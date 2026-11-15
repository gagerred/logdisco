/** Pesquisa externa pela letra de uma faixa (nada é guardado no LogDisco). */
export function urlDaLetra(artista: string, faixa: string): string {
  return `https://www.google.com/search?q=${encodeURIComponent(`${artista} ${faixa} letra`)}`;
}

export function urlDoArtistaNoDiscogs(id: number | null | undefined): string | null {
  return id ? `https://www.discogs.com/artist/${id}` : null;
}

const termoDeBusca = (artista: string, titulo: string) => `${artista} ${titulo}`.replace(/\s+/g, " ").trim();

/** Pesquisas por artista e título nos marketplaces e na web (lista de desejos). */
export function urlsDeBusca(artista: string, titulo: string) {
  const termo = termoDeBusca(artista, titulo);
  const q = encodeURIComponent(termo);
  return {
    shopee: `https://shopee.com.br/search?keyword=${q}`,
    mercadoLivre: `https://lista.mercadolivre.com.br/${termo.split(" ").map(encodeURIComponent).join("-")}`,
    amazon: `https://www.amazon.com.br/s?k=${q}`,
    web: `https://www.google.com/search?q=${q}`,
  };
}

/** Pesquisa do álbum no YouTube Music (seção Quero Conhecer). */
export function urlYouTubeMusic(artista: string, titulo: string): string {
  return `https://music.youtube.com/search?q=${encodeURIComponent(termoDeBusca(artista, titulo))}`;
}
