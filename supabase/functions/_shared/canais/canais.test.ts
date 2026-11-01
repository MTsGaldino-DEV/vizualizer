import { describe, expect, it } from "vitest";
import { backoffS, montarMensagem, textoWhatsApp } from "./tipos.ts";
import { criarCanalWhatsApp } from "./whatsapp.ts";

const video = { id: "v1", username: "criador.um", latenciaMs: 3400, permalink: "https://www.instagram.com/reel/A/" };
const msg = montarMensagem("alerta", video, "http://painel");

describe("mensagens", () => {
  it("alerta traz latência em segundos e link do card", () => {
    expect(msg.titulo).toBe("🟢 Novo vídeo de @criador.um");
    expect(msg.corpo).toBe("Detectado 3 s após a publicação");
    expect(msg.url).toBe("http://painel/video/v1");
  });
  it("texto do WhatsApp inclui post, baixar e painel", () => {
    const t = textoWhatsApp(msg, { ...video, linkBaixar: "http://x/baixar" });
    expect(t).toContain("https://www.instagram.com/reel/A/");
    expect(t).toContain("Baixar: http://x/baixar");
    expect(t).toContain("Painel: http://painel/video/v1");
  });
  it("resumo lista as tags com #", () =>
    expect(montarMensagem("resumo", { ...video, resumo: "Receita rápida.", tags: ["receita", "doce"] }, "p").corpo).toBe(
      "Receita rápida.\n#receita #doce",
    ));
  it("backoff cresce: 10 s, 40 s, 90 s", () => expect([1, 2, 3].map(backoffS)).toEqual([10, 40, 90]));
});

describe("canal WhatsApp — trava de segurança", () => {
  const chamadas: string[] = [];
  const f = (async (url: string) => {
    chamadas.push(url);
    return new Response("{}");
  }) as unknown as typeof fetch;
  const cfg = { url: "http://evo", chave: "k", instancia: "viz", permitidos: ["+55 (11) 99999-0000"] };

  it("número fora da lista NUNCA é chamado (simula)", async () => {
    const r = await criarCanalWhatsApp(cfg, f).enviar({ numero: "5511888887777" }, msg);
    expect(r).toEqual({ ok: true, simulado: true });
    expect(chamadas).toEqual([]);
  });
  it("lista vazia = nada sai", async () => {
    const r = await criarCanalWhatsApp({ ...cfg, permitidos: [""] }, f).enviar({ numero: "" }, msg);
    expect(r).toMatchObject({ simulado: true });
    expect(chamadas).toEqual([]);
  });
  it("número permitido chama a Evolution", async () => {
    const r = await criarCanalWhatsApp(cfg, f).enviar({ numero: "5511999990000" }, msg);
    expect(r).toEqual({ ok: true });
    expect(chamadas).toEqual(["http://evo/message/sendText/viz"]);
  });
  it("HTTP 500 da Evolution vira falha (para retry)", async () => {
    const f500 = (async () => new Response("", { status: 500 })) as unknown as typeof fetch;
    expect(await criarCanalWhatsApp(cfg, f500).enviar({ numero: "5511999990000" }, msg)).toEqual({
      ok: false,
      erro: "Evolution HTTP 500",
    });
  });
});
