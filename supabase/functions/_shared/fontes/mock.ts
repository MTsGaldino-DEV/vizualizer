// Fonte C — Mock: lê posts crus (formato das fixtures em fixtures/ig/) de um repositório injetado.
// No `vigiar`, o repositório é a tabela `config` (chave `mock:<username>`), alimentada por `pnpm simular`.

import { ErroFonte, type FonteInstagram, type PostIG } from "./tipos.ts";

export interface PostCru {
  shortcode: string;
  igId?: string;
  tipo: PostIG["tipo"];
  ehReels: boolean;
  fixado: boolean;
  publicadoEm: string;
  legenda?: string;
  permalink: string;
  urlVideo?: string;
  urlThumb?: string;
  duracaoS?: number;
}

export function criarFonteMock(buscar: (username: string) => Promise<PostCru[] | null>): FonteInstagram {
  return {
    nome: "mock",
    async ultimosPosts(username, limite) {
      const crus = await buscar(username);
      if (!crus) throw new ErroFonte("mock", `perfil @${username} sem dados no mock`);
      return crus
        .map((p) => ({ ...p, publicadoEm: new Date(p.publicadoEm) }))
        // Simula o Instagram: fixados primeiro, depois do mais novo para o mais velho.
        .sort((a, b) => Number(b.fixado) - Number(a.fixado) || b.publicadoEm.getTime() - a.publicadoEm.getTime())
        .slice(0, limite);
    },
  };
}
