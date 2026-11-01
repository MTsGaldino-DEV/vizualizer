# Spike de fontes — Fase 0 (modo noturno, sem medição real)

> **Estado:** pesquisa documental apenas. `PROVEDOR_IG_API_KEY` não existe no `.env`, então **nenhuma medição de latência/frescor foi feita**. Os números abaixo vêm de páginas públicas e de blogs de terceiros (alguns de fornecedores concorrentes) e **precisam ser conferidos nas páginas oficiais de preço** antes de qualquer contratação. Fixtures são sintéticas.

## 1. Candidatos

| Fonte | Modelo de cobrança (reportado) | Síncrono? | Observações | Link |
|---|---|---|---|---|
| **HikerAPI** | Por requisição. Fontes divergem: US$ 0,02 (plano Start) → US$ 0,001 (Standard) → US$ 0,00069 (Business); outro guia cita US$ 1/1.000 req | Sim (REST direto) | Sem latência medida nas fontes; avaliações citam custo que escala rápido | [Capterra](https://capterra.com/p/10039767/HikerAPI/), [xpoz.ai](https://www.xpoz.ai/blog/guides/instagram-api-pricing-2026/) |
| **ScrapeCreators** | Créditos: ~US$ 47 / 25 mil créditos ≈ US$ 1,88/1.000; 100 créditos grátis; falhas não cobradas (alegado) | Sim (`/v2/instagram/user/posts`) | Benchmark do próprio fornecedor: mediana ~3,1 s, p95 ~25,7 s (para Reels). **p95 estoura o critério de 3 s.** Endpoint pode pedir user id numérico | [Benchmark](https://scrapecreators.com/blog/apify-instagram-reels-scraper-benchmark), [Comparativo](https://www.socialcrawl.dev/blog/best-instagram-data-apis-2026) |
| **Apify (atores)** | Por resultado (US$ 0,05–5 / 1.000 resultados, conforme o ator) | Existe `run-sync-get-dataset-items`, mas o ator precisa "subir" | **Descartado como fonte do tick** (plano seção 3.1); bom para backfill | [exemplo](https://apify.com/dami_studio/instagram-scraper) |
| **Business Discovery (Graph API)** | Grátis, ~200 chamadas/h por usuário do app | Sim | Só contas Business/Creator; **não serve para segundos**. Backup/conferência | docs Meta |

## 2. Recomendação provisória

1. **Fonte principal do tick: HikerAPI** (menor preço/req reportado, REST síncrono). *Hipótese não medida.* ScrapeCreators como segunda opção (p95 reportado alto).
2. **Fonte B: Business Discovery**, para as contas que forem Business/Creator.
3. Primeira ação de manhã: criar chave de teste (HikerAPI tem plano mínimo US$ 20; ScrapeCreators tem 100 créditos grátis), pôr em `.env` e rodar o spike de 2 h do plano `docs/planos/fase-0.md`.
4. Aceite da Fase 0 (frescor p95 ≤ 30 s e latência p95 ≤ 3 s): **❌ não verificado**.

## 3. Custo mensal — 10 perfis (fórmula da seção 3.3)

`reqMes = perfis × (horasQuentes×3600/quente + horasFrias×3600/frio) × 30`

| Perfil | Definição | Req/mês | Custo a US$ 0,001/req | Custo a US$ 0,00188/req |
|---|---|---|---|---|
| **Turbo** | 24 h a cada 10 s | 2.592.000 | US$ 2.592 | US$ 4.873 |
| **Adaptativo** | 6 h a 10 s + 18 h a 120 s | 810.000 | US$ 810 | US$ 1.523 |
| **Econômico** | 24 h a cada 300 s | 86.400 | US$ 86 | US$ 162 |

Conclusão: "segundos" em tempo integral é caro; o Adaptativo é o ponto de partida, e o orçamento (3.3) precisa de teto. Janelas quentes mais curtas reduzem o custo quase linearmente.

## 4. Limites do Supabase (Context7, doc oficial)

- Edge Functions: **Free 500 mil invocações/mês; Pro 2 mi** (+US$ 2/mi extra).
- Tick de 10 s ≈ 259 mil invocações/mês só do `vigiar` → cabe no Free com folga pequena (somar `notificar` e `baixar-video`); Pro é seguro.
- Cron (pg_cron): intervalo mínimo de 1 s; aceita sintaxe `'10 seconds'`.
- Storage e Realtime: **não conferidos esta noite** — checar antes do deploy.

## 5. Fixtures

`fixtures/ig/mock-perfil-a.json` e `mock-perfil-b.json`: **sintéticas** (post fixado antigo, Reels recente, carrossel, imagem, vídeo de feed e vídeo antigo). Servem ao adapter mock; substituir por respostas reais quando houver chave.
