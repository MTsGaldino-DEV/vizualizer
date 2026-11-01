"use client";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Erro, Vazio } from "@/components/Vazio";
import { linkDownload, ok, SELECT_VIDEO, statusJob, useAoVivo, type Video } from "@/lib/dados";
import { supabase } from "@/lib/supabase/client";
import { horaLocal, segundos } from "@/lib/tempo";

const STATUS: Record<string, string> = {
  novo: "Novo",
  baixado: "Pronto para baixar",
  resumido: "Resumido",
  repostado: "Repostado",
  ignorado: "Ignorado",
};

export default function DetalheVideo() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { dados: video, erro, carregando } = useAoVivo(
    async () => ok(await supabase().from("videos").select(SELECT_VIDEO).eq("id", id).maybeSingle()) as Video | null,
    ["videos", "jobs_ia"],
  );
  const [src, setSrc] = useState<string | null>(null);
  const [acaoErro, setAcaoErro] = useState<string | null>(null);

  useEffect(() => {
    setSrc(null);
    if (video?.storage_path) linkDownload(video.storage_path).then(setSrc, () => setSrc(null));
  }, [video?.storage_path]);

  async function baixar() {
    setAcaoErro(null);
    try {
      window.location.href = await linkDownload(video!.storage_path!); // link novo a cada clique
    } catch (e) {
      setAcaoErro(e instanceof Error ? e.message : "falha ao gerar o link");
    }
  }

  async function marcar(status: "repostado" | "ignorado") {
    const { error } = await supabase().from("videos").update({ status }).eq("id", id);
    if (error) setAcaoErro(error.message);
  }

  if (carregando) return <div role="status" className="skeleton h-96 rounded-[22px] bg-sup-2" aria-label="Carregando vídeo" />;
  if (erro && !video) return <Erro mensagem={erro} />;
  if (!video) return <Vazio titulo="Vídeo não encontrado" texto="Ele pode ter sido removido." />;
  const job = statusJob(video);

  return (
    <div className="space-y-8">
      <button type="button" onClick={() => router.back()} className="text-sm text-texto-2 hover:text-texto">
        ← Voltar
      </button>
      <div className="grid gap-8 md:grid-cols-[minmax(0,360px)_1fr]">
        <div className="overflow-hidden rounded-[22px] border border-borda bg-sup-1">
          {src ? (
            <video src={src} controls playsInline className="aspect-[9/16] w-full bg-tinta object-contain" />
          ) : (
            <div className="grid aspect-[9/16] place-items-center p-6 text-center text-sm text-mudo">
              {video.storage_path ? "Carregando vídeo…" : "O vídeo ainda está sendo baixado."}
            </div>
          )}
        </div>

        <div className="space-y-6">
          <div>
            <p className="rotulo text-mudo">{STATUS[video.status] ?? video.status}</p>
            <h1 className="mt-2 font-display text-[32px] leading-tight font-bold tracking-[-0.02em]">
              @{video.perfis?.username}
            </h1>
            <dl className="mt-3 grid grid-cols-3 gap-4 border-y border-borda py-4 font-mono text-[13px]">
              <div>
                <dt className="text-mudo">Publicado</dt>
                <dd className="mt-1">{horaLocal(video.publicado_em)}</dd>
              </div>
              <div>
                <dt className="text-mudo">Detectado</dt>
                <dd className="mt-1">{horaLocal(video.detectado_em)}</dd>
              </div>
              <div>
                <dt className="text-mudo">Latência</dt>
                <dd className="mt-1 text-sinal">{segundos(video.latencia_ms)}</dd>
              </div>
            </dl>
          </div>

          <section>
            <h2 className="font-display text-lg font-bold">Resumo</h2>
            {video.resumo ? (
              <p className="mt-2 max-w-[62ch] leading-relaxed text-texto-2">{video.resumo}</p>
            ) : (
              <p className="mt-2 text-sm text-mudo">
                {job === "falhou" ? "O resumo não ficou pronto." : "Vizu está assistindo para resumir…"}
              </p>
            )}
            {!!video.resumo_tags?.length && (
              <p className="mt-3 flex flex-wrap gap-1.5">
                {video.resumo_tags.map((t) => (
                  <span key={t} className="rounded-[4px] border border-borda px-1.5 py-0.5 font-mono text-[12px] text-texto-2">
                    #{t}
                  </span>
                ))}
              </p>
            )}
          </section>

          {video.legenda && (
            <section>
              <h2 className="font-display text-lg font-bold">Legenda</h2>
              <p className="mt-2 max-w-[62ch] whitespace-pre-line text-texto-2">{video.legenda}</p>
            </section>
          )}

          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              onClick={baixar}
              disabled={!video.storage_path}
              className="rounded-[14px] bg-sinal px-5 py-3 font-bold text-tinta disabled:opacity-50"
            >
              {video.storage_path ? "Baixar" : "Preparando o download…"}
            </button>
            <a href={video.permalink} target="_blank" rel="noreferrer" className="rounded-[14px] border border-borda px-5 py-3 font-bold">
              Abrir no Instagram
            </a>
            <button type="button" onClick={() => marcar("repostado")} className="rounded-[14px] border border-borda px-5 py-3 font-bold">
              Marcar como repostado
            </button>
            <button type="button" onClick={() => marcar("ignorado")} className="rounded-[14px] px-5 py-3 font-bold text-mudo hover:text-texto">
              Ignorar
            </button>
          </div>
          {acaoErro && <p role="alert" className="text-sm text-alerta">Não foi possível salvar: {acaoErro}</p>}
        </div>
      </div>
    </div>
  );
}
