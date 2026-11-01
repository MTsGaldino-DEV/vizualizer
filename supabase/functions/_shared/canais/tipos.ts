// Interface única de envio (seção 6). Trocar Evolution por WhatsApp Cloud API = novo canal, sem refatorar.

export interface Mensagem {
  tipoMsg: "alerta" | "resumo";
  titulo: string;
  corpo: string;
  url: string; // abre o card do vídeo no painel
  textoWhatsApp?: string;
}

export type ResultadoEnvio =
  | { ok: true; simulado?: boolean }
  | { ok: false; erro: string; desativarDispositivo?: boolean };

export interface CanalNotificacao {
  tipo: "whatsapp" | "web_push" | "expo";
  enviar(destino: Record<string, unknown>, msg: Mensagem): Promise<ResultadoEnvio>;
}

/** Backoff das tentativas de envio: 10 s, 40 s, 90 s… (até 3 tentativas no total). */
export const MAX_TENTATIVAS = 3;
export const backoffS = (tentativas: number) => 10 * tentativas * tentativas;

export interface DadosVideo {
  id: string;
  username: string;
  latenciaMs: number;
  permalink: string;
  linkBaixar?: string | null;
  resumo?: string | null;
  tags?: string[] | null;
}

export function montarMensagem(tipoMsg: Mensagem["tipoMsg"], v: DadosVideo, urlPainel: string): Mensagem {
  const url = `${urlPainel}/video/${v.id}`;
  if (tipoMsg === "resumo") {
    const tags = v.tags?.length ? `\n${v.tags.map((t) => `#${t}`).join(" ")}` : "";
    return { tipoMsg, titulo: `Resumo · @${v.username}`, corpo: `${v.resumo ?? ""}${tags}`, url };
  }
  const s = Math.max(0, Math.round(v.latenciaMs / 1000));
  return {
    tipoMsg,
    titulo: `🟢 Novo vídeo de @${v.username}`,
    corpo: `Detectado ${s} s após a publicação`,
    url,
  };
}

/** Texto do WhatsApp (mensagem 1 e 2 da seção 6.1). */
export function textoWhatsApp(msg: Mensagem, v: DadosVideo): string {
  if (msg.tipoMsg === "resumo") {
    const baixar = v.linkBaixar ? `\nBaixar: ${v.linkBaixar}` : "";
    return `*${msg.titulo}*\n${msg.corpo}\n${baixar}\nPainel: ${msg.url}`;
  }
  const baixar = v.linkBaixar ? `\nBaixar: ${v.linkBaixar}` : "\nBaixar: preparando…";
  return `${msg.titulo} — ${msg.corpo.toLowerCase()}\nPost: ${v.permalink}${baixar}\nPainel: ${msg.url}`;
}
