"use client";
import Link from "next/link";
import { CardDestaque } from "@/components/CardDestaque";
import { Radar } from "@/components/Radar";
import { Erro, Vazio } from "@/components/Vazio";
import { ok, SELECT_VIDEO, useAoVivo, type Perfil, type Video } from "@/lib/dados";
import { supabase } from "@/lib/supabase/client";
import { haQuanto, horaLocal, segundos, useAgora } from "@/lib/tempo";

async function buscar() {
  const sb = supabase();
  const [perfis, videos] = await Promise.all([
    sb.from("perfis").select("*").order("username"),
    sb.from("videos").select(SELECT_VIDEO).eq("ja_visto_no_baseline", false).order("detectado_em", { ascending: false }).limit(12),
  ]);
  return { perfis: ok(perfis) as Perfil[], videos: ok(videos) as Video[] };
}

function statusPerfil(p: Perfil, agora: number) {
  if (!p.ativo) return { texto: "pausado", cor: "bg-borda" };
  if (p.erros_seguidos >= 3) return { texto: "fonte com erro", cor: "bg-alerta" };
  const hoje = p.ultimo_video_em && new Date(p.ultimo_video_em).toDateString() === new Date(agora).toDateString();
  if (!hoje) return { texto: "sem vídeos hoje", cor: "bg-texto-2" };
  return { texto: `último vídeo ${haQuanto(p.ultimo_video_em, agora)}`, cor: "bg-sinal" };
}

export default function AoVivo() {
  const agora = useAgora();
  const { dados, erro } = useAoVivo(buscar, ["videos", "perfis", "jobs_ia"]);
  const ativos = dados?.perfis.filter((p) => p.ativo).length ?? 0;
  const [destaque, ...demais] = dados?.videos ?? [];

  return (
    <div className="space-y-10">
      <section className="flex items-center gap-5 md:gap-8">
        <Radar perfis={dados?.perfis ?? []} agora={agora} tamanho={120} />
        <div>
          <h1 className="font-display text-[32px] leading-none font-extrabold tracking-[-0.03em] md:text-[56px]">Ao vivo</h1>
          <p className="rotulo mt-3 flex items-center gap-2 text-texto-2">
            <span className="relative inline-flex size-2">
              <span className="radar-anel absolute inset-0 rounded-full bg-sinal" />
              <span className="relative size-2 rounded-full bg-sinal" />
            </span>
            Monitorando · {ativos} {ativos === 1 ? "perfil" : "perfis"} · ao vivo
          </p>
        </div>
      </section>

      {erro && <Erro mensagem={erro} />}

      {dados && !destaque && (
        <Vazio
          titulo="Tudo calmo no horizonte"
          texto="Assim que um dos perfis postar um vídeo, ele aparece aqui em segundos."
          acao={
            dados.perfis.length === 0 ? (
              <Link href="/perfis" className="mt-2 rounded-[14px] bg-sinal px-5 py-2.5 font-bold text-tinta">
                Adicionar perfil
              </Link>
            ) : undefined
          }
        />
      )}
      {destaque && <CardDestaque key={destaque.id} video={destaque} agora={agora} />}

      <div className="grid gap-10 lg:grid-cols-[1fr_1.1fr]">
        <section aria-labelledby="t-perfis" className="min-w-0">
          <h2 id="t-perfis" className="font-display text-xl font-bold">Perfis</h2>
          <ul className="mt-3 divide-y divide-borda border-y border-borda">
            {dados?.perfis.map((p) => {
              const s = statusPerfil(p, agora);
              return (
                <li key={p.id} className="flex items-center gap-3 py-3">
                  <span className={`size-2 shrink-0 rounded-full ${s.cor}`} aria-hidden />
                  <span className="min-w-0 flex-1 truncate font-mono text-[14px]">@{p.username}</span>
                  <span className="text-[13px] text-mudo">{s.texto}</span>
                </li>
              );
            })}
          </ul>
        </section>

        <section aria-labelledby="t-recentes" className="min-w-0">
          <h2 id="t-recentes" className="font-display text-xl font-bold">Detectados antes</h2>
          {demais.length === 0 ? (
            <p className="mt-3 text-sm text-mudo">Os vídeos anteriores aparecem aqui.</p>
          ) : (
            <ul className="mt-3 divide-y divide-borda border-y border-borda">
              {demais.map((v) => (
                <li key={v.id}>
                  <Link href={`/video/${v.id}`} className="flex items-baseline gap-3 py-3 hover:bg-sup-1">
                    <span className="font-mono text-[13px] text-mudo">{horaLocal(v.detectado_em)}</span>
                    <span className="min-w-0 flex-1 truncate">
                      <span className="font-mono text-[14px]">@{v.perfis?.username}</span>
                      <span className="text-texto-2"> · {v.resumo ?? v.legenda ?? (v.eh_reels ? "Reels" : "Vídeo")}</span>
                    </span>
                    <span className="font-mono text-[12px] text-mudo">{segundos(v.latencia_ms)}</span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}
