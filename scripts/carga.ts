// `pnpm carga` — teste de carga acelerado (Fase 6), só no Supabase LOCAL.
// Parte 1 (real): 10 perfis mock, N rodadas de tick com 2 `vigiar` concorrentes + o cron, posts aleatórios.
//   Confere: todo post novo vira exatamente 1 vídeo, 1 job_ia e 1 alerta por dispositivo; nada além disso.
// Parte 2 (relógio virtual de 24 h): agenda os mesmos 10 perfis com as funções puras de produção
//   (janelas quentes, jitter, orçamento) e compara as requisições do dia com o orçamento mensal / 30.

import { writeFileSync } from "node:fs";
import { custoMensal, proximoCheck, type Janela } from "../packages/shared/src/agendamento.ts";
import { chamar, db, esperar } from "./local.ts";

const PERFIS = Array.from({ length: 10 }, (_, i) => `carga-${String(i).padStart(2, "0")}`);
const RODADAS = Number(process.argv[2] ?? 144); // 144 rodadas ≈ 1 a cada 10 min de um dia
const PROB_POST = 0.4; // ~58 posts no total ≈ 6 por perfil/dia
const t0 = Date.now();
const log = (s: string) => console.log(`[+${((Date.now() - t0) / 1000).toFixed(0).padStart(4)} s] ${s}`);

async function preparar() {
  await db.from("perfis").delete().like("username", "carga-%");
  await db.from("config").delete().like("chave", "mock:carga-%");
  const antigo = new Date(Date.now() - 3 * 86400_000).toISOString();
  await db.from("config").insert(
    PERFIS.map((u) => ({
      chave: `mock:${u}`,
      valor: [
        { shortcode: `${u}-fixado`, tipo: "video", ehReels: true, fixado: true, publicadoEm: antigo, permalink: `https://www.instagram.com/reel/${u}-fixado/` },
        { shortcode: `${u}-velho`, tipo: "imagem", ehReels: false, fixado: false, publicadoEm: antigo, permalink: `https://www.instagram.com/p/${u}-velho/` },
      ],
    })),
  );
  await db.from("perfis").insert(PERFIS.map((u) => ({ username: u })));
  await chamar("vigiar"); // baseline (lim 10 por tick)
  await chamar("vigiar");
  const { count } = await db.from("perfis").select("id", { count: "exact", head: true }).like("username", "carga-%").eq("baseline_feito", true);
  log(`baseline feito em ${count}/10 perfis`);
}

async function postar(u: string, n: number) {
  const { data } = await db.from("config").select("valor").eq("chave", `mock:${u}`).single();
  const sc = `${u}-p${n}`;
  const novo = { shortcode: sc, tipo: "video", ehReels: true, fixado: false, publicadoEm: new Date().toISOString(), permalink: `https://www.instagram.com/reel/${sc}/`, urlVideo: "mock://amostra.mp4" };
  await db.from("config").update({ valor: [novo, ...(data!.valor as unknown[])] }).eq("chave", `mock:${u}`);
  return sc;
}

async function parteReal() {
  const postados: string[] = [];
  for (let r = 0; r < RODADAS; r++) {
    if (Math.random() < PROB_POST) postados.push(await postar(PERFIS[Math.floor(Math.random() * 10)]!, r));
    await db.from("perfis").update({ proximo_check_em: new Date().toISOString() }).like("username", "carga-%");
    await Promise.all([chamar("vigiar"), chamar("vigiar")]); // ticks sobrepostos de propósito
    if (r % 24 === 0) log(`rodada ${r}/${RODADAS} · ${postados.length} posts`);
  }
  await esperar(3000);

  const { data: perfis } = await db.from("perfis").select("id").like("username", "carga-%");
  const ids = perfis!.map((p) => p.id);
  // Filtra pelos 10 perfis via join (um .in() com centenas de UUIDs estoura a URL do PostgREST).
  const sel = <T>(r: { data: T | null; error: { message: string } | null }, onde: string): T => {
    if (r.error) throw new Error(`${onde}: ${r.error.message}`);
    return r.data!;
  };
  const videos = sel(await db.from("videos").select("id,shortcode,ja_visto_no_baseline,latencia_ms").in("perfil_id", ids).limit(5000), "videos");
  const alertados = videos.filter((v) => !v.ja_visto_no_baseline);
  const vids = alertados.map((v) => v.id);
  const jobs = sel(await db.from("jobs_ia").select("video_id, videos!inner(perfil_id)").in("videos.perfil_id", ids).limit(5000), "jobs");
  const notifs = sel(
    await db.from("notificacoes").select("video_id,dispositivo_id, videos!inner(perfil_id)").eq("tipo_msg", "alerta").in("videos.perfil_id", ids).limit(5000),
    "notificações",
  );
  const { count: disp } = await db.from("dispositivos").select("id", { count: "exact", head: true }).eq("ativo", true);

  const dup = (xs: string[]) => xs.length - new Set(xs).size;
  const faltando = postados.filter((s) => !alertados.some((v) => v.shortcode === s));
  const extras = alertados.filter((v) => !postados.includes(v.shortcode)).map((v) => v.shortcode);
  const lat = alertados.map((v) => v.latencia_ms).sort((a, b) => a - b);
  return {
    postados: postados.length,
    alertados: alertados.length,
    faltando,
    extras,
    videosDuplicados: dup(videos.map((v) => v.shortcode)),
    jobsDuplicados: dup(jobs.map((j) => j.video_id)),
    jobsFaltando: vids.length - new Set(jobs.map((j) => j.video_id)).size,
    alertasDuplicados: dup(notifs.map((n) => `${n.video_id}:${n.dispositivo_id}`)),
    alertasEsperados: vids.length * (disp ?? 0),
    alertasCriados: notifs.length,
    latenciaP50: lat[Math.floor(lat.length * 0.5)] ?? null,
    latenciaP95: lat[Math.floor(lat.length * 0.95)] ?? null,
  };
}

function parteVirtual() {
  // 6 h quentes (18–24 h) por perfil, 10 s quente / 120 s frio: o exemplo "Adaptativo" da seção 3.3.
  const janelas: Janela[] = [{ dow: [1, 2, 3, 4, 5, 6, 7], inicio: "18:00", fim: "00:00" }];
  const inicio = new Date("2026-11-02T03:00:00Z"); // 00:00 em São Paulo
  const fim = inicio.getTime() + 86400_000;
  let req = 0;
  for (let p = 0; p < 10; p++) {
    let t = new Date(inicio.getTime() + p * 997);
    while (t.getTime() < fim) {
      req++;
      t = proximoCheck({ intervaloQuenteS: 10, intervaloFrioS: 120, janelas }, t);
    }
  }
  const esperado = custoMensal({ perfis: 10, horasQuentes: 6, intervaloQuenteS: 10, intervaloFrioS: 120, precoPorReq: 0 });
  return { reqDia: req, reqDiaFormula: esperado.reqPorPerfilDia * 10, orcamentoDia: 810_000 / 30 };
}

async function main() {
  log(`teste de carga: ${PERFIS.length} perfis, ${RODADAS} rodadas, 2 ticks concorrentes por rodada`);
  await preparar();
  const real = await parteReal();
  const virtual = parteVirtual();
  const ok =
    real.faltando.length === 0 && real.extras.length === 0 && real.videosDuplicados === 0 && real.jobsDuplicados === 0 &&
    real.jobsFaltando === 0 && real.alertasDuplicados === 0 && real.alertasCriados === real.alertasEsperados &&
    virtual.reqDia <= virtual.orcamentoDia;
  const md = `# Teste de carga acelerado (Fase 6) — ${new Date().toISOString()}

Comando: \`pnpm carga ${RODADAS}\` (Supabase local, fonte mock, cron ligado em paralelo).

## Parte real: ${RODADAS} rodadas × 2 \`vigiar\` concorrentes, 10 perfis

| Métrica | Valor |
|---|---|
| Posts novos publicados no mock | ${real.postados} |
| Vídeos alertados | ${real.alertados} |
| Posts não detectados | ${real.faltando.length} ${real.faltando.join(", ")} |
| Alertas indevidos (fixado/antigo/baseline) | ${real.extras.length} ${real.extras.join(", ")} |
| Vídeos duplicados | ${real.videosDuplicados} |
| Jobs de IA duplicados / faltando | ${real.jobsDuplicados} / ${real.jobsFaltando} |
| Alertas criados / esperados (vídeos × dispositivos) | ${real.alertasCriados} / ${real.alertasEsperados} |
| Alertas duplicados | ${real.alertasDuplicados} |
| Latência de detecção p50 / p95 (mock) | ${real.latenciaP50} ms / ${real.latenciaP95} ms |

## Parte virtual: 24 h de agendamento (funções de produção)

| Métrica | Valor |
|---|---|
| Requisições no dia (simulado, com jitter) | ${virtual.reqDia.toLocaleString("pt-BR")} |
| Requisições no dia (fórmula 3.3) | ${virtual.reqDiaFormula.toLocaleString("pt-BR")} |
| Orçamento por dia (810 mil / 30) | ${virtual.orcamentoDia.toLocaleString("pt-BR")} |

**Resultado: ${ok ? "✅ zero duplicatas, nenhum post perdido, dentro do orçamento" : "❌ ver linhas acima"}**
`;
  writeFileSync("docs/carga.md", md);
  console.log(md);
  process.exit(ok ? 0 : 1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
