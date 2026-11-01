# Relatório da noite — Vizualizer (2026-11-01)

Branch `noite/mvp`, 11 commits, nenhum `git push`, nenhum deploy. Tudo rodou no Supabase **local** (Docker).

## 1. Estado em 5 linhas

1. O robô funciona ponta a ponta com a fonte mock. Um post simulado vira vídeo detectado em ~70 ms, alerta enviado (canal simulado) em ~1 s, vídeo baixado e resumo de IA real gravado em ~22 s.
2. Há zero duplicatas no teste de carga acelerado: 864 rodadas com 2 ticks concorrentes e o cron em paralelo, 374 de 374 posts detectados, 374 alertas e 374 jobs.
3. O painel tem a identidade Vizualizer (radar, card lima, 6 telas). Ele atualiza em tempo real, é um PWA com push e o login é por link mágico. Screenshots em `docs/telas/`.
4. A IA local roda na RX 7600 com `qwen3:8b`, em 3–4 s por resumo. Visão e transcrição estão prontas no código, mas desligadas por falta de modelo e binário.
5. O que falta depende de você: chave do provedor de Instagram (para medir o "segundos" de verdade), WhatsApp de teste, modelos de visão e whisper, e um teste no celular.

## 2. Critérios de aceite por fase

| Fase | Critério | | Evidência |
|---|---|---|---|
| 0 | Fonte com frescor p95 ≤ 30 s e latência p95 ≤ 3 s | ❌ | Não medido: sem `PROVEDOR_IG_API_KEY`. Pesquisa e custo em `docs/spike-fontes.md` |
| 1 | `pnpm test` verde | ✅ | 53 testes passando (+2 de integração com `test:integracao`) |
| 1 | Banco local com tabelas + RLS | ✅ | 7/7 tabelas com `relrowsecurity = t` |
| 1 | Tokens exportados | ✅ | `packages/tokens` + `tokens.test.ts`; o painel consome `cssVars` |
| 2 | Testes das 6 regras da 3.2 | ✅ | `packages/shared/src/deteccao.test.ts` (baseline, dedupe, fixado, só vídeo, antigo, latência) + `agendamento.test.ts` (3.3) |
| 2 | Mock: post novo vira linha em `videos` em ≤ 1 tick | ✅ | `pnpm simular`: "detecção … latência 64 ms" no 1º tick |
| 2 | Nenhum alerta duplicado com 2 ticks concorrentes | ✅ | `scripts/integracao.test.ts` (8 chamadas simultâneas) + `docs/carga.md` (0 duplicatas) |
| 2 | Perfil real detectado ao vivo | ❌ | Sem chave de provedor (bloqueio B1) |
| 3 | Alerta no WhatsApp e no push em ≤ 5 s | ⚠️ | 1,1 s até `notificacoes.status = enviado`, mas com **canal simulado** (sem número de teste nem Evolution) |
| 3 | Falha de um canal não bloqueia o outro | ⚠️ | Por desenho: uma linha por dispositivo + `Promise.allSettled`. Sem teste automatizado com 2 canais reais |
| 3 | Vídeo baixável pelo link | ✅ | `baixar-video` → bucket `videos-temp`; player e botão Baixar com signed URL (`docs/telas/video-desktop.png`) |
| 4 | Vídeo novo aparece no painel sem recarregar | ⚠️ | Realtime implementado em `lib/dados.ts`; não há teste automatizado do "sem recarregar" |
| 4 | Instalável como PWA no Android e iPhone | ❌ | Manifest, service worker e ícones prontos; **não testado em aparelho** |
| 4 | Push abre o card certo | ❌ | `sw.js` com `notificationclick` → `/video/<id>`; chaves VAPID locais geradas; não testado num navegador real |
| 4 | Acessibilidade sem bloqueios | ✅ | Revisão achou 1 bloqueio (foco invisível no card lima), já corrigido; contraste AA ok |
| 4 | Fiel às pranchas | ⚠️ | Tokens, fontes, mascote e ícones originais usados; a comparação visual é sua (`docs/telas/`) |
| 5 | Resumo PT-BR coerente em ≤ 90 s | ✅ | `docs/benchmark-ia.md`; ponta a ponta 22 s (amostra de 12 s, sem fala; Reel real de 60 s não testado) |
| 5 | PC desligado: jobs processados ao religar | ✅ | ~290 jobs acumulados foram processados pelo worker ao voltar (log `scripts/saida/worker-ia.log`) |
| 5 | Card e WhatsApp atualizados com o resumo | ⚠️ | Resumo gravado + notificação `resumo` "enviada (simulado)"; WhatsApp real pendente |
| 6 | 24 h rodando sem intervenção | ⚠️ | Versão acelerada (pedida): `docs/carga.md`. 24 h reais não rodadas |
| 6 | Latência média e p95 visíveis | ✅ | Tela Saúde (`docs/telas/saude-desktop.png`) |
| 6 | Custo projetado ≤ orçamento | ✅ | 26.975 req/dia simuladas contra 27.000/dia de orçamento (no limite: qualquer janela extra estoura) |
| 7 | Deploy | — | Não executado (regra da noite). Checklist em `docs/runbook.md` §6 |

**Seção 13 (pronto do MVP):** alerta em segundos (✅ mock / ❌ real) · painel ao vivo instalável (✅ / ❌ não testado em aparelho) · botão "Baixar e repostar" (✅) · resumo por IA local (✅ texto / ❌ visão e fala) · 24 h sem duplicatas e dentro do orçamento (✅ acelerado) com runbook (✅).

## 3. Decisões que tomei sozinho e você precisa validar

A lista completa, com alternativas, está em `docs/DECISOES-NOITE.md` (35 itens). As mais importantes:

1. **Fonte principal provisória: HikerAPI**, com Business Discovery de reserva. É hipótese de preço, não medida. As fontes divergem entre US$ 0,001 e 0,02 por requisição.
2. **Edge Functions só aceitam a service key.** A anon key é pública e permitiria a qualquer pessoa disparar o `vigiar` e queimar o orçamento.
3. **Cadastro público desligado.** O usuário do painel é criado com `pnpm criar-usuario`.
4. **WhatsApp com trava:** só envia para `WHATSAPP_NUMERO_TESTE`. Qualquer outro número fica simulado.
5. **Alerta não espera o download.** Se o vídeo ainda não baixou, a 1ª mensagem sai sem link "Baixar"; o link vai sempre na 2ª (resumo). A seção 6.1 pedia o link já na mensagem 1.
6. **Fila de IA pega o vídeo mais recente primeiro**, não FIFO.
7. **Painel sem shadcn/ui** (revisto no dia seguinte: shadcn/ui integrado e customizado à marca, MCP em `.mcp.json`; ver decisões #36–#39).
8. **Perfil Econômico = 24 h a 300 s** na tabela de custo.
9. **Supabase local nas portas 564xx**, não 543xx. O Docker recusou a 54323.
10. **Migrations editadas várias vezes durante a noite.** Nunca foram aplicadas fora do local, então dá para revisar como versão única.

## 4. Bloqueios que dependem de você (por prioridade)

| # | O que | Destrava |
|---|---|---|
| B1 | Chave de teste de um provedor de IG (HikerAPI: plano mínimo ~US$ 20; ScrapeCreators: 100 créditos grátis) em `supabase/functions/.env` | Medição da Fase 0, perfil real na Fase 2, decisão de custo |
| B2 | `WHATSAPP_NUMERO_TESTE` + `EVOLUTION_API_URL`/`KEY`/`INSTANCIA` (número dedicado) | WhatsApp real (Fases 3 e 5) |
| B3 | Modelo de visão no Ollama (`ollama pull` de um multimodal que caiba em 8 GB) → `OLLAMA_MODELO_VISAO` | Descrição dos quadros |
| B4 | whisper.cpp com Vulkan + modelo ggml `small`/`medium` → `WHISPER_CLI`/`WHISPER_MODELO` | Transcrição da fala |
| B5 | Teste em celular: PWA instalado (iPhone exige HTTPS, por exemplo um Cloudflare Tunnel para o `localhost:3000`) + "Ativar push" | Aceites de PWA e push da Fase 4 |
| B6 | Conta profissional + app Meta (`IG_GRAPH_USER_ID`, `IG_GRAPH_TOKEN`) | Fonte B (Business Discovery) |
| B7 | Lista dos 10 perfis e o perfil de custo escolhido (seção 12) | Configuração real |

Observação: o primeiro comando da noite (`ollama list`) abriu o app do Ollama, e o atualizador automático dele baixou e instalou a versão 0.40.13. Não foi ação minha de instalar, mas aconteceu por causa do comando.

## 5. Ordem de revisão sugerida

1. **Migrations SQL**, na ordem:
   1. `supabase/migrations/20261101000001_base.sql` (tabelas, RLS, `registrar_posts`, `pegar_*`);
   2. `…02_cron.sql` (pg_cron + Vault);
   3. `…03_download_e_fila_ia.sql`;
   4. `…04_painel.sql`;
   5. `…05_heartbeat.sql`;
   6. `supabase/seed.sql`, que é só local.
2. `supabase/config.toml`: portas, `enable_signup`, URLs de redirect.
3. Regras puras e seus testes: `supabase/functions/_shared/regras/` + `packages/shared/src/*.test.ts`.
4. Edge Functions: `vigiar`, `notificar` (trava do WhatsApp em `_shared/canais/whatsapp.ts`), `baixar-video`.
5. Adapters das fontes: `_shared/fontes/hikerapi.ts` tem campos ainda **não validados** com resposta real.
6. Painel: telas em `docs/telas/` e código em `apps/painel/`.
7. Worker: `apps/worker-ia/src/`.
8. Documentos:
   - `docs/spike-fontes.md`;
   - `docs/benchmark-ia.md`;
   - `docs/carga.md`;
   - `docs/seguranca.md`;
   - `docs/runbook.md`.

## 6. Comandos (PowerShell) para ver tudo rodando

```powershell
cd C:\APPWEB\Vizualizer

# 1. Supabase local (Docker Desktop aberto). Studio: http://127.0.0.1:56423 · e-mails: http://127.0.0.1:56424
npx supabase start -x vector,logflare,imgproxy,supavisor

# 2. Dependências (uma vez) e usuário do painel
corepack pnpm install
corepack pnpm criar-usuario voce@email.com

# 3. Painel → http://localhost:3000 (o link de login chega no Mailpit)
corepack pnpm dev

# 4. Worker de IA (outro terminal)
cd apps\worker-ia; corepack pnpm start
#    apps\worker-ia\.env já existe (OLLAMA_MODELO_TEXTO=qwen3:8b); modelo de referência em .env.example

# 5. Simular um post e ver o caminho inteiro (outro terminal, na raiz)
corepack pnpm simular --esperar-resumo

# Conferências
corepack pnpm test; corepack pnpm test:integracao; corepack pnpm typecheck; corepack pnpm lint
corepack pnpm carga 144      # teste de carga (limpa os próprios dados no fim)
corepack pnpm telas          # regenera os screenshots (precisa do painel no ar)
```

Para ligar os canais reais, edite `supabase/functions/.env`, que já existe e já tem chaves VAPID locais (o modelo dos campos está em `.env.example`). Depois rode `docker restart supabase_edge_runtime_Vizualizer`, porque o runtime guarda as funções em cache.
