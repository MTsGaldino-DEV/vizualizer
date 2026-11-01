// Fonte B — Instagram Graph API, Business Discovery (oficial, grátis, ~200 chamadas/h).
// Só contas Business/Creator. Requer IG_GRAPH_USER_ID (conta profissional do cliente) e IG_GRAPH_TOKEN.
// TODO(fase 0 real): conferir versão atual da Graph API e campos no Context7/doc Meta antes de ligar.

import { ErroFonte, type FonteInstagram, type PostIG } from "./tipos.ts";

const VERSAO = "v21.0";

// deno-lint-ignore no-explicit-any
type Item = Record<string, any>;

export function normalizarGraph(m: Item): PostIG {
  const permalink: string = m.permalink;
  const shortcode = permalink.split("/").filter(Boolean).pop() ?? m.id;
  const tipo = m.media_type === "VIDEO" ? "video" : m.media_type === "CAROUSEL_ALBUM" ? "carrossel" : "imagem";
  return {
    shortcode,
    igId: m.id,
    tipo,
    ehReels: m.media_product_type === "REELS",
    fixado: false, // a Graph API não informa fixação; regra 3.2.5 (idade) cobre o caso
    publicadoEm: new Date(m.timestamp),
    legenda: m.caption,
    permalink,
    urlVideo: tipo === "video" ? m.media_url : undefined,
    urlThumb: m.thumbnail_url ?? m.media_url,
  };
}

export function criarFonteBusinessDiscovery(
  igUserId: string | undefined,
  token: string | undefined,
  f: typeof fetch = fetch,
): FonteInstagram {
  return {
    nome: "business-discovery",
    async ultimosPosts(username, limite) {
      if (!igUserId || !token) throw new ErroFonte("business-discovery", "IG_GRAPH_USER_ID/IG_GRAPH_TOKEN ausentes");
      const campos = `business_discovery.username(${username}){media.limit(${limite}){id,media_type,media_product_type,permalink,timestamp,caption,media_url,thumbnail_url}}`;
      const url = `https://graph.facebook.com/${VERSAO}/${igUserId}?fields=${encodeURIComponent(campos)}&access_token=${token}`;
      const r = await f(url, { signal: AbortSignal.timeout(8000) });
      if (!r.ok) throw new ErroFonte("business-discovery", `HTTP ${r.status}`);
      const dados = await r.json();
      return (dados.business_discovery?.media?.data ?? []).map(normalizarGraph);
    },
  };
}
