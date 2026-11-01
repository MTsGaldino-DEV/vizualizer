"use client";
import { useEffect, useState } from "react";
import { Logo } from "@/components/Logo";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/lib/supabase/client";

export default function Login() {
  const [email, setEmail] = useState("");
  const [estado, setEstado] = useState<"livre" | "enviando" | "enviado">("livre");
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    if (new URLSearchParams(window.location.search).get("erro") === "link")
      setErro("Este link de acesso é inválido ou expirou. Peça um novo abaixo.");
  }, []);

  async function enviar(e: React.FormEvent) {
    e.preventDefault();
    setEstado("enviando");
    setErro(null);
    const { error } = await supabase().auth.signInWithOtp({
      email,
      options: { emailRedirectTo: `${window.location.origin}/auth/callback`, shouldCreateUser: false },
    });
    if (error) {
      setErro(/signups not allowed|not found/i.test(error.message) ? "Este e-mail não tem acesso ao painel." : error.message);
      setEstado("livre");
    } else setEstado("enviado");
  }

  return (
    <main className="grid min-h-dvh place-items-center px-4">
      <div className="w-full max-w-sm">
        <img src="/marca/vizu-mascote-180.svg" alt="Vizu, o suricato sentinela" width={120} height={120} className="mx-auto" />
        <div className="mt-6 text-center">
          <Logo tamanho={36} />
          <p className="mt-3 text-texto-2">A sentinela que nunca pisca.</p>
        </div>

        {estado === "enviado" ? (
          <div className="mt-10 rounded-[18px] border border-borda bg-sup-2 p-5 text-center" role="status">
            <p className="font-bold">Link enviado para {email}</p>
            <p className="mt-1 text-sm text-texto-2">Abra o e-mail neste aparelho para entrar.</p>
          </div>
        ) : (
          <form onSubmit={enviar} className="mt-10 space-y-3">
            <Label htmlFor="email" className="text-texto-2">
              E-mail
            </Label>
            <Input
              id="email"
              type="email"
              required
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="voce@exemplo.com"
            />
            <Button type="submit" size="marca" className="w-full" disabled={estado === "enviando"}>
              {estado === "enviando" ? "Enviando…" : "Receber link de acesso"}
            </Button>
            {erro && (
              <p role="alert" className="text-sm text-alerta">
                {erro}
              </p>
            )}
          </form>
        )}
      </div>
    </main>
  );
}
