# Benchmark de IA local — RX 7600 8 GB (noite de 2026-11-01)

**Ambiente:** Ollama 0.40.13 no Windows, GPU detectada como `ROCm gfx1102 — AMD Radeon RX 7600, 8 GiB` (log do servidor). Comando: `pnpm --filter @vizualizer/worker-ia benchmark`.

## Texto (resumo JSON validado com zod)

| Modelo | Caso | Tempo (s) | Resumo | Tags |
|---|---|---|---|---|
| qwen3:8b | @chef.rapida | 22,8 (inclui carregar o modelo) | A chef mostra como fazer um bolo de caneca de chocolate em 3 minutos. Mistura ingredientes em uma caneca e coloca no micro-ondas por 2,5 minutos. O resultado é um bolo crescido e pronto. | receita rápida, bolo de caneca, microondas, chocolate, doce, cozinha |
| qwen3:8b | @treino.em.casa | 3,9 | O vídeo mostra um homem fazendo três exercícios sem equipamento: agachamento, flexão com joelho no chão e prancha. Ele executa cada exercício por 3 séries de 15 repetições e mantém a prancha por 30 segundos. O treino é feito três vezes por semana. | agachamento, flexão, prancha, treino em casa, exercícios, sem equipamento |
| qwen3:8b | @viagem.barata | 3,0 | Trilha na mata que leva a uma praia escondida em Ubatuba. Vista aérea mostra uma pequena praia com água verde e poucas pessoas. | praia escondida, trilha, ubatuba, natureza, viagem, paisagem |

Ponta a ponta (`pnpm simular --esperar-resumo` com o worker no ar): **resumo gravado 33 s após a detecção** (4,2 s de IA por job com o modelo quente; o resto foi fila de jobs antigos).

Observação de qualidade: no caso do treino o modelo atribuiu "3 séries de 15" aos três exercícios (a fala diz isso só do agachamento). Aceitável para o MVP; revisar o prompt se incomodar.

## Escolha provisória
- **Texto: `qwen3:8b`** (único instalado; `think: false`, `temperature 0.2`, `keep_alive 60s`).
- **Visão: nenhum** — não há modelo multimodal instalado. **Bloqueio B3.** Baixar um modelo cria arquivos fora da pasta do projeto (proibido esta noite). Sugestão para a manhã: testar 2 modelos de visão que caibam em 8 GB da biblioteca atual do Ollama e rodar este benchmark com `OLLAMA_MODELO_VISAO`.
- **Transcrição: desligada** — whisper.cpp não instalado. **Bloqueio B4.** Precisa do binário com Vulkan (`whisper-cli`) e de um modelo ggml (`small`/`medium`) em `WHISPER_CLI`/`WHISPER_MODELO`.
- Segundo modelo de texto para comparação: não instalado (mesmo motivo).

## Atualização — visão com `gemma3:4b` (2026-11-01, dia)

Vídeo: Reel real de 24 s do @instagram (`DfISRt1vadT`), 5 quadros, sem transcrição (whisper ainda desligado). Comando: `tsx src/benchmark-visao.ts`.

| Combinação | Visão | Texto | Total (frio, inclui carregar modelo) |
|---|---|---|---|
| A: `gemma3:4b` visão + `qwen3:8b` texto | 36,0 s | 34,9 s | 71,0 s |
| **B: `gemma3:4b` para tudo** | 26,9 s | 22,3 s | **49,2 s** |

Ponta a ponta no worker (`pnpm simular --esperar-resumo` com o Reel real): **32 s** com modelo frio, **~9 s** com o modelo já carregado.

Resumo gerado (B, ponta a ponta): "Um criador demonstra o processo de criação de uma peça de roupa temática de Halloween, utilizando tecido preto com pregas e detalhes em branco… Ele utiliza ferramentas como tesoura e agulha para criar os desenhos e, por fim, veste a peça finalizada."

**Escolha: `gemma3:4b` para visão e texto.** Mais rápido, um só modelo na VRAM (3,4 GB), sem troca de modelo; o worker mantém o modelo carregado entre visão e texto quando é o mesmo. As duas combinações variam em detalhes pequenos (ex.: "arroz" x "grânulos") — sem a fala transcrita, a descrição depende só dos quadros.

## Atualização — transcrição com whisper.cpp (2026-11-01)

Build `whisper-blas-bin-x64` (v1.9.5, CPU) + `ggml-small.bin` (465 MB), em `ferramentas/whisper/`. Reel real de 52 s do @oreidosites com fala em PT:

| Threads | Tempo |
|---|---|
| 4 (padrão do whisper) | 36,3 s |
| **8** | **31,0 s** |

Transcrição fiel ("rapaziada internet acabou… um cara criou um software… unifica todos os google drives gratuitos…"). Ponta a ponta no worker (whisper + `gemma3:4b` frio): **72,8 s**. Resumo gerado: "O vídeo apresenta o software 9Drive, que unifica contas de armazenamento em nuvem gratuitas… Ele argumenta que a IA está substituindo serviços pagos, como Google Drive e Spotify."

O alerta não espera nada disso (sai em ~1 s); só o resumo chega depois.
