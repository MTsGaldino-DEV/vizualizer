-- 0002_cron.sql — agendamento do robô (Supabase Cron = pg_cron + pg_net).
-- URL e chave das funções vêm do Vault (secrets `project_url` e `service_role_key`), nunca do repositório.
-- Local: criados pelo supabase/seed.sql com a chave demo pública do CLI. Cloud: criar manualmente (runbook).

create extension if not exists pg_cron;
create extension if not exists pg_net;

create or replace function chamar_funcao(nome text, corpo jsonb default '{}')
returns bigint
language plpgsql
security definer
set search_path = public
as $$
declare
  v_url text := (select decrypted_secret from vault.decrypted_secrets where name = 'project_url');
  v_chave text := (select decrypted_secret from vault.decrypted_secrets where name = 'service_role_key');
begin
  if v_url is null or v_chave is null then
    raise notice 'chamar_funcao(%): secrets do Vault ausentes, ignorando', nome;
    return null;
  end if;
  return net.http_post(
    url := v_url || '/functions/v1/' || nome,
    headers := jsonb_build_object('Content-Type', 'application/json', 'Authorization', 'Bearer ' || v_chave),
    body := corpo,
    timeout_milliseconds := 20000
  );
end;
$$;
revoke execute on function chamar_funcao(text, jsonb) from public, anon, authenticated;

-- Tick do robô.
select cron.schedule('vigiar', '10 seconds', $$ select chamar_funcao('vigiar') $$);
-- Rede de segurança da fila de notificações (retries com backoff) e do download.
select cron.schedule('notificar', '15 seconds', $$ select chamar_funcao('notificar') $$);
select cron.schedule('baixar-video', '30 seconds', $$ select chamar_funcao('baixar-video') $$);

-- Retenção diária (03:30 UTC): checagens > 30 dias, histórico do cron e respostas do pg_net.
select cron.schedule('retencao', '30 3 * * *', $$
  delete from checagens where criado_em < now() - interval '30 days';
  delete from cron.job_run_details where end_time < now() - interval '2 days';
  delete from net._http_response where created < now() - interval '1 day';
$$);
