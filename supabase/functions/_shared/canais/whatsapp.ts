// Canal WhatsApp via Evolution API (POST {url}/message/sendText/{instancia}, header `apikey`).
// TRAVA DE SEGURANÇA: só envia para números em `permitidos` (WHATSAPP_NUMERO_TESTE no MVP local).
// Sem URL/chave da Evolution ou sem número permitido → modo simulado (só log).

import type { CanalNotificacao } from "./tipos.ts";

export interface ConfigWhatsApp {
  url?: string;
  chave?: string;
  instancia?: string;
  permitidos: string[];
}

const soDigitos = (n: unknown) => String(n ?? "").replace(/\D/g, "");

export function criarCanalWhatsApp(cfg: ConfigWhatsApp, f: typeof fetch = fetch): CanalNotificacao {
  const permitidos = new Set(cfg.permitidos.map(soDigitos).filter(Boolean));
  return {
    tipo: "whatsapp",
    async enviar(destino, msg) {
      const numero = soDigitos(destino.numero);
      if (!permitidos.has(numero)) {
        console.log(`[whatsapp simulado] para ${numero || "(vazio)"}: ${msg.titulo}`);
        return { ok: true, simulado: true };
      }
      if (!cfg.url || !cfg.chave || !cfg.instancia) {
        console.log(`[whatsapp simulado] Evolution não configurada: ${msg.titulo}`);
        return { ok: true, simulado: true };
      }
      try {
        const r = await f(`${cfg.url.replace(/\/$/, "")}/message/sendText/${cfg.instancia}`, {
          method: "POST",
          headers: { "content-type": "application/json", apikey: cfg.chave },
          body: JSON.stringify({ number: numero, text: msg.textoWhatsApp ?? `${msg.titulo}\n${msg.corpo}` }),
          signal: AbortSignal.timeout(8000),
        });
        return r.ok ? { ok: true } : { ok: false, erro: `Evolution HTTP ${r.status}` };
      } catch (e) {
        return { ok: false, erro: e instanceof Error ? e.message : String(e) };
      }
    },
  };
}
