# Teste de carga acelerado (Fase 6) — 2026-11-01T06:02:22.857Z

Comando: `pnpm carga 864` (Supabase local, fonte mock, cron ligado em paralelo).

## Parte real: 864 rodadas × 2 `vigiar` concorrentes, 10 perfis

| Métrica | Valor |
|---|---|
| Posts novos publicados no mock | 374 |
| Vídeos alertados | 374 |
| Posts não detectados | 0  |
| Alertas indevidos (fixado/antigo/baseline) | 0  |
| Vídeos duplicados | 0 |
| Jobs de IA duplicados / faltando | 0 / 0 |
| Alertas criados / esperados (vídeos × dispositivos) | 374 / 374 |
| Alertas duplicados | 0 |
| Latência de detecção p50 / p95 (mock) | 97 ms / 201 ms |

## Parte virtual: 24 h de agendamento (funções de produção)

| Métrica | Valor |
|---|---|
| Requisições no dia (simulado, com jitter) | 26.975 |
| Requisições no dia (fórmula 3.3) | 27.000 |
| Orçamento por dia (810 mil / 30) | 27.000 |

**Resultado: ✅ zero duplicatas, nenhum post perdido, dentro do orçamento**
