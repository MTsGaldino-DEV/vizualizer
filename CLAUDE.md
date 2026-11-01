# Vizualizer

> Memória do projeto para o Claude Code. Fonte da verdade: `PLANO-VIZUALIZER.md` — todo trabalho começa lendo esse arquivo.

## Regras do projeto

- Idioma: **PT-BR** em código de negócio, UI, commits e docs.
- **Commits em PT-BR**, pequenos, um por etapa concluída.
- **Windows + PowerShell**: nunca sintaxe bash nos comandos passados ao Matheus.
- **SQL é manual**: escrever a migration em `supabase/migrations/` e **parar** para revisão; nunca aplicar sozinho.
- **Passo a passo com confirmação** entre etapas (parar em cada checkpoint).
- Antes de usar API externa: consultar Context7 / documentação oficial (limites e assinaturas mudam).
- Segredos só em `.env` / Supabase Vault; nunca no repositório.
- Ao terminar uma fase: atualizar a seção 14 (Registro de decisões) do `PLANO-VIZUALIZER.md`.

## Diretrizes de comportamento

1. **Pensar antes de codar** — declarar suposições; se houver mais de uma interpretação, apresentar em vez de escolher em silêncio; se algo estiver realmente obscuro, parar e perguntar.
2. **Simplicidade primeiro** — o mínimo de código que resolve. Sem funcionalidade especulativa, sem abstração de uso único, sem configuração não pedida.
3. **Mudanças conservadoras e com escopo** — tocar só no que o pedido exige. Não refatorar, reformatar nem "melhorar" código adjacente.
4. **Execução orientada a metas** — transformar tarefas em metas verificáveis (teste que reproduz → fazer passar). Em trabalho de várias etapas, declarar plano curto com verificação por etapa.
5. **Orquestrador, não implementador** — a sessão principal planeja e coordena; implementação e análise delegáveis vão para subagente especialista, em paralelo quando o escopo não conflita.

## Stack

TypeScript em tudo · pnpm workspaces · Next.js (App Router) + Tailwind + shadcn/ui (painel → Vercel) · Supabase (Postgres, Auth, Realtime, Storage, Edge Functions Deno, Cron) · Node/TS (worker-ia) · Vitest · Ollama + whisper.cpp + ffmpeg (local).

## Comandos canônicos

Usar exatamente estes (PowerShell). Preencher conforme a Fase 1 criar o monorepo.

- **Instalar:** `pnpm install`
- **Lint:** `pnpm lint`
- **Typecheck:** `pnpm typecheck`
- **Teste:** `pnpm test`
- **Build:** `pnpm build`
- **Dev:** `pnpm dev` (painel) · `supabase start` (banco local)

## Roteamento de agentes

| Agente | Quando usar |
|---|---|
| `feature-dev:code-architect` | Desenhar arquitetura de feature/fase antes de codar |
| `feature-dev:code-reviewer` / `pr-review-toolkit:code-reviewer` | Revisar código após editar arquivos-fonte |
| `pr-review-toolkit:silent-failure-hunter` | Revisar tratamento de erro em adapters, notificações, worker |
| `general-purpose` | Implementação de partes independentes (adapters, telas) em paralelo |
| `Explore` | Busca ampla no código |

## Convenções

- Regras de detecção ficam em `packages/shared` como **funções puras**, testadas com Vitest (TDD) e importadas pelas Edge Functions.
- Envio de notificação sempre atrás da interface `CanalNotificacao`; fontes de dados atrás de `FonteInstagram` (Adapter).
- O alerta **nunca espera** download nem IA: detectar → alertar → baixar → resumir.
- Nunca usar login automatizado no Instagram (instagrapi etc.).
- Identidade visual: tokens da seção 7.1 do plano; não redesenhar o mascote à mão (usar `assets/marca/`).
- UI do painel: componentes shadcn/ui em `apps/painel/components/ui/` (adicionar com `npx shadcn@4.23.0 add <nome>` dentro de `apps/painel`). As variáveis do shadcn em `globals.css` apontam para os tokens `--viz-*`; não trocar por cores soltas. Botões da marca: `size="marca"`; dentro do card lima: `variant="tinta"`.
