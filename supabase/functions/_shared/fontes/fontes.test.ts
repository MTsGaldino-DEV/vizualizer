import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { criarFonteMock, type PostCru } from "./mock.ts";
import { criarFonteHikerAPI, normalizarHiker } from "./hikerapi.ts";
import { criarFonteBusinessDiscovery, normalizarGraph } from "./business-discovery.ts";
import { criarFonteScrapeCreators } from "./scrapecreators.ts";

const fixture = JSON.parse(readFileSync("fixtures/ig/mock-perfil-a.json", "utf8")) as { posts: PostCru[] };

describe("fonte mock", () => {
  it("devolve fixados primeiro e depois do mais novo ao mais velho, com Date", async () => {
    const fonte = criarFonteMock(async () => fixture.posts);
    const posts = await fonte.ultimosPosts("mock-perfil-a", 12);
    expect(posts[0]?.fixado).toBe(true);
    expect(posts[1]?.shortcode).toBe("CfIXaDo002");
    expect(posts[1]?.publicadoEm).toBeInstanceOf(Date);
  });
  it("perfil sem dados vira erro (conta como falha na checagem)", async () => {
    await expect(criarFonteMock(async () => null).ultimosPosts("x", 12)).rejects.toThrow(/sem dados/);
  });
});

describe("fonte hikerapi", () => {
  it("normaliza um Reels", () => {
    const p = normalizarHiker({
      pk: "1", code: "ABC", media_type: 2, product_type: "clips", taken_at_ts: 1793520000,
      video_url: "https://cdn/x.mp4", caption_text: "oi",
    });
    expect(p).toMatchObject({ shortcode: "ABC", tipo: "video", ehReels: true, legenda: "oi", permalink: "https://www.instagram.com/reel/ABC/" });
    expect(p.publicadoEm.toISOString()).toBe(new Date(1793520000 * 1000).toISOString());
  });
  it("carrossel = media_type 8", () => expect(normalizarHiker({ code: "C", media_type: 8, taken_at_ts: 1 }).tipo).toBe("carrossel"));
  it("sem chave falha sem fazer requisição", async () => {
    let chamou = false;
    const f = (async () => { chamou = true; return new Response("{}"); }) as typeof fetch;
    await expect(criarFonteHikerAPI(undefined, f).ultimosPosts("x", 12)).rejects.toThrow(/PROVEDOR_IG_API_KEY/);
    expect(chamou).toBe(false);
  });
  it("HTTP 429 vira ErroFonte", async () => {
    const f = (async () => new Response("", { status: 429 })) as typeof fetch;
    await expect(criarFonteHikerAPI("k", f).ultimosPosts("x", 12)).rejects.toThrow(/429/);
  });
});

describe("fonte scrapecreators", () => {
  const resposta = {
    success: true,
    credits_charged: 1,
    pinned_profile_grid_items_ids: ["111"],
    items: [
      { pk: "111", code: "FIX", media_type: 2, product_type: "clips", taken_at: 1700000000, video_versions: [{ url: "https://cdn/fix.mp4" }] },
      { pk: "222", code: "NOVO", media_type: 2, product_type: "clips", taken_at: 1793520000, caption: { text: "oi" }, video_versions: [{ url: "https://cdn/novo.mp4" }] },
      { pk: "333", code: "FOTO", media_type: 1, taken_at: 1793500000 },
    ],
  };
  const chamadas: { url: string; chave: string | null }[] = [];
  const f = (async (url: string, init?: RequestInit) => {
    chamadas.push({ url, chave: new Headers(init?.headers).get("x-api-key") });
    return new Response(JSON.stringify(resposta));
  }) as unknown as typeof fetch;

  it("chama /v2/instagram/user/posts com handle e x-api-key, e normaliza", async () => {
    const posts = await criarFonteScrapeCreators("k", f).ultimosPosts("criador.um", 12);
    expect(chamadas[0]).toEqual({ url: "https://api.scrapecreators.com/v2/instagram/user/posts?handle=criador.um&trim=true", chave: "k" });
    expect(posts.map((p) => p.shortcode)).toEqual(["FIX", "NOVO", "FOTO"]);
    expect(posts[1]).toMatchObject({ tipo: "video", ehReels: true, legenda: "oi", urlVideo: "https://cdn/novo.mp4" });
  });
  it("marca fixado pelo pinned_profile_grid_items_ids da resposta", async () => {
    const posts = await criarFonteScrapeCreators("k", f).ultimosPosts("x", 12);
    expect(posts.map((p) => p.fixado)).toEqual([true, false, false]);
  });
  it("success:false com HTTP 200 vira erro (a doc pede checar a mensagem, não só o status)", async () => {
    const fErro = (async () => new Response(JSON.stringify({ success: false, message: "perfil privado" }))) as unknown as typeof fetch;
    await expect(criarFonteScrapeCreators("k", fErro).ultimosPosts("x", 12)).rejects.toThrow(/perfil privado/);
  });
  it("sem chave falha sem gastar crédito", async () => {
    await expect(criarFonteScrapeCreators(undefined, f).ultimosPosts("x", 12)).rejects.toThrow(/SCRAPECREATORS_API_KEY/);
  });
});

describe("fonte business-discovery", () => {
  it("extrai shortcode do permalink e mapeia REELS", () => {
    const p = normalizarGraph({
      id: "9", media_type: "VIDEO", media_product_type: "REELS", permalink: "https://www.instagram.com/reel/XYZ/",
      timestamp: "2026-11-01T10:00:00+0000", media_url: "https://cdn/v.mp4",
    });
    expect(p).toMatchObject({ shortcode: "XYZ", tipo: "video", ehReels: true, fixado: false, urlVideo: "https://cdn/v.mp4" });
  });
  it("sem credenciais falha com mensagem clara", async () => {
    await expect(criarFonteBusinessDiscovery(undefined, undefined).ultimosPosts("x", 5)).rejects.toThrow(/IG_GRAPH/);
  });
});
