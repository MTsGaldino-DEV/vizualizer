"use client";
import { useEffect, useState } from "react";

export function haQuanto(data: string | Date | null | undefined, agora: number): string {
  if (!data) return "nunca";
  const s = Math.max(0, Math.round((agora - new Date(data).getTime()) / 1000));
  if (s < 60) return `há ${s} s`;
  if (s < 3600) return `há ${Math.floor(s / 60)} min`;
  if (s < 86400) return `há ${Math.floor(s / 3600)} h`;
  return `há ${Math.floor(s / 86400)} d`;
}

export const segundos = (ms: number | null | undefined) => (ms == null ? "—" : `${Math.max(0, Math.round(ms / 1000))} s`);

export const horaLocal = (d: string) =>
  new Date(d).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", timeZone: "America/Sao_Paulo" });

/** Relógio que bate a cada `ms` (contador "HÁ X s" ao vivo). */
export function useAgora(ms = 1000) {
  const [agora, setAgora] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setAgora(Date.now()), ms);
    return () => clearInterval(id);
  }, [ms]);
  return agora;
}
