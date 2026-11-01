-- 0003 — bucket temporário de vídeos, tentativas de download e fila de IA que espera o download.

insert into storage.buckets (id, name, public, file_size_limit)
values ('videos-temp', 'videos-temp', false, 104857600) -- 100 MB por arquivo
on conflict (id) do nothing;

alter table videos add column download_tentativas int not null default 0;
alter table videos add column download_erro text;

-- O worker só pega job cujo vídeo já foi baixado, ou cujo download desistiu
-- (3 tentativas / sem URL) — nesse caso resume só com legenda + thumb.
create or replace function pegar_job_ia()
returns setof jobs_ia
language sql
security definer
set search_path = public
as $$
  update jobs_ia j
     set status = 'processando', pego_em = now(), tentativas = j.tentativas + 1
   where j.id = (
     select q.id from jobs_ia q
       join videos v on v.id = q.video_id
      where q.tentativas < 3
        and (q.status = 'pendente' or (q.status = 'processando' and q.pego_em < now() - interval '10 minutes'))
        and (v.storage_path is not null or v.download_tentativas >= 3 or v.url_video is null)
      order by q.criado_em
      limit 1
      for update of q skip locked
   )
  returning j.*;
$$;
revoke execute on function pegar_job_ia() from public, anon, authenticated;

-- Limpeza do bucket (> 48 h) roda dentro da função baixar-video com ?limpar=1 (API de Storage remove o arquivo de fato).
select cron.schedule('limpar-videos-temp', '15 4 * * *', $$ select chamar_funcao('baixar-video', '{"limpar": true}') $$);
