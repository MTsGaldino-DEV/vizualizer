// Fonte A — HikerAPI (provedor terceiro, síncrono). Doc: https://hiker-doc.readthedocs.io (via Context7).
// Autenticação: header `x-access-key`. Mídias: GET /gql/user/medias?user_id=… (o /v2/user/medias está deprecado).
// TODO(fase 0 real): validar nomes de campos (is_pinned, product_type, video_url) com uma resposta real.

import { ErroFonte, type FonteInstagram, type PostIG } from "./tipos.ts";

const BASE = "https://api.hikerapi.com";

// deno-lint-ignore no-explicit-any
type Item = Record<string, any>;

export function normalizarHiker(item: Item): PostIG {
  const code: string = item.code;
  const tipoNum = Number(item.media_type); // 1 foto, 2 vídeo, 8 carrossel
  const ehReels = item.product_type === "clips";
  const ts = item.taken_at_ts ?? item.taken_at;
  return {
    shortcode: code,
    igId: item.pk ? String(item.pk) : undefined,
    tipo: tipoNum === 2 ? "video" : tipoNum === 8 ? "carrossel" : "imagem",
    ehReels,
    fixado: Boolean(item.is_pinned ?? (Array.isArray(item.timeline_pinned_user_ids) && item.timeline_pinned_user_ids.length)),
    publicadoEm: typeof ts === "number" ? new Date(ts * 1000) : new Date(ts),
    legenda: item.caption_text ?? item.caption?.text ?? undefined,
    permalink: `https://www.instagram.com/${ehReels ? "reel" : "p"}/${code}/`,
    urlVideo: item.video_url ?? item.resources?.find((r: Item) => r.video_url)?.video_url ?? undefined,
    urlThumb: item.thumbnail_url ?? item.image_versions2?.candidates?.[0]?.url ?? undefined,
    duracaoS: item.video_duration ?? undefined,
  };
}

export function criarFonteHikerAPI(chave: string | undefined, f: typeof fetch = fetch): FonteInstagram {
  const idsCache = new Map<string, string>();
  const get = async (caminho: string) => {
    if (!chave) throw new ErroFonte("hikerapi", "PROVEDOR_IG_API_KEY ausente");
    const r = await f(`${BASE}${caminho}`, {
      headers: { "x-access-key": chave },
      signal: AbortSignal.timeout(8000),
    });
    if (!r.ok) throw new ErroFonte("hikerapi", `HTTP ${r.status}`);
    return r.json();
  };
  return {
    nome: "hikerapi",
    async ultimosPosts(username, limite) {
      let id = idsCache.get(username);
      if (!id) {
        const u = await get(`/v1/user/by/username?username=${encodeURIComponent(username)}`);
        id = String(u.pk ?? u.id);
        idsCache.set(username, id);
      }
      const dados = await get(`/gql/user/medias?user_id=${id}`);
      const itens: Item[] = Array.isArray(dados) ? dados : (dados.response?.items ?? dados.items ?? []);
      return itens.slice(0, limite).map(normalizarHiker);
    },
  };
}
