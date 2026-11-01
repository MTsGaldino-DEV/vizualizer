/** Estado vazio/erro com o Vizu espiando da toca. */
export function Vazio({ titulo, texto, acao }: { titulo: string; texto?: string; acao?: React.ReactNode }) {
  return (
    <div className="flex flex-col items-center gap-3 rounded-[18px] border border-dashed border-borda px-6 py-10 text-center">
      <img src="/marca/vizu-toca-u.svg" alt="" width={72} height={72} className="opacity-90" />
      <p className="font-display text-lg font-bold">{titulo}</p>
      {texto && <p className="max-w-[42ch] text-sm text-texto-2">{texto}</p>}
      {acao}
    </div>
  );
}

export function Erro({ mensagem }: { mensagem: string }) {
  return (
    <p role="alert" className="rounded-[14px] border border-alerta/40 bg-alerta/10 px-4 py-3 text-sm text-alerta">
      Não foi possível carregar os dados: {mensagem}
    </p>
  );
}
