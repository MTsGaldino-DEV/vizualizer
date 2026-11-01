// Canal Web Push (VAPID) com a lib `web-push` (npm, v3.6.7 — conferida no Context7).
// 404/410 = assinatura morta → desativar dispositivo (seção 6.2).
import webpush from "npm:web-push@3.6.7";
import type { CanalNotificacao } from "./tipos.ts";

export function criarCanalWebPush(publica?: string, privada?: string, contato = "mailto:admin@vizualizer.local"): CanalNotificacao {
  if (publica && privada) webpush.setVapidDetails(contato, publica, privada);
  return {
    tipo: "web_push",
    async enviar(destino, msg) {
      if (!publica || !privada) {
        console.log(`[web push simulado] VAPID ausente: ${msg.titulo}`);
        return { ok: true, simulado: true };
      }
      const payload = JSON.stringify({ title: msg.titulo, body: msg.corpo, icon: "/icone-192.png", data: { url: msg.url } });
      try {
        // deno-lint-ignore no-explicit-any
        await webpush.sendNotification(destino as any, payload, { TTL: 600, timeout: 8000 });
        return { ok: true };
      } catch (e) {
        const status = (e as { statusCode?: number }).statusCode;
        return { ok: false, erro: `push HTTP ${status ?? "?"}`, desativarDispositivo: status === 404 || status === 410 };
      }
    },
  };
}
