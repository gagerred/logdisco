import type { AlbumDoc, ArtistaAlbum } from "@/lib/tipos";
import { normalizarTexto } from "./texto";

/** Identificador estável do artista: o ID do Discogs ou, na falta dele, um slug do nome. */
export function chaveDoArtista(id: number | null | undefined, nome: string): string {
  if (id) return String(id);
  return "n-" + (normalizarTexto(nome).replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "desconhecido");
}

export function artistaDe(id: number | null | undefined, nome: string): ArtistaAlbum {
  return { id: id ?? null, name: nome, key: chaveDoArtista(id, nome) };
}

export type GrupoArtista = { key: string; name: string; discogsId: number | null; albuns: AlbumDoc[] };

export function compararNomes(a: string, b: string): number {
  return a.localeCompare(b, "pt-BR", { sensitivity: "base", numeric: true });
}

/** Agrupa os álbuns por artista (um álbum com dois artistas aparece nos dois). */
export function agruparPorArtista(albuns: AlbumDoc[]): GrupoArtista[] {
  const mapa = new Map<string, GrupoArtista>();
  for (const album of albuns) {
    for (const a of album.artists) {
      const g = mapa.get(a.key) ?? { key: a.key, name: a.name, discogsId: a.id, albuns: [] };
      g.albuns.push(album);
      mapa.set(a.key, g);
    }
  }
  return [...mapa.values()].sort((x, y) => compararNomes(x.name, y.name));
}

/** Artistas dos últimos álbuns adicionados, sem repetir, do mais recente para o mais antigo. */
export function artistasRecentes(albuns: AlbumDoc[], limite: number): GrupoArtista[] {
  const grupos = new Map(agruparPorArtista(albuns).map((g) => [g.key, g]));
  const ordenados = [...albuns].sort((a, b) => (b.addedAt?.toMillis() ?? Infinity) - (a.addedAt?.toMillis() ?? Infinity));
  const vistos = new Set<string>();
  const saida: GrupoArtista[] = [];
  for (const album of ordenados) {
    for (const a of album.artists) {
      if (vistos.has(a.key)) continue;
      vistos.add(a.key);
      const g = grupos.get(a.key);
      if (g) saida.push(g);
    }
    if (saida.length >= limite) break;
  }
  return saida.slice(0, limite);
}

/** Letra usada para separar a lista de artistas ("#" para números e símbolos). */
export function inicialDe(nome: string): string {
  const c = normalizarTexto(nome).charAt(0).toUpperCase();
  return /[A-Z]/.test(c) ? c : "#";
}
