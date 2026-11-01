"use client";
import { useState } from "react";
import { Erro, Vazio } from "@/components/Vazio";
import { ok, useAoVivo, type Perfil } from "@/lib/dados";
import { supabase } from "@/lib/supabase/client";
import { haQuanto, useAgora } from "@/lib/tempo";

type Janela = Perfil["janelas_manuais"][number];
const DIAS = ["seg", "ter", "qua", "qui", "sex", "sáb", "dom"];

async function buscar() {
  const sb = supabase();
  const [perfis, videos] = await Promise.all([
    sb.from("perfis").select("*").order("criado_em"),
    sb.from("videos").select("perfil_id,publicado_em").order("publicado_em", { ascending: false }).limit(1000),
  ]);
  const horas = new Map<string, number[]>();
  for (const v of ok(videos) as { perfil_id: string; publicado_em: string }[]) {
    const h = Number(new Date(v.publicado_em).toLocaleString("en-US", { hour: "numeric", hourCycle: "h23", timeZone: "America/Sao_Paulo" }));
    const arr = horas.get(v.perfil_id) ?? new Array(24).fill(0);
    arr[h]++;
    horas.set(v.perfil_id, arr);
  }
  return { perfis: ok(perfis) as Perfil[], horas };
}

export default function Perfis() {
  const agora = useAgora(5000);
  const { dados, erro, recarregar } = useAoVivo(buscar, ["perfis", "videos"]);
  const [novo, setNovo] = useState("");
  const [msg, setMsg] = useState<string | null>(null);

  async function adicionar(e: React.FormEvent) {
    e.preventDefault();
    const username = novo.trim().replace(/^@/, "").toLowerCase();
    if (!/^[a-z0-9._]{1,30}$/.test(username)) return setMsg("Use só letras, números, ponto e sublinhado (até 30).");
    const { error } = await supabase().from("perfis").insert({ username });
    if (error) return setMsg(/duplicate/.test(error.message) ? `@${username} já está na lista.` : error.message);
    setNovo("");
    setMsg(`@${username} adicionado. A primeira leitura grava os posts atuais sem alertar.`);
    recarregar();
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="font-display text-[32px] leading-none font-extrabold tracking-[-0.03em] md:text-[48px]">Perfis</h1>
        <p className="mt-3 text-texto-2">Quem o Vizu está vigiando, e com que frequência.</p>
      </div>

      <form onSubmit={adicionar} className="flex flex-col gap-2 sm:flex-row">
        <label htmlFor="novo" className="sr-only">Usuário do Instagram</label>
        <input
          id="novo"
          value={novo}
          onChange={(e) => setNovo(e.target.value)}
          placeholder="@usuario"
          className="flex-1 rounded-[14px] border border-borda bg-sup-2 px-4 py-3 font-mono"
        />
        <button className="rounded-[14px] bg-sinal px-5 py-3 font-bold text-tinta">Adicionar perfil</button>
      </form>
      {msg && <p role="status" className="text-sm text-texto-2">{msg}</p>}
      {erro && <Erro mensagem={erro} />}
      {dados?.perfis.length === 0 && <Vazio titulo="Nenhum perfil ainda" texto="Adicione o @ de um criador para começar a vigiar." />}

      <ul className="space-y-3">
        {dados?.perfis.map((p) => (
          <CartaoPerfil key={p.id} perfil={p} horas={dados.horas.get(p.id) ?? new Array(24).fill(0)} agora={agora} aoMudar={recarregar} />
        ))}
      </ul>
    </div>
  );
}

function CartaoPerfil({ perfil: p, horas, agora, aoMudar }: { perfil: Perfil; horas: number[]; agora: number; aoMudar: () => void }) {
  const [quente, setQuente] = useState(p.intervalo_quente_s);
  const [frio, setFrio] = useState(p.intervalo_frio_s);
  const [janela, setJanela] = useState<Janela>({ dow: [1, 2, 3, 4, 5], inicio: "18:00", fim: "22:00" });
  const [erro, setErro] = useState<string | null>(null);
  const max = Math.max(1, ...horas);

  async function salvar(campos: Partial<Perfil>) {
    const { error } = await supabase().from("perfis").update(campos).eq("id", p.id);
    setErro(error?.message ?? null);
    aoMudar();
  }

  return (
    <li className="rounded-[18px] border border-borda bg-sup-2">
      <details>
        <summary className="flex cursor-pointer list-none items-center gap-3 p-4">
          <span className={`size-2 rounded-full ${p.ativo ? "bg-sinal" : "bg-borda"}`} aria-hidden />
          <span className="flex-1 font-mono text-[15px]">@{p.username}</span>
          <span className="hidden text-[13px] text-mudo sm:inline">
            {p.ativo ? `checado ${haQuanto(p.ultimo_check_em, agora)}` : "pausado"}
          </span>
          <span className="text-mudo" aria-hidden>▾</span>
        </summary>

        <div className="grid gap-6 border-t border-borda p-4 md:grid-cols-2">
          <div className="space-y-4">
            <button
              type="button"
              onClick={() => salvar({ ativo: !p.ativo })}
              className="rounded-[12px] border border-borda px-4 py-2 text-sm font-bold"
            >
              {p.ativo ? "Pausar" : "Retomar"}
            </button>
            <div className="flex flex-wrap items-end gap-3">
              <label className="text-sm">
                <span className="block text-texto-2">Intervalo quente (s)</span>
                <input type="number" min={5} value={quente} onChange={(e) => setQuente(+e.target.value)} className="mt-1 w-24 rounded-[10px] border border-borda bg-tinta px-3 py-2 font-mono" />
              </label>
              <label className="text-sm">
                <span className="block text-texto-2">Intervalo frio (s)</span>
                <input type="number" min={30} value={frio} onChange={(e) => setFrio(+e.target.value)} className="mt-1 w-24 rounded-[10px] border border-borda bg-tinta px-3 py-2 font-mono" />
              </label>
              <button
                type="button"
                onClick={() =>
                  Number.isFinite(quente) && Number.isFinite(frio) && quente > 0 && frio > 0
                    ? salvar({ intervalo_quente_s: Math.max(5, Math.round(quente)), intervalo_frio_s: Math.max(30, Math.round(frio)) })
                    : setErro("Preencha os dois intervalos com números em segundos.")
                }
                className="rounded-[10px] bg-texto px-3 py-2 text-sm font-bold text-tinta"
              >
                Salvar intervalos
              </button>
            </div>

            <div>
              <p className="text-sm text-texto-2">Horários de postagem (últimos vídeos)</p>
              <div className="mt-2 grid grid-cols-24 gap-[3px]" style={{ gridTemplateColumns: "repeat(24, minmax(0, 1fr))" }}>
                {horas.map((n, h) => (
                  <div
                    key={h}
                    title={`${h}h: ${n} post(s)`}
                    className="aspect-square rounded-[2px]"
                    style={{ background: n ? `rgb(200 255 46 / ${0.15 + 0.85 * (n / max)})` : "var(--viz-superficie-3)" }}
                  />
                ))}
              </div>
              <div className="mt-1 flex justify-between font-mono text-[10px] text-mudo">
                <span>0h</span><span>12h</span><span>23h</span>
              </div>
            </div>
          </div>

          <div className="space-y-3">
            <p className="text-sm text-texto-2">Janelas quentes (checagem no intervalo quente)</p>
            <ul className="space-y-1.5 font-mono text-[13px]">
              {p.janelas_manuais.map((j, i) => (
                <li key={i} className="flex items-center gap-2">
                  <span className="flex-1">{j.dow.map((d) => DIAS[d - 1]).join(" ")} · {j.inicio}–{j.fim}</span>
                  <button
                    type="button"
                    onClick={() => salvar({ janelas_manuais: p.janelas_manuais.filter((_, k) => k !== i) })}
                    className="text-mudo hover:text-alerta"
                    aria-label={`Remover janela ${j.inicio}–${j.fim}`}
                  >
                    remover
                  </button>
                </li>
              ))}
              {p.janelas_aprendidas.map((j, i) => (
                <li key={`a${i}`} className="text-mudo">aprendida · {j.inicio}–{j.fim}</li>
              ))}
              {!p.janelas_manuais.length && !p.janelas_aprendidas.length && <li className="text-mudo">Nenhuma janela: tudo no intervalo frio.</li>}
            </ul>
            <fieldset className="space-y-2 rounded-[12px] border border-borda p-3">
              <legend className="px-1 text-sm text-texto-2">Nova janela</legend>
              <div className="flex flex-wrap gap-1">
                {DIAS.map((d, i) => {
                  const marcado = janela.dow.includes(i + 1);
                  return (
                    <button
                      key={d}
                      type="button"
                      aria-pressed={marcado}
                      onClick={() => setJanela({ ...janela, dow: marcado ? janela.dow.filter((x) => x !== i + 1) : [...janela.dow, i + 1].sort() })}
                      className={`rounded-[4px] px-2 py-1 font-mono text-[12px] ${marcado ? "bg-sinal text-tinta" : "bg-sup-3 text-texto-2"}`}
                    >
                      {d}
                    </button>
                  );
                })}
              </div>
              <div className="flex flex-wrap items-center gap-2 text-sm">
                <input type="time" value={janela.inicio} onChange={(e) => setJanela({ ...janela, inicio: e.target.value })} aria-label="Início" className="rounded-[10px] border border-borda bg-tinta px-2 py-1.5 font-mono" />
                <span>até</span>
                <input type="time" value={janela.fim} onChange={(e) => setJanela({ ...janela, fim: e.target.value })} aria-label="Fim" className="rounded-[10px] border border-borda bg-tinta px-2 py-1.5 font-mono" />
                <button
                  type="button"
                  disabled={!janela.dow.length}
                  onClick={() => salvar({ janelas_manuais: [...p.janelas_manuais, janela] })}
                  className="ml-auto rounded-[10px] bg-texto px-3 py-1.5 font-bold text-tinta disabled:opacity-40"
                >
                  Adicionar
                </button>
              </div>
            </fieldset>
          </div>
          {erro && <p role="alert" className="text-sm text-alerta md:col-span-2">Não foi possível salvar: {erro}</p>}
        </div>
      </details>
    </li>
  );
}
