import type { DetalheMudanca, Momento } from "@/lib/tipos";

/** Registro do histórico de alterações: users/{uid}/changeLog/{id}. */
export type EntradaHistorico = {
  id: string;
  tipo: string;
  resumo: string;
  at: Momento | null;
  detalhes?: DetalheMudanca[];
  releaseId?: number;
  origem?: string;
};

export const ROTULO_TIPO: Record<string, string> = {
  inclusao: "Inclusão de álbum",
  edicao: "Edição de álbum",
  atualizacao: "Atualização de álbum",
  remocao: "Remoção de álbum",
  sincronizacao: "Sincronização",
  atualizacao_desejos: "Lista de desejos",
  importacao: "Importação de arquivo",
  restauracao: "Restauração de cópia",
};

export const rotuloDoTipo = (tipo: string) => ROTULO_TIPO[tipo] ?? tipo;

/** Tipos presentes nos registros, na ordem de ROTULO_TIPO (os desconhecidos vão para o fim). */
export function tiposPresentes(entradas: EntradaHistorico[]): string[] {
  const presentes = new Set(entradas.map((e) => e.tipo));
  const conhecidos = Object.keys(ROTULO_TIPO).filter((t) => presentes.has(t));
  return [...conhecidos, ...[...presentes].filter((t) => !(t in ROTULO_TIPO)).sort()];
}

export const filtrarHistorico = (entradas: EntradaHistorico[], tipo: string) => (tipo === "todos" ? entradas : entradas.filter((e) => e.tipo === tipo));
