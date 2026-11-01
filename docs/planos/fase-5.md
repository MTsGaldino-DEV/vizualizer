# Fase 5 — Worker de IA local: Plano

> Spec: PLANO-VIZUALIZER.md seção 5. TDD no orquestrador (dependências injetadas).

1. `src/ia.ts`: `MotorIA` (`descreverQuadros`, `resumir`), `criarMotorOllama` (`/api/chat`, `format` = JSON schema, `think:false`, visão com `keep_alive:0` para liberar VRAM), `motorMock`, `validarResumo` (zod + normalização de tags).
2. `src/midia.ts`: ffprobe/ffmpeg (5 quadros no meio de cada fatia + WAV 16 kHz mono), `transcrever` com whisper-cli (desliga sem binário).
3. `src/pipeline.ts`: `processarProximo(repo, motor, midia)` → vazio | feito | falhou; 3ª falha é definitiva; limpa temporários sempre.
4. `src/index.ts`: Realtime em `jobs_ia`/`videos` + polling 30 s, batimento em `config.worker_ia_batimento`, enfileira notificação `resumo` e chama `notificar`.
5. `src/benchmark.ts` → `docs/benchmark-ia.md`.
6. `scripts/worker-ia-tarefa.ps1`: tarefa agendada no logon (não registrada esta noite).
