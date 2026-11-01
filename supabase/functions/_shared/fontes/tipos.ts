// Contrato das fontes de dados (seção 3.1). Mesmo formato de packages/shared/src/fontes.ts, sem zod.

export interface PostIG {
  shortcode: string;
  igId?: string;
  tipo: "video" | "imagem" | "carrossel";
  ehReels: boolean;
  fixado: boolean;
  publicadoEm: Date;
  legenda?: string;
  permalink: string;
  urlVideo?: string;
  urlThumb?: string;
  duracaoS?: number;
}

export interface FonteInstagram {
  nome: string;
  ultimosPosts(username: string, limite: number): Promise<PostIG[]>;
}

export class ErroFonte extends Error {
  constructor(
    public fonte: string,
    mensagem: string,
  ) {
    super(`[${fonte}] ${mensagem}`);
  }
}
