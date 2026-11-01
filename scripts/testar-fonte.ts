// `pnpm testar-fonte <@perfil>` — UMA chamada real à ScrapeCreators (1 crédito).
// Mostra latência, créditos restantes, campos que a regra de detecção usa e salva a resposta crua
// como fixture real em fixtures/ig/. Lê a chave de supabase/functions/.env (nunca imprime).
import { existsSync, writeFileSync } from "node:fs";
import { criarFonteScrapeCreators } from "../supabase/functions/_shared/fontes/scrapecreators.ts";

if (existsSync("supabase/functions/.env")) process.loadEnvFile("supabase/functions/.env");
const handle = (process.argv[2] ?? "").replace(/^@/, "");
if (!handle) {
  console.error("uso: pnpm testar-fonte <perfil>");
  process.exit(1);
}

let bruto: Record<string, unknown> = {};
const fetchEspiao = (async (url: string, init?: RequestInit) => {
  const r = await fetch(url, init);
  bruto = await r.clone().json().catch(() => ({}));
  return r;
}) as typeof fetch;

const t0 = performance.now();
const posts = await criarFonteScrapeCreators(process.env.SCRAPECREATORS_API_KEY, fetchEspiao, 45_000).ultimosPosts(handle, 12);
const ms = Math.round(performance.now() - t0);

const agora = Date.now();
const idadeMin = (d: Date) => Math.round((agora - d.getTime()) / 60000);
console.log(`@${handle}: ${posts.length} posts em ${ms} ms · créditos cobrados ${bruto.credits_charged} · restantes ${bruto.credits_remaining}`);
console.table(
  posts.map((p) => ({
    shortcode: p.shortcode,
    tipo: p.tipo,
    reels: p.ehReels,
    fixado: p.fixado,
    "publicado há (min)": idadeMin(p.publicadoEm),
    "tem urlVideo": !!p.urlVideo,
  })),
);
const arquivo = `fixtures/ig/scrapecreators-${handle}.json`;
writeFileSync(arquivo, JSON.stringify({ _aviso: `Resposta REAL da ScrapeCreators em ${new Date().toISOString()} (URLs do CDN expiram).`, ...bruto }, null, 2));
console.log(`resposta crua salva em ${arquivo}`);
