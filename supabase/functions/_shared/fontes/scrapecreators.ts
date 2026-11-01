// Fonte A — ScrapeCreators (provedor terceiro, síncrono, 1 crédito por requisição).
// Doc: https://docs.scrapecreators.com/v2/instagram/user/posts (via Context7).
// GET /v2/instagram/user/posts?handle=… com header `x-api-key`. Os itens seguem o formato da API
// do Instagram, o mesmo que a HikerAPI devolve, então a normalização é compartilhada.

import { normalizarHiker } from "./hikerapi.ts";
import { ErroFonte, type FonteInstagram } from "./tipos.ts";

const BASE = "https://api.scrapecreators.com";

export function criarFonteScrapeCreators(chave: string | undefined, f: typeof fetch = fetch, timeoutMs = 8000): FonteInstagram {
  return {
    nome: "scrapecreators",
    async ultimosPosts(username, limite) {
      if (!chave) throw new ErroFonte("scrapecreators", "SCRAPECREATORS_API_KEY ausente");
      const r = await f(`${BASE}/v2/instagram/user/posts?handle=${encodeURIComponent(username)}&trim=true`, {
        headers: { "x-api-key": chave },
        signal: AbortSignal.timeout(timeoutMs),
      });
      if (!r.ok) throw new ErroFonte("scrapecreators", `HTTP ${r.status}`);
      const dados = await r.json();
      // A doc avisa: checar a mensagem de acesso, não só o status HTTP.
      if (dados.success === false) throw new ErroFonte("scrapecreators", dados.message ?? dados.error ?? "resposta sem sucesso");
      const fixados = new Set((dados.pinned_profile_grid_items_ids ?? []).map(String));
      return (dados.items ?? []).slice(0, limite).map((item: Record<string, any>) => {
        const p = normalizarHiker(item);
        return fixados.has(String(item.pk)) ? { ...p, fixado: true } : p;
      });
    },
  };
}
