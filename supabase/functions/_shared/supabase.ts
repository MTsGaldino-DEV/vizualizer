// Cliente service role para as Edge Functions (variáveis injetadas pelo runtime do Supabase).
import { createClient } from "npm:@supabase/supabase-js@2";

export const admin = () =>
  createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, {
    auth: { persistSession: false },
  });

/**
 * As funções do robô só aceitam a chave de serviço (pg_cron, worker, scripts). A anon key é pública
 * (vai no painel) e, com verify_jwt, já bastaria para chamar a função e queimar orçamento da fonte.
 */
export function exigirServico(req: Request): Response | null {
  const token = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  return token && token === Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ? null : json({ erro: "não autorizado" }, 401);
}

export const json =(dados: unknown, status = 200) =>
  new Response(JSON.stringify(dados), { status, headers: { "content-type": "application/json" } });

/** Dispara outra função sem esperar (o alerta nunca espera download nem IA). */
export function dispararFuncao(nome: string, corpo: unknown = {}) {
  const url = `${Deno.env.get("SUPABASE_URL")}/functions/v1/${nome}`;
  return fetch(url, {
    method: "POST",
    headers: {
      authorization: `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}`,
      "content-type": "application/json",
    },
    body: JSON.stringify(corpo),
  }).catch((e) => console.error(`falha ao disparar ${nome}:`, e));
}
