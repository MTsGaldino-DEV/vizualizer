import { z } from "zod";

export const postIGSchema = z.object({
  shortcode: z.string().min(1),
  igId: z.string().optional(),
  tipo: z.enum(["video", "imagem", "carrossel"]),
  ehReels: z.boolean(),
  fixado: z.boolean(),
  publicadoEm: z.coerce.date(),
  legenda: z.string().optional(),
  permalink: z.string().url(),
  urlVideo: z.string().url().optional(),
  urlThumb: z.string().url().optional(),
  duracaoS: z.number().optional(),
});
export type PostIG = z.infer<typeof postIGSchema>;

export interface FonteInstagram {
  nome: string;
  ultimosPosts(username: string, limite: number): Promise<PostIG[]>;
}

export const resumoIASchema = z.object({
  resumo: z.string(),
  assunto: z.string(),
  tags: z.array(z.string()),
  tem_fala: z.boolean(),
  idioma: z.string(),
});
export type ResumoIA = z.infer<typeof resumoIASchema>;
