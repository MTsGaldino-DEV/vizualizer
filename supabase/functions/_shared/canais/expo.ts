// Stub do canal Expo Push (Fase 8). `dispositivos.tipo='expo'` já é aceito pelo banco.
import type { CanalNotificacao } from "./tipos.ts";

export const canalExpoStub: CanalNotificacao = {
  tipo: "expo",
  enviar(_destino, msg) {
    console.log(`[expo stub] ${msg.titulo}`);
    return Promise.resolve({ ok: true, simulado: true });
  },
};
