# Revisão de segurança (Fase 6) — noite de 2026-11-01

| Item | Estado | Evidência |
|---|---|---|
| RLS ligado em todas as tabelas | ✅ | `select relname, relrowsecurity from pg_class` → 7/7 `t` |
| Cadastro público no Auth | ✅ desligado | `POST /auth/v1/otp` com e-mail novo → `signup_disabled`; usuário via `pnpm criar-usuario` |
| Painel só altera `videos.status` | ✅ | privilégio por coluna (`grant update (status)`), evita SSRF via `url_video` |
| RPCs internas (`pegar_*`, `registrar_posts`, `chamar_funcao`, `verificar_batimento`) | ✅ | `revoke execute … from public, anon, authenticated` |
| `estatisticas_painel` | ✅ | revogada de `anon`, liberada só para `authenticated` |
| Edge Functions aceitam só a chave de serviço | ✅ | `exigirServico()`; anon key (pública) → **401** nas 3 funções |
| CORS | ✅ | funções não enviam cabeçalhos CORS → navegador não consegue chamá-las |
| Rate limit das funções públicas | ✅ por desenho | nenhuma função é pública (todas exigem service key); Auth usa os limites padrão do `config.toml` |
| Segredos no repositório | ✅ | nenhum `.env` versionado; só chaves **demo públicas do Supabase CLI local** em `seed.sql`/`scripts/local.ts` (iguais em toda instalação) |
| Cron → funções | ✅ | URL e chave lidas do **Vault** (`project_url`, `service_role_key`) |
| WhatsApp só para número permitido | ✅ | `criarCanalWhatsApp` + testes em `canais.test.ts` |
| Dados de dispositivos do sistema visíveis a qualquer autenticado | ⚠️ intencional | painel single-tenant; revisar se houver mais de um cliente |
| Circuit breaker sem controle de concorrência | ⚠️ aceito no MVP | estado em `config`, sobrescrita possível com ticks sobrepostos |

**Antes do Cloud:** criar os secrets do Vault com a URL do projeto e a service key reais; trocar `site_url`/`additional_redirect_urls`; SMTP real para o link mágico; conferir que `verify_jwt` continua ligado.
