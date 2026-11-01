"use client";
import { Erro } from "@/components/Vazio";
import { ok, useAoVivo } from "@/lib/dados";
import { supabase } from "@/lib/supabase/client";
import { haQuanto, segundos, useAgora } from "@/lib/tempo";

interface Estatisticas {
  latencia_media_ms: number | null;
  latencia_p95_ms: number | null;
  videos_24h: number;
  checagens_24h: number;
  erros_24h: number;
  checagens_mes: number;
  por_fonte: Record<string, number>;
  fila_ia: number;
  worker_ia_batimento: { em: string; modelo?: string } | null;
  vigiar_batimento: { em: string; fonte: string } | null;
  orcamento_requisicoes_mes: number | null;
}

const vivo = (em: string | undefined, agora: number, limiteS: number) => !!em && agora - new Date(em).getTime() < limiteS * 1000;

export default function Saude() {
  const agora = useAgora(2000);
  const { dados: e, erro } = useAoVivo(
    async () => ok(await supabase().rpc("estatisticas_painel")) as Estatisticas,
    ["videos", "jobs_ia", "checagens"],
  );
  const orcamento = Number(e?.orcamento_requisicoes_mes ?? 0);
  const uso = orcamento ? Math.min(1, (e?.checagens_mes ?? 0) / orcamento) : 0;
  const robo = vivo(e?.vigiar_batimento?.em, agora, 120);
  const worker = vivo(e?.worker_ia_batimento?.em, agora, 90);

  return (
    <div className="space-y-10">
      <div>
        <h1 className="font-display text-[32px] leading-none font-extrabold tracking-[-0.03em] md:text-[48px]">Saúde e custo</h1>
        <p className="mt-3 text-texto-2">Velocidade de detecção, erros e consumo do mês.</p>
      </div>
      {erro && <Erro mensagem={erro} />}

      <section className="grid gap-px overflow-hidden rounded-[18px] border border-borda bg-borda sm:grid-cols-2 lg:grid-cols-4">
        {[
          ["Latência média", segundos(e?.latencia_media_ms), "últimos 7 dias"],
          ["Latência p95", segundos(e?.latencia_p95_ms), "95 % dos vídeos abaixo disso"],
          ["Vídeos em 24 h", String(e?.videos_24h ?? "—"), "detectados e avisados"],
          ["Erros em 24 h", String(e?.erros_24h ?? "—"), `de ${e?.checagens_24h ?? "—"} checagens`],
        ].map(([t, v, d]) => (
          <div key={t} className="bg-sup-1 p-5">
            <p className="text-sm text-texto-2">{t}</p>
            <p className="mt-2 font-display text-[36px] leading-none font-bold">{v}</p>
            <p className="mt-2 text-[13px] text-mudo">{d}</p>
          </div>
        ))}
      </section>

      <div className="grid gap-8 md:grid-cols-2">
        <section aria-labelledby="t-servicos" className="space-y-3">
          <h2 id="t-servicos" className="font-display text-xl font-bold">Serviços</h2>
          <ul className="divide-y divide-borda border-y border-borda">
            <li className="flex items-center gap-3 py-3">
              <span className={`size-2 rounded-full ${robo ? "bg-sinal" : "bg-alerta"}`} aria-hidden />
              <span className="flex-1">Robô de vigia</span>
              <span className="font-mono text-[13px] text-mudo">
                {robo ? `ok · ${e?.vigiar_batimento?.fonte}` : "parado"} · {haQuanto(e?.vigiar_batimento?.em, agora)}
              </span>
            </li>
            <li className="flex items-center gap-3 py-3">
              <span className={`size-2 rounded-full ${worker ? "bg-sinal" : "bg-borda"}`} aria-hidden />
              <span className="flex-1">Resumo por IA (PC)</span>
              <span className="font-mono text-[13px] text-mudo">
                {worker ? "online" : "offline"} · fila {e?.fila_ia ?? 0}
              </span>
            </li>
          </ul>
          {!worker && (
            <p className="text-sm text-mudo">Com o PC desligado, os resumos esperam na fila. Os alertas continuam saindo.</p>
          )}
        </section>

        <section aria-labelledby="t-custo" className="space-y-3">
          <h2 id="t-custo" className="font-display text-xl font-bold">Consumo do mês</h2>
          <p className="font-mono text-[14px]">
            {(e?.checagens_mes ?? 0).toLocaleString("pt-BR")} de {orcamento ? orcamento.toLocaleString("pt-BR") : "—"} requisições
          </p>
          <div className="h-2 overflow-hidden rounded-full bg-sup-3" role="progressbar" aria-valuenow={Math.round(uso * 100)} aria-valuemin={0} aria-valuemax={100} aria-label="Consumo do orçamento">
            <div className={`h-full ${uso > 0.9 ? "bg-alerta" : "bg-sinal"}`} style={{ width: `${uso * 100}%` }} />
          </div>
          <ul className="space-y-1 pt-2 font-mono text-[13px] text-texto-2">
            {Object.entries(e?.por_fonte ?? {}).map(([f, n]) => (
              <li key={f} className="flex justify-between">
                <span>{f}</span>
                <span>{n.toLocaleString("pt-BR")} em 24 h</span>
              </li>
            ))}
          </ul>
        </section>
      </div>
    </div>
  );
}
