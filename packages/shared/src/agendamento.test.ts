import { describe, expect, it } from "vitest";
import {
  aprenderJanelas,
  avaliarCircuito,
  custoMensal,
  estaEmJanela,
  fatorOrcamento,
  proximoCheck,
} from "./agendamento";

// 2026-11-02 é segunda-feira. 21:00Z = 18:00 em São Paulo (UTC−3).
const seg18h = new Date("2026-11-02T21:00:00Z");
const seg23h = new Date("2026-11-03T02:00:00Z");
const janela = [{ dow: [1, 2, 3, 4, 5], inicio: "17:00", fim: "22:00" }];
const delta = (d: Date, base: Date) => d.getTime() - base.getTime();

describe("estaEmJanela (fuso America/Sao_Paulo, dow ISO)", () => {
  it("segunda 18:00 local está na janela 17–22 de dias úteis", () =>
    expect(estaEmJanela(janela, seg18h)).toBe(true));
  it("segunda 23:00 local está fora", () => expect(estaEmJanela(janela, seg23h)).toBe(false));
  it("domingo 18:00 local está fora", () =>
    expect(estaEmJanela(janela, new Date("2026-11-01T21:00:00Z"))).toBe(false));
  it("janela que cruza a meia-noite (22:00–02:00)", () =>
    expect(
      estaEmJanela([{ dow: [1, 2, 3, 4, 5, 6, 7], inicio: "22:00", fim: "02:00" }], new Date("2026-11-03T04:00:00Z")),
    ).toBe(true));
});

describe("proximoCheck", () => {
  const perfil = { intervaloQuenteS: 10, intervaloFrioS: 120, janelas: janela };
  it("usa intervalo quente dentro da janela (sem jitter quando rand=0.5)", () =>
    expect(delta(proximoCheck(perfil, seg18h, { rand: () => 0.5 }), seg18h)).toBe(10_000));
  it("usa intervalo frio fora da janela", () =>
    expect(delta(proximoCheck(perfil, seg23h, { rand: () => 0.5 }), seg23h)).toBe(120_000));
  it("jitter fica em ±20 %", () => {
    expect(delta(proximoCheck(perfil, seg18h, { rand: () => 0 }), seg18h)).toBe(8_000);
    expect(delta(proximoCheck(perfil, seg18h, { rand: () => 1 }), seg18h)).toBe(12_000);
  });
  it("fator de orçamento alarga só o intervalo frio", () => {
    expect(delta(proximoCheck(perfil, seg23h, { rand: () => 0.5, fatorFrio: 2 }), seg23h)).toBe(240_000);
    expect(delta(proximoCheck(perfil, seg18h, { rand: () => 0.5, fatorFrio: 2 }), seg18h)).toBe(10_000);
  });
});

describe("aprenderJanelas", () => {
  it("vira janela a faixa de hora com postagens recorrentes (com 1 h de antecedência)", () => {
    // 5 posts às 19:15 locais (22:15Z) em dias diferentes + 1 post solto às 08:00 local
    const datas = [1, 2, 3, 4, 5].map((d) => new Date(`2026-10-0${d}T22:15:00Z`));
    datas.push(new Date("2026-10-06T11:00:00Z"));
    expect(aprenderJanelas(datas)).toEqual([{ dow: [1, 2, 3, 4, 5, 6, 7], inicio: "18:00", fim: "20:00" }]);
  });
  it("sem histórico suficiente → nenhuma janela", () => expect(aprenderJanelas([new Date()])).toEqual([]));
});

describe("fatorOrcamento", () => {
  const meio = new Date("2026-11-16T03:00:00Z"); // metade de novembro
  it("dentro do orçamento → 1", () =>
    expect(fatorOrcamento({ usadoMes: 100, orcamentoMes: 1000, agora: meio }).fator).toBe(1));
  it("projeção acima do teto → fator > 1 e alerta", () => {
    const r = fatorOrcamento({ usadoMes: 1000, orcamentoMes: 1000, agora: meio });
    expect(r.fator).toBeGreaterThan(1.8);
    expect(r.estourando).toBe(true);
  });
});

describe("custoMensal (fórmula 3.3)", () => {
  it("exemplo do plano: 10 perfis, 6 h a 10 s + 18 h a 120 s = 810 mil req/mês", () => {
    const r = custoMensal({ perfis: 10, horasQuentes: 6, intervaloQuenteS: 10, intervaloFrioS: 120, precoPorReq: 0.001 });
    expect(r.reqPorPerfilDia).toBe(2700);
    expect(r.reqMes).toBe(810_000);
    expect(r.custoMes).toBeCloseTo(810);
  });
});

describe("avaliarCircuito", () => {
  const agora = new Date("2026-11-01T12:00:00Z");
  const opts = { limite: 3, pausaMin: 10 };
  it("abre depois de N erros seguidos", () => {
    let e: { errosSeguidos: number; abertoAte: Date | null } = { errosSeguidos: 0, abertoAte: null };
    for (let i = 0; i < 3; i++) e = avaliarCircuito(e, false, agora, opts);
    expect(e.abertoAte?.toISOString()).toBe("2026-11-01T12:10:00.000Z");
  });
  it("sucesso zera o contador", () =>
    expect(avaliarCircuito({ errosSeguidos: 2, abertoAte: null }, true, agora, opts)).toEqual({
      errosSeguidos: 0,
      abertoAte: null,
    }));
});
