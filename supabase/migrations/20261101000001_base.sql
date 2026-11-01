-- 0001_base.sql — esquema base do Vizualizer (seção 4 do PLANO-VIZUALIZER.md)
-- Aplicado SOMENTE no Supabase local nesta noite. Cloud: revisão do Matheus.

create table perfis (
  id uuid primary key default gen_random_uuid(),
  username text not null unique,
  nome_exibicao text,
  avatar_url text,
  ativo boolean not null default true,
  intervalo_quente_s int not null default 10,
  intervalo_frio_s int not null default 120,
  janelas_manuais jsonb not null default '[]',
  janelas_aprendidas jsonb not null default '[]',
  baseline_feito boolean not null default false,
  monitorado_desde timestamptz not null default now(),
  ultimo_check_em timestamptz,
  proximo_check_em timestamptz not null default now(),
  ultimo_video_em timestamptz,
  erros_seguidos int not null default 0,
  criado_em timestamptz not null default now()
);

create table videos (
  id uuid primary key default gen_random_uuid(),
  perfil_id uuid not null references perfis(id) on delete cascade,
  shortcode text not null,
  tipo text not null,
  eh_reels boolean not null default false,
  publicado_em timestamptz not null,
  detectado_em timestamptz not null default now(),
  latencia_ms bigint generated always as ((extract(epoch from (detectado_em - publicado_em)) * 1000)::bigint) stored, -- bigint: post fixado antigo passa de 24 dias em ms
  legenda text,
  permalink text not null,
  url_thumb text,
  url_video text,                         -- URL do CDN (expira) para o baixar-video
  storage_path text,
  status text not null default 'novo',
  resumo text,
  resumo_tags text[],
  ja_visto_no_baseline boolean not null default false,
  unique (perfil_id, shortcode)
);
create index videos_detectado_em_idx on videos (detectado_em desc);

create table checagens (
  id bigint generated always as identity primary key,
  perfil_id uuid references perfis(id) on delete cascade,
  fonte text not null,
  ok boolean not null,
  duracao_ms int,
  erro text,
  criado_em timestamptz not null default now()
);
create index checagens_criado_em_idx on checagens (criado_em desc);

create table dispositivos (
  id uuid primary key default gen_random_uuid(),
  usuario_id uuid references auth.users(id) on delete cascade, -- null = dispositivo do sistema (ex.: WhatsApp de teste)
  tipo text not null check (tipo in ('web_push','expo','whatsapp')),
  destino jsonb not null,
  ativo boolean not null default true,
  criado_em timestamptz not null default now()
);

create table notificacoes (
  id bigint generated always as identity primary key,
  video_id uuid not null references videos(id) on delete cascade,
  dispositivo_id uuid references dispositivos(id) on delete cascade,
  tipo_msg text not null check (tipo_msg in ('alerta','resumo')),
  status text not null default 'pendente' check (status in ('pendente','enviado','falhou')),
  tentativas int not null default 0,
  proxima_tentativa_em timestamptz not null default now(),
  erro text,
  enviado_em timestamptz,
  criado_em timestamptz not null default now()
);
create index notificacoes_pendentes_idx on notificacoes (proxima_tentativa_em) where status = 'pendente';

create table jobs_ia (
  id bigint generated always as identity primary key,
  video_id uuid not null unique references videos(id) on delete cascade,
  status text not null default 'pendente' check (status in ('pendente','processando','feito','falhou')),
  tentativas int not null default 0,
  pego_em timestamptz,
  erro text,
  criado_em timestamptz not null default now()
);

create table config (
  chave text primary key,
  valor jsonb not null
);

-- ---------------------------------------------------------------- RLS
-- Painel single-tenant: qualquer usuário autenticado lê; escreve só onde o painel precisa.
-- Edge Functions e worker usam service role (ignora RLS).
alter table perfis enable row level security;
alter table videos enable row level security;
alter table checagens enable row level security;
alter table dispositivos enable row level security;
alter table notificacoes enable row level security;
alter table jobs_ia enable row level security;
alter table config enable row level security;

create policy "autenticado lê perfis" on perfis for select to authenticated using (true);
create policy "autenticado gerencia perfis" on perfis for all to authenticated using (true) with check (true);
create policy "autenticado lê videos" on videos for select to authenticated using (true);
create policy "autenticado atualiza status do video" on videos for update to authenticated using (true) with check (true);
-- Painel só altera `status` (url_video/storage_path ficam com o service role: evita SSRF no baixar-video).
revoke update on videos from authenticated;
grant update (status) on videos to authenticated;
create policy "autenticado lê checagens" on checagens for select to authenticated using (true);
create policy "dono gerencia dispositivos" on dispositivos for all to authenticated
  using (usuario_id = auth.uid()) with check (usuario_id = auth.uid());
create policy "autenticado lê notificacoes" on notificacoes for select to authenticated using (true);
create policy "autenticado lê jobs_ia" on jobs_ia for select to authenticated using (true);
create policy "autenticado lê config" on config for select to authenticated using (true);

-- ---------------------------------------------------------------- Realtime
alter publication supabase_realtime add table videos, perfis, jobs_ia;

-- ---------------------------------------------------------------- RPCs

-- Pega perfis vencidos e "arrenda" por 60 s para ticks concorrentes não pegarem o mesmo.
create or replace function pegar_perfis_vencidos(lim int default 10)
returns setof perfis
language sql
security definer
set search_path = public
as $$
  update perfis p
     set proximo_check_em = now() + interval '60 seconds'
   where p.id in (
     select id from perfis
      where ativo and proximo_check_em <= now()
      order by proximo_check_em
      limit lim
      for update skip locked
   )
  returning p.*;
$$;

-- Registra posts já classificados pelas regras puras (packages/shared).
-- posts: [{shortcode,tipo,eh_reels,publicado_em,legenda,permalink,url_thumb,url_video,alertar}]
-- Idempotente: só quem de fato inseriu enfileira notificação/job (regra 3.2.2).
create or replace function registrar_posts(p_perfil uuid, posts jsonb, p_baseline boolean)
returns table (video_id uuid, shortcode text, alertar boolean)
language plpgsql
security definer
set search_path = public
as $$
#variable_conflict use_column
declare
  r record;
  v_id uuid;
begin
  for r in select * from jsonb_to_recordset(posts) as x(
    shortcode text, tipo text, eh_reels boolean, publicado_em timestamptz, legenda text,
    permalink text, url_thumb text, url_video text, alertar boolean)
  loop
    insert into videos (perfil_id, shortcode, tipo, eh_reels, publicado_em, legenda, permalink,
                        url_thumb, url_video, ja_visto_no_baseline, status)
    values (p_perfil, r.shortcode, r.tipo, coalesce(r.eh_reels, false), r.publicado_em, r.legenda,
            r.permalink, r.url_thumb, r.url_video, p_baseline or not coalesce(r.alertar, false),
            case when p_baseline or not coalesce(r.alertar, false) then 'ignorado' else 'novo' end)
    on conflict (perfil_id, shortcode) do nothing
    returning id into v_id;

    if v_id is not null and not p_baseline and coalesce(r.alertar, false) then
      insert into notificacoes (video_id, dispositivo_id, tipo_msg)
        select v_id, d.id, 'alerta' from dispositivos d where d.ativo;
      insert into jobs_ia (video_id) values (v_id);
      update perfis set ultimo_video_em = greatest(coalesce(ultimo_video_em, r.publicado_em), r.publicado_em)
       where id = p_perfil;
      video_id := v_id; shortcode := r.shortcode; alertar := true;
      return next;
    end if;
    v_id := null;
  end loop;
  if p_baseline then
    update perfis set baseline_feito = true where id = p_perfil;
  end if;
end;
$$;

-- Fila do worker de IA: pega 1 job com SKIP LOCKED. Reaproveita jobs "processando" travados > 10 min.
create or replace function pegar_job_ia()
returns setof jobs_ia
language sql
security definer
set search_path = public
as $$
  update jobs_ia j
     set status = 'processando', pego_em = now(), tentativas = j.tentativas + 1
   where j.id = (
     select id from jobs_ia
      where tentativas < 3
        and (status = 'pendente' or (status = 'processando' and pego_em < now() - interval '10 minutes'))
      order by criado_em
      limit 1
      for update skip locked
   )
  returning j.*;
$$;

-- Fila de notificações: pega lote pendente com SKIP LOCKED.
create or replace function pegar_notificacoes(lim int default 20)
returns setof notificacoes
language sql
security definer
set search_path = public
as $$
  update notificacoes n
     set tentativas = n.tentativas + 1,
         proxima_tentativa_em = now() + interval '30 seconds'  -- arrendamento enquanto envia
   where n.id in (
     select id from notificacoes
      where status = 'pendente' and proxima_tentativa_em <= now()
      order by id
      limit lim
      for update skip locked
   )
  returning n.*;
$$;

create or replace function estatisticas_painel()
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select jsonb_build_object(
    'latencia_media_ms', (select avg(latencia_ms)::int from videos where not ja_visto_no_baseline and detectado_em > now() - interval '7 days'),
    'latencia_p95_ms', (select percentile_cont(0.95) within group (order by latencia_ms)::int from videos where not ja_visto_no_baseline and detectado_em > now() - interval '7 days'),
    'videos_24h', (select count(*) from videos where not ja_visto_no_baseline and detectado_em > now() - interval '24 hours'),
    'checagens_24h', (select count(*) from checagens where criado_em > now() - interval '24 hours'),
    'erros_24h', (select count(*) from checagens where not ok and criado_em > now() - interval '24 hours'),
    'checagens_mes', (select count(*) from checagens where criado_em > date_trunc('month', now())),
    'por_fonte', (select coalesce(jsonb_object_agg(fonte, n), '{}') from (select fonte, count(*) n from checagens where criado_em > now() - interval '24 hours' group by fonte) s),
    'fila_ia', (select count(*) from jobs_ia where status in ('pendente','processando')),
    'worker_ia_batimento', (select valor from config where chave = 'worker_ia_batimento'),
    'vigiar_batimento', (select valor from config where chave = 'vigiar_batimento'),
    'orcamento_requisicoes_mes', (select valor from config where chave = 'orcamento_requisicoes_mes')
  );
$$;

revoke execute on function pegar_perfis_vencidos(int), registrar_posts(uuid, jsonb, boolean),
  pegar_job_ia(), pegar_notificacoes(int) from public, anon, authenticated;
revoke execute on function estatisticas_painel() from public, anon;
grant execute on function estatisticas_painel() to authenticated;

insert into config (chave, valor) values
  ('orcamento_requisicoes_mes', '810000'),
  ('carrossel_com_video_alerta', 'false');
