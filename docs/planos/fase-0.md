# Fase 0 — Spike de Fontes: Plano de Implementação

> **Para executores:** usar `superpowers:executing-plans` (checkpoint a cada tarefa). Passos com checkbox `- [ ]`.

**Meta:** medir provedores de API de Instagram (e Business Discovery) e entregar `docs/spike-fontes.md` com recomendação e custo mensal nos 3 perfis de uso.

**Arquitetura:** pasta `scripts/` isolada (ainda sem monorepo — Fase 1). Um coletor `spike-fontes.ts` chama cada provedor via função `Provedor` mínima, grava cada amostra em JSONL; funções puras de estatística (`percentil`, `atrasoFrescor`, `custoMensal`) têm teste Vitest. Análise lê o JSONL.

**Stack:** TypeScript, `tsx`, Vitest, pnpm, `fetch` nativo (Node 20+).

**Spec:** `PLANO-VIZUALIZER.md` seções 3.1, 3.3, 10 (Fase 0).

## Restrições globais

- Comandos em PowerShell; commits em PT-BR, pequenos.
- Segredos (tokens de provedor) só em `scripts/.env`, listado em `.gitignore`.
- Antes de integrar cada provedor: consultar documentação oficial / Context7.
- Chamada tem de ser **síncrona** (resposta com os posts na mesma requisição); ator assíncrono (ex.: Apify) é descartado como fonte do tick.
- Sem login automatizado no Instagram.
- Aceite: frescor p95 ≤ 30 s **e** latência de resposta p95 ≤ 3 s, ou decisão registrada de aceitar o que existir.

## Foco de revisão (casos que o plano não testa por padrão)

1. Provedor devolve **cache** (mesmo post antigo por minutos) → frescor medido pelo 1º aparecimento de cada `shortcode`, não pela hora da resposta.
2. Post **fixado** no topo → registrar `is_pinned`/ordem; nunca assumir "primeiro = mais novo".
3. Resposta com **erro/429/timeout** → conta como falha na taxa de erro, não derruba o coletor.
4. Perfil **sem posts novos** durante as 2 h → frescor indefinido; relatório deve dizer "sem amostra", não 0.
5. Campo `taken_at` ausente → provedor reprovado nesse critério.

## Estrutura de arquivos

- `scripts/package.json`, `scripts/tsconfig.json`, `scripts/.env.example` — setup isolado
- `scripts/lib/estatisticas.ts` (+ `estatisticas.test.ts`) — funções puras
- `scripts/lib/provedores.ts` — interface `Provedor` e um adapter por provedor escolhido
- `scripts/spike-fontes.ts` — coletor (CLI)
- `scripts/analisar-spike.ts` — lê JSONL, imprime tabela
- `scripts/saida/` — JSONL bruto (ignorado no git); `fixtures/ig/*.json` — respostas reais para o mock
- `docs/spike-fontes.md` — entregável

---

### Tarefa 1: Setup isolado do spike

**Arquivos:** criar `scripts/package.json`, `scripts/tsconfig.json`, `scripts/.env.example`, `.gitignore` (raiz).

**Interfaces — Produz:** comandos `pnpm -C scripts test` e `pnpm -C scripts spike`.

- [ ] **Passo 1:** `git init` na raiz (hoje não é repositório) e criar `.gitignore` com `.env`, `node_modules`, `scripts/saida/`.
- [ ] **Passo 2:** criar `scripts/package.json` (type `module`, devDeps `typescript`, `tsx`, `vitest`, `@types/node`; scripts `test`=`vitest run`, `spike`=`tsx spike-fontes.ts`). Versões conferidas no Context7/npm antes de fixar.
- [ ] **Passo 3:** `pnpm -C scripts install` → esperado: sem erro. `pnpm -C scripts test` → esperado: "No test files found" (ok).
- [ ] **Passo 4:** commit `chore: setup isolado do spike da fase 0`.

**⏸ Checkpoint 1** — confirmar com Matheus.

### Tarefa 2: Estatísticas puras (TDD)

**Arquivos:** criar `scripts/lib/estatisticas.ts`, `scripts/lib/estatisticas.test.ts`.

**Interfaces — Produz:**
```ts
export function percentil(valores: number[], p: number): number | null; // p em 0..100; [] -> null
export function atrasoFrescor(publicadoEm: Date, vistoPrimeiraVezEm: Date): number; // segundos
export function custoMensal(p: { perfis: number; horasQuentes: number; intervaloQuenteS: number; intervaloFrioS: number; precoPorReq: number }): { reqPorPerfilDia: number; reqMes: number; custoMes: number };
```

- [ ] **Passo 1: testes que falham** — `percentil([1,2,3,4,5],50)===3`; `percentil([],95)===null`; `percentil([10],95)===10`; `atrasoFrescor` com 12 s de diferença retorna `12`; `custoMensal({perfis:10,horasQuentes:6,intervaloQuenteS:10,intervaloFrioS:120,precoPorReq:0})` retorna `reqPorPerfilDia===2700` e `reqMes===810000` (exemplo da seção 3.3 do plano).
- [ ] **Passo 2:** `pnpm -C scripts test` → esperado: FALHA (funções não definidas).
- [ ] **Passo 3:** implementar as 3 funções (percentil por interpolação linear/nearest-rank — escolher um e documentar em comentário; fórmula de custo exatamente a da seção 3.3).
- [ ] **Passo 4:** `pnpm -C scripts test` → esperado: PASSA.
- [ ] **Passo 5:** commit `feat: estatisticas puras do spike (percentil, frescor, custo)`.

**⏸ Checkpoint 2.**

### Tarefa 3: Levantamento de provedores e limites do Supabase (pesquisa)

**Arquivos:** criar `docs/spike-fontes.md` (rascunho: tabela de candidatos + seção de limites Supabase).

- [ ] **Passo 1:** pesquisar (web + docs oficiais) provedores de API de Instagram com chamada síncrona por perfil; para cada um registrar: preço/requisição ou plano fixo, rate limit, campos retornados (`taken_at`, tipo de mídia, `is_pinned`, URL do vídeo), alegação de cache. Sem inventar dados: onde a documentação não disser, marcar "não informado".
- [ ] **Passo 2:** propor **2–3 candidatos** + Business Discovery para o Matheus aprovar (ele cria as contas/chaves e paga eventuais créditos).
- [ ] **Passo 3:** registrar limites do Supabase já levantados no Context7: Edge Functions Free = 500 mil invocações/mês, Pro = 2 mi (+US$ 2 por mi); Cron mínimo de 1 s. Tick de 10 s ≈ 259 mil/mês → cabe no Free só com folga limitada (notificar/baixar-video somam). Confirmar Storage e Realtime na doc atual e anotar.
- [ ] **Passo 4:** commit `docs: rascunho do spike de fontes (candidatos e limites)`.

**⏸ Checkpoint 3 — decisão do Matheus:** quais provedores testar e fornecimento das chaves. Sem isso, não segue.

### Tarefa 4: Adapters de coleta dos provedores aprovados

**Arquivos:** criar `scripts/lib/provedores.ts`, `scripts/.env.example`; fixtures em `fixtures/ig/`.

**Interfaces — Consome:** nada. **Produz:**
```ts
export interface Amostra { provedor: string; username: string; iniciadoEm: string; duracaoMs: number; ok: boolean; erro?: string; posts: PostBruto[] }
export interface PostBruto { shortcode: string; tipo: 'video'|'imagem'|'carrossel'; fixado: boolean|null; publicadoEm: string|null; urlVideo?: string }
export interface Provedor { nome: string; consultar(username: string): Promise<Amostra> }
```

- [ ] **Passo 1:** para cada provedor aprovado, escrever um adapter `Provedor` que normaliza a resposta para `PostBruto` (campo ausente → `null`, nunca valor inventado) e captura erro/timeout (10 s) em `ok:false`.
- [ ] **Passo 2:** teste Vitest por adapter usando 1 resposta real salva em `fixtures/ig/<provedor>-<perfil>.json`: `shortcode` não vazio, `publicadoEm` ISO válido ou `null`.
- [ ] **Passo 3:** `pnpm -C scripts test` → PASSA.
- [ ] **Passo 4:** commit `feat: adapters de coleta dos provedores do spike`.

**⏸ Checkpoint 4** — Matheus confere 1 resposta real por provedor.

### Tarefa 5: Coletor e Business Discovery

**Arquivos:** criar `scripts/spike-fontes.ts`; adapter Business Discovery em `scripts/lib/provedores.ts`.

- [ ] **Passo 1:** `spike-fontes.ts`: args `--perfis a,b,c --intervalo 15 --duracao 7200`; a cada intervalo consulta todos os provedores em paralelo e anexa cada `Amostra` em `scripts/saida/<data>.jsonl`; Ctrl+C encerra limpo.
- [ ] **Passo 2:** adapter Business Discovery (Graph API) com conta profissional de teste do Matheus; respeitar o limite (~200 chamadas/h): intervalo próprio, mais lento.
- [ ] **Passo 3:** rodada curta de validação: `pnpm -C scripts spike --perfis <p1> --intervalo 15 --duracao 60` → esperado: ≥ 4 linhas no JSONL por provedor, sem crash.
- [ ] **Passo 4:** commit `feat: coletor do spike e Business Discovery`.

**⏸ Checkpoint 5.**

### Tarefa 6: Análise

**Arquivos:** criar `scripts/analisar-spike.ts`.

**Interfaces — Consome:** `percentil`, `atrasoFrescor` (Tarefa 2).

- [ ] **Passo 1:** teste com JSONL sintético: provedor com 1 erro em 4 amostras → taxa de erro 25%; post visto 1ª vez 12 s após `publicadoEm` → frescor 12 s; sem post novo → "sem amostra".
- [ ] **Passo 2:** implementar: por provedor, latência p50/p95, taxa de erro, frescor p50/p95 (1º aparecimento por `shortcode`), presença de `taken_at`/`fixado`/`urlVideo`.
- [ ] **Passo 3:** testes passam; commit `feat: analise do spike`.

**⏸ Checkpoint 6.**

### Tarefa 7: Coleta real (2 h) e entregáveis

**Arquivos:** modificar `docs/spike-fontes.md`; criar fixtures finais; modificar `PLANO-VIZUALIZER.md` seção 14.

- [ ] **Passo 1:** Matheus escolhe 3 perfis ativos (idealmente com posts frequentes) e roda `pnpm -C scripts spike --perfis ... --intervalo 15 --duracao 7200` em horário de pico. (Eu só rodo se ele pedir.)
- [ ] **Passo 2:** `pnpm -C scripts tsx analisar-spike.ts` → colar tabela no doc.
- [ ] **Passo 3:** completar `docs/spike-fontes.md`: tabela comparativa, recomendação, custo mensal em Turbo/Adaptativo/Econômico usando `custoMensal` com o preço real, consumo Edge Functions vs plano Supabase.
- [ ] **Passo 4:** copiar respostas reais representativas (incl. post fixado, vídeo, imagem) para `fixtures/ig/` para o mock da Fase 2.
- [ ] **Passo 5:** verificar critério de aceite (p95 frescor ≤ 30 s, latência p95 ≤ 3 s) ou registrar decisão; adicionar linha na seção 14 do plano.
- [ ] **Passo 6:** commit `docs: resultado do spike de fontes e decisao registrada`.

**⏸ Checkpoint final — Matheus aprova a fonte escolhida antes da Fase 1.**
