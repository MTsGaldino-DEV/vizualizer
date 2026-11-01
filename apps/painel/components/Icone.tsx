export type NomeIcone =
  | "monitorar"
  | "alertar"
  | "video-novo"
  | "em-segundos"
  | "de-olho"
  | "repostar"
  | "tempo-real"
  | "perfis";

/** Ícones da marca (traço 1.6 px, grid 24) via máscara: a cor vem de currentColor. */
export function Icone({ nome, tamanho = 20, className = "" }: { nome: NomeIcone; tamanho?: number; className?: string }) {
  return (
    <span
      aria-hidden
      className={`icone shrink-0 ${className}`}
      style={{ width: tamanho, height: tamanho, ["--src" as string]: `url(/marca/icones/${nome}.svg)` }}
    />
  );
}
