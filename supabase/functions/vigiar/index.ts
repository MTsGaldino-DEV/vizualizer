// Tick do robô (seção 3). Chamado pelo Supabase Cron a cada 10 s.
// 1. pega perfis vencidos  2. consulta a fonte  3. classifica  4. registra (dedupe no banco)  5. dispara notificar.

import { admin, dispararFuncao, json } from "../_shared/supabase.ts";
import { classificarPosts } from "../_shared/regras/deteccao.ts";
import {
  avaliarCircuito,
  circuitoAberto,
  fatorOrcamento,
  proximoCheck,
  type EstadoCircuito,
  type Janela,
} from "../_shared/regras/agendamento.ts";
import { criarFonteMock, type PostCru } from "../_shared/fontes/mock.ts";
import { criarFonteHikerAPI } from "../_shared/fontes/hikerapi.ts";
import { criarFonteBusinessDiscovery } from "../_shared/fontes/business-discovery.ts";
import type { FonteInstagram } from "../_shared/fontes/tipos.ts";

declare const EdgeRuntime: { waitUntil(p: Promise<unknown>): void };

const LIMITE_POSTS = 12;
const CIRCUITO = { limite: 5, pausaMin: 10 };

Deno.serve(async () => {
  const db = admin();
  const agora = new Date();

  const fontes: Record<string, FonteInstagram> = {
    mock: criarFonteMock(async (u) => {
      const { data } = await db.from("config").select("valor").eq("chave", `mock:${u}`).maybeSingle();
      return (data?.valor as PostCru[] | undefined) ?? null;
    }),
    hikerapi: criarFonteHikerAPI(Deno.env.get("PROVEDOR_IG_API_KEY")),
    "business-discovery": criarFonteBusinessDiscovery(Deno.env.get("IG_GRAPH_USER_ID"), Deno.env.get("IG_GRAPH_TOKEN")),
  };
  const nomePrincipal = Deno.env.get("FONTE_PRINCIPAL") ?? "mock";
  const nomeReserva = Deno.env.get("FONTE_RESERVA") ?? "";

  const { data: perfis, error } = await db.rpc("pegar_perfis_vencidos", { lim: 10 });
  if (error) return json({ erro: error.message }, 500);

  const cfg = Object.fromEntries(
    ((await db.from("config").select("chave,valor")).data ?? [])
      .filter((c) => !c.chave.startsWith("mock:"))
      .map((c) => [c.chave, c.valor]),
  );
  const circuito: EstadoCircuito = cfg[`circuito:${nomePrincipal}`]
    ? { ...cfg[`circuito:${nomePrincipal}`], abertoAte: cfg[`circuito:${nomePrincipal}`].abertoAte ? new Date(cfg[`circuito:${nomePrincipal}`].abertoAte) : null }
    : { errosSeguidos: 0, abertoAte: null };

  const inicioMes = new Date(Date.UTC(agora.getUTCFullYear(), agora.getUTCMonth(), 1)).toISOString();
  const { count: usadoMes } = await db
    .from("checagens")
    .select("id", { count: "exact", head: true })
    .gte("criado_em", inicioMes)
    .neq("fonte", "mock");
  const orcamento = fatorOrcamento({ usadoMes: usadoMes ?? 0, orcamentoMes: Number(cfg.orcamento_requisicoes_mes ?? 0), agora });

  const usarReserva = circuitoAberto(circuito, agora) && !!fontes[nomeReserva];
  const fonte = fontes[usarReserva ? nomeReserva : nomePrincipal];
  if (!fonte) return json({ erro: `fonte desconhecida: ${nomePrincipal}` }, 500);

  let novos = 0;
  let estadoCircuito = circuito;
  await Promise.all(
    (perfis ?? []).map(async (perfil) => {
      const t0 = Date.now();
      let ok = true;
      let erro: string | undefined;
      try {
        const posts = await fonte.ultimosPosts(perfil.username, LIMITE_POSTS);
        const classificados = classificarPosts(posts, {
          baseline: !perfil.baseline_feito,
          monitoradoDesde: new Date(perfil.monitorado_desde),
          agora: new Date(),
          carrosselComVideo: cfg.carrossel_com_video_alerta === true,
        });
        const { data: inseridos, error: e } = await db.rpc("registrar_posts", {
          p_perfil: perfil.id,
          p_baseline: !perfil.baseline_feito,
          posts: classificados.map((p) => ({
            shortcode: p.shortcode,
            tipo: p.tipo,
            eh_reels: p.ehReels,
            publicado_em: p.publicadoEm.toISOString(),
            legenda: p.legenda ?? null,
            permalink: p.permalink,
            url_thumb: p.urlThumb ?? null,
            url_video: p.urlVideo ?? null,
            alertar: p.alertar,
          })),
        });
        if (e) throw new Error(e.message);
        novos += inseridos?.length ?? 0;
        for (const v of inseridos ?? []) console.log(`🟢 vídeo novo @${perfil.username} ${v.shortcode}`);
      } catch (e) {
        ok = false;
        erro = e instanceof Error ? e.message : String(e);
        console.error(`checagem @${perfil.username}: ${erro}`);
      }
      if (!usarReserva) estadoCircuito = avaliarCircuito(estadoCircuito, ok, agora, CIRCUITO);

      const janelas = [...(perfil.janelas_manuais as Janela[]), ...(perfil.janelas_aprendidas as Janela[])];
      await Promise.all([
        db.from("checagens").insert({ perfil_id: perfil.id, fonte: fonte.nome, ok, duracao_ms: Date.now() - t0, erro }),
        db
          .from("perfis")
          .update({
            ultimo_check_em: new Date().toISOString(),
            proximo_check_em: proximoCheck(
              { intervaloQuenteS: perfil.intervalo_quente_s, intervaloFrioS: perfil.intervalo_frio_s, janelas },
              new Date(),
              { fatorFrio: orcamento.fator },
            ).toISOString(),
            erros_seguidos: ok ? 0 : perfil.erros_seguidos + 1,
          })
          .eq("id", perfil.id),
      ]);
    }),
  );

  await db.from("config").upsert([
    { chave: "vigiar_batimento", valor: { em: new Date().toISOString(), perfis: perfis?.length ?? 0, fonte: fonte.nome } },
    { chave: `circuito:${nomePrincipal}`, valor: estadoCircuito },
    { chave: "orcamento_estado", valor: orcamento },
  ]);

  if (novos > 0) {
    // Sem await: o alerta é prioridade; download corre em paralelo.
    EdgeRuntime.waitUntil(Promise.all([dispararFuncao("notificar"), dispararFuncao("baixar-video")]));
  }
  return json({ perfis: perfis?.length ?? 0, novos, fonte: fonte.nome, reserva: usarReserva });
});
