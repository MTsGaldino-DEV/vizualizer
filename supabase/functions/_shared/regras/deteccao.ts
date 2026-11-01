// Regras de detecção puras (seção 3.2). Sem dependências: rodam no Deno (Edge Functions) e no Node (Vitest).

export interface PostRegra {
  shortcode: string;
  tipo: "video" | "imagem" | "carrossel";
  ehReels: boolean;
  fixado: boolean;
  publicadoEm: Date;
  urlVideo?: string;
}

export interface ContextoDeteccao {
  baseline: boolean;
  monitoradoDesde: Date;
  agora: Date;
  carrosselComVideo: boolean;
}

export type MotivoIgnorado = "baseline" | "nao_e_video" | "antes_do_monitoramento" | "mais_de_24h";

const DIA_MS = 24 * 3600_000;

/**
 * Decide quais posts merecem alerta. A comparação é sempre por shortcode + publicadoEm
 * (nunca por posição: post fixado fica no topo). O dedupe contra o que já foi visto é do banco
 * (UNIQUE + ON CONFLICT DO NOTHING), então aqui só entram regras sobre o próprio post.
 */
export function classificarPosts<T extends PostRegra>(
  posts: T[],
  ctx: ContextoDeteccao,
): Array<T & { alertar: boolean; motivo?: MotivoIgnorado }> {
  return posts.map((p) => {
    const motivo = motivoIgnorar(p, ctx);
    return motivo ? { ...p, alertar: false, motivo } : { ...p, alertar: true };
  });
}

function motivoIgnorar(p: PostRegra, ctx: ContextoDeteccao): MotivoIgnorado | undefined {
  if (ctx.baseline) return "baseline";
  const ehVideo = p.tipo === "video" || (p.tipo === "carrossel" && ctx.carrosselComVideo && !!p.urlVideo);
  if (!ehVideo) return "nao_e_video";
  if (p.publicadoEm < ctx.monitoradoDesde) return "antes_do_monitoramento";
  if (ctx.agora.getTime() - p.publicadoEm.getTime() > DIA_MS) return "mais_de_24h";
  return undefined;
}

export function latenciaMs(publicadoEm: Date, detectadoEm: Date): number {
  return Math.max(0, detectadoEm.getTime() - publicadoEm.getTime());
}
