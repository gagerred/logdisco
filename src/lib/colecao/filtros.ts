import type { CategoriaMidia } from "@/lib/discogs/formato";
import type { AlbumDoc } from "@/lib/tipos";
import { compararNomes } from "./artistas";
import { normalizarTexto } from "./texto";

export type Filtros = {
  artista: string;
  titulo: string;
  formato: CategoriaMidia | "todos";
  situacao: "todos" | "ouvidos" | "nunca";
};

export const FILTROS_VAZIOS: Filtros = { artista: "", titulo: "", formato: "todos", situacao: "todos" };

export const tituloExibido = (a: Pick<AlbumDoc, "title" | "titleCustom">): string => a.titleCustom?.trim() || a.title;

const contem = (texto: string, busca: string) => normalizarTexto(texto).includes(busca);

/** Aplica os filtros em conjunto (todos precisam ser satisfeitos). */
export function filtrarAlbuns(albuns: AlbumDoc[], f: Filtros, idsOuvidos: Set<string>): AlbumDoc[] {
  const artista = normalizarTexto(f.artista);
  const titulo = normalizarTexto(f.titulo);
  return albuns.filter((a) => {
    if (artista && !a.artists.some((x) => contem(x.name, artista)) && !contem(a.artistName, artista)) return false;
    if (titulo && !contem(tituloExibido(a), titulo) && !contem(a.title, titulo)) return false;
    if (f.formato !== "todos" && a.mediaType !== f.formato) return false;
    const ouvido = idsOuvidos.has(a.id);
    if (f.situacao === "ouvidos" && !ouvido) return false;
    if (f.situacao === "nunca" && ouvido) return false;
    return true;
  });
}

/** Busca simples por artista OU título (usada na navbar e na tela da coleção). */
export function buscarAlbuns(albuns: AlbumDoc[], texto: string): AlbumDoc[] {
  const t = normalizarTexto(texto);
  if (!t) return [];
  return albuns.filter(
    (a) => a.artists.some((x) => contem(x.name, t)) || contem(a.artistName, t) || contem(tituloExibido(a), t) || contem(a.title, t),
  );
}

export type Ordem = "artista" | "titulo" | "recentes";

export function ordenarAlbuns(albuns: AlbumDoc[], ordem: Ordem): AlbumDoc[] {
  const copia = [...albuns];
  if (ordem === "recentes") {
    return copia.sort((a, b) => (b.addedAt?.toMillis() ?? Infinity) - (a.addedAt?.toMillis() ?? Infinity));
  }
  if (ordem === "titulo") return copia.sort((a, b) => compararNomes(tituloExibido(a), tituloExibido(b)));
  return copia.sort((a, b) => compararNomes(a.artistName, b.artistName) || compararNomes(tituloExibido(a), tituloExibido(b)));
}
