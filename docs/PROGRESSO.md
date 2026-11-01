# Progresso (modo noturno, 2026-11-01)

Branch `noite/mvp`. Fases 0 a 6 executadas localmente; a Fase 7 (deploy) ficou só em documentação, como pedido. Relatório completo: `docs/RELATORIO-NOITE.md`.

| Fase | Estado | Próximo passo |
|---|---|---|
| 0 | ⚠️ pesquisa + fixtures; medição real pendente | Chave de provedor → rodar o spike de 2 h |
| 1 | ✅ | — |
| 2 | ✅ com mock; ❌ perfil real ao vivo | Mesma chave da Fase 0 |
| 3 | ✅ com canais simulados; ❌ WhatsApp/push reais | `WHATSAPP_NUMERO_TESTE` + Evolution; testar push num celular |
| 4 | ✅ telas + PWA; ❌ instalação no iPhone/Android não testada | Abrir no celular pela rede local/HTTPS |
| 5 | ✅ texto com IA real; ❌ visão e transcrição | Instalar modelo de visão e whisper.cpp |
| 6 | ✅ (carga acelerada, não 24 h reais) | Rodar 24 h com a fonte real |
| 7 | 📄 só runbook/checklist | Seguir `docs/runbook.md` §6 |

Ao retomar: `npx supabase start -x vector,logflare,imgproxy,supavisor`, depois `corepack pnpm test` e `corepack pnpm simular`.
