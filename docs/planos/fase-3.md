# Fase 3 — Notificações: Plano

> Spec: PLANO-VIZUALIZER.md 6.1–6.3. TDD nas partes puras (mensagens, backoff, trava do WhatsApp).

1. `_shared/canais/tipos.ts`: `CanalNotificacao`, `montarMensagem`, `textoWhatsApp`, `backoffS` (10/40/90 s), `MAX_TENTATIVAS=3`.
2. `whatsapp.ts` (Evolution `POST /message/sendText/{instancia}`, header `apikey`) com **trava**: só números em `WHATSAPP_NUMERO_TESTE`; fora disso, simulado.
3. `webpush.ts` (`npm:web-push@3.6.7`, VAPID; 404/410 desativa dispositivo); `expo.ts` stub.
4. RPC `pegar_notificacoes` (SKIP LOCKED + arrendamento 30 s) e Edge Function `notificar` (allSettled por dispositivo).
5. Migration 0003: bucket `videos-temp`, `download_tentativas`, `pegar_job_ia` espera download; Edge Function `baixar-video` (+ `?limpar` > 48 h).
6. `pnpm simular` ponta a ponta.

Foco de revisão: número fora da lista nunca chamado; canal com erro não bloqueia outro; vídeo sem URL não trava o job de IA.
