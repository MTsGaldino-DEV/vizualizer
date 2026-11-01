# Runbook — Vizualizer

Comandos em PowerShell, na pasta `C:\APPWEB\Vizualizer`. O `pnpm` não está instalado globalmente nesta máquina: use `corepack pnpm` (ou instale o pnpm e troque).

## 1. Subir tudo localmente

```powershell
# Banco + Auth + Storage + Edge Functions + Cron (Docker Desktop aberto)
npx supabase start -x vector,logflare,imgproxy,supavisor
# Painel → http://localhost:3000
corepack pnpm dev
# Worker de IA (outro terminal)
cd apps\worker-ia; corepack pnpm start
```

- Portas locais: API `56421`, banco `56422`, Studio `http://127.0.0.1:56423`, Mailpit (e-mails do link mágico) `http://127.0.0.1:56424`.
- Primeiro acesso: `corepack pnpm criar-usuario voce@email.com` e entre em `/login`. O link chega no Mailpit.
- Ver o robô funcionando: `corepack pnpm simular` (com `--esperar-resumo` se o worker estiver no ar).

## 2. Operar

| Situação | O que fazer |
|---|---|
| Tela Saúde mostra "Robô de vigia: parado" | `docker logs --tail 50 supabase_edge_runtime_Vizualizer`; no Cloud, logs da função `vigiar`. Ver `select * from cron.job_run_details order by start_time desc limit 10;` |
| Muitos erros de fonte | Ver `checagens` (`erro`). O circuit breaker abre após 5 erros seguidos e usa `FONTE_RESERVA` por 10 min |
| Consumo perto do orçamento | Ajustar `config.orcamento_requisicoes_mes` ou os intervalos/janelas na tela Perfis. Acima do teto, o intervalo frio já alarga sozinho |
| Resumo não chega | Worker no ar? (Saúde → "Resumo por IA"). `select * from jobs_ia where status <> 'feito' order by id desc;` |
| Alerta não chega | `select status, erro, tentativas from notificacoes order by id desc limit 20;` (3 tentativas com backoff 10/40/90 s) |

## 3. Religar o worker de IA

```powershell
cd C:\APPWEB\Vizualizer\apps\worker-ia; corepack pnpm start
# Iniciar com o Windows (tarefa do usuário, sem admin):
powershell -ExecutionPolicy Bypass -File C:\APPWEB\Vizualizer\scripts\worker-ia-tarefa.ps1
```

PC desligado: os jobs ficam `pendente` e são processados quando o worker voltar. Os alertas não dependem do PC.

## 4. Trocar a fonte de dados

1. Pôr a chave em `supabase/functions/.env` (local) ou nos secrets do projeto (Cloud): `PROVEDOR_IG_API_KEY`, `IG_GRAPH_USER_ID`, `IG_GRAPH_TOKEN`.
2. `FONTE_PRINCIPAL=hikerapi` e `FONTE_RESERVA=business-discovery` (ou `mock` em desenvolvimento).
3. Local: `docker restart supabase_edge_runtime_Vizualizer`. Cloud: `npx supabase secrets set FONTE_PRINCIPAL=hikerapi`.
4. Novo provedor = novo arquivo em `supabase/functions/_shared/fontes/` implementando `FonteInstagram` + teste em `fontes.test.ts`.

## 5. Rotacionar chaves

| Chave | Onde | Como |
|---|---|---|
| Provedor de IG | secrets das funções | gerar nova no provedor → `supabase secrets set` → revogar a antiga |
| Evolution API | secrets (`EVOLUTION_API_KEY`) | trocar na Evolution e nos secrets |
| VAPID | secrets + `NEXT_PUBLIC_VAPID_PUBLIC_KEY` na Vercel | `npx web-push generate-vapid-keys`; **todas as assinaturas de push precisam ser refeitas** |
| Service role | Vault (`service_role_key`) + `.env` do worker | rotacionar no painel do Supabase; `select vault.update_secret(...)` |

## 6. Checklist de deploy (NÃO executado na noite de 2026-11-01)

- [ ] Revisar as migrations `supabase/migrations/2026110100000{1..5}_*.sql` (ordem: base → cron → download → painel → heartbeat).
- [ ] Criar projeto no Supabase Cloud (região São Paulo) e decidir o plano. O tick de 10 s gera cerca de 259 mil invocações por mês só do `vigiar`; o Free tem 500 mil e o Pro 2 milhões.
- [ ] `npx supabase link --project-ref <ref>` → `npx supabase db push` (só depois da revisão).
- [ ] Vault no Cloud: `select vault.create_secret('https://<ref>.supabase.co','project_url'); select vault.create_secret('<service key>','service_role_key');`
- [ ] Secrets das funções: `npx supabase secrets set --env-file supabase/functions/.env` (sem as chaves de teste).
- [ ] `npx supabase functions deploy vigiar notificar baixar-video`.
- [ ] Auth: `site_url` e `additional_redirect_urls` com o domínio real; SMTP próprio; cadastro desligado.
- [ ] Vercel: importar `apps/painel`, variáveis `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `NEXT_PUBLIC_VAPID_PUBLIC_KEY`; domínio.
- [ ] `URL_PAINEL` nos secrets com o domínio final (links do push e do WhatsApp).
- [ ] Decidir o WhatsApp de produção (Evolution numa VPS ou WhatsApp Cloud API, seção 6.1) e registrar na seção 14.
- [ ] Worker: `apps/worker-ia/.env` apontando para o Cloud + tarefa agendada.
- [ ] Teste final: `pnpm simular` adaptado ou post real de um perfil autorizado.
