"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "./supabase/client";

export interface Perfil {
  id: string;
  username: string;
  nome_exibicao: string | null;
  ativo: boolean;
  intervalo_quente_s: number;
  intervalo_frio_s: number;
  janelas_manuais: { dow: number[]; inicio: string; fim: string }[];
  janelas_aprendidas: { dow: number[]; inicio: string; fim: string }[];
  ultimo_check_em: string | null;
  ultimo_video_em: string | null;
  erros_seguidos: number;
}

export interface Video {
  id: string;
  perfil_id: string;
  shortcode: string;
  tipo: string;
  eh_reels: boolean;
  publicado_em: string;
  detectado_em: string;
  latencia_ms: number;
  legenda: string | null;
  permalink: string;
  url_thumb: string | null;
  storage_path: string | null;
  status: string;
  resumo: string | null;
  resumo_tags: string[] | null;
  perfis: { username: string } | null;
  jobs_ia: { status: string }[] | { status: string } | null;
}

export const statusJob = (v: Video) => (Array.isArray(v.jobs_ia) ? v.jobs_ia[0]?.status : v.jobs_ia?.status);

export const SELECT_VIDEO = "*, perfis(username), jobs_ia(status)";

/**
 * Busca + Realtime: refaz a consulta quando qualquer tabela observada muda.
 * ponytail: refetch inteiro a cada evento; com 10 perfis é barato. Aplicar o diff do payload se crescer.
 */
export function useAoVivo<T>(buscar: () => Promise<T>, tabelas: string[]) {
  const [dados, setDados] = useState<T | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [carregando, setCarregando] = useState(true);
  const ref = useRef(buscar);
  ref.current = buscar;
  const chave = tabelas.join(",");

  const recarregar = useCallback(async () => {
    try {
      setDados(await ref.current());
      setErro(null);
    } catch (e) {
      setErro(e instanceof Error ? e.message : String(e));
    } finally {
      setCarregando(false);
    }
  }, []);

  useEffect(() => {
    recarregar();
    let t: ReturnType<typeof setTimeout> | undefined;
    const canal = supabase().channel(`ao-vivo:${chave}:${Math.random().toString(36).slice(2)}`);
    for (const tabela of chave.split(",")) {
      canal.on("postgres_changes", { event: "*", schema: "public", table: tabela }, () => {
        clearTimeout(t);
        t = setTimeout(recarregar, 250);
      });
    }
    // Ao (re)conectar, recarrega: eventos perdidos durante a queda não se repetem.
    let primeira = true;
    canal.subscribe((status) => {
      if (status === "SUBSCRIBED" && !primeira) recarregar();
      if (status === "SUBSCRIBED") primeira = false;
      if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") setErro("conexão ao vivo caiu, tentando reconectar…");
    });
    return () => {
      clearTimeout(t);
      supabase().removeChannel(canal);
    };
  }, [chave, recarregar]);

  return { dados, erro, carregando, recarregar };
}

/** Lança o erro do Supabase em vez de devolver dados vazios em silêncio. */
export function ok<T>(r: { data: T | null; error: { message: string } | null }): T {
  if (r.error) throw new Error(r.error.message);
  return r.data as T;
}

export async function linkDownload(storagePath: string) {
  const { data, error } = await supabase().storage.from("videos-temp").createSignedUrl(storagePath, 48 * 3600, { download: true });
  if (error) throw new Error(error.message);
  return data.signedUrl;
}
