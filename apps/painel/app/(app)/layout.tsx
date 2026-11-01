import { Navegacao } from "@/components/Navegacao";
import { Logo } from "@/components/Logo";

export default function LayoutApp({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-dvh">
      <a
        href="#principal"
        className="sr-only focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-50 focus:rounded-[10px] focus:bg-sinal focus:px-4 focus:py-2 focus:font-bold focus:text-tinta"
      >
        Pular para o conteúdo
      </a>
      <Navegacao />
      <div className="min-w-0 flex-1">
        <header className="flex items-center justify-between border-b border-borda px-4 py-3 md:hidden">
          <Logo tamanho={20} />
        </header>
        <main id="principal" tabIndex={-1} className="mx-auto w-full max-w-5xl px-4 pt-6 pb-28 md:px-10 md:pt-10 md:pb-16">{children}</main>
      </div>
    </div>
  );
}
