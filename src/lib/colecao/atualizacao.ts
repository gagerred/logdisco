import { CATEGORIAS_MIDIA, type CategoriaMidia } from "@/lib/discogs/formato";
import type { ReleaseDoc } from "@/lib/discogs/release";
import type { AlbumDoc, DetalheMudanca } from "@/lib/tipos";
import { artistaDe } from "./artistas";
import { tituloExibido } from "./filtros";

export const ehCategoriaValida = (v: unknown): v is CategoriaMidia =>
  typeof v === "string" && (CATEGORIAS_MIDIA as readonly string[]).includes(v);

/** Campos de um álbum novo (sem addedAt, que o servidor define na gravação). */
export function montarAlbumNovo(release: ReleaseDoc, mediaType: CategoriaMidia) {
  const artists = release.artists.map((a) => artistaDe(a.id, a.name));
  return {
    releaseId: release.releaseId,
    masterId: release.masterId,
    title: release.title,
    year: release.year,
    artistId: release.artistId,
    artistName: release.artistName,
    artists,
    artistKeys: artists.map((a) => a.key),
    isVarious: release.isVarious,
    formatOriginal: release.formatOriginal,
    mediaType,
    cover: release.cover,
    thumb: release.thumb,
    discogsUrl: release.discogsUrl,
    tracks: release.tracks,
    artistNameLocked: true,
    status: "active" as const,
  };
}

/** Identifica a imagem pelo último trecho do endereço, já que a parte inicial pode variar. */
function identidadeDaImagem(url: string | null | undefined): string {
  return (url ?? "").split("?")[0].split("/").pop() ?? "";
}

type AlbumComparavel = Pick<
  AlbumDoc,
  "title" | "year" | "masterId" | "cover" | "thumb" | "formatOriginal" | "discogsUrl" | "tracks" | "artistName" | "artistNameLocked"
>;

export type ResultadoComparacao = {
  /** Diferenças que o usuário vê na prévia. */
  mudancas: DetalheMudanca[];
  /** Campos a gravar. Nunca inclui audições, categoria, título personalizado, status ou data de inclusão. */
  patch: Record<string, unknown>;
};

const m = (campo: string, rotulo: string, de: string, para: string): DetalheMudanca => ({ campo, rotulo, de, para });

/**
 * Compara o álbum guardado com os dados atuais do Discogs.
 * O nome do artista só é considerado quando não está protegido.
 */
export function compararRelease(atual: AlbumComparavel, novo: ReleaseDoc): ResultadoComparacao {
  const mudancas: DetalheMudanca[] = [];
  const patch: Record<string, unknown> = {};

  if (atual.title !== novo.title) {
    mudancas.push(m("title", "Título no Discogs", atual.title, novo.title));
    patch.title = novo.title;
  }
  if ((atual.year ?? null) !== novo.year) {
    mudancas.push(m("year", "Ano", String(atual.year ?? "—"), String(novo.year ?? "—")));
    patch.year = novo.year;
  }
  if ((atual.masterId ?? null) !== novo.masterId) patch.masterId = novo.masterId;
  if (atual.formatOriginal !== novo.formatOriginal) {
    mudancas.push(m("formatOriginal", "Formato original", atual.formatOriginal || "—", novo.formatOriginal || "—"));
    patch.formatOriginal = novo.formatOriginal;
  }
  if (atual.discogsUrl !== novo.discogsUrl) patch.discogsUrl = novo.discogsUrl;

  if (JSON.stringify(atual.tracks) !== JSON.stringify(novo.tracks)) {
    const a = atual.tracks.length;
    const b = novo.tracks.length;
    mudancas.push(
      m("tracks", "Faixas", `${a} faixa${a === 1 ? "" : "s"}`, a === b ? `${b} faixas (títulos ou artistas alterados)` : `${b} faixa${b === 1 ? "" : "s"}`),
    );
    patch.tracks = novo.tracks;
  }

  // Capa: só aparece na prévia se a imagem mudou; o endereço é renovado em silêncio.
  if (identidadeDaImagem(atual.cover) !== identidadeDaImagem(novo.cover)) {
    mudancas.push(m("cover", "Capa", atual.cover ? "capa anterior" : "sem capa", novo.cover ? "nova capa" : "sem capa"));
  }
  if (atual.cover !== novo.cover) patch.cover = novo.cover;
  if (atual.thumb !== novo.thumb) patch.thumb = novo.thumb;

  if (!atual.artistNameLocked && atual.artistName !== novo.artistName) {
    mudancas.push(m("artistName", "Artista", atual.artistName, novo.artistName));
    patch.artistName = novo.artistName;
    patch.artistId = novo.artistId;
    const artists = novo.artists.map((a) => artistaDe(a.id, a.name));
    patch.artists = artists;
    patch.artistKeys = artists.map((a) => a.key);
    patch.isVarious = novo.isVarious;
  }
  return { mudancas, patch };
}

/** Descreve uma edição feita pelo usuário (título e categoria) e os campos a gravar. */
export function compararEdicao(
  album: Pick<AlbumDoc, "title" | "titleCustom" | "mediaType">,
  entrada: { titulo: string; mediaType: CategoriaMidia },
) {
  const titulo = entrada.titulo.trim();
  const detalhes: DetalheMudanca[] = [];
  // título vazio ou igual ao do Discogs = voltar ao título original
  const novoCustom = !titulo || titulo === album.title ? null : titulo;
  const antes = album.titleCustom?.trim() || null;
  if (novoCustom !== antes) {
    detalhes.push(m("titleCustom", "Título", tituloExibido(album), novoCustom ?? album.title));
  }
  if (entrada.mediaType !== album.mediaType) {
    detalhes.push(m("mediaType", "Formato", album.mediaType, entrada.mediaType));
  }
  return { detalhes, novoCustom, mudouTitulo: novoCustom !== antes, mudouFormato: entrada.mediaType !== album.mediaType };
}
