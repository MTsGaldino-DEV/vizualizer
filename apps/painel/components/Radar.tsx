"use client";
import type { Perfil } from "@/lib/dados";

const ACESO_MS = 2 * 60_000;

/**
 * "A sentinela que nunca pisca": círculos concêntricos = tela de radar; cada perfil é um ponto.
 * Anel interno = vídeo na última hora; meio = hoje; borda = mais antigo. Ponto lima = vídeo nos últimos 2 min.
 */
export function Radar({ perfis, agora, tamanho = 220 }: { perfis: Perfil[]; agora: number; tamanho?: number }) {
  const c = 50;
  const pontos = perfis.map((p, i) => {
    const idade = p.ultimo_video_em ? agora - new Date(p.ultimo_video_em).getTime() : Infinity;
    const raio = idade < 3600_000 ? 16 : idade < 86400_000 ? 29 : 41;
    const ang = (i * 137.5 - 90) * (Math.PI / 180); // ângulo de ouro espalha sem sobrepor
    return {
      p,
      x: c + raio * Math.cos(ang),
      y: c + raio * Math.sin(ang),
      aceso: p.ativo && idade < ACESO_MS,
    };
  });
  const algumAceso = pontos.some((d) => d.aceso);

  return (
    <svg
      viewBox="0 0 100 100"
      width={tamanho}
      height={tamanho}
      role="img"
      aria-label={`Radar: ${perfis.length} perfis monitorados${algumAceso ? ", vídeo novo agora" : ""}`}
      className="shrink-0"
    >
      <defs>
        <linearGradient id="feixe" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#C8FF2E" stopOpacity="0" />
          <stop offset="1" stopColor="#C8FF2E" stopOpacity="0.28" />
        </linearGradient>
      </defs>
      {[46, 35, 22, 9].map((r) => (
        <circle key={r} cx={c} cy={c} r={r} fill="none" stroke="var(--viz-borda)" strokeWidth={0.5} />
      ))}
      <line x1={c} y1={4} x2={c} y2={96} stroke="var(--viz-superficie-3)" strokeWidth={0.4} />
      <line x1={4} y1={c} x2={96} y2={c} stroke="var(--viz-superficie-3)" strokeWidth={0.4} />
      <g className="radar-varredura">
        <path d={`M${c} ${c} L${c} 4 A46 46 0 0 1 ${c + 46 * Math.sin(0.7)} ${c - 46 * Math.cos(0.7)} Z`} fill="url(#feixe)" />
        <line x1={c} y1={c} x2={c} y2={4} stroke="#C8FF2E" strokeOpacity={0.55} strokeWidth={0.5} />
      </g>
      <circle cx={c} cy={c} r={1.6} fill="var(--viz-texto-mudo)" />
      {pontos.map(({ p, x, y, aceso }) => (
        <g key={p.id}>
          <title>@{p.username}</title>
          {aceso && <circle cx={x} cy={y} r={4} fill="none" stroke="#C8FF2E" strokeWidth={0.6} className="radar-anel" />}
          <circle
            cx={x}
            cy={y}
            r={aceso ? 2.4 : 1.7}
            fill={!p.ativo ? "var(--viz-borda)" : aceso ? "#C8FF2E" : "var(--viz-texto-2)"}
            className={aceso ? "ponto-aceso" : undefined}
          />
        </g>
      ))}
    </svg>
  );
}
