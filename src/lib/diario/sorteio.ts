import type { CategoriaMidia } from "@/lib/discogs/formato";
import type { AlbumDoc } from "@/lib/tipos";

/** Grupo A: histórico de audições. */
export type GrupoHistorico = "todos" | "nunca";
/** Grupo B: tipo de mídia. */
export type GrupoMidia = Extract<CategoriaMidia, "CD" | "Vinyl">;

export type FiltrosSorteio = { historico: GrupoHistorico | null; midia: GrupoMidia | null };

/** Álbuns que atendem aos filtros escolhidos. Sem filtro algum, vale a coleção inteira. */
export function candidatosDoSorteio(albuns: AlbumDoc[], idsOuvidos: Set<string>, f: FiltrosSorteio): AlbumDoc[] {
  return albuns.filter((a) => {
    if (a.status === "removed") return false;
    if (f.historico === "nunca" && idsOuvidos.has(a.id)) return false;
    if (f.midia && a.mediaType !== f.midia) return false;
    return true;
  });
}

/** Sorteia um álbum entre os candidatos; ao sortear de novo, evita repetir o anterior se houver outro. */
export function sortear(
  albuns: AlbumDoc[],
  idsOuvidos: Set<string>,
  f: FiltrosSorteio,
  opcoes: { rng?: () => number; excluirId?: string } = {},
): { album: AlbumDoc | null; total: number } {
  const todos = candidatosDoSorteio(albuns, idsOuvidos, f);
  const lista = opcoes.excluirId && todos.length > 1 ? todos.filter((a) => a.id !== opcoes.excluirId) : todos;
  if (!lista.length) return { album: null, total: 0 };
  const rng = opcoes.rng ?? Math.random;
  return { album: lista[Math.min(lista.length - 1, Math.floor(rng() * lista.length))], total: todos.length };
}
