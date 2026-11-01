# Progresso (modo noturno)

Ambiente: Node 24, Docker 29 ok, Ollama com `qwen3:8b` (visão não instalada), ffmpeg ok, pnpm e Supabase CLI ausentes, sem `.env`.

## Fase 0 — Spike de fontes
- ✅ Pesquisa de provedores e tabela de custo → `docs/spike-fontes.md`
- ✅ Fixtures sintéticas → `fixtures/ig/`
- ❌ Medição real (sem `PROVEDOR_IG_API_KEY`) — bloqueio B1
- ❌ Aceite p95 frescor ≤ 30 s / latência ≤ 3 s — não verificado

Próximo: Fase 1 (monorepo, `supabase init`, migration `0001_base.sql`).

## Bloqueios
- B1: chave de provedor de IG (HikerAPI/ScrapeCreators) para medir.
