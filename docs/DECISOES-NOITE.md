# Decisões da noite (modo autônomo)

| # | Decisão | Alternativas | Motivo |
|---|---|---|---|
| 1 | Branch `noite/mvp`, `git init` na raiz | trabalhar sem git | Exigido pelas regras; a pasta não era repositório |
| 2 | Fase 0 só com pesquisa + fixtures sintéticas | gerar chave/conta | Proibido criar contas/chaves; `.env` não existe |
| 3 | Preço por req em faixa (US$ 0,001–0,00188) | escolher um | Fontes divergem; sem página oficial verificada |
| 4 | Perfil Econômico = 24 h a 300 s | 120 s | Plano diz frio de 2–5 min; usei o extremo para contraste |
| 5 | `pnpm` ausente → usar `corepack pnpm` (ou `npx pnpm`) | instalar pnpm global | Instalação global pode pedir admin |
| 6 | Supabase CLI ausente → `npx supabase` dentro do projeto | scoop/winget | Evita instalar fora do projeto |
| 7 | Supabase local nas portas 564xx | parar outro projeto | 54323 recusado pelo Docker; não mexer em outros projetos |
| 8 | Regras puras em `supabase/functions/_shared/regras/`, reexportadas por `packages/shared` | código em packages/shared + import map | Edge runtime local só enxerga `supabase/functions`; evita duplicar |
| 9 | Dedupe + enfileiramento numa RPC `registrar_posts` (transação no banco) | lógica no TS | Idempotência atômica com ticks sobrepostos |
| 10 | `pegar_perfis_vencidos` arrenda o perfil por 60 s | só SKIP LOCKED | SKIP LOCKED solta o lock no fim do UPDATE; o arrendamento evita o 2º tick pegar o mesmo |
| 11 | Mock lê posts da tabela `config` (`mock:<username>`) | ler arquivos | Edge Function não acessa `fixtures/`; `pnpm simular` injeta posts ali |
| 12 | Alerta sai sem link de download se o vídeo ainda não baixou; o link vai sempre na 2ª mensagem (resumo) | esperar o download | Regra de ouro: alerta nunca espera download |
| 13 | WhatsApp com trava por lista (`WHATSAPP_NUMERO_TESTE`); fora dela, simulado | confiar no cadastro | Limite rígido da noite + evita envio acidental |
| 14 | `latencia_ms` virou `bigint` | int | Post fixado antigo estoura int em ms (bug achado no `pnpm simular`) |
| 15 | Web Push com `npm:web-push@3.6.7` no Deno | lib JSR | Lib madura, conferida no Context7; validar em runtime quando houver VAPID |
| 16 | Endpoints HikerAPI (`/v1/user/by/username`, `/gql/user/medias`) da doc via Context7, campos não validados | — | Sem chave; TODO no adapter |
