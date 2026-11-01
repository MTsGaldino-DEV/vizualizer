# Vizualizer — Plano de Implementação (MVP)

> Robô que vigia perfis de influenciadores no Instagram e avisa em segundos quando sai vídeo novo, com resumo do vídeo feito por IA local, para o cliente baixar e repostar no TikTok (com autorização dos criadores).
>
> **Este arquivo é a fonte da verdade do projeto.** Todo prompt no Claude Code começa com "Leia `PLANO-VIZUALIZER.md`". Ao terminar cada fase, atualize a seção 14 (Registro de decisões).

---

## 0. Como usar este plano no Claude Code

1. Abra o Claude Code na pasta `C:\APPWEB\Vizualizer`.
2. Rode o **Prompt 0** (setup do toolkit + CLAUDE.md + Fase 0).
3. Siga as fases **na ordem**, um prompt por fase (Apêndice A). Cada fase passa pelo ciclo do Superpowers:
   `brainstorming` (só se houver dúvida) → `writing-plans` → `executing-plans` com checkpoint → `requesting-code-review` → `verification-before-completion` → `finishing-a-development-branch`.
4. Nunca pular para a próxima fase sem os critérios de aceite da atual marcados como ✅.

---

## 1. Decisões já tomadas

| Tema | Decisão |
|---|---|
| Nome / marca | **Vizualizer** — mascote **Vizu, o suricato sentinela** |
| Volume | Até **10 perfis** monitorados |
| Canais de alerta | **WhatsApp** (Evolution API) + **Web Push** do painel (PWA) |
| Painel | Painel web completo (Next.js na **Vercel**) |
| Backend | **Supabase**: Postgres, Auth, Realtime, Storage, Edge Functions, **Supabase Cron** (agendamento em segundos) |
| Robô | Edge Function chamada pelo Supabase Cron a cada ~10 s (a Vercel **não** roda o robô: cron do Hobby é 1x/dia, do Pro é 1x/min) |
| Resumo do vídeo | **IA local e gratuita**: Ollama + whisper.cpp no PC do Matheus (**RX 7600 8 GB**), via worker que *busca* trabalhos no Supabase |
| Direitos | Cliente declarou ter autorização dos influenciadores → download do vídeo liberado |
| Mobile | MVP web/PWA. Android e **iPhone (prioridade)** depois, com Expo. Arquitetura já preparada |
| Ambiente atual | Tudo roda local para teste (Supabase CLI local + Next dev), depois sobe para Supabase Cloud + Vercel |
| Linguagem | **TypeScript em tudo** (Edge Functions em Deno/TS, worker em Node/TS, painel em Next/TS) |

---

## 2. Arquitetura

```
                    ┌──────────────────────── SUPABASE ────────────────────────┐
                    │                                                          │
 Supabase Cron ───► │  Edge Function `vigiar` (tick a cada 10 s)               │
  (10 seconds)      │   1. pega perfis "vencidos" (proximo_check_em <= now)    │
                    │   2. consulta Fonte (adapter) em paralelo                │
                    │   3. detecta vídeo novo (dedupe por shortcode)           │
                    │   4. INSERT em `videos` + enfileira `notificacoes`       │
                    │                    │                                     │
                    │                    ▼                                     │
                    │  Edge Function `notificar` ──► WhatsApp (Evolution API)  │
                    │      (trigger/fila)        ──► Web Push (VAPID)          │
                    │                            ──► [futuro] Expo Push        │
                    │                    │                                     │
                    │  Edge Function `baixar-video` ──► Storage (bucket temp.) │
                    │                    │                                     │
                    │  Tabela `jobs_ia` (fila) ◄──────────────┐                │
                    │  Realtime ──────────────► Painel        │                │
                    └─────────────────────────────────────────┼────────────────┘
                                                              │ (conexão de saída)
   VERCEL: Painel Next.js (PWA) ◄── Realtime/Auth             │
                                                              │
   PC do Matheus (RX 7600): worker-ia (Node/TS) ──────────────┘
      ffmpeg → whisper.cpp (Vulkan) → quadros-chave → Ollama (visão) → Ollama (texto)
      → grava `videos.resumo` → Realtime atualiza o card + 2ª mensagem no WhatsApp
```

**Regra de ouro:** o alerta **nunca espera** download nem IA. Ordem: detectar → alertar (segundos) → baixar vídeo → resumir (segunda mensagem/atualização de card).

---

## 3. Motor de detecção (o coração)

### 3.1 Fontes de dados (padrão Adapter)

```ts
// packages/shared/src/fontes.ts
export interface PostIG {
  shortcode: string;          // chave de dedupe
  igId?: string;
  tipo: 'video' | 'imagem' | 'carrossel';
  ehReels: boolean;
  fixado: boolean;            // post fixado no topo do perfil!
  publicadoEm: Date;          // taken_at
  legenda?: string;
  permalink: string;
  urlVideo?: string;          // URL do CDN (expira!)
  urlThumb?: string;
  duracaoS?: number;
}
export interface FonteInstagram {
  nome: string;
  ultimosPosts(username: string, limite: number): Promise<PostIG[]>;
}
```

Adapters previstos:

| Fonte | Uso | Observações |
|---|---|---|
| **A. Provedor de API terceiro (pago, baixa latência)** | Fonte principal do tick rápido | Escolhido na **Fase 0** por medição real. Precisa de chamada **síncrona** (não serve ator que demora para "subir", como execuções do Apify, que são ótimas para backfill e ruins para segundos). |
| **B. Instagram Graph API — Business Discovery (oficial, grátis)** | Backup / conferência / backfill | Só funciona com contas Business/Creator; exige conta profissional do cliente + app Meta. Limite baixo (~200 chamadas/h por usuário do app) → **não serve** para segundos. |
| **C. Mock** | Testes e desenvolvimento | Lê fixtures JSON gravadas na Fase 0. |
| ❌ Login com conta + API privada (instagrapi etc.) | Não usar | Risco de ban e violação de termos. |

### 3.2 Regras de detecção (cobrir com testes — TDD)

1. **Baseline**: ao adicionar um perfil, a 1ª leitura grava os posts existentes como `ja_vistos` e **não alerta**.
2. **Dedupe**: `UNIQUE (perfil_id, shortcode)`; insert com `ON CONFLICT DO NOTHING` → só quem inseriu dispara alerta (idempotência mesmo com ticks sobrepostos).
3. **Post fixado**: fixados aparecem no topo, então **nunca** comparar por posição; comparar por `shortcode` + `publicadoEm`.
4. **Só vídeo**: alertar apenas `tipo = 'video'` (Reels e vídeo de feed). Carrossel com vídeo: configurável.
5. **Post antigo que reapareceu** (desarquivado/fixado novo): ignorar se `publicadoEm` < `perfil.criado_em_monitoramento` ou mais velho que 24 h.
6. **Latência registrada**: `detectado_em - publicado_em` em todo vídeo (métrica que vende o produto: "Detectado 3 s após a publicação").

### 3.3 Agendamento adaptativo + orçamento

- O tick (Cron, 10 s) só processa perfis com `proximo_check_em <= now()`, via RPC `pegar_perfis_vencidos(lim)` com `FOR UPDATE SKIP LOCKED`.
- Cada perfil tem **intervalo quente** (ex.: 10 s) e **frio** (ex.: 2–5 min).
- **Janelas quentes aprendidas**: a partir do histórico de `publicado_em`, calcular as faixas de hora em que cada perfil costuma postar (+ janelas manuais no painel).
- **Jitter** de ±20% no intervalo para não bater sempre no mesmo segundo.
- **Orçamento mensal** (`config.orcamento_requisicoes_mes`): se o consumo projetado passar do teto, o sistema alarga intervalos frios automaticamente e avisa no painel.
- **Circuit breaker** por fonte: N erros seguidos → pausa a fonte por X min, cai para a fonte B e avisa o admin.

**Fórmula de custo (mostrar no painel e na proposta ao cliente):**

```
req/dia por perfil = (horas_quentes × 3600 / intervalo_quente) + (horas_frias × 3600 / intervalo_frio)
custo/mês ≈ Σ perfis × req/dia × 30 × preço_por_requisição
```

Exemplo, 10 perfis, 6 h quentes a 10 s + 18 h frias a 120 s → 2.700 req/perfil/dia → **~810 mil req/mês**. O preço por requisição sai da Fase 0. Esse número é o que define "segundos" na prática; o cliente escolhe o perfil de custo (Turbo / Adaptativo / Econômico) num seletor do painel.

**Invocações de Edge Function:** tick de 10 s = ~259 mil invocações/mês, só do `vigiar`. Conferir na Fase 0 contra os limites atuais do plano Supabase (gratuito x Pro) e registrar na seção 14.

---

## 4. Modelo de dados (SQL manual)

> O Matheus aplica SQL manualmente. O Claude Code **escreve** os arquivos em `supabase/migrations/` e **para** para revisão antes de aplicar.

```sql
-- 0001_base.sql
create table perfis (
  id uuid primary key default gen_random_uuid(),
  username text not null unique,
  nome_exibicao text,
  avatar_url text,
  ativo boolean not null default true,
  intervalo_quente_s int not null default 10,
  intervalo_frio_s int not null default 120,
  janelas_manuais jsonb not null default '[]',     -- [{dow:[1..7], inicio:"18:00", fim:"22:00"}]
  janelas_aprendidas jsonb not null default '[]',
  baseline_feito boolean not null default false,
  monitorado_desde timestamptz not null default now(),
  ultimo_check_em timestamptz,
  proximo_check_em timestamptz not null default now(),
  ultimo_video_em timestamptz,
  erros_seguidos int not null default 0,
  criado_em timestamptz not null default now()
);

create table videos (
  id uuid primary key default gen_random_uuid(),
  perfil_id uuid not null references perfis(id) on delete cascade,
  shortcode text not null,
  tipo text not null,
  eh_reels boolean not null default false,
  publicado_em timestamptz not null,
  detectado_em timestamptz not null default now(),
  latencia_ms int generated always as ((extract(epoch from (detectado_em - publicado_em)) * 1000)::int) stored,
  legenda text,
  permalink text not null,
  url_thumb text,
  storage_path text,                      -- vídeo baixado (bucket temporário)
  status text not null default 'novo',    -- novo | baixado | resumido | repostado | ignorado
  resumo text,
  resumo_tags text[],
  ja_visto_no_baseline boolean not null default false,
  unique (perfil_id, shortcode)
);

create table checagens (                  -- log enxuto para métricas e custo
  id bigint generated always as identity primary key,
  perfil_id uuid references perfis(id) on delete cascade,
  fonte text not null,
  ok boolean not null,
  duracao_ms int,
  erro text,
  criado_em timestamptz not null default now()
);

create table dispositivos (               -- porta para o app nativo
  id uuid primary key default gen_random_uuid(),
  usuario_id uuid not null references auth.users(id) on delete cascade,
  tipo text not null check (tipo in ('web_push','expo','whatsapp')),
  destino jsonb not null,                 -- subscription Web Push | expo token | {numero}
  ativo boolean not null default true,
  criado_em timestamptz not null default now()
);

create table notificacoes (               -- fila + histórico de envios
  id bigint generated always as identity primary key,
  video_id uuid not null references videos(id) on delete cascade,
  dispositivo_id uuid references dispositivos(id) on delete cascade,
  tipo_msg text not null,                 -- alerta | resumo
  status text not null default 'pendente',-- pendente | enviado | falhou
  tentativas int not null default 0,
  erro text,
  enviado_em timestamptz,
  criado_em timestamptz not null default now()
);

create table jobs_ia (                    -- fila do worker local
  id bigint generated always as identity primary key,
  video_id uuid not null unique references videos(id) on delete cascade,
  status text not null default 'pendente',-- pendente | processando | feito | falhou
  tentativas int not null default 0,
  pego_em timestamptz,
  erro text,
  criado_em timestamptz not null default now()
);

create table config (
  chave text primary key,
  valor jsonb not null
);
```

- **RLS** ligado em tudo; painel lê com usuário autenticado; Edge Functions e worker usam service role (worker: chave só no `.env` local).
- **Realtime** habilitado em `videos`, `perfis` e `jobs_ia`.
- **Retenção**: cron diário apaga `checagens` > 30 dias e arquivos do bucket `videos-temp` > 48 h (cabe no Storage gratuito).
- RPCs: `pegar_perfis_vencidos(lim int)`, `pegar_job_ia()` (com `SKIP LOCKED`), `estatisticas_painel()`.

---

## 5. Resumo do vídeo com IA local (RX 7600 8 GB)

**Viável.** A RX 7600 está na lista oficial de GPUs AMD suportadas pelo Ollama no Windows.

Pipeline do `apps/worker-ia` (Node/TS, roda no PC, só conexões de saída):

1. Escuta `jobs_ia` via Realtime + polling de segurança a cada 30 s; pega job com `pegar_job_ia()`.
2. Baixa o vídeo do Storage (signed URL).
3. `ffmpeg`: extrai áudio (16 kHz mono WAV) e **4–6 quadros-chave** (detecção de cena ou intervalos regulares).
4. **Transcrição**: `whisper.cpp` com build **Vulkan** (o faster-whisper só acelera em NVIDIA). Modelo para PT-BR testado na Fase 5 (começar pelo `small`/`medium`; subir se a qualidade pedir).
5. **Visão**: modelo multimodal no Ollama descreve os quadros.
6. **Texto**: modelo de texto no Ollama gera o resumo a partir de transcrição + legenda + descrição dos quadros.
7. Grava `videos.resumo`, `videos.resumo_tags`, `status='resumido'` → Realtime atualiza o card → `notificar` manda a 2ª mensagem no WhatsApp.

Regras:
- **VRAM de 8 GB**: um modelo por vez; usar `keep_alive` curto e descarregar o modelo de visão antes do de texto (e liberar antes do whisper se usar GPU nele).
- **Modelos**: escolher na Fase 5 entre os disponíveis na biblioteca do Ollama no momento, com quantização que caiba em 8 GB (~7–8B no máximo, preferir 4B se a qualidade bastar). Registrar a escolha na seção 14.
- **Prompt do resumo** (saída JSON validada com zod): `{ resumo: string (2–3 frases PT-BR), assunto: string, tags: string[], tem_fala: boolean, idioma: string }`.
- **PC desligado** → jobs ficam `pendente` e são processados quando ele voltar. O alerta não depende disso.
- Timeout por job e `tentativas <= 3`.
- Meta: resumo pronto em < 90 s após a detecção (Reel de até 90 s).

---

## 6. Notificações

### 6.1 WhatsApp (Evolution API)
- Edge Function `notificar` → Evolution API do Matheus via **Cloudflare Tunnel** (`evolution.calculaeasy.com.br`), autenticada por API key em Supabase Vault.
- **Número dedicado** (automação em número pessoal arrisca banimento).
- Mensagem 1 (alerta): `🟢 Novo vídeo de @perfil — detectado X s após a publicação` + link do post + link "Baixar" (signed URL de 48 h) + link do painel.
- Mensagem 2 (resumo): resumo + tags.
- ⚠️ **Ponto frágil**: Evolution roda no PC → PC desligado = WhatsApp não sai (Web Push continua). Para produção, decisão do cliente: Evolution numa VPS **ou** WhatsApp Cloud API oficial (paga por conversa). Deixar o envio atrás da interface `CanalNotificacao` para trocar sem refatorar.

### 6.2 Web Push (PWA)
- VAPID; chaves em Vault/Env. Assinatura salva em `dispositivos (tipo='web_push')`.
- Android: funciona direto no navegador. **iPhone: só com o painel instalado na Tela de Início (iOS 16.4+)** → tela de onboarding "Adicionar à Tela de Início" com instruções visuais.
- Payload: título, corpo, ícone do Vizu, `data.url` para abrir o card do vídeo.
- Limpar assinaturas que retornarem 404/410.

### 6.3 Porta para o app nativo (Expo, Android + iPhone)
- Toda regra fica no Supabase; o painel é só cliente → o app Expo reutiliza tudo.
- `dispositivos.tipo='expo'` + `CanalExpoPush` no `notificar` = app nativo pronto para receber push sem mexer no backend.
- `packages/shared` (tipos, zod, fórmulas) e `packages/tokens` (identidade) já consumíveis por React Native.
- Publicar na App Store exige conta Apple Developer (US$ 99/ano) → custo do cliente na fase mobile.

---

## 7. Painel + Identidade Visual

### 7.1 Tokens da marca (extraídos de `Vizualizer — Identidade Visual.html`)

| Token | Valor | Uso |
|---|---|---|
| `--viz-tinta` | `#0B0B0C` | Fundo principal (modo escuro é o padrão) e tinta do logo |
| `--viz-superficie-1` | `#1A1A1C` | Faixas / seções |
| `--viz-superficie-2` | `#1F1F22` | Cards em repouso |
| `--viz-superficie-3` | `#232326` | Cards / linhas de grid |
| `--viz-borda` | `#2E2E30` | Bordas e divisores |
| `--viz-texto` | `#EDEDED` | Texto principal |
| `--viz-texto-2` | `#C9C9C9` | Texto secundário |
| `--viz-texto-mudo` | `#A6A6A6` | Rótulos, metadados |
| `--viz-sinal` | `#C8FF2E` | **Lima elétrico (cor da marca)** — "ao vivo", vídeo novo, CTA principal |
| `--viz-creme` | `#F3ECE0` | Mascote / fundo claro alternativo |
| `--viz-terra` | `#3A302A` | Detalhes do mascote |
| `--viz-alerta` | `#FF5B1F` | Erros/pausas (paleta secundária, uso pontual) |

Paletas alternativas no arquivo (Alerta `#FF5B1F`, Radar `#2B4BFF`, Viral `#FF3D8B`) ficam fora do MVP; a lima é a escolhida.

**Tipografia (Google Fonts, via `next/font`):**
- **Syne** 600/700/800 — logo e títulos. Display: ExtraBold 72/68. Título: Bold 40/44. Logo com tracking −5%.
- **DM Sans** 400/500/700 — interface e texto. Texto: 19/29. Botões: Bold 16.
- **JetBrains Mono** 400/600 — dados e rótulos (`NOVO VÍDEO · HÁ 3 s`, `@criador.dois`, horários), caixa alta com tracking aberto.

**Forma:** cantos 14–22 px nos cards, 4 px em chips/tags; ícones traço **1.6–2 px**, cantos arredondados, grid 24 px.

**Logo:** wordmark `viz` + `u` + `alizer` em Syne ExtraBold; o **"u" vira a toca do mascote** (o Vizu espia de dentro do u). Versões: tinta em fundo claro e versão sobre a cor da marca. Ícone do app: Vizu 180 px e reduzido 72 px.

**Conceito para microcopy e motion:** "A sentinela que nunca pisca" — **Vigiar · Avisar · Agir**. Círculos concêntricos = tela de radar; cada ponto aceso = vídeo detectado.

**Assets já extraídos** em `assets/marca/`:
- `vizu-mascote-180.svg`, `vizu-mascote-72.svg`, `vizu-toca-u.svg`, `vizu-conceito.svg`
- `icones/`: `monitorar`, `alertar`, `video-novo`, `em-segundos`, `de-olho`, `repostar`, `tempo-real`, `perfis` (`.svg`, traço já em `#C8FF2E` → trocar por `currentColor` ao virar componente).

O HTML original é um *bundle* comprimido (manifest base64 + gzip, com outro bundle dentro de cada página). Se precisar de algo além dos assets, peça para extrair; não reescrever o mascote à mão.

### 7.2 Telas do MVP (baseadas na prancha "06 — Aplicação no app")

1. **Ao vivo (home)**: cabeçalho "Monitorando · 10 perfis · ao vivo" com radar pulsando; **card destaque em lima** do vídeo mais recente (`NOVO VÍDEO · HÁ 3 s`, `@perfil acabou de postar um reels`, botão **Baixar e repostar**, resumo da IA quando chegar, com skeleton enquanto processa); lista dos perfis com status (`último vídeo há 18 min`, `sem vídeos hoje`, `pausado`).
2. **Vídeo (detalhe)**: player, legenda, resumo, tags, latência, botões Baixar / Abrir no Instagram / Marcar como repostado / Ignorar.
3. **Perfis**: adicionar por @, pausar, janelas quentes, intervalos, histórico de horários (mini heatmap).
4. **Alertas**: dispositivos (Web Push, WhatsApp), teste de envio, onboarding "instalar no iPhone".
5. **Saúde & custo**: latência média/p95, checagens por fonte, erros, consumo vs orçamento, status do worker IA (online/offline, fila).
6. **Login** (Supabase Auth, e-mail mágico).

Estados vazios e de erro com o Vizu (ex.: "Tudo calmo no horizonte"). Português em toda a interface. Modo escuro padrão.

### 7.3 Motion (discreto e com propósito)
- Radar com anel pulsando no "ao vivo"; ponto lima "acendendo" quando entra vídeo novo; card novo entra com deslize + leve brilho; contador "HÁ X s" ao vivo.
- `prefers-reduced-motion` respeitado. Sem animação decorativa em lista.

---

## 8. Estrutura do repositório

```
C:\APPWEB\Vizualizer
├─ PLANO-VIZUALIZER.md          ← este arquivo
├─ CLAUDE.md                    ← regras do projeto (template do toolkit)
├─ assets/marca/                ← mascote e ícones extraídos
├─ apps/
│  ├─ painel/                   ← Next.js (App Router) + PWA → Vercel
│  ├─ worker-ia/                ← Node/TS, roda no PC (ffmpeg, whisper.cpp, Ollama)
│  └─ mobile/                   ← [futuro] Expo (Android + iPhone)
├─ packages/
│  ├─ shared/                   ← tipos, zod, interface FonteInstagram, regras de detecção puras
│  └─ tokens/                   ← identidade visual em TS (cores, fontes, raios) → Tailwind e RN
├─ supabase/
│  ├─ migrations/               ← SQL manual, revisado pelo Matheus
│  ├─ functions/
│  │  ├─ vigiar/                ← tick do robô
│  │  ├─ notificar/
│  │  ├─ baixar-video/
│  │  └─ _shared/fontes/        ← adapters (provedor, business-discovery, mock)
│  └─ seed.sql
└─ docs/
   ├─ spike-fontes.md           ← resultado da Fase 0
   └─ runbook.md                ← operar, religar, trocar fonte
```

- **pnpm workspaces**. As regras de detecção ficam em `packages/shared` como **funções puras** (testáveis com Vitest) e são importadas pelas Edge Functions.
- Comandos de terminal sempre em **PowerShell** (Windows).

---

## 9. Como o Claude Code deve trabalhar (vibe-coding-toolkit + skills)

### 9.1 Setup único
```powershell
/plugin marketplace add anthropics/claude-plugins-official
/plugin install superpowers@claude-plugins-official
```
- Copiar `templates/CLAUDE.md.template` do toolkit para `CLAUDE.md` e preencher com as regras da 9.3.
- Ligar **Context7** (docs atualizadas de Supabase, Next.js, web-push, Ollama, whisper.cpp) — **obrigatório consultar antes de usar qualquer API externa**, porque limites e assinaturas mudam.
- **Graphify** a partir da Fase 3 (quando o código crescer), para o Claude navegar pelo grafo do projeto.
- **RTK** para economizar tokens em sessões longas; **Caveman/Ponytail** quando quiser respostas curtas.
- **Memória**: ai-memory já instalado em `C:\APPWEB` + Claude/Obsidian do toolkit — registrar decisões de cada fase.

### 9.2 Skills por fase

| Momento | Skill |
|---|---|
| Ideia com dúvida | `superpowers:brainstorming` |
| Antes de codar cada fase | `superpowers:writing-plans` (plano da fase em `docs/planos/fase-N.md`) |
| Execução | `superpowers:executing-plans` com **checkpoint e confirmação a cada etapa** |
| Partes independentes (ex.: adapters, telas) | `superpowers:subagent-driven-development` / `dispatching-parallel-agents` |
| Spikes arriscados | `superpowers:using-git-worktrees` |
| Regras de detecção, fila, orçamento | `superpowers:test-driven-development` |
| Qualquer bug | `systematic-debugging` (antes de propor correção) |
| Fim de fase | `superpowers:requesting-code-review` → `verification-before-completion` → `finishing-a-development-branch` |
| Painel | `frontend-design`, `design-taste-frontend`, `build-awwwards-quality-sites`, `vercel-react-best-practices`, **shadcn-ui MCP** |
| Motion do radar/alertas | `motion-design` (+ `gsap` se precisar de timeline) |
| Acessibilidade do painel | `accessibility-review` |

### 9.3 Regras para o CLAUDE.md
- Idioma: **PT-BR** em código de negócio, UI, commits e docs.
- **Commits em PT-BR**, pequenos, um por etapa concluída.
- **Windows + PowerShell**: nunca sintaxe bash nos comandos para o Matheus.
- **SQL é manual**: escrever migration em arquivo e **parar** para revisão; nunca aplicar sozinho.
- **Mudanças conservadoras e com escopo**: não refatorar o que não foi pedido.
- **Passo a passo com confirmação** entre etapas.
- Antes de usar API externa: consultar Context7/documentação oficial.
- Segredos só em `.env` / Supabase Vault; nunca no repositório.
- Ao terminar uma fase: atualizar a seção 14 deste plano.

---

## 10. Fases

### Fase 0 — Spike de viabilidade das fontes (1–2 dias) ⚠️ decide o custo do produto
- Pesquisar provedores de API de Instagram com chamada síncrona por perfil (preço por requisição, plano fixo, latência, **frescor do dado**: alguns provedores servem cache).
- Script `scripts/spike-fontes.ts`: 3 perfis × N provedores, a cada 15 s por 2 h → medir latência p50/p95, taxa de erro, se retorna `taken_at`, tipo de mídia, `is_pinned`, URL do vídeo, e **atraso de frescor** (post publicado → aparece na fonte).
- Testar Business Discovery com uma conta profissional de teste.
- Gravar fixtures JSON reais para o adapter mock.
- Conferir limites atuais do Supabase (invocações de Edge Function, Cron em segundos, Storage, Realtime).
- **Entregável:** `docs/spike-fontes.md` com tabela comparativa, recomendação, custo mensal nos 3 perfis de uso (Turbo / Adaptativo / Econômico).
- **Aceite:** ✅ uma fonte com frescor p95 ≤ 30 s e latência de resposta p95 ≤ 3 s, ou decisão registrada de aceitar o que existir.

### Fase 1 — Fundação
- Monorepo pnpm, TS estrito, ESLint/Prettier, Vitest.
- `supabase init` + Supabase local (Docker Desktop).
- Migration `0001_base.sql` (seção 4) → **revisão do Matheus** → aplicar.
- `packages/tokens` com a identidade (seção 7.1) e `packages/shared` com tipos e zod.
- **Aceite:** ✅ `pnpm test` verde; ✅ banco local com tabelas + RLS; ✅ tokens exportados.

### Fase 2 — Motor de detecção (TDD)
- Regras puras em `packages/shared`: baseline, dedupe, fixado, só vídeo, post antigo, próximo check (quente/frio/jitter), janelas aprendidas, orçamento.
- Adapters: `provedor` (escolhido na Fase 0), `business-discovery`, `mock`.
- Edge Function `vigiar` + RPC `pegar_perfis_vencidos` + Supabase Cron a cada 10 s.
- Circuit breaker + fallback de fonte.
- **Aceite:** ✅ testes cobrindo as 6 regras da 3.2; ✅ com o mock, post novo vira linha em `videos` em ≤ 1 tick; ✅ nenhum alerta duplicado com 2 ticks concorrentes; ✅ perfil real detectado em teste ao vivo.

### Fase 3 — Notificações
- Interface `CanalNotificacao` + `CanalWhatsApp` (Evolution) + `CanalWebPush` (VAPID) + stub `CanalExpoPush`.
- Edge Function `notificar` (fila `notificacoes`, retry com backoff, até 3 tentativas).
- Edge Function `baixar-video` → bucket `videos-temp` + signed URL 48 h; cron de limpeza.
- **Aceite:** ✅ alerta no WhatsApp e no push em ≤ 5 s após a detecção; ✅ falha de um canal não bloqueia o outro; ✅ vídeo baixável pelo link.

### Fase 4 — Painel (identidade Vizualizer)
- Next.js App Router + Tailwind (tokens do `packages/tokens`) + shadcn/ui customizado à marca + `next/font` (Syne, DM Sans, JetBrains Mono).
- Telas da seção 7.2, Realtime em `videos`/`perfis`/`jobs_ia`, PWA (manifest com ícone do Vizu, service worker, push), onboarding iPhone.
- Motion da 7.3.
- **Aceite:** ✅ vídeo novo aparece no painel sem recarregar; ✅ instalável como PWA no Android e no iPhone; ✅ push abre o card certo; ✅ revisão de acessibilidade sem bloqueios; ✅ fiel às pranchas da identidade.

### Fase 5 — Worker de IA local (RX 7600)
- Instalar/validar Ollama no Windows com aceleração da RX 7600; build Vulkan do whisper.cpp; ffmpeg.
- Benchmark rápido de 2–3 modelos de visão e 2 de texto que caibam em 8 GB → escolher pela qualidade do resumo em PT-BR e tempo.
- `apps/worker-ia` com fila (`pegar_job_ia`), pipeline da seção 5, saída JSON validada, retry, logs.
- Serviço Windows ou tarefa agendada para iniciar com o PC.
- **Aceite:** ✅ resumo em PT-BR coerente em ≤ 90 s para Reel de 60 s; ✅ PC desligado → jobs processados ao religar; ✅ card e WhatsApp atualizados com o resumo.

### Fase 6 — Robustez e observabilidade
- Heartbeat: se `vigiar` ficar > 2 min sem sucesso → alerta para o admin.
- Status do worker IA no painel (último batimento).
- Teste de carga: 10 perfis, 24 h, sem duplicatas e dentro do orçamento.
- Revisão de segurança: RLS, segredos, CORS, rate limit nas funções públicas.
- **Aceite:** ✅ 24 h rodando sem intervenção; ✅ latência média e p95 visíveis; ✅ custo projetado ≤ orçamento.

### Fase 7 — Deploy e entrega
- Supabase Cloud (migrations revisadas) + Vercel (painel) + domínio.
- Decisão do WhatsApp de produção (6.1) registrada.
- `docs/runbook.md` (operar, religar worker, trocar fonte, rotacionar chaves).
- Vídeo curto de demonstração para o cliente (e material para o Behance).
- **Aceite:** ✅ cliente recebendo alertas reais; ✅ runbook entregue.

### Fase 8 — [futuro] App nativo (Expo)
- `apps/mobile` com Expo + EAS, Supabase Auth, `expo-notifications` registrando `dispositivos.tipo='expo'`, telas Ao vivo / Vídeo / Perfis com os mesmos tokens. iPhone primeiro.

---

## 11. Riscos e mitigação

| Risco | Mitigação |
|---|---|
| Provedor muda/cai/fica caro | Padrão Adapter + fallback para Business Discovery + circuit breaker |
| Custo de "segundos" alto | Agendamento adaptativo, orçamento com teto, seletor Turbo/Adaptativo/Econômico |
| Frescor do provedor (cache) estraga o "segundos" | Medido na Fase 0; latência real exibida no painel |
| Post fixado gera alerta falso | Regra 3.2.3 + teste |
| URL do vídeo expira | `baixar-video` roda logo após o alerta |
| PC desligado | Alerta e push independem do PC; resumo entra na fila; WhatsApp de produção fora do PC |
| Ban do número de WhatsApp | Número dedicado; volume baixo; opção pela API oficial |
| iPhone sem push | Onboarding de instalação do PWA; app nativo na Fase 8 |
| VRAM de 8 GB | Um modelo por vez, `keep_alive` curto, modelos ≤ 8B quantizados |
| Termos de uso das plataformas | Nada de login automatizado no Instagram; autorização dos criadores documentada pelo cliente |

---

## 12. Pendências para confirmar com o cliente
- Lista dos 10 perfis (e se são contas Business/Creator).
- Perfil de custo desejado (Turbo / Adaptativo / Econômico) após ver os números da Fase 0.
- Número de WhatsApp dedicado e quem recebe os alertas.
- Quem paga custos recorrentes: provedor de API, Supabase/Vercel (se sair do gratuito), WhatsApp de produção, conta Apple na fase mobile.
- Registro da autorização dos influenciadores para repost.

---

## 13. Definição de pronto do MVP
- [ ] Vídeo novo de qualquer um dos 10 perfis gera alerta no WhatsApp e no push em segundos (latência real registrada).
- [ ] Painel ao vivo com a identidade Vizualizer, instalável como PWA.
- [ ] Botão "Baixar e repostar" entregando o arquivo.
- [ ] Resumo do vídeo por IA local chegando em seguida.
- [ ] 24 h sem duplicatas, dentro do orçamento, com runbook.

---

## 14. Registro de decisões (atualizar a cada fase)

| Data | Fase | Decisão | Motivo |
|---|---|---|---|
| 2026-11-01 | — | Plano criado | — |
| 2026-11-01 | 0 | Recomendação provisória: HikerAPI (principal) + Business Discovery (reserva); spike de medição **não rodado** | Sem chave de provedor; preços conflitantes nas fontes (ver `docs/spike-fontes.md`) |
| 2026-11-01 | 0 | Supabase: Edge Functions Free 500 mil / Pro 2 mi invocações/mês; Cron mínimo 1 s | Context7 (doc oficial); tick de 10 s ≈ 259 mil/mês só do `vigiar` |
| 2026-11-01 | 1 | Supabase local nas portas 564xx; regras puras em `supabase/functions/_shared/regras` reexportadas por `packages/shared` | Conflito de porta no Docker; Edge runtime só enxerga `supabase/functions` |
| 2026-11-01 | 2 | Dedupe + enfileiramento numa única RPC `registrar_posts`; perfis arrendados por 60 s | Idempotência atômica com ticks sobrepostos (teste de carga: 0 duplicatas) |
| 2026-11-01 | 3 | Funções só aceitam a service key; WhatsApp travado em `WHATSAPP_NUMERO_TESTE` | Anon key é pública; evitar envio acidental |
| 2026-11-01 | 4 | Painel com shadcn/ui customizado à marca (tokens `--viz-*` nas variáveis semânticas); radar como elemento central. MCP do shadcn em `.mcp.json` | Na noite o MCP faltou e os componentes foram à mão; integrado no mesmo dia |
| 2026-11-01 | 5 | Texto: `qwen3:8b` na RX 7600 (ROCm). Visão e whisper.cpp pendentes | Únicos recursos instalados; ver `docs/benchmark-ia.md` |
| 2026-11-01 | 6 | Heartbeat com aviso ao admin; teste de carga acelerado aprovado | `docs/carga.md`, `docs/seguranca.md` |
| 2026-11-01 | 7 | Deploy **não** executado; runbook e checklist prontos | Regra do modo noturno; `docs/runbook.md` |

---

## Apêndice A — Prompts por fase (colar no Claude Code)

**Prompt 0 — Setup + Fase 0**
> Leia `PLANO-VIZUALIZER.md` inteiro. Use o Superpowers. 1) Crie o `CLAUDE.md` a partir do template do vibe-coding-toolkit com as regras da seção 9.3. 2) Confirme que Context7 está disponível. 3) Rode `superpowers:writing-plans` para a **Fase 0** e me mostre o plano antes de executar. Comandos em PowerShell. Pare em cada checkpoint.

**Prompt 1 — Fundação**
> Leia `PLANO-VIZUALIZER.md` e `docs/spike-fontes.md`. Execute a **Fase 1** com `superpowers:writing-plans` + `executing-plans`. Escreva a migration da seção 4 e PARE para eu revisar o SQL antes de aplicar. Crie `packages/tokens` com a seção 7.1. Commits em PT-BR.

**Prompt 2 — Motor de detecção**
> Leia `PLANO-VIZUALIZER.md`. Execute a **Fase 2** com `superpowers:test-driven-development`: escreva primeiro os testes das 6 regras da seção 3.2 e do agendamento da 3.3, depois implemente. Adapters em paralelo com `subagent-driven-development`. Consulte Context7 para Supabase Cron, pg_net e Edge Functions antes de codar.

**Prompt 3 — Notificações**
> Leia `PLANO-VIZUALIZER.md`. Execute a **Fase 3** (seções 6.1, 6.2, 6.3). Interface `CanalNotificacao` com WhatsApp (Evolution API via Cloudflare Tunnel), Web Push (VAPID) e stub Expo. Consulte Context7 para a lib de Web Push compatível com Deno. Alerta nunca espera download nem IA.

**Prompt 4 — Painel**
> Leia `PLANO-VIZUALIZER.md`, seção 7 inteira, e use os assets de `assets/marca/`. Execute a **Fase 4** com as skills `frontend-design`, `design-taste-frontend`, `build-awwwards-quality-sites`, `vercel-react-best-practices`, shadcn-ui MCP e `motion-design` para o radar. Fidelidade total aos tokens, fontes e conceito "Vigiar · Avisar · Agir". Comece pela tela Ao vivo e me mostre antes de seguir.

**Prompt 5 — Worker IA local**
> Leia `PLANO-VIZUALIZER.md`, seção 5. Execute a **Fase 5**. Primeiro valide Ollama com a RX 7600 no Windows e o whisper.cpp com Vulkan; depois faça o benchmark de modelos que caibam em 8 GB e me apresente a tabela antes de escolher. Use `systematic-debugging` em qualquer falha de GPU.

**Prompt 6 — Robustez, deploy e entrega**
> Leia `PLANO-VIZUALIZER.md`. Execute as **Fases 6 e 7**. Depois `superpowers:requesting-code-review` no projeto inteiro, `verification-before-completion` contra a seção 13, e escreva `docs/runbook.md`. Atualize a seção 14.
