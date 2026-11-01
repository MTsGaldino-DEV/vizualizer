// Agendamento adaptativo, orçamento e circuit breaker (seção 3.3). Funções puras, sem dependências.

export interface Janela {
  dow: number[]; // ISO: 1=segunda … 7=domingo
  inicio: string; // "HH:MM" (horário de São Paulo)
  fim: string;
}

const FUSO = "America/Sao_Paulo";
const fmt = new Intl.DateTimeFormat("en-US", {
  timeZone: FUSO,
  weekday: "short",
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
});
const DOW: Record<string, number> = { Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6, Sun: 7 };

function local(d: Date): { dow: number; min: number } {
  const partes = Object.fromEntries(fmt.formatToParts(d).map((p) => [p.type, p.value]));
  return { dow: DOW[partes.weekday!]!, min: Number(partes.hour) * 60 + Number(partes.minute) };
}

const paraMin = (hhmm: string) => {
  const [h, m] = hhmm.split(":").map(Number);
  return h! * 60 + m!;
};
const paraHHMM = (min: number) =>
  `${String(Math.floor(min / 60) % 24).padStart(2, "0")}:${String(min % 60).padStart(2, "0")}`;

export function estaEmJanela(janelas: Janela[], agora: Date): boolean {
  const { dow, min } = local(agora);
  const diaAnterior = dow === 1 ? 7 : dow - 1;
  return janelas.some((j) => {
    const ini = paraMin(j.inicio);
    const fim = paraMin(j.fim);
    if (ini <= fim) return j.dow.includes(dow) && min >= ini && min < fim;
    // Cruza a meia-noite: a parte antes da meia-noite pertence ao dia de início.
    return (j.dow.includes(dow) && min >= ini) || (j.dow.includes(diaAnterior) && min < fim);
  });
}

export interface PerfilAgenda {
  intervaloQuenteS: number;
  intervaloFrioS: number;
  janelas: Janela[];
}

/** Próximo check: quente na janela, frio fora; jitter ±20 %; `fatorFrio` (orçamento) alarga só o frio. */
export function proximoCheck(
  perfil: PerfilAgenda,
  agora: Date,
  opts: { rand?: () => number; fatorFrio?: number } = {},
): Date {
  const rand = opts.rand ?? Math.random;
  const quente = estaEmJanela(perfil.janelas, agora);
  const baseS = quente ? perfil.intervaloQuenteS : perfil.intervaloFrioS * (opts.fatorFrio ?? 1);
  const jitter = 1 + (rand() * 2 - 1) * 0.2;
  return new Date(agora.getTime() + Math.round(baseS * jitter * 1000));
}

/**
 * Janelas aprendidas: horas locais com ≥ 3 publicações e ≥ 20 % do total viram janela
 * (todos os dias), com 1 h de antecedência e terminando no fim da hora.
 * ponytail: ignora dia da semana; separar por dow quando o histórico for grande.
 */
export function aprenderJanelas(publicacoes: Date[]): Janela[] {
  const MIN_POSTS = 3;
  if (publicacoes.length < MIN_POSTS) return [];
  const porHora = new Array<number>(24).fill(0);
  for (const d of publicacoes) porHora[Math.floor(local(d).min / 60)]!++;
  const corte = Math.max(MIN_POSTS, publicacoes.length * 0.2);
  const quentes = porHora.map((n, h) => (n >= corte ? h : -1)).filter((h) => h >= 0);

  const janelas: Janela[] = [];
  let inicio = -1;
  let anterior = -2;
  for (const h of [...quentes, 99]) {
    if (h !== anterior + 1) {
      if (inicio >= 0) {
        janelas.push({
          dow: [1, 2, 3, 4, 5, 6, 7],
          inicio: paraHHMM(((inicio - 1 + 24) % 24) * 60),
          fim: paraHHMM((anterior + 1) * 60),
        });
      }
      inicio = h;
    }
    anterior = h;
  }
  return janelas;
}

/** Projeta o consumo do mês pelo ritmo atual; se passar do teto, devolve o fator para alargar o frio. */
export function fatorOrcamento(p: { usadoMes: number; orcamentoMes: number; agora: Date }): {
  fator: number;
  projetado: number;
  estourando: boolean;
} {
  const a = p.agora;
  const inicio = Date.UTC(a.getUTCFullYear(), a.getUTCMonth(), 1);
  const fim = Date.UTC(a.getUTCFullYear(), a.getUTCMonth() + 1, 1);
  const decorrido = Math.max((a.getTime() - inicio) / (fim - inicio), 1 / 720); // evita ÷0 na 1ª hora
  const projetado = p.usadoMes / decorrido;
  const estourando = p.orcamentoMes > 0 && projetado > p.orcamentoMes;
  return { fator: estourando ? projetado / p.orcamentoMes : 1, projetado: Math.round(projetado), estourando };
}

export function custoMensal(p: {
  perfis: number;
  horasQuentes: number;
  intervaloQuenteS: number;
  intervaloFrioS: number;
  precoPorReq: number;
}): { reqPorPerfilDia: number; reqMes: number; custoMes: number } {
  const reqPorPerfilDia =
    (p.horasQuentes * 3600) / p.intervaloQuenteS + ((24 - p.horasQuentes) * 3600) / p.intervaloFrioS;
  const reqMes = p.perfis * reqPorPerfilDia * 30;
  return { reqPorPerfilDia, reqMes, custoMes: reqMes * p.precoPorReq };
}

export interface EstadoCircuito {
  errosSeguidos: number;
  abertoAte: Date | null;
}

export function avaliarCircuito(
  estado: EstadoCircuito,
  ok: boolean,
  agora: Date,
  opts: { limite: number; pausaMin: number },
): EstadoCircuito {
  if (ok) return { errosSeguidos: 0, abertoAte: null };
  const errosSeguidos = estado.errosSeguidos + 1;
  const abertoAte =
    errosSeguidos >= opts.limite ? new Date(agora.getTime() + opts.pausaMin * 60_000) : estado.abertoAte;
  return { errosSeguidos, abertoAte };
}

export const circuitoAberto = (e: EstadoCircuito, agora: Date) => !!e.abertoAte && e.abertoAte > agora;
