// `pnpm telas` — gera os ícones PNG do PWA e tira screenshots de cada tela em docs/telas/
// (celular 390×844 e desktop 1440×900). Usa o Chrome instalado (sem baixar navegador).
// Faz login de verdade: pede o link mágico e lê o e-mail no Mailpit local.

import { mkdirSync, readFileSync } from "node:fs";
import { chromium, type Page } from "playwright-core";
import { db, esperar } from "./local.ts";

const PAINEL = process.env.URL_PAINEL ?? "http://localhost:3000";
const MAILPIT = "http://127.0.0.1:56424";
const EMAIL = "matheus@vizualizer.local";
mkdirSync("docs/telas", { recursive: true });

async function icones(page: Page) {
  const svg = readFileSync("assets/marca/vizu-mascote-180.svg", "utf8");
  for (const t of [180, 192, 512]) {
    await page.setViewportSize({ width: t, height: t });
    await page.setContent(
      `<body style="margin:0;background:#0B0B0C;display:grid;place-items:center;height:100vh">
         <div style="width:78%;height:78%">${svg.replace("<svg", '<svg width="100%" height="100%"')}</div></body>`,
    );
    await page.screenshot({ path: `apps/painel/public/icone-${t}.png` });
  }
}

async function linkMagico(): Promise<string> {
  for (let i = 0; i < 20; i++) {
    const lista = await (await fetch(`${MAILPIT}/api/v1/search?query=to:${EMAIL}`)).json();
    const id = lista.messages?.[0]?.ID;
    if (id) {
      const msg = await (await fetch(`${MAILPIT}/api/v1/message/${id}`)).json();
      const link = String(msg.Text ?? msg.HTML).match(/https?:\/\/[^\s"<>]+verify[^\s"<>]+/)?.[0];
      if (link) return link.replace(/&amp;/g, "&");
    }
    await esperar(500);
  }
  throw new Error("link mágico não chegou no Mailpit");
}

async function main() {
  const navegador = await chromium.launch({ channel: "chrome" });
  const ctx = await navegador.newContext({ colorScheme: "dark", locale: "pt-BR", timezoneId: "America/Sao_Paulo" });
  const page = await ctx.newPage();

  await icones(page);
  console.log("ícones gerados");

  await db.auth.admin.createUser({ email: EMAIL, email_confirm: true }).catch(() => {});
  await fetch(`${MAILPIT}/api/v1/messages`, { method: "DELETE" });

  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(`${PAINEL}/login`);
  await page.screenshot({ path: "docs/telas/login-celular.png" });
  await page.fill("#email", EMAIL);
  await page.click("button[type=submit]");
  await page.waitForSelector("text=Link enviado");
  await page.goto(await linkMagico());
  await page.waitForURL(`${PAINEL}/`, { timeout: 20_000 });
  console.log("login ok");

  const { data: ultimo } = await db.from("videos").select("id").eq("ja_visto_no_baseline", false).order("detectado_em", { ascending: false }).limit(1).maybeSingle();
  const telas: [string, string][] = [
    ["ao-vivo", "/"],
    ["perfis", "/perfis"],
    ["alertas", "/alertas"],
    ["saude", "/saude"],
    ...(ultimo ? ([["video", `/video/${ultimo.id}`]] as [string, string][]) : []),
  ];
  for (const [w, h, sufixo] of [[390, 844, "celular"], [1440, 900, "desktop"]] as const) {
    await page.setViewportSize({ width: w, height: h });
    for (const [nome, rota] of telas) {
      await page.goto(`${PAINEL}${rota}`);
      await page.waitForLoadState("networkidle");
      if (nome === "perfis") await page.locator("summary").first().click().catch(() => {});
      await esperar(1200); // dados + animação de entrada
      await page.screenshot({ path: `docs/telas/${nome}-${sufixo}.png`, fullPage: true });
      console.log(`docs/telas/${nome}-${sufixo}.png`);
    }
  }
  await navegador.close();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
