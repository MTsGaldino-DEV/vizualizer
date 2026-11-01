// `pnpm criar-usuario voce@email.com` — cria o usuário do painel no Supabase LOCAL (cadastro público está desligado).
import { db } from "./local.ts";

const email = process.argv[2];
if (!email) {
  console.error("uso: pnpm criar-usuario voce@email.com");
  process.exit(1);
}
const { data, error } = await db.auth.admin.createUser({ email, email_confirm: true });
if (error && !/already/i.test(error.message)) throw error;
console.log(data.user ? `usuário criado: ${data.user.email}` : `usuário já existia: ${email}`);
console.log("Entre em http://localhost:3000/login — o link mágico chega no Mailpit: http://127.0.0.1:56424");
