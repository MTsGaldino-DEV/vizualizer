// Worker de IA local (roda no PC do Matheus, só conexões de saída).
// Escuta `jobs_ia` via Realtime + polling de segurança a cada 30 s; batimento em config.worker_ia_batimento.
import { existsSync } from "node:fs";
import { mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createClient } from "@supabase/supabase-js";
import { criarMotorOllama, motorMock } from "./ia";
import { extrairMidia, transcrever } from "./midia";
import { processarProximo, type Repositorio } from "./pipeline";

if (existsSync(".env")) process.loadEnvFile(".env");
const env = (k: string) => process.env[k] || undefined;

const URL_SB = env("SUPABASE_URL") ?? "http://127.0.0.1:56421";
const local = /127\.0\.0\.1|localhost/.test(URL_SB);
// Chave demo pública do Supabase CLI: só vale no banco local.
const CHAVE =
  env("SUPABASE_SERVICE_ROLE_KEY") ??
  (local
    ? "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU"
    : undefined);
if (!CHAVE) throw new Error("SUPABASE_SERVICE_ROLE_KEY ausente no apps/worker-ia/.env");

const db = createClient(URL_SB, CHAVE, { auth: { persistSession: false } });
const motor = env("OLLAMA_MODELO_TEXTO")
  ? criarMotorOllama({ url: env("OLLAMA_URL") ?? "http://127.0.0.1:11434", modeloTexto: env("OLLAMA_MODELO_TEXTO")!, modeloVisao: env("OLLAMA_MODELO_VISAO") })
  : motorMock;
const ffmpeg = { ffmpeg: env("FFMPEG") ?? "ffmpeg", ffprobe: env("FFPROBE") ?? "ffprobe" };
const whisper = { cli: env("WHISPER_CLI"), modelo: env("WHISPER_MODELO") };

const log = (s: string) => console.log(`${new Date().toLocaleTimeString("pt-BR")} ${s}`);
const falha = (r: { error: { message: string } | null }, onde: string) => {
  if (r.error) throw new Error(`${onde}: ${r.error.message}`);
};

const repo: Repositorio = {
  async pegarJob() {
    const r = await db.rpc("pegar_job_ia");
    falha(r, "pegar_job_ia");
    return r.data?.[0] ?? null;
  },
  async carregarVideo(id) {
    const r = await db.from("videos").select("id,legenda,storage_path,perfis(username)").eq("id", id).single();
    falha(r, "carregar vídeo");
    const v = r.data as unknown as { id: string; legenda: string | null; storage_path: string | null; perfis: { username: string } };
    return { id: v.id, legenda: v.legenda, storage_path: v.storage_path, username: v.perfis.username };
  },
  async baixarArquivo(caminho) {
    const r = await db.storage.from("videos-temp").download(caminho);
    if (r.error) return null; // arquivo limpo/ausente: resume só com a legenda
    const dir = await mkdtemp(join(tmpdir(), "vizu-dl-"));
    const arquivo = join(dir, "video.mp4");
    await writeFile(arquivo, Buffer.from(await r.data.arrayBuffer()));
    return arquivo;
  },
  async salvarResumo(videoId, res) {
    falha(await db.from("videos").update({ resumo: res.resumo, resumo_tags: res.tags }).eq("id", videoId), "gravar resumo");
    // Só avança o status se o painel não marcou repostado/ignorado.
    await db.from("videos").update({ status: "resumido" }).eq("id", videoId).in("status", ["novo", "baixado"]);
    const { data: disp } = await db.from("dispositivos").select("id").eq("ativo", true);
    if (disp?.length) {
      falha(await db.from("notificacoes").insert(disp.map((d) => ({ video_id: videoId, dispositivo_id: d.id, tipo_msg: "resumo" }))), "enfileirar resumo");
      // Não espera o cron de 15 s.
      fetch(`${URL_SB}/functions/v1/notificar`, { method: "POST", headers: { authorization: `Bearer ${CHAVE}` } }).catch(() => {});
    }
  },
  async concluirJob(id) {
    falha(await db.from("jobs_ia").update({ status: "feito", erro: null }).eq("id", id), "concluir job");
  },
  async falharJob(id, erro, definitivo) {
    falha(await db.from("jobs_ia").update({ status: definitivo ? "falhou" : "pendente", erro }).eq("id", id), "falhar job");
  },
};

const midia = {
  extrair: (v: string) => extrairMidia(v, ffmpeg),
  transcrever: (wav: string | null) => transcrever(wav, whisper),
};

let rodando = false;
let deNovo = false;
async function drenar() {
  if (rodando) return void (deNovo = true);
  rodando = true;
  try {
    do {
      deNovo = false;
      for (;;) {
        const t0 = Date.now();
        const r = await processarProximo(repo, motor, midia).catch((e) => {
          log(`erro inesperado: ${e instanceof Error ? e.message : e}`);
          return "falhou" as const;
        });
        if (r === "vazio") break;
        log(`job ${r} em ${((Date.now() - t0) / 1000).toFixed(1)} s`);
      }
    } while (deNovo);
  } finally {
    rodando = false;
  }
}

async function batimento() {
  await db.from("config").upsert({ chave: "worker_ia_batimento", valor: { em: new Date().toISOString(), modelo: motor.nome } });
}

log(`worker-ia no ar · ${URL_SB} · motor ${motor.nome} · whisper ${whisper.cli ? "ligado" : "desligado"}`);
await batimento();
setInterval(batimento, 30_000);
setInterval(drenar, 30_000); // polling de segurança
db.channel("worker-ia")
  .on("postgres_changes", { event: "*", schema: "public", table: "jobs_ia" }, () => void drenar())
  .on("postgres_changes", { event: "UPDATE", schema: "public", table: "videos" }, () => void drenar())
  .subscribe((s) => log(`realtime: ${s}`));
void drenar();
