import type { CategoriaMidia } from "@/lib/discogs/formato";
import type { Momento } from "@/lib/tipos";

export type StatusSync = "coletando" | "conferencia" | "aplicando" | "concluida" | "concluida_com_erros" | "cancelada" | "falhou";

export const STATUS_EM_ANDAMENTO: StatusSync[] = ["coletando", "conferencia", "aplicando"];

export const ROTULO_STATUS: Record<StatusSync, string> = {
  coletando: "Consultando o Discogs",
  conferencia: "Aguardando conferência",
  aplicando: "Em andamento",
  concluida: "Concluída",
  concluida_com_erros: "Concluída com erros",
  cancelada: "Não aplicada",
  falhou: "Falhou",
};

export type ContagensSync = {
  totalDiscogs: number;
  totalAtivos: number;
  adicionar: number;
  reativar: number;
  manter: number;
  remover: number;
};

export type ResultadoSync = {
  adicionados: number;
  reativados: number;
  removidos: number;
  inalterados: number;
  naoSelecionados: number;
  erros: number;
};

/** Documento users/{uid}/syncRuns/{id}. */
export type SyncRunDoc = {
  id: string;
  status: StatusSync;
  criadaEm: Momento | null;
  concluidaEm?: Momento | null;
  discogsUsername: string;
  totalPaginas?: number | null;
  proximaPagina?: number;
  itensColetados?: number;
  contagens?: ContagensSync;
  /** IDs dos álbuns que existem nos dois lados e não precisam de alteração. */
  manterIds?: number[];
  resultado?: ResultadoSync;
  /** Quantidade de itens aprovados pelo usuário, para o indicador de progresso. */
  totalSelecionados?: number;
  /** Mensagem de falha quando status = "falhou". */
  erro?: string;
  /** Última interrupção recuperável (ex.: limite de requisições do Discogs); a operação pode continuar. */
  ultimoErro?: string;
};

export type AcaoSync = "adicionar" | "reativar" | "remover";
export type EstadoItemSync = "pendente" | "feito" | "erro";

/** Documento users/{uid}/syncRuns/{id}/items/{releaseId}. */
export type SyncItemDoc = {
  id: string;
  releaseId: number;
  acao: AcaoSync;
  grupo: "entrada" | "saida";
  titulo: string;
  artista: string;
  formatoOriginal?: string;
  categoria: CategoriaMidia | null;
  mediaTypeEscolhida?: CategoriaMidia | null;
  capa: string | null;
  selecionado: boolean;
  estado: EstadoItemSync;
  /** Mensagem quando estado = "erro", ou observação (ex.: "já estava na coleção"). */
  observacao?: string;
  /** O item foi processado, mas nada precisou mudar (ex.: já estava na coleção). */
  semMudanca?: boolean;
};
