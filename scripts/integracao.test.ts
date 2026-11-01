// Integração com o Supabase LOCAL (pula se ele não estiver no ar).
import { beforeAll, describe, expect, it } from "vitest";
import { db } from "./local.ts";

let noAr = false;
beforeAll(async () => {
  noAr = !(await db.from("config").select("chave").limit(1)).error;
});

// Só roda com `pnpm test:integracao` (cria linhas no banco local e pode disparar o notificar do cron).
describe.runIf(import.meta.env.MODE === "integracao")("banco local", () => {
  it("ticks concorrentes não duplicam vídeo, notificação nem job (regra 3.2.2)", async (ctx) => {
    if (!noAr) return ctx.skip();
    const username = `conc-${Date.now()}`;
    const { data: perfil } = await db.from("perfis").insert({ username, baseline_feito: true }).select().single();
    const post = {
      shortcode: `C${Date.now()}`, tipo: "video", eh_reels: true, publicado_em: new Date().toISOString(),
      permalink: "https://www.instagram.com/reel/x/", alertar: true,
    };
    const chamadas = await Promise.all(
      Array.from({ length: 8 }, () => db.rpc("registrar_posts", { p_perfil: perfil!.id, posts: [post], p_baseline: false })),
    );
    expect(chamadas.map((c) => c.error)).toEqual(Array(8).fill(null));
    expect(chamadas.flatMap((c) => c.data ?? [])).toHaveLength(1);

    const { data: v } = await db.from("videos").select("id").eq("perfil_id", perfil!.id);
    expect(v).toHaveLength(1);
    const { count: jobs } = await db.from("jobs_ia").select("id", { count: "exact", head: true }).eq("video_id", v![0]!.id);
    expect(jobs).toBe(1);
    const { count: disp } = await db.from("dispositivos").select("id", { count: "exact", head: true }).eq("ativo", true);
    const { count: notifs } = await db.from("notificacoes").select("id", { count: "exact", head: true }).eq("video_id", v![0]!.id);
    expect(notifs).toBe(disp);
    await db.from("perfis").delete().eq("id", perfil!.id);
  });

  it("pegar_perfis_vencidos concorrente entrega conjuntos disjuntos (SKIP LOCKED + arrendamento)", async (ctx) => {
    if (!noAr) return ctx.skip();
    const prefixo = `venc-${Date.now()}`;
    await db.from("perfis").insert(
      Array.from({ length: 6 }, (_, i) => ({ username: `${prefixo}-${i}`, proximo_check_em: new Date(Date.now() - 1000).toISOString() })),
    );
    const [a, b] = await Promise.all([db.rpc("pegar_perfis_vencidos", { lim: 50 }), db.rpc("pegar_perfis_vencidos", { lim: 50 })]);
    const nomes = (r: typeof a) => (r.data ?? []).map((p: { username: string }) => p.username).filter((u: string) => u.startsWith(prefixo));
    const ia = nomes(a);
    const ib = nomes(b);
    expect(ia.filter((u: string) => ib.includes(u))).toEqual([]);
    expect(ia.length + ib.length).toBe(6);
    await db.from("perfis").delete().like("username", `${prefixo}%`);
  });
});
