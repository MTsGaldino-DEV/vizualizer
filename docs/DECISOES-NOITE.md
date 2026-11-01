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
| 17 | Cadastro público desligado no Auth; usuário criado por `pnpm criar-usuario` | signup aberto | Revisão: qualquer cadastro viraria `authenticated` com acesso total |
| 18 | Painel só pode alterar `videos.status` (privilégio por coluna) | RPC | Revisão: evita SSRF via `url_video` no baixar-video |
| 19 | Fila de download com `pegar_downloads` (SKIP LOCKED + arrendamento 2 min) | — | Revisão: cron e disparo do vigiar baixavam em dobro |
| 20 | Erro de fonte → backoff 20/40/80…300 s por perfil | intervalo normal | Revisão: erro persistente gastava orçamento a cada 10 s |
| 21 | Posts malformados descartados antes do RPC (`separarValidos`) | — | Revisão: 1 post ruim fazia rollback do lote e travava alertas do perfil |
| 22 | Circuit breaker com estado em `config` sem controle de concorrência | RPC atômica | Aceitável no MVP (ticks raramente se sobrepõem); revisitar na Fase 6 |
| 23 | Testes de integração só com `pnpm test:integracao` | rodar sempre | Criam linhas no banco local e podem disparar o notificar do cron |
| 24 | ~~Sem shadcn/ui~~ **Revisto em 2026-11-01 (dia):** shadcn/ui integrado (ver #36) | — | Na noite o MCP do shadcn não estava disponível |
| 25 | Chaves VAPID geradas localmente (web-push CLI) em `.env` ignorados | não gerar | Não é serviço externo; permite testar push de verdade no local |
| 26 | `[auth.email] enable_signup` fica `true` (o global é `false`) | ambos false | O flag de e-mail desliga o login por e-mail inteiro (achado ao testar) |
| 27 | Screenshots com Playwright usando o Chrome instalado (`channel: chrome`) | baixar Chromium | Download iria para fora da pasta do projeto |
| 28 | Não baixar modelos do Ollama nem whisper.cpp | `ollama pull` / baixar binário | Gravariam fora da pasta do projeto (limite rígido); worker funciona sem eles |
| 29 | Texto com `qwen3:8b` (`think:false`) | outro modelo | Único instalado; resumo coerente em 3–4 s com modelo quente |
| 30 | Tarefa agendada do worker só como script (`scripts/worker-ia-tarefa.ps1`), não registrada | registrar | Alteraria o sistema fora do projeto |
| 31 | Edge Functions exigem a service key (`exigirServico`) | só verify_jwt | A anon key é pública; com ela qualquer um chamaria `vigiar` e queimaria orçamento |
| 32 | Aviso de "robô parado" vai direto (sem fila) a todos os dispositivos | tabela de alertas de sistema | `notificacoes.video_id` é obrigatório; aviso de sistema é raro |
| 33 | Teste de carga "24 h" = 864 rodadas reais (2 ticks concorrentes cada) + 24 h de agendamento em relógio virtual | rodar 24 h de verdade | Exigência de versão acelerada |
| 34 | Fila de IA pega o vídeo **mais recente primeiro** | FIFO | Com fila acumulada (PC desligado, carga), o vídeo novo esperava ~290 jobs velhos |
| 35 | Scripts raiz usam `corepack pnpm`/`tsc` direto | exigir pnpm global | `pnpm` não está no PATH; o typecheck do painel nem rodava pelo script raiz (achado na verificação final) |
| 36 | shadcn/ui (`radix-nova`) no painel; variáveis semânticas (`--primary`, `--ring`…) apontam para os tokens `--viz-*`; só tema escuro (classe `dark` fixa) | tema neutro padrão | Fidelidade à seção 7.1; componentes são código nosso, customizados à marca |
| 37 | Botão ganhou tamanhos `marca`/`marca-sm` e variante `tinta`; Input 48 px com fonte 16 px; chips com raio 4 px | usar os padrões do shadcn | Seção 7.1 (botões Bold 16, cantos 14 px, chips 4 px); 16 px evita zoom do iOS |
| 38 | Servidor MCP do shadcn em `.mcp.json` fixado em `shadcn@4.23.0` com `--cwd apps/painel` | `shadcn@latest` na raiz | Versão reproduzível; o `components.json` está no painel |
| 39 | `allowBuilds: esbuild` no `pnpm-workspace.yaml` | desligar a checagem de builds | O pnpm 12 abortava instalações (inclusive a do shadcn) por ignorar o build do esbuild; aprova só ele |
| 40 | `gemma3:4b` para visão **e** texto no worker | `gemma3:4b` + `qwen3:8b` | Pedido do Matheus; 49 s x 71 s a frio, ~9 s quente, um modelo só na VRAM |
| 41 | Fonte principal do robô continua `mock` mesmo com a chave da ScrapeCreators | ligar já | 1 crédito por checagem: 98 créditos acabam em ~16 min com 1 perfil a 10 s; latência medida ~12 s > tick de 10 s |
