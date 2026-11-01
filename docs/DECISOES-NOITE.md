# Decisões da noite (modo autônomo)

| # | Decisão | Alternativas | Motivo |
|---|---|---|---|
| 1 | Branch `noite/mvp`, `git init` na raiz | trabalhar sem git | Exigido pelas regras; a pasta não era repositório |
| 2 | Fase 0 só com pesquisa + fixtures sintéticas | gerar chave/conta | Proibido criar contas/chaves; `.env` não existe |
| 3 | Preço por req em faixa (US$ 0,001–0,00188) | escolher um | Fontes divergem; sem página oficial verificada |
| 4 | Perfil Econômico = 24 h a 300 s | 120 s | Plano diz frio de 2–5 min; usei o extremo para contraste |
| 5 | `pnpm` ausente → usar `corepack pnpm` (ou `npx pnpm`) | instalar pnpm global | Instalação global pode pedir admin |
| 6 | Supabase CLI ausente → `npx supabase` dentro do projeto | scoop/winget | Evita instalar fora do projeto |
