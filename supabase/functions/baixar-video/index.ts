// Baixa o vídeo do CDN (URL expira!) para o bucket `videos-temp` logo após o alerta.
// `{ "limpar": true }` remove arquivos com mais de 48 h (cron diário).
// URL `mock://<arquivo>` copia de `videos-temp/amostras/<arquivo>` (usado por `pnpm simular`).

import { admin, json } from "../_shared/supabase.ts";

const BUCKET = "videos-temp";

Deno.serve(async (req) => {
  const db = admin();
  const corpo = await req.json().catch(() => ({}));
  if (corpo.limpar) return json(await limpar(db));

  const { data: pendentes } = await db
    .from("videos")
    .select("id,perfil_id,shortcode,url_video,download_tentativas")
    .eq("status", "novo")
    .is("storage_path", null)
    .not("url_video", "is", null)
    .lt("download_tentativas", 3)
    .order("detectado_em", { ascending: false })
    .limit(5);

  const res = await Promise.allSettled(
    (pendentes ?? []).map(async (v) => {
      const caminho = `${v.perfil_id}/${v.shortcode}.mp4`;
      try {
        if (v.url_video.startsWith("mock://")) {
          const { error } = await db.storage.from(BUCKET).copy(`amostras/${v.url_video.slice(7)}`, caminho);
          if (error && !/exists/i.test(error.message)) throw error;
        } else {
          const r = await fetch(v.url_video, { signal: AbortSignal.timeout(60_000) });
          if (!r.ok) throw new Error(`CDN HTTP ${r.status}`);
          const { error } = await db.storage.from(BUCKET).upload(caminho, await r.blob(), { contentType: "video/mp4", upsert: true });
          if (error) throw error;
        }
        await db.from("videos").update({ storage_path: caminho, status: "baixado", download_erro: null }).eq("id", v.id);
      } catch (e) {
        const erro = e instanceof Error ? e.message : String(e);
        await db.from("videos").update({ download_tentativas: v.download_tentativas + 1, download_erro: erro }).eq("id", v.id);
        throw new Error(`${v.shortcode}: ${erro}`);
      }
    }),
  );
  const falhas = res.filter((r) => r.status === "rejected").length;
  if (falhas) console.error(res.filter((r) => r.status === "rejected").map((r) => (r as PromiseRejectedResult).reason));
  return json({ baixados: res.length - falhas, falhas });
});

// deno-lint-ignore no-explicit-any
async function limpar(db: any) {
  const limite = Date.now() - 48 * 3600_000;
  const { data: pastas } = await db.storage.from(BUCKET).list("", { limit: 1000 });
  const remover: string[] = [];
  for (const p of pastas ?? []) {
    if (p.id || p.name === "amostras") continue; // só pastas de perfil
    const { data: arquivos } = await db.storage.from(BUCKET).list(p.name, { limit: 1000 });
    for (const a of arquivos ?? []) if (new Date(a.created_at).getTime() < limite) remover.push(`${p.name}/${a.name}`);
  }
  if (remover.length) await db.storage.from(BUCKET).remove(remover);
  return { removidos: remover.length };
}
