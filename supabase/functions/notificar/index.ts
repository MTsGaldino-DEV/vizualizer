// Fila de notificações (seção 6): pega pendentes, envia por canal, retry com backoff (até 3 tentativas).
// Cada linha é um dispositivo → falha de um canal não bloqueia os outros (allSettled).

import { admin, json } from "../_shared/supabase.ts";
import { backoffS, MAX_TENTATIVAS, montarMensagem, textoWhatsApp, type CanalNotificacao } from "../_shared/canais/tipos.ts";
import { criarCanalWhatsApp } from "../_shared/canais/whatsapp.ts";
import { criarCanalWebPush } from "../_shared/canais/webpush.ts";
import { canalExpoStub } from "../_shared/canais/expo.ts";

const env = (k: string) => Deno.env.get(k) || undefined;

Deno.serve(async () => {
  const db = admin();
  const canais: Record<string, CanalNotificacao> = {
    whatsapp: criarCanalWhatsApp({
      url: env("EVOLUTION_API_URL"),
      chave: env("EVOLUTION_API_KEY"),
      instancia: env("EVOLUTION_INSTANCIA"),
      permitidos: [env("WHATSAPP_NUMERO_TESTE") ?? ""],
    }),
    web_push: criarCanalWebPush(env("VAPID_PUBLIC_KEY"), env("VAPID_PRIVATE_KEY"), env("VAPID_CONTATO")),
    expo: canalExpoStub,
  };
  const urlPainel = env("URL_PAINEL") ?? "http://localhost:3000";

  const { data: fila, error } = await db.rpc("pegar_notificacoes", { lim: 20 });
  if (error) return json({ erro: error.message }, 500);
  if (!fila?.length) return json({ enviados: 0 });

  const resultados = await Promise.allSettled(
    fila.map(async (n) => {
      const [{ data: v }, { data: d }] = await Promise.all([
        db.from("videos").select("id,permalink,latencia_ms,storage_path,resumo,resumo_tags,perfis(username)").eq("id", n.video_id).single(),
        db.from("dispositivos").select("*").eq("id", n.dispositivo_id).single(),
      ]);
      if (!v || !d) throw new Error("vídeo ou dispositivo sumiu");

      let linkBaixar: string | null = null;
      if (v.storage_path) {
        const { data: s } = await db.storage.from("videos-temp").createSignedUrl(v.storage_path, 48 * 3600, { download: true });
        linkBaixar = s?.signedUrl ?? null;
      }
      const dados = {
        id: v.id,
        // deno-lint-ignore no-explicit-any
        username: (v.perfis as any)?.username ?? "?",
        latenciaMs: v.latencia_ms,
        permalink: v.permalink,
        linkBaixar,
        resumo: v.resumo,
        tags: v.resumo_tags,
      };
      const msg = montarMensagem(n.tipo_msg, dados, urlPainel);
      msg.textoWhatsApp = textoWhatsApp(msg, dados);

      const canal = canais[d.tipo];
      const r = canal ? await canal.enviar(d.destino, msg) : { ok: false as const, erro: `canal ${d.tipo} desconhecido` };

      if (r.ok) {
        await db.from("notificacoes").update({ status: "enviado", enviado_em: new Date().toISOString(), erro: r.simulado ? "simulado" : null }).eq("id", n.id);
        return;
      }
      const desistir = n.tentativas >= MAX_TENTATIVAS || r.desativarDispositivo;
      await db
        .from("notificacoes")
        .update({
          status: desistir ? "falhou" : "pendente",
          erro: r.erro,
          proxima_tentativa_em: new Date(Date.now() + backoffS(n.tentativas) * 1000).toISOString(),
        })
        .eq("id", n.id);
      if (r.desativarDispositivo) await db.from("dispositivos").update({ ativo: false }).eq("id", d.id);
      throw new Error(r.erro);
    }),
  );
  const falhas = resultados.filter((r) => r.status === "rejected").map((r) => String((r as PromiseRejectedResult).reason));
  for (const f of falhas) console.error("notificação falhou:", f);
  return json({ processados: fila.length, falhas: falhas.length });
});
