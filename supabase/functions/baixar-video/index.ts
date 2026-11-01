// Baixa o vídeo do CDN (URL expira!) para o bucket `videos-temp` logo após o alerta.
// `{ "limpar": true }` remove arquivos com mais de 48 h (cron diário).
// URL `mock://<arquivo>` copia de `videos-temp/amostras/<arquivo>` (usado por `pnpm simular`).

import { admin, exigirServico, json } from "../_shared/supabase.ts";

const BUCKET = "videos-temp";

Deno.serve(async (req) => {
  const negado = exigirServico(req);
  if (negado) return negado;
  const db = admin();
  const corpo = await req.json().catch(() => ({}));
  if (corpo.limpar) return json(await limpar(db));

  const { data: pendentes, error } = await db.rpc("pegar_downloads", { lim: 5 });
  if (error) return json({ erro: error.message }, 500);

  const res = await Promise.allSettled(
    (pendentes ?? []).map(async (v: any) => {
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
        const ok = await db.from("videos").update({ storage_path: caminho, download_erro: null }).eq("id", v.id);
        if (ok.error) throw ok.error;
        // Só avança o status se o painel ainda não mexeu nele.
        await db.from("videos").update({ status: "baixado" }).eq("id", v.id).eq("status", "novo");
      } catch (e) {
        const erro = e instanceof Error ? e.message : String(e);
        await db.from("videos").update({ download_erro: erro, download_pego_em: null }).eq("id", v.id);
        throw new Error(`${v.shortcode}: ${erro}`);
      }
    }),
  );
  const falhas = res.filter((r) => r.status === "rejected") as PromiseRejectedResult[];
  for (const f of falhas) console.error("download falhou:", f.reason);
  return json({ baixados: res.length - falhas.length, falhas: falhas.length });
});

async function limpar(db: any) {
  const limite = Date.now() - 48 * 3600_000;
  const { data: pastas } = await db.storage.from(BUCKET).list("", { limit: 1000 });
  const remover: string[] = [];
  for (const p of pastas ?? []) {
    if (p.id || p.name === "amostras") continue; // só pastas de perfil
    const { data: arquivos } = await db.storage.from(BUCKET).list(p.name, { limit: 1000 });
    for (const a of arquivos ?? []) if (new Date(a.created_at).getTime() < limite) remover.push(`${p.name}/${a.name}`);
  }
  if (remover.length) {
    await db.storage.from(BUCKET).remove(remover);
    // Sem isso, notificar/worker gerariam signed URL para arquivo que não existe mais.
    await db.from("videos").update({ storage_path: null }).in("storage_path", remover);
  }
  return { removidos: remover.length };
}
