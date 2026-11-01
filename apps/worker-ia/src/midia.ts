// ffmpeg (áudio 16 kHz mono + quadros-chave) e whisper.cpp (transcrição). Tudo local, via processos.
import { execFile } from "node:child_process";
import { mkdtemp, readFile, readdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";

const exec = promisify(execFile);

export interface Midia {
  quadros: Buffer[];
  audioWav: string | null;
  limpar(): Promise<void>;
}

/** Instantes (s) dos quadros-chave: N pontos espaçados no meio de cada fatia (evita tela preta no início/fim). */
export function instantesQuadros(duracaoS: number, n = 5): number[] {
  if (!(duracaoS > 0)) return [];
  return Array.from({ length: n }, (_, i) => Math.round(((duracaoS * (i + 0.5)) / n) * 100) / 100);
}

export async function extrairMidia(video: string, cfg: { ffmpeg: string; ffprobe: string }): Promise<Midia> {
  const dir = await mkdtemp(join(tmpdir(), "vizu-"));
  const limpar = () => rm(dir, { recursive: true, force: true });
  try {
    const { stdout } = await exec(cfg.ffprobe, ["-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", video]);
    const instantes = instantesQuadros(Number(stdout.trim()));
    for (const [i, t] of instantes.entries()) {
      await exec(cfg.ffmpeg, ["-y", "-loglevel", "error", "-ss", String(t), "-i", video, "-frames:v", "1", "-vf", "scale=512:-2", join(dir, `q${i}.jpg`)]);
    }
    let audioWav: string | null = join(dir, "audio.wav");
    try {
      await exec(cfg.ffmpeg, ["-y", "-loglevel", "error", "-i", video, "-vn", "-ac", "1", "-ar", "16000", "-c:a", "pcm_s16le", audioWav]);
    } catch {
      audioWav = null; // vídeo sem trilha de áudio
    }
    const arquivos = (await readdir(dir)).filter((a) => a.endsWith(".jpg")).sort();
    const quadros = await Promise.all(arquivos.map((a) => readFile(join(dir, a))));
    return { quadros, audioWav, limpar };
  } catch (e) {
    await limpar();
    throw e;
  }
}

/** Transcreve com whisper.cpp (`whisper-cli -m modelo -l pt -nt -f audio.wav`). Sem binário/modelo → null. */
export async function transcrever(wav: string | null, cfg: { cli?: string; modelo?: string }): Promise<string | null> {
  if (!wav || !cfg.cli || !cfg.modelo) return null;
  const { stdout } = await exec(cfg.cli, ["-m", cfg.modelo, "-l", "auto", "-nt", "-np", "-f", wav], { timeout: 120_000, maxBuffer: 8 << 20 });
  const texto = stdout.replace(/\[[^\]]*\]/g, "").replace(/\s+/g, " ").trim();
  return texto || null;
}
