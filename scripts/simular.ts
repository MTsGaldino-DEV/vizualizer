// `pnpm simular` — faz um perfil falso "postar" um Reels e mostra o caminho inteiro no log:
// detecção → linha em videos → notificações → download → job_ia.
// Só fala com o Supabase LOCAL (ver scripts/local.ts).

import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync } from "node:fs";
import { chamar, db, esperar } from "./local.ts";

const AMOSTRA = "scripts/saida/amostra.mp4";
const PERFIS = ["mock-perfil-a", "mock-perfil-b"];
const t0 = Date.now();
const log = (s: string) => console.log(`[+${((Date.now() - t0) / 1000).toFixed(1).padStart(5)} s] ${s}`);

async function prepararAmostra() {
  if (!existsSync(AMOSTRA)) {
    mkdirSync("scripts/saida", { recursive: true });
    // 12 s de barras coloridas + tom de 440 Hz (sem fala) — suficiente para o pipeline de IA.
    execFileSync("ffmpeg", ["-y", "-loglevel", "error", "-f", "lavfi", "-i", "testsrc2=size=720x1280:rate=30:duration=12",
      "-f", "lavfi", "-i", "sine=frequency=440:duration=12", "-c:v", "libx264", "-pix_fmt", "yuv420p", "-c:a", "aac", "-shortest", AMOSTRA]);
  }
  await db.storage.from("videos-temp").upload("amostras/amostra.mp4", readFileSync(AMOSTRA), { contentType: "video/mp4", upsert: true });
}

async function prepararPerfis() {
  for (const u of PERFIS) {
    const { posts } = JSON.parse(readFileSync(`fixtures/ig/${u}.json`, "utf8"));
    const { data: existente } = await db.from("config").select("chave").eq("chave", `mock:${u}`).maybeSingle();
    if (!existente) await db.from("config").insert({ chave: `mock:${u}`, valor: posts });
    await db.from("perfis").upsert({ username: u, nome_exibicao: u.replace("mock-", "").replace("-", " ") }, { onConflict: "username", ignoreDuplicates: true });
  }
  const numero = process.env.WHATSAPP_NUMERO_TESTE ?? "";
  const { data: disp } = await db.from("dispositivos").select("id").eq("tipo", "whatsapp").is("usuario_id", null).maybeSingle();
  if (!disp) await db.from("dispositivos").insert({ tipo: "whatsapp", destino: { numero: numero || "simulado" } });
}

async function main() {
  log("preparando amostra de vídeo, perfis mock e dispositivo WhatsApp de teste");
  await prepararAmostra();
  await prepararPerfis();

  const { data: semBaseline } = await db.from("perfis").select("id,username").in("username", PERFIS).eq("baseline_feito", false);
  if (semBaseline?.length) {
    log(`baseline de ${semBaseline.map((p) => "@" + p.username).join(", ")} (posts existentes não alertam)`);
    await db.from("perfis").update({ proximo_check_em: new Date().toISOString() }).in("username", PERFIS);
    await chamar("vigiar");
  }

  const username = PERFIS[0]!;
  const shortcode = `SIM${Date.now().toString(36).toUpperCase()}`;
  const { data: cfg } = await db.from("config").select("valor").eq("chave", `mock:${username}`).single();
  const novo = {
    shortcode, tipo: "video", ehReels: true, fixado: false, publicadoEm: new Date().toISOString(),
    legenda: "Reels simulado pelo pnpm simular", permalink: `https://www.instagram.com/reel/${shortcode}/`,
    urlVideo: "mock://amostra.mp4", duracaoS: 12,
  };
  await db.from("config").update({ valor: [novo, ...(cfg!.valor as unknown[])] }).eq("chave", `mock:${username}`);
  log(`@${username} "postou" o Reels ${shortcode}`);

  await db.from("perfis").update({ proximo_check_em: new Date().toISOString() }).eq("username", username);
  log(`tick do vigiar → ${JSON.stringify(await chamar("vigiar"))}`);

  const vistos = new Set<string>();
  const ver = (chave: string, msg: string) => { if (!vistos.has(chave)) { vistos.add(chave); log(msg); } };
  for (let i = 0; i < 60; i++) {
    const { data: v } = await db.from("videos").select("id,status,latencia_ms,storage_path,resumo").eq("shortcode", shortcode).maybeSingle();
    if (v) {
      ver("video", `✅ detecção: linha em videos (latência ${v.latencia_ms} ms, status ${v.status})`);
      const { data: ns } = await db.from("notificacoes").select("id,status,erro,dispositivos(tipo)").eq("video_id", v.id);
      for (const n of ns ?? []) if (n.status !== "pendente") ver(`n${n.id}${n.status}`, `✅ notificação ${(n.dispositivos as unknown as { tipo: string }).tipo}: ${n.status}${n.erro ? ` (${n.erro})` : ""}`);
      if (v.storage_path) ver("dl", `✅ download: ${v.storage_path}`);
      const { data: j } = await db.from("jobs_ia").select("status").eq("video_id", v.id).maybeSingle();
      if (j) ver(`job${j.status}`, `✅ job_ia: ${j.status}`);
      if (v.resumo) { ver("resumo", `✅ resumo: ${v.resumo}`); break; }
      if (v.storage_path && j && ns?.every((n) => n.status !== "pendente") && !process.argv.includes("--esperar-resumo")) break;
    }
    await esperar(1000);
  }
  if (!vistos.has("video")) { log("❌ vídeo não detectado"); process.exit(1); }
  log("fim. Use --esperar-resumo com o worker-ia rodando para ver o resumo.");
}

main().catch((e) => { console.error(e); process.exit(1); });
