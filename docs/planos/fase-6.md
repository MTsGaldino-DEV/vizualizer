# Fase 6 — Robustez e observabilidade: Plano

1. Heartbeat: `vigiar` grava `vigiar_batimento` só em tick com sucesso; `verificar_batimento()` (cron 1 min) avisa o admin após 2 min, no máximo 1 vez a cada 30 min (`notificar` com `{sistema}`).
2. Status do worker IA no painel (batimento < 90 s) — feito na Fase 4/5.
3. `pnpm carga N`: 10 perfis mock, N rodadas × 2 `vigiar` concorrentes + cron; parte virtual de 24 h com as funções de agendamento de produção → `docs/carga.md`.
4. Segurança: `exigirServico()` nas funções, revisão em `docs/seguranca.md`.
