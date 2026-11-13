/** Pesquisa externa pela letra de uma faixa (nada é guardado no LogDisco). */
export function urlDaLetra(artista: string, faixa: string): string {
  return `https://www.google.com/search?q=${encodeURIComponent(`${artista} ${faixa} letra`)}`;
}

export function urlDoArtistaNoDiscogs(id: number | null | undefined): string | null {
  return id ? `https://www.discogs.com/artist/${id}` : null;
}
