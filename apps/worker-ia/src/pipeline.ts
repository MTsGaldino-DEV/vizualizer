// Um job da fila `jobs_ia`: baixa → ffmpeg → whisper → visão → texto → grava resumo (seção 5).
import type { ResumoIA } from "@vizualizer/shared";
import type { MotorIA } from "./ia";
import type { Midia } from "./midia";

export interface Job {
  id: number;
  video_id: string;
  tentativas: number;
}

export interface VideoJob {
  id: string;
  legenda: string | null;
  storage_path: string | null;
  username: string;
}

export interface Repositorio {
  pegarJob(): Promise<Job | null>;
  carregarVideo(id: string): Promise<VideoJob>;
  /** Baixa do Storage para um arquivo local; null se não houver arquivo. */
  baixarArquivo(storagePath: string): Promise<string | null>;
  salvarResumo(videoId: string, r: ResumoIA): Promise<void>;
  concluirJob(jobId: number): Promise<void>;
  falharJob(jobId: number, erro: string, definitivo: boolean): Promise<void>;
}

export interface DepsMidia {
  extrair(video: string): Promise<Midia>;
  transcrever(wav: string | null): Promise<string | null>;
}

export const MAX_TENTATIVAS = 3;

export async function processarProximo(
  repo: Repositorio,
  motor: MotorIA,
  midia: DepsMidia,
): Promise<"vazio" | "feito" | "falhou"> {
  const job = await repo.pegarJob();
  if (!job) return "vazio";
  let m: Midia | null = null;
  try {
    const v = await repo.carregarVideo(job.video_id);
    const arquivo = v.storage_path ? await repo.baixarArquivo(v.storage_path) : null;
    m = arquivo ? await midia.extrair(arquivo) : null;
    const transcricao = m ? await midia.transcrever(m.audioWav) : null;
    const quadros = m ? await motor.descreverQuadros(m.quadros) : null;
    const resumo = await motor.resumir({ username: v.username, legenda: v.legenda, transcricao, quadros });
    await repo.salvarResumo(v.id, resumo);
    await repo.concluirJob(job.id);
    return "feito";
  } catch (e) {
    const erro = e instanceof Error ? e.message : String(e);
    await repo.falharJob(job.id, erro, job.tentativas >= MAX_TENTATIVAS);
    return "falhou";
  } finally {
    await m?.limpar();
  }
}
