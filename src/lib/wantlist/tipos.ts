import type { CategoriaMidia } from "@/lib/discogs/formato";
import type { ArtistaAlbum, Momento } from "@/lib/tipos";

/** Item da lista de desejos: users/{uid}/wantlist/{releaseId} (espelho da wantlist do Discogs). */
export type DesejoDoc = {
  id: string;
  releaseId: number;
  titulo: string;
  artista: string;
  artists: ArtistaAlbum[];
  artistKeys: string[];
  /** Nomes dos formatos informados pelo Discogs (Vinyl, CD, Cassette…). */
  formatos: string[];
  formatoOriginal: string;
  categoria: CategoriaMidia | null;
  capa: string | null;
  discogsUrl: string;
  atualizadoEm?: Momento | null;
};

export type StatusWantlist = "coletando" | "concluida" | "falhou";

export type ResultadoWantlist = { total: number; adicionados: number; removidos: number; atualizados: number };

/** Execução da atualização: users/{uid}/wantlistRuns/{id}. */
export type WantlistRunDoc = {
  id: string;
  origem: "manual" | "automatica";
  status: StatusWantlist;
  criadaEm: Momento | null;
  concluidaEm?: Momento | null;
  concluidaEmMs?: number;
  resultado?: ResultadoWantlist;
  proximaPagina?: number;
  totalPaginas?: number | null;
  erro?: string;
  ultimoErro?: string;
};

export const ROTULO_STATUS_WANTLIST: Record<StatusWantlist, string> = {
  coletando: "Em andamento",
  concluida: "Concluída",
  falhou: "Falhou",
};

/** Item da seção "Quero Conhecer": users/{uid}/discover/{releaseId}. */
export type QueroConhecerDoc = {
  id: string;
  releaseId: number;
  titulo: string;
  artista: string;
  artists: ArtistaAlbum[];
  artistKeys: string[];
  formatoOriginal: string;
  capa: string | null;
  discogsUrl: string;
  adicionadoEm?: Momento | null;
};

export type NotificacaoDoc = {
  id: string;
  tipo: string;
  mensagem: string;
  lida: boolean;
  em?: Momento | null;
};
