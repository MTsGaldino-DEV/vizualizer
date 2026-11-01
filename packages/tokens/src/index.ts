export const cores = {
  tinta: "#0B0B0C",
  superficie1: "#1A1A1C",
  superficie2: "#1F1F22",
  superficie3: "#232326",
  borda: "#2E2E30",
  texto: "#EDEDED",
  texto2: "#C9C9C9",
  textoMudo: "#A6A6A6",
  sinal: "#C8FF2E",
  creme: "#F3ECE0",
  terra: "#3A302A",
  alerta: "#FF5B1F",
} as const;

export const fontes = {
  display: "Syne",
  texto: "DM Sans",
  mono: "JetBrains Mono",
} as const;

export const raios = { card: 18, cardMin: 14, cardMax: 22, chip: 4 } as const;
export const icone = { traco: 1.8, grade: 24 } as const;

/** Variáveis CSS `--viz-*` derivadas de `cores`. */
export const cssVars: Record<string, string> = {
  "--viz-tinta": cores.tinta,
  "--viz-superficie-1": cores.superficie1,
  "--viz-superficie-2": cores.superficie2,
  "--viz-superficie-3": cores.superficie3,
  "--viz-borda": cores.borda,
  "--viz-texto": cores.texto,
  "--viz-texto-2": cores.texto2,
  "--viz-texto-mudo": cores.textoMudo,
  "--viz-sinal": cores.sinal,
  "--viz-creme": cores.creme,
  "--viz-terra": cores.terra,
  "--viz-alerta": cores.alerta,
};
