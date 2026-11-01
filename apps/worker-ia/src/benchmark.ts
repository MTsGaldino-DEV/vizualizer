// `pnpm --filter @vizualizer/worker-ia benchmark` — mede modelos de texto do Ollama no resumo em PT-BR.
// Uso: tsx src/benchmark.ts qwen3:8b outro:modelo   (padrão: os modelos instalados)
import { criarMotorOllama, type EntradaResumo } from "./ia";

const URL_OLLAMA = process.env.OLLAMA_URL ?? "http://127.0.0.1:11434";
const CASOS: EntradaResumo[] = [
  {
    username: "chef.rapida",
    legenda: "Bolo de caneca de chocolate em 3 minutos 🍫 salva essa receita!",
    transcricao: "Oi gente! Hoje é o bolo de caneca mais fácil do mundo. Quatro colheres de farinha, três de açúcar, duas de chocolate em pó, um ovo, três colheres de leite e de óleo. Mexe bem e micro-ondas por dois minutos e meio. Pronto!",
    quadros: "Uma mulher em uma cozinha clara mistura ingredientes numa caneca branca; depois a caneca sai do micro-ondas com bolo crescido.",
  },
  {
    username: "treino.em.casa",
    legenda: "3 exercícios pra fazer sem equipamento #treino",
    transcricao: "Primeiro, agachamento, três séries de quinze. Depois flexão com o joelho no chão se precisar. Por último prancha, trinta segundos. Faz isso três vezes por semana.",
    quadros: "Um homem de regata faz agachamentos, flexões e prancha num tapete na sala.",
  },
  {
    username: "viagem.barata",
    legenda: "Praia escondida em Ubatuba, chega de trilha 🏝️",
    transcricao: null,
    quadros: "Trilha na mata, depois vista aérea de uma praia pequena com água verde e poucas pessoas.",
  },
];

const modelos =
  process.argv.slice(2).length > 0
    ? process.argv.slice(2)
    : ((await (await fetch(`${URL_OLLAMA}/api/tags`)).json()).models as { name: string }[]).map((m) => m.name);

console.log(`| Modelo | Caso | Tempo (s) | Resumo | Tags |\n|---|---|---|---|---|`);
for (const modelo of modelos) {
  const motor = criarMotorOllama({ url: URL_OLLAMA, modeloTexto: modelo });
  for (const c of CASOS) {
    const t0 = Date.now();
    try {
      const r = await motor.resumir(c);
      console.log(`| ${modelo} | @${c.username} | ${((Date.now() - t0) / 1000).toFixed(1)} | ${r.resumo.replace(/\|/g, "/")} | ${r.tags.join(", ")} |`);
    } catch (e) {
      console.log(`| ${modelo} | @${c.username} | — | ERRO: ${e instanceof Error ? e.message : e} | |`);
    }
  }
  // Descarrega antes do próximo modelo (8 GB de VRAM).
  await fetch(`${URL_OLLAMA}/api/chat`, { method: "POST", body: JSON.stringify({ model: modelo, messages: [], keep_alive: 0 }) });
}
