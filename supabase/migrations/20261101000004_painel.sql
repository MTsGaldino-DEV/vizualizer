-- 0004 — necessidades do painel: leitura do bucket e teste de envio.

-- Usuário autenticado pode gerar signed URL / baixar do bucket temporário.
create policy "autenticado lê videos-temp" on storage.objects for select to authenticated
  using (bucket_id = 'videos-temp');

-- Teste de envio: enfileira um alerta do vídeo mais recente para um dispositivo do próprio usuário
-- (ou do sistema, usuario_id nulo). Devolve o id da notificação.
create or replace function testar_dispositivo(p_disp uuid)
returns bigint
language plpgsql
security definer
set search_path = public
as $$
declare
  v_video uuid;
  v_id bigint;
begin
  if not exists (select 1 from dispositivos where id = p_disp and (usuario_id = auth.uid() or usuario_id is null)) then
    raise exception 'dispositivo não encontrado';
  end if;
  select id into v_video from videos order by detectado_em desc limit 1;
  if v_video is null then
    raise exception 'ainda não há vídeo para usar no teste';
  end if;
  insert into notificacoes (video_id, dispositivo_id, tipo_msg) values (v_video, p_disp, 'alerta') returning id into v_id;
  return v_id;
end;
$$;
revoke execute on function testar_dispositivo(uuid) from public, anon;
grant execute on function testar_dispositivo(uuid) to authenticated;

-- Painel também lista dispositivos do sistema (WhatsApp de teste, usuario_id nulo).
create policy "autenticado lê dispositivos do sistema" on dispositivos for select to authenticated
  using (usuario_id is null);
