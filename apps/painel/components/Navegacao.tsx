"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Icone, type NomeIcone } from "./Icone";
import { Logo } from "./Logo";

const ITENS: { href: string; rotulo: string; icone: NomeIcone }[] = [
  { href: "/", rotulo: "Ao vivo", icone: "tempo-real" },
  { href: "/perfis", rotulo: "Perfis", icone: "perfis" },
  { href: "/alertas", rotulo: "Alertas", icone: "alertar" },
  { href: "/saude", rotulo: "Saúde", icone: "monitorar" },
];

export function Navegacao() {
  const atual = usePathname();
  const ativo = (href: string) => (href === "/" ? atual === "/" || atual.startsWith("/video") : atual.startsWith(href));
  return (
    <>
      {/* Desktop: trilho lateral */}
      <nav aria-label="Principal" className="sticky top-0 hidden h-dvh w-60 shrink-0 flex-col gap-8 border-r border-borda px-5 py-7 md:flex">
        <Link href="/" className="px-2">
          <Logo />
        </Link>
        <ul className="flex flex-col gap-1">
          {ITENS.map((i) => (
            <li key={i.href}>
              <Link
                href={i.href}
                aria-current={ativo(i.href) ? "page" : undefined}
                className={`flex items-center gap-3 rounded-[12px] px-3 py-2.5 text-[15px] font-medium transition-colors ${
                  ativo(i.href) ? "bg-sup-2 text-texto" : "text-texto-2 hover:text-texto"
                }`}
              >
                <Icone nome={i.icone} className={ativo(i.href) ? "text-sinal" : ""} />
                {i.rotulo}
              </Link>
            </li>
          ))}
        </ul>
        <p className="mt-auto px-2 font-display text-sm font-bold leading-snug text-mudo">
          Vigiar. Avisar.
          <br />
          Agir.
        </p>
      </nav>

      {/* Celular: barra inferior */}
      <nav aria-label="Principal" className="fixed inset-x-0 bottom-0 z-20 border-t border-borda bg-tinta/95 pb-[env(safe-area-inset-bottom)] backdrop-blur md:hidden">
        <ul className="grid grid-cols-4">
          {ITENS.map((i) => (
            <li key={i.href}>
              <Link
                href={i.href}
                aria-current={ativo(i.href) ? "page" : undefined}
                className={`flex flex-col items-center gap-1 py-2.5 text-[11px] font-medium ${ativo(i.href) ? "text-sinal" : "text-mudo"}`}
              >
                <Icone nome={i.icone} tamanho={22} />
                {i.rotulo}
              </Link>
            </li>
          ))}
        </ul>
      </nav>
    </>
  );
}
