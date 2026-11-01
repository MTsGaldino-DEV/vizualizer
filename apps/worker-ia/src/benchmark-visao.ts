// `pnpm --filter @vizualizer/worker-ia exec tsx src/benchmark-visao.ts <video.mp4> [legenda]`
// Mede o pipeline completo de um vídeo real: ffmpeg → visão → texto, em duas combinações:
//   A) visão gemma3:4b + texto qwen3:8b (troca de modelo na VRAM)   B) gemma3:4b para tudo
import { criarMotorOllama } from "./ia";
import { extrairMidia } from "./midia";

const [video, legenda = null] = process.argv.slice(2);
if (!video) throw new Error("uso: tsx src/benchmark-visao.ts <video.mp4> [legenda]");
const URL_OLLAMA = process.env.OLLAMA_URL ?? "http://127.0.0.1:11434";
const descarregar = (model: string) =>
  fetch(`${URL_OLLAMA}/api/chat`, { method: "POST", body: JSON.stringify({ model, messages: [], keep_alive: 0 }) });

const m = await extrairMidia(video, { ffmpeg: "ffmpeg", ffprobe: "ffprobe" });
console.log(`${m.quadros.length} quadros extraídos\n`);

for (const [nome, visao, texto] of [
  ["A", "gemma3:4b", "qwen3:8b"],
  ["B", "gemma3:4b", "gemma3:4b"],
] as const) {
  await Promise.all([descarregar("gemma3:4b"), descarregar("qwen3:8b")]); // começa frio, como no worker
  const motor = criarMotorOllama({ url: URL_OLLAMA, modeloTexto: texto, modeloVisao: visao });
  const t0 = performance.now();
  const quadros = await motor.descreverQuadros(m.quadros);
  const t1 = performance.now();
  const r = await motor.resumir({ username: "instagram", legenda, transcricao: null, quadros });
  const t2 = performance.now();
  console.log(`## ${nome}: visão ${visao} + texto ${texto}`);
  console.log(`visão ${((t1 - t0) / 1000).toFixed(1)} s · texto ${((t2 - t1) / 1000).toFixed(1)} s · total ${((t2 - t0) / 1000).toFixed(1)} s`);
  console.log(`QUADROS: ${quadros}`);
  console.log(`RESUMO: ${r.resumo}\nTAGS: ${r.tags.join(", ")}\n`);
}
await m.limpar();
