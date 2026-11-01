-- 0003 — bucket temporário de vídeos, fila de download com arrendamento e fila de IA que espera o download.

insert into storage.buckets (id, name, public, file_size_limit)
values ('videos-temp', 'videos-temp', false, 104857600) -- 100 MB por arquivo
on conflict (id) do nothing;

alter table videos add column download_tentativas int not null default 0;
alter table videos add column download_erro text;
alter table videos add column download_pego_em timestamptz;

-- Fila de download: SKIP LOCKED + arrendamento de 2 min (cron e disparo do vigiar podem rodar juntos).
-- A tentativa é contada aqui, atomicamente.
create or replace function pegar_downloads(lim int default 5)
returns setof videos
language sql
security definer
set search_path = public
as $$
  update videos v
     set download_pego_em = now(), download_tentativas = v.download_tentativas + 1
   where v.id in (
     select id from videos
      where storage_path is null
        and url_video is not null
        and not ja_visto_no_baseline
        and download_tentativas < 3
        and detectado_em > now() - interval '24 hours'  -- URL do CDN já expirou; e não rebaixa o que a limpeza apagou
        and (download_pego_em is null or download_pego_em < now() - interval '2 minutes')
      order by detectado_em desc
      limit lim
      for update skip locked
   )
  returning v.*;
$$;

-- O worker só pega job cujo vídeo já foi baixado, ou cujo download desistiu
-- (3 tentativas / sem URL) — nesse caso resume só com legenda + thumb.
-- Antes, encerra como 'falhou' jobs que esgotaram as tentativas presos em 'processando' (worker morreu).
create or replace function pegar_job_ia()
returns setof jobs_ia
language sql
security definer
set search_path = public
as $$
  update jobs_ia set status = 'falhou', erro = coalesce(erro, 'tentativas esgotadas')
   where status = 'processando' and tentativas >= 3 and pego_em < now() - interval '10 minutes';

  update jobs_ia j
     set status = 'processando', pego_em = now(), tentativas = j.tentativas + 1
   where j.id = (
     select q.id from jobs_ia q
       join videos v on v.id = q.video_id
      where q.tentativas < 3
        and (q.status = 'pendente' or (q.status = 'processando' and q.pego_em < now() - interval '10 minutes'))
        and (v.storage_path is not null or v.download_tentativas >= 3 or v.url_video is null)
      order by q.criado_em desc  -- mais recente primeiro: com fila acumulada (PC desligado), o vídeo novo não espera os velhos
      limit 1
      for update of q skip locked
   )
  returning j.*;
$$;
revoke execute on function pegar_job_ia(), pegar_downloads(int) from public, anon, authenticated;

-- Limpeza do bucket (> 48 h) roda dentro da função baixar-video com {"limpar": true}
-- (a API de Storage remove o arquivo de fato).
select cron.schedule('limpar-videos-temp', '15 4 * * *', $$ select chamar_funcao('baixar-video', '{"limpar": true}') $$);
