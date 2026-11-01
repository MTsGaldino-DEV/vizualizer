import { describe, expect, it } from "vitest";
import { classificarPosts, latenciaMs, separarValidos } from "./deteccao";
import type { PostIG } from "./fontes";

const agora = new Date("2026-11-01T15:00:00Z");
const monitoradoDesde = new Date("2026-10-01T00:00:00Z");
const min = (m: number) => new Date(agora.getTime() - m * 60_000);
const post = (o: Partial<PostIG>): PostIG => ({
  shortcode: "X",
  tipo: "video",
  ehReels: true,
  fixado: false,
  publicadoEm: min(1),
  permalink: "https://www.instagram.com/reel/X/",
  ...o,
});
const ctx = { baseline: false, monitoradoDesde, agora, carrosselComVideo: false };
const alertados = (r: ReturnType<typeof classificarPosts>) =>
  r.filter((p) => p.alertar).map((p) => p.shortcode);

describe("classificarPosts — regras 3.2", () => {
  it("1. baseline grava tudo e não alerta nada", () => {
    const r = classificarPosts([post({ shortcode: "A" }), post({ shortcode: "B" })], {
      ...ctx,
      baseline: true,
    });
    expect(r).toHaveLength(2);
    expect(alertados(r)).toEqual([]);
  });

  it("3. post fixado antigo no topo não alerta; vídeo novo abaixo dele alerta", () => {
    const r = classificarPosts(
      [
        post({ shortcode: "FIX", fixado: true, publicadoEm: new Date("2026-09-01T00:00:00Z") }),
        post({ shortcode: "NOVO", publicadoEm: min(1) }),
      ],
      ctx,
    );
    expect(alertados(r)).toEqual(["NOVO"]);
  });

  it("4. só vídeo: imagem e carrossel não alertam por padrão", () => {
    const r = classificarPosts(
      [
        post({ shortcode: "IMG", tipo: "imagem" }),
        post({ shortcode: "CAR", tipo: "carrossel", urlVideo: "https://cdn.x/v.mp4" }),
        post({ shortcode: "FEED", tipo: "video", ehReels: false }),
      ],
      ctx,
    );
    expect(alertados(r)).toEqual(["FEED"]);
  });

  it("4b. carrossel com vídeo alerta quando configurado", () => {
    const r = classificarPosts(
      [
        post({ shortcode: "CAR", tipo: "carrossel", urlVideo: "https://cdn.x/v.mp4" }),
        post({ shortcode: "CAR2", tipo: "carrossel" }),
      ],
      { ...ctx, carrosselComVideo: true },
    );
    expect(alertados(r)).toEqual(["CAR"]);
  });

  it("5. post antigo que reapareceu (> 24 h) é ignorado", () => {
    const r = classificarPosts(
      [post({ shortcode: "VELHO", publicadoEm: min(60 * 25) }), post({ shortcode: "OK", publicadoEm: min(60 * 23) })],
      ctx,
    );
    expect(alertados(r)).toEqual(["OK"]);
  });

  it("5b. post publicado antes de monitoradoDesde é ignorado mesmo dentro de 24 h", () => {
    const r = classificarPosts([post({ shortcode: "P", publicadoEm: min(30) })], {
      ...ctx,
      monitoradoDesde: min(10),
    });
    expect(alertados(r)).toEqual([]);
  });

  it("devolve motivo para cada post não alertado", () => {
    const [r] = classificarPosts([post({ tipo: "imagem" })], ctx);
    expect(r?.motivo).toBe("nao_e_video");
  });
});

describe("separarValidos", () => {
  it("post sem shortcode, sem permalink ou com data inválida é descartado sem derrubar os outros", () => {
    const { validos, descartados } = separarValidos([
      post({ shortcode: "OK" }),
      post({ shortcode: "" }),
      post({ shortcode: "SEMDATA", publicadoEm: new Date("lixo") }),
      post({ shortcode: "SEMLINK", permalink: "" }),
    ]);
    expect(validos.map((p) => p.shortcode)).toEqual(["OK"]);
    expect(descartados).toHaveLength(3);
  });
});

describe("6. latência registrada", () => {
  it("detectado − publicado em ms", () =>
    expect(latenciaMs(new Date("2026-11-01T15:00:00Z"), new Date("2026-11-01T15:00:03Z"))).toBe(3000));
  it("nunca negativa (relógio do provedor adiantado)", () =>
    expect(latenciaMs(new Date("2026-11-01T15:00:05Z"), new Date("2026-11-01T15:00:03Z"))).toBe(0));
});
