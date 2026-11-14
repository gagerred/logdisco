import { normalizarTexto } from "@/lib/colecao/texto";
import type { AlbumDoc } from "@/lib/tipos";

export type EntradaIndice = { norm: string; titulo: string; album: AlbumDoc; posicao: string; artistaDaFaixa: string | null };
export type OcorrenciaMusica = { album: AlbumDoc; posicao: string; artistaDaFaixa: string | null };
export type ResultadoMusica = { titulo: string; ocorrencias: OcorrenciaMusica[] };

/** Prepara a busca de músicas: normaliza os títulos das faixas uma só vez. Só entram álbuns da coleção ativa. */
export function indexarFaixas(albuns: AlbumDoc[]): EntradaIndice[] {
  const indice: EntradaIndice[] = [];
  for (const album of albuns) {
    if (album.status === "removed") continue;
    for (const t of album.tracks) {
      indice.push({
        norm: normalizarTexto(t.title),
        titulo: t.title,
        album,
        posicao: t.position,
        artistaDaFaixa: album.isVarious ? t.artist : null,
      });
    }
  }
  return indice;
}

/** Procura faixas pelo nome e agrupa as que têm o mesmo título, mostrando em quais álbuns aparecem. */
export function buscarMusicas(indice: EntradaIndice[], texto: string, limite = 30): ResultadoMusica[] {
  const busca = normalizarTexto(texto);
  if (busca.length < 2) return [];
  const grupos = new Map<string, ResultadoMusica>();
  for (const e of indice) {
    if (!e.norm.includes(busca)) continue;
    const g = grupos.get(e.norm) ?? { titulo: e.titulo, ocorrencias: [] };
    g.ocorrencias.push({ album: e.album, posicao: e.posicao, artistaDaFaixa: e.artistaDaFaixa });
    grupos.set(e.norm, g);
  }
  return [...grupos.entries()]
    .sort(([a], [b]) => Number(b === busca) - Number(a === busca) || Number(b.startsWith(busca)) - Number(a.startsWith(busca)) || a.localeCompare(b, "pt-BR"))
    .map(([, g]) => g)
    .slice(0, limite);
}
