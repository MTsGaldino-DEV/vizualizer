# Fase 4 — Painel: Plano

> Spec: PLANO-VIZUALIZER.md seção 7. Skills: frontend-design (+ motion por CSS). Ausentes nesta máquina: design-taste-frontend, build-awwwards-quality-sites, vercel-react-best-practices. shadcn/ui integrado depois (decisões #36–#39).

**Design:** marca fixada pela 7.1 (tinta + lima, Syne/DM Sans/JetBrains Mono). Um elemento marcante: o **radar** (cada perfil é um ponto; acende em lima com vídeo < 2 min). Resto quieto. Mobile-first (PWA), trilho lateral no desktop.

1. Next 16 + Tailwind 4; cores via `@vizualizer/tokens` → `--viz-*` no `<html>` → `@theme`.
2. Auth: link mágico (`@supabase/ssr`, `proxy.ts`), cadastro desligado.
3. Telas: Ao vivo (radar, card lima, perfis, recentes), Vídeo, Perfis (intervalos, janelas, heatmap), Alertas (push, WhatsApp, teste, onboarding iPhone), Saúde & custo, Login.
4. Realtime: `useAoVivo` refaz a consulta em mudanças de `videos`/`perfis`/`jobs_ia`.
5. PWA: `manifest.ts`, `public/sw.js` (push + abrir card), ícones gerados do mascote.
6. `pnpm telas`: login real via Mailpit + screenshots em `docs/telas/`.
