// Motores de IA (seção 5): Ollama local (RX 7600) ou mock. Um modelo por vez na VRAM de 8 GB.
import { resumoIASchema, type ResumoIA } from "@vizualizer/shared";

export interface EntradaResumo {
  username: string;
  legenda: string | null;
  transcricao: string | null;
  quadros: string | null; // descrição dos quadros-chave
}

export interface MotorIA {
  nome: string;
  /** Descreve os quadros (JPEG). Devolve null quando não há modelo de visão. */
  descreverQuadros(jpegs: Buffer[]): Promise<string | null>;
  resumir(e: EntradaResumo): Promise<ResumoIA>;
}

const ESQUEMA = {
  type: "object",
  properties: {
    resumo: { type: "string" },
    assunto: { type: "string" },
    tags: { type: "array", items: { type: "string" } },
    tem_fala: { type: "boolean" },
    idioma: { type: "string" },
  },
  required: ["resumo", "assunto", "tags", "tem_fala", "idioma"],
};

export function promptResumo(e: EntradaResumo): string {
  return [
    `Você resume vídeos curtos do Instagram (Reels) do criador @${e.username} para uma equipe que decide se vai repostar.`,
    "Responda em JSON. Campos:",
    "- resumo: 2 a 3 frases em português do Brasil, concretas, sem inventar nada que não esteja nas fontes;",
    "- assunto: 2 a 5 palavras;",
    "- tags: 3 a 6 palavras-chave minúsculas, sem #;",
    "- tem_fala: true se a transcrição tiver fala;",
    "- idioma: código do idioma da fala (pt, en…) ou \"nenhum\".",
    "",
    `LEGENDA DO POST:\n${e.legenda?.trim() || "(sem legenda)"}`,
    `TRANSCRIÇÃO DO ÁUDIO:\n${e.transcricao?.trim() || "(sem transcrição)"}`,
    `O QUE APARECE NO VÍDEO:\n${e.quadros?.trim() || "(sem descrição visual)"}`,
  ].join("\n");
}

/** Valida a saída do modelo; normaliza tags (minúsculas, sem #, sem repetição). */
export function validarResumo(bruto: string): ResumoIA {
  const obj = resumoIASchema.parse(JSON.parse(bruto));
  const tags = [...new Set(obj.tags.map((t) => t.replace(/^#/, "").trim().toLowerCase()).filter(Boolean))].slice(0, 6);
  return { ...obj, resumo: obj.resumo.trim(), tags };
}

export function criarMotorOllama(cfg: {
  url: string;
  modeloTexto: string;
  modeloVisao?: string;
  f?: typeof fetch;
}): MotorIA {
  const f = cfg.f ?? fetch;
  const chat = async (corpo: object) => {
    const r = await f(`${cfg.url}/api/chat`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ stream: false, ...corpo }),
      signal: AbortSignal.timeout(180_000),
    });
    if (!r.ok) throw new Error(`Ollama HTTP ${r.status}: ${await r.text()}`);
    return (await r.json()) as { message: { content: string } };
  };
  return {
    nome: `ollama:${cfg.modeloTexto}${cfg.modeloVisao ? `+${cfg.modeloVisao}` : ""}`,
    async descreverQuadros(jpegs) {
      if (!cfg.modeloVisao || !jpegs.length) return null;
      const r = await chat({
        model: cfg.modeloVisao,
        // Modelos diferentes: libera a VRAM antes do de texto. Mesmo modelo: mantém carregado para o resumo.
        keep_alive: cfg.modeloVisao === cfg.modeloTexto ? "60s" : 0,
        messages: [
          {
            role: "user",
            content: "Descreva em português, em até 4 frases, o que acontece nestes quadros de um vídeo curto (pessoas, lugar, objetos, texto na tela).",
            images: jpegs.map((b) => b.toString("base64")),
          },
        ],
      });
      return r.message.content.trim();
    },
    async resumir(e) {
      const r = await chat({
        model: cfg.modeloTexto,
        keep_alive: "60s",
        think: false,
        format: ESQUEMA,
        options: { temperature: 0.2 },
        messages: [{ role: "user", content: promptResumo(e) }],
      });
      return validarResumo(r.message.content);
    },
  };
}

export const motorMock: MotorIA = {
  nome: "mock",
  descreverQuadros: async (jpegs) => (jpegs.length ? `${jpegs.length} quadros extraídos (descrição simulada).` : null),
  resumir: async (e) => ({
    resumo: `Resumo simulado do vídeo de @${e.username}. ${e.legenda ? `Legenda: “${e.legenda.slice(0, 80)}”.` : ""}`.trim(),
    assunto: "simulação",
    tags: ["mock", e.username.replace(/[^a-z0-9]/gi, "")],
    tem_fala: !!e.transcricao,
    idioma: e.transcricao ? "pt" : "nenhum",
  }),
};
