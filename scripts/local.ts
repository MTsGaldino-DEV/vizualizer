// Conexão com o Supabase LOCAL para scripts de desenvolvimento.
// Padrões = URL e chave demo pública do Supabase CLI (iguais em toda instalação local; não são segredo).
import { createClient } from "@supabase/supabase-js";

export const SUPABASE_URL = process.env.SUPABASE_URL ?? "http://127.0.0.1:56421";
export const SERVICE_KEY =
  process.env.SUPABASE_SERVICE_ROLE_KEY ??
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU";

if (!/127\.0\.0\.1|localhost/.test(SUPABASE_URL)) {
  throw new Error(`Scripts de simulação só rodam no Supabase LOCAL (recebi ${SUPABASE_URL}).`);
}

export const db = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });

export async function chamar(funcao: string, corpo: unknown = {}) {
  const r = await fetch(`${SUPABASE_URL}/functions/v1/${funcao}`, {
    method: "POST",
    headers: { authorization: `Bearer ${SERVICE_KEY}`, "content-type": "application/json" },
    body: JSON.stringify(corpo),
  });
  return r.json();
}

export const esperar = (ms: number) => new Promise((r) => setTimeout(r, ms));
