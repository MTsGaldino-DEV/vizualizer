# Fase 2 — Motor de detecção: Plano

> Executar com superpowers:test-driven-development. Spec: PLANO-VIZUALIZER.md 3.2, 3.3.

**Meta:** regras puras testadas + Edge Function `vigiar` + Cron 10 s, ponta a ponta com o adapter mock.

## Tarefas
1. `packages/shared/src/deteccao.ts` — `classificarPosts(posts, ctx)`, `latenciaMs`. Testes: baseline não alerta; só vídeo; carrossel configurável (via `urlVideo`); post antigo (< monitoradoDesde ou > 24 h) ignorado; fixado antigo no topo não alerta e post novo abaixo dele alerta.
2. `packages/shared/src/agendamento.ts` — `estaEmJanela`, `proximoCheck` (quente/frio, jitter ±20 %), `aprenderJanelas`, `fatorOrcamento`, `custoMensal`, `avaliarCircuito`. Fuso America/Sao_Paulo; dow ISO 1=segunda … 7=domingo.
3. Dedupe/idempotência: RPC `registrar_posts` (ON CONFLICT DO NOTHING) — teste de integração no banco local com chamadas concorrentes.
4. Adapters em `supabase/functions/_shared/fontes/`: `mock` (fixtures + postagens simuladas), `provedor` (HikerAPI, sem chave → erro claro), `business-discovery` (Graph API, sem token → erro claro).
5. Edge Function `vigiar` + migration do Cron (pg_cron + pg_net, 10 s) + batimento em `config`.
6. Circuit breaker + fallback de fonte no `vigiar`.

## Foco de revisão
- Tick sobreposto → sem duplicata (arrendamento + UNIQUE).
- Fonte devolve erro → `checagens.ok=false`, `erros_seguidos++`, perfil reagendado.
- `publicadoEm` no futuro (relógio do provedor) → latência clamp em 0.
