"use client";
import Link from "next/link";
import { useState } from "react";
import { linkDownload, statusJob, type Video } from "@/lib/dados";
import { haQuanto, segundos } from "@/lib/tempo";

/** Card em lima do vídeo mais recente (prancha 06). `key={video.id}` no pai reinicia a animação de entrada. */
export function CardDestaque({ video, agora }: { video: Video; agora: number }) {
  const [erro, setErro] = useState<string | null>(null);
  const recente = agora - new Date(video.detectado_em).getTime() < 10 * 60_000;
  const job = statusJob(video);
  const tipo = video.eh_reels ? "um reels" : "um vídeo";

  async function baixar() {
    setErro(null);
    try {
      window.location.href = await linkDownload(video.storage_path!);
    } catch (e) {
      setErro(e instanceof Error ? e.message : "falha ao gerar o link");
    }
  }

  return (
    <article className="card-novo rounded-[22px] bg-sinal p-6 text-tinta md:p-8">
      <p className="rotulo font-semibold">
        {recente ? "Novo vídeo" : "Último vídeo"} · {haQuanto(video.detectado_em, agora)}
      </p>
      <h2 className="mt-3 font-display text-[28px] leading-[1.1] font-bold tracking-[-0.02em] md:text-[40px] md:leading-[44px]">
        @{video.perfis?.username} {recente ? "acabou de postar" : "postou"} {tipo}
      </h2>
      <p className="mt-2 font-mono text-[13px]">Detectado {segundos(video.latencia_ms)} após a publicação</p>

      <div className="mt-5 max-w-[62ch] text-[15px] leading-relaxed">
        {video.resumo ? (
          <>
            <p>{video.resumo}</p>
            {!!video.resumo_tags?.length && (
              <p className="mt-2 flex flex-wrap gap-1.5">
                {video.resumo_tags.map((t) => (
                  <span key={t} className="rounded-[4px] bg-tinta/10 px-1.5 py-0.5 font-mono text-[12px]">
                    #{t}
                  </span>
                ))}
              </p>
            )}
          </>
        ) : job === "falhou" ? (
          <p className="text-tinta/70">O resumo não ficou pronto. O vídeo continua disponível para baixar.</p>
        ) : (
          <div className="space-y-2">
            <div className="skeleton h-3.5 w-11/12 rounded" aria-hidden />
            <div className="skeleton h-3.5 w-8/12 rounded" aria-hidden />
            <p role="status" className="pt-1 font-mono text-[12px] text-tinta/70">Vizu está assistindo para resumir…</p>
          </div>
        )}
      </div>

      <div className="mt-6 flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={baixar}
          disabled={!video.storage_path}
          className="rounded-[14px] bg-tinta px-5 py-3 text-[16px] font-bold text-sinal transition-opacity disabled:opacity-50"
        >
          {video.storage_path ? "Baixar e repostar" : "Preparando o download…"}
        </button>
        <Link href={`/video/${video.id}`} className="rounded-[14px] px-4 py-3 text-[15px] font-bold underline-offset-4 hover:underline">
          Ver detalhes
        </Link>
      </div>
      {erro && <p role="alert" className="mt-3 text-sm font-medium">Não deu para gerar o link: {erro}</p>}
    </article>
  );
}
