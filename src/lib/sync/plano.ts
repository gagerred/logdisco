import { compararNomes } from "@/lib/colecao/artistas";
import { descreverFormatoOriginal, mapearCategoria, type CategoriaMidia, type FormatoBruto } from "@/lib/discogs/formato";
import { nomeDosArtistas, type ArtistaBruto } from "@/lib/discogs/release";
import type { AlbumDoc } from "@/lib/tipos";

export type BasicoBruto = {
  id?: number;
  master_id?: number;
  title?: string;
  year?: number;
  artists?: ArtistaBruto[];
  formats?: FormatoBruto[];
  thumb?: string;
  cover_image?: string;
};
/** Item das listas do Discogs (coleção e wantlist): traz só um resumo do lançamento. */
export type ItemBruto = { id?: number; basic_information?: BasicoBruto };
export type PaginaBruta = {
  pagination?: { page?: number; pages?: number; per_page?: number; items?: number };
  releases?: ItemBruto[];
  wants?: ItemBruto[];
};

export type ItemDiscogs = {
  id: number;
  titulo: string;
  artista: string;
  formatoOriginal: string;
  /** null quando o formato não corresponde a nenhuma das 4 categorias. */
  categoria: CategoriaMidia | null;
  capa: string | null;
};

/** Converte um item da lista do Discogs; devolve null se faltar identificação ou título. */
export function converterItemBasico(bruto: ItemBruto): ItemDiscogs | null {
  const b = bruto?.basic_information;
  const id = b?.id ?? bruto?.id;
  if (typeof id !== "number" || !b?.title) return null;
  const artistas = (b.artists ?? []).filter((a) => a.name);
  return {
    id,
    titulo: b.title.trim(),
    artista: artistas.length ? nomeDosArtistas(artistas) : "Artista desconhecido",
    formatoOriginal: descreverFormatoOriginal(b.formats),
    categoria: mapearCategoria(b.formats),
    capa: b.thumb || b.cover_image || null,
  };
}

/** Várias cópias do mesmo lançamento aparecem repetidas no Discogs; aqui cada Release conta uma vez. */
export function deduplicarItens(itens: ItemDiscogs[]): ItemDiscogs[] {
  const vistos = new Map<number, ItemDiscogs>();
  for (const i of itens) if (!vistos.has(i.id)) vistos.set(i.id, i);
  return [...vistos.values()];
}

export type AlbumParaComparar = Pick<AlbumDoc, "id" | "status" | "title" | "titleCustom" | "artistName" | "mediaType" | "thumb" | "cover">;

export type ItemRemocao = { id: number; titulo: string; artista: string; categoria: CategoriaMidia; capa: string | null };

export type Plano = {
  /** No Discogs e ainda não cadastrados no LogDisco. */
  adicionar: ItemDiscogs[];
  /** No Discogs e cadastrados antes no LogDisco, mas removidos da coleção ativa (exclusão lógica). */
  reativar: ItemDiscogs[];
  /** Nos dois lados e ativos: nada a fazer. */
  manter: number[];
  /** Ativos no LogDisco, mas ausentes da coleção do Discogs. */
  remover: ItemRemocao[];
};

const porArtistaETitulo = (a: { artista: string; titulo: string }, b: { artista: string; titulo: string }) =>
  compararNomes(a.artista, b.artista) || compararNomes(a.titulo, b.titulo);

/** Compara a coleção do Discogs com a do LogDisco. Identifica os lançamentos pelo ID do Release. */
export function compararColecao(discogs: ItemDiscogs[], albuns: AlbumParaComparar[]): Plano {
  const unicos = deduplicarItens(discogs);
  const doLogDisco = new Map(albuns.map((a) => [a.id, a]));
  const idsDiscogs = new Set(unicos.map((i) => String(i.id)));

  const plano: Plano = { adicionar: [], reativar: [], manter: [], remover: [] };
  for (const item of unicos) {
    const existente = doLogDisco.get(String(item.id));
    if (!existente) plano.adicionar.push(item);
    else if (existente.status === "removed") plano.reativar.push(item);
    else plano.manter.push(item.id);
  }
  for (const a of albuns) {
    if (a.status === "removed" || idsDiscogs.has(a.id)) continue;
    plano.remover.push({
      id: Number(a.id),
      titulo: a.titleCustom?.trim() || a.title,
      artista: a.artistName,
      categoria: a.mediaType,
      capa: a.thumb ?? a.cover ?? null,
    });
  }
  plano.adicionar.sort(porArtistaETitulo);
  plano.reativar.sort(porArtistaETitulo);
  plano.remover.sort(porArtistaETitulo);
  return plano;
}

/**
 * Remoção que atinge metade da coleção ou mais (a partir de 5 álbuns) exige uma confirmação extra:
 * costuma indicar que a coleção do Discogs ainda não foi preenchida, e não que os discos saíram dela.
 */
export function removalEmMassa(removidos: number, totalAtivos: number): boolean {
  return removidos >= 5 && removidos * 2 >= totalAtivos;
}
