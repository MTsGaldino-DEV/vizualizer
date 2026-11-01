"use client";
import { useEffect, useState } from "react";
import { Icone } from "@/components/Icone";
import { Erro } from "@/components/Vazio";
import { ok, useAoVivo } from "@/lib/dados";
import { supabase } from "@/lib/supabase/client";

interface Dispositivo {
  id: string;
  usuario_id: string | null;
  tipo: "web_push" | "whatsapp" | "expo";
  destino: { numero?: string; endpoint?: string };
  ativo: boolean;
}

const VAPID = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
const NOMES = { web_push: "Push neste aparelho", whatsapp: "WhatsApp", expo: "App (em breve)" };

function base64ParaUint8(b64: string) {
  const s = atob((b64 + "=".repeat((4 - (b64.length % 4)) % 4)).replace(/-/g, "+").replace(/_/g, "/"));
  return Uint8Array.from(s, (c) => c.charCodeAt(0));
}

export default function Alertas() {
  const { dados, erro, recarregar } = useAoVivo(
    async () => ok(await supabase().from("dispositivos").select("*").order("criado_em")) as Dispositivo[],
    ["dispositivos"],
  );
  const [msg, setMsg] = useState<string | null>(null);
  const [numero, setNumero] = useState("");
  const [ios, setIos] = useState({ ehIos: false, instalado: false });

  useEffect(() => {
    setIos({
      ehIos: /iphone|ipad|ipod/i.test(navigator.userAgent),
      instalado: window.matchMedia("(display-mode: standalone)").matches,
    });
  }, []);

  async function ativarPush() {
    setMsg(null);
    try {
      if (!VAPID) throw new Error("chave VAPID não configurada no painel (NEXT_PUBLIC_VAPID_PUBLIC_KEY)");
      if (!("serviceWorker" in navigator) || !("PushManager" in window))
        throw new Error(ios.ehIos ? "no iPhone, instale o painel na Tela de Início primeiro (veja abaixo)" : "este navegador não suporta push");
      if ((await Notification.requestPermission()) !== "granted") throw new Error("permissão de notificação negada");
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: base64ParaUint8(VAPID) });
      const { data: u } = await supabase().auth.getUser();
      const { error } = await supabase().from("dispositivos").insert({ usuario_id: u.user!.id, tipo: "web_push", destino: sub.toJSON() });
      if (error) throw new Error(error.message);
      setMsg("Push ativado neste aparelho.");
      recarregar();
    } catch (e) {
      setMsg(`Não foi possível ativar o push: ${e instanceof Error ? e.message : e}`);
    }
  }

  async function adicionarWhatsApp(e: React.FormEvent) {
    e.preventDefault();
    const n = numero.replace(/\D/g, "");
    if (n.length < 12) return setMsg("Informe o número com DDI e DDD, ex.: 55 11 99999-0000.");
    const { data: u } = await supabase().auth.getUser();
    const { error } = await supabase().from("dispositivos").insert({ usuario_id: u.user!.id, tipo: "whatsapp", destino: { numero: n } });
    setMsg(error ? error.message : "WhatsApp adicionado.");
    setNumero("");
    recarregar();
  }

  async function testar(d: Dispositivo) {
    const { error } = await supabase().rpc("testar_dispositivo", { p_disp: d.id });
    setMsg(error ? `Teste não enviado: ${error.message}` : "Teste na fila. Chega em alguns segundos.");
  }

  async function alternar(d: Dispositivo) {
    const { error } = await supabase().from("dispositivos").update({ ativo: !d.ativo }).eq("id", d.id);
    if (error) setMsg(error.message);
    recarregar();
  }

  return (
    <div className="space-y-10">
      <div>
        <h1 className="font-display text-[32px] leading-none font-extrabold tracking-[-0.03em] md:text-[48px]">Alertas</h1>
        <p className="mt-3 text-texto-2">Onde o aviso de vídeo novo chega.</p>
      </div>
      {erro && <Erro mensagem={erro} />}
      {msg && <p role="status" className="rounded-[14px] border border-borda bg-sup-2 px-4 py-3 text-sm">{msg}</p>}

      <section className="space-y-3">
        <ul className="divide-y divide-borda border-y border-borda">
          {dados?.map((d) => (
            <li key={d.id} className="flex flex-wrap items-center gap-3 py-3">
              <Icone nome={d.tipo === "whatsapp" ? "alertar" : "em-segundos"} className={d.ativo ? "text-sinal" : "text-mudo"} />
              <span className="flex-1">
                <span className="font-medium">{NOMES[d.tipo]}</span>
                <span className="ml-2 font-mono text-[13px] text-mudo">
                  {d.tipo === "whatsapp" ? `+${d.destino.numero}` : d.destino.endpoint ? new URL(d.destino.endpoint).host : ""}
                  {d.usuario_id === null && " · sistema"}
                  {!d.ativo && " · desligado"}
                </span>
              </span>
              <button type="button" onClick={() => testar(d)} disabled={!d.ativo} className="rounded-[10px] border border-borda px-3 py-1.5 text-sm font-bold disabled:opacity-40">
                Enviar teste
              </button>
              {d.usuario_id !== null && (
                <button type="button" onClick={() => alternar(d)} className="px-2 py-1.5 text-sm text-mudo hover:text-texto">
                  {d.ativo ? "Desligar" : "Religar"}
                </button>
              )}
            </li>
          ))}
          {dados?.length === 0 && <li className="py-4 text-sm text-mudo">Nenhum canal ainda. Ative o push ou adicione um WhatsApp.</li>}
        </ul>

        <div className="flex flex-col gap-3 pt-2 md:flex-row">
          <button type="button" onClick={ativarPush} className="rounded-[14px] bg-sinal px-5 py-3 font-bold text-tinta">
            Ativar push neste aparelho
          </button>
          <form onSubmit={adicionarWhatsApp} className="flex flex-1 flex-col gap-2 sm:flex-row">
            <label htmlFor="wpp" className="sr-only">Número de WhatsApp</label>
            <input id="wpp" inputMode="tel" value={numero} onChange={(e) => setNumero(e.target.value)} placeholder="55 11 99999-0000" className="min-w-0 flex-1 rounded-[14px] border border-borda bg-sup-2 px-4 py-3 font-mono" />
            <button className="rounded-[14px] border border-borda px-4 py-3 font-bold">Adicionar WhatsApp</button>
          </form>
        </div>
      </section>

      <section aria-labelledby="t-iphone" className={`rounded-[22px] border p-6 ${ios.ehIos && !ios.instalado ? "border-sinal bg-sup-2" : "border-borda"}`}>
        <div className="flex items-start gap-4">
          <img src="/marca/vizu-mascote-72.svg" alt="" width={56} height={56} />
          <div>
            <h2 id="t-iphone" className="font-display text-xl font-bold">Receber push no iPhone</h2>
            <p className="mt-1 text-sm text-texto-2">
              O iPhone só entrega notificações de sites instalados na Tela de Início (iOS 16.4 ou mais novo).
            </p>
          </div>
        </div>
        <ol className="mt-5 grid gap-3 sm:grid-cols-3">
          {[
            ["Abra no Safari", "Este endereço, no Safari do iPhone."],
            ["Toque em Compartilhar", "O quadrado com a seta para cima, na barra de baixo."],
            ["Adicionar à Tela de Início", "Depois abra o Vizualizer pelo ícone e toque em “Ativar push”."],
          ].map(([t, d], i) => (
            <li key={t} className="rounded-[14px] bg-sup-1 p-4">
              <span className="font-mono text-[12px] text-sinal">{i + 1}</span>
              <p className="mt-1 font-bold">{t}</p>
              <p className="mt-1 text-sm text-texto-2">{d}</p>
            </li>
          ))}
        </ol>
      </section>
    </div>
  );
}
