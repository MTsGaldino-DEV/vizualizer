-- 0005 — heartbeat (Fase 6): robô sem sucesso por > 2 min → aviso ao admin, no máximo a cada 30 min.

create or replace function verificar_batimento()
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_ultimo timestamptz := ((select valor from config where chave = 'vigiar_batimento') ->> 'em')::timestamptz;
  v_avisado timestamptz := ((select valor from config where chave = 'alerta_vigiar_parado') ->> 'em')::timestamptz;
begin
  if v_ultimo is null or v_ultimo > now() - interval '2 minutes' then
    return 'ok';
  end if;
  if v_avisado is not null and v_avisado > now() - interval '30 minutes' then
    return 'ja_avisado';
  end if;
  insert into config (chave, valor) values ('alerta_vigiar_parado', jsonb_build_object('em', now()))
  on conflict (chave) do update set valor = excluded.valor;
  perform chamar_funcao('notificar', jsonb_build_object(
    'sistema', format('O robô de vigia está sem checagens com sucesso desde %s. Veja a tela Saúde.',
                      to_char(v_ultimo at time zone 'America/Sao_Paulo', 'HH24:MI'))));
  return 'avisado';
end;
$$;
revoke execute on function verificar_batimento() from public, anon, authenticated;

select cron.schedule('verificar-batimento', '* * * * *', $$ select verificar_batimento() $$);
