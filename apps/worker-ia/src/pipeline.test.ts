import { describe, expect, it } from "vitest";
import { criarMotorOllama, motorMock, validarResumo, type MotorIA } from "./ia";
import { instantesQuadros } from "./midia";
import { processarProximo, type Repositorio } from "./pipeline";

function repoFalso(o: Partial<Repositorio> = {}) {
  const log: string[] = [];
  const repo: Repositorio = {
    pegarJob: async () => ({ id: 1, video_id: "v1", tentativas: 1 }),
    carregarVideo: async () => ({ id: "v1", legenda: "Bolo de cenoura em 5 min", storage_path: "p/v1.mp4", username: "criador" }),
    baixarArquivo: async () => "C:/tmp/v1.mp4",
    salvarResumo: async (id, r) => void log.push(`resumo ${id} ${r.tags.join(",")}`),
    concluirJob: async (id) => void log.push(`feito ${id}`),
    falharJob: async (id, erro, definitivo) => void log.push(`falhou ${id} ${definitivo ? "definitivo" : "retry"} ${erro}`),
    ...o,
  };
  return { repo, log };
}
const midiaFalsa = {
  extrair: async () => ({ quadros: [Buffer.from("jpg")], audioWav: "a.wav", limpar: async () => {} }),
  transcrever: async () => "oi gente, hoje vou fazer um bolo",
};

describe("processarProximo", () => {
  it("fila vazia não faz nada", async () => {
    const { repo, log } = repoFalso({ pegarJob: async () => null });
    expect(await processarProximo(repo, motorMock, midiaFalsa)).toBe("vazio");
    expect(log).toEqual([]);
  });

  it("caminho feliz: resume, salva e conclui o job", async () => {
    const { repo, log } = repoFalso();
    expect(await processarProximo(repo, motorMock, midiaFalsa)).toBe("feito");
    expect(log).toEqual(["resumo v1 mock,criador", "feito 1"]);
  });

  it("sem arquivo (download desistiu) resume só com a legenda", async () => {
    let entrada: unknown;
    const motor: MotorIA = { ...motorMock, resumir: async (e) => ((entrada = e), motorMock.resumir(e)) };
    const { repo } = repoFalso({ carregarVideo: async () => ({ id: "v1", legenda: "só legenda", storage_path: null, username: "c" }) });
    expect(await processarProximo(repo, motor, midiaFalsa)).toBe("feito");
    expect(entrada).toMatchObject({ legenda: "só legenda", transcricao: null, quadros: null });
  });

  it("erro da IA devolve o job para nova tentativa", async () => {
    const motor: MotorIA = { ...motorMock, resumir: async () => { throw new Error("Ollama HTTP 500"); } };
    const { repo, log } = repoFalso();
    expect(await processarProximo(repo, motor, midiaFalsa)).toBe("falhou");
    expect(log).toEqual(["falhou 1 retry Ollama HTTP 500"]);
  });

  it("3ª tentativa com erro é definitiva", async () => {
    const motor: MotorIA = { ...motorMock, resumir: async () => { throw new Error("x"); } };
    const { repo, log } = repoFalso({ pegarJob: async () => ({ id: 9, video_id: "v1", tentativas: 3 }) });
    await processarProximo(repo, motor, midiaFalsa);
    expect(log).toEqual(["falhou 9 definitivo x"]);
  });

  it("limpa os arquivos temporários mesmo quando a IA falha", async () => {
    let limpo = false;
    const motor: MotorIA = { ...motorMock, resumir: async () => { throw new Error("x"); } };
    const { repo } = repoFalso();
    await processarProximo(repo, motor, { ...midiaFalsa, extrair: async () => ({ quadros: [], audioWav: null, limpar: async () => void (limpo = true) }) });
    expect(limpo).toBe(true);
  });
});

describe("validarResumo", () => {
  it("normaliza tags e rejeita JSON fora do esquema", () => {
    expect(validarResumo('{"resumo":" A. ","assunto":"x","tags":["#Bolo","bolo","Doce"],"tem_fala":true,"idioma":"pt"}')).toEqual({
      resumo: "A.", assunto: "x", tags: ["bolo", "doce"], tem_fala: true, idioma: "pt",
    });
    expect(() => validarResumo('{"resumo":"A"}')).toThrow();
    expect(() => validarResumo("não é json")).toThrow();
  });
});

describe("criarMotorOllama — VRAM", () => {
  const corpos: { model: string; keep_alive: unknown }[] = [];
  const f = (async (_url: string, init?: RequestInit) => {
    corpos.push(JSON.parse(String(init?.body)));
    return new Response(JSON.stringify({ message: { content: "quadros descritos" } }));
  }) as unknown as typeof fetch;

  it("modelos diferentes: descarrega a visão logo após usar (libera VRAM para o texto)", async () => {
    corpos.length = 0;
    await criarMotorOllama({ url: "http://o", modeloVisao: "gemma3:4b", modeloTexto: "qwen3:8b", f }).descreverQuadros([Buffer.from("x")]);
    expect(corpos[0]).toMatchObject({ model: "gemma3:4b", keep_alive: 0 });
  });
  it("mesmo modelo para visão e texto: mantém carregado (não recarrega à toa)", async () => {
    corpos.length = 0;
    await criarMotorOllama({ url: "http://o", modeloVisao: "gemma3:4b", modeloTexto: "gemma3:4b", f }).descreverQuadros([Buffer.from("x")]);
    expect(corpos[0]).toMatchObject({ model: "gemma3:4b", keep_alive: "60s" });
  });
});

describe("instantesQuadros", () => {
  it("5 quadros no meio de cada fatia", () => expect(instantesQuadros(10)).toEqual([1, 3, 5, 7, 9]));
  it("duração inválida → nenhum quadro", () => expect(instantesQuadros(NaN)).toEqual([]));
});
