"use client";
import { useParams, useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
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

  if (carregando) return <Skeleton role="status" className="h-96 rounded-[22px]" aria-label="Carregando vídeo" />;
  if (erro && !video) return <Erro mensagem={erro} />;
  if (!video) return <Vazio titulo="Vídeo não encontrado" texto="Ele pode ter sido removido." />;
  const job = statusJob(video);

  return (
    <div className="space-y-8">
      <Button variant="ghost" size="sm" onClick={() => router.back()} className="text-texto-2">
        ← Voltar
      </Button>
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
                  <Badge key={t} variant="outline" className="font-mono text-[12px] font-normal text-texto-2">
                    #{t}
                  </Badge>
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
            <Button size="marca" onClick={baixar} disabled={!video.storage_path}>
              {video.storage_path ? "Baixar" : "Preparando o download…"}
            </Button>
            <Button asChild variant="outline" size="marca">
              <a href={video.permalink} target="_blank" rel="noreferrer">
                Abrir no Instagram
              </a>
            </Button>
            <Button variant="outline" size="marca" onClick={() => marcar("repostado")}>
              Marcar como repostado
            </Button>
            <Button variant="ghost" size="marca" onClick={() => marcar("ignorado")} className="text-mudo">
              Ignorar
            </Button>
          </div>
          {acaoErro && <p role="alert" className="text-sm text-alerta">Não foi possível salvar: {acaoErro}</p>}
        </div>
      </div>
    </div>
  );
}
