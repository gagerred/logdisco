import { DiscogsErro } from "./erros";
import {
  descreverFormatoOriginal,
  mapearCategoria,
  type CategoriaMidia,
  type FormatoBruto,
} from "./formato";

export type ArtistaBruto = { id?: number; name?: string; join?: string; anv?: string };
export type FaixaBruta = {
  position?: string;
  type_?: string;
  title?: string;
  duration?: string;
  artists?: ArtistaBruto[];
  sub_tracks?: FaixaBruta[];
};
export type ImagemBruta = { type?: string; uri?: string; uri150?: string; resource_url?: string };
export type ReleaseBruto = {
  id?: number;
  master_id?: number;
  title?: string;
  year?: number;
  uri?: string;
  thumb?: string;
  artists?: ArtistaBruto[];
  formats?: FormatoBruto[];
  tracklist?: FaixaBruta[];
  images?: ImagemBruta[];
};

export type FaixaDoc = {
  position: string;
  title: string;
  duration: string;
  /** Artista da faixa, quando o Discogs informa; null caso contrário. */
  artist: string | null;
};

/** Dados de um lançamento, no formato guardado pelo LogDisco. */
export type ReleaseDoc = {
  releaseId: number;
  masterId: number | null;
  title: string;
  year: number | null;
  artistId: number | null;
  artistName: string;
  artists: { id: number | null; name: string }[];
  isVarious: boolean;
  formatOriginal: string;
  /** null quando o formato do Discogs não corresponde a nenhuma das 4 categorias. */
  mediaType: CategoriaMidia | null;
  cover: string | null;
  thumb: string | null;
  discogsUrl: string;
  tracks: FaixaDoc[];
};

const ID_VARIOUS = 194;

/** O Discogs diferencia homônimos com um número entre parênteses: "Nirvana (2)". */
export function limparNomeArtista(nome: string): string {
  return nome.replace(/\s*\(\d+\)\s*$/, "").trim();
}

/** Monta "A & B", "A, B feat. C" a partir dos artistas e dos conectores do Discogs. */
export function nomeDosArtistas(artistas: ArtistaBruto[]): string {
  const validos = artistas.filter((a) => a.name);
  return validos
    .map((a, i) => {
      const nome = limparNomeArtista(a.name!);
      const juncao = (a.join ?? "").trim();
      if (i === validos.length - 1 || !juncao) return nome;
      return juncao === "," ? `${nome}, ` : `${nome} ${juncao} `;
    })
    .join("")
    .replace(/\s+/g, " ")
    .trim();
}

function achatarFaixas(faixas: FaixaBruta[]): FaixaDoc[] {
  const saida: FaixaDoc[] = [];
  for (const f of faixas) {
    const tipo = f.type_ ?? "track";
    if (tipo === "heading") continue;
    if (tipo === "index" && f.sub_tracks?.length) {
      saida.push(...achatarFaixas(f.sub_tracks));
      continue;
    }
    const titulo = (f.title ?? "").trim();
    if (!titulo) continue;
    saida.push({
      position: f.position ?? "",
      title: titulo,
      duration: f.duration ?? "",
      artist: f.artists?.some((a) => a.name) ? nomeDosArtistas(f.artists) : null,
    });
  }
  return saida;
}

/** Converte a resposta de GET /releases/{id} do Discogs no modelo do LogDisco. */
export function converterRelease(bruto: ReleaseBruto): ReleaseDoc {
  if (!bruto || typeof bruto.id !== "number" || typeof bruto.title !== "string") {
    throw new DiscogsErro("resposta_invalida", "O Discogs devolveu um lançamento em formato inesperado.");
  }
  const artistas = (bruto.artists ?? []).filter((a) => a.name);
  const principal = artistas[0];
  const imagem = bruto.images?.find((i) => i.type === "primary") ?? bruto.images?.[0];

  return {
    releaseId: bruto.id,
    masterId: bruto.master_id && bruto.master_id > 0 ? bruto.master_id : null,
    title: bruto.title.trim(),
    year: bruto.year && bruto.year > 0 ? bruto.year : null,
    artistId: principal?.id ?? null,
    artistName: artistas.length ? nomeDosArtistas(artistas) : "Artista desconhecido",
    artists: artistas.map((a) => ({ id: a.id ?? null, name: limparNomeArtista(a.name!) })),
    isVarious:
      !!principal && (principal.id === ID_VARIOUS || limparNomeArtista(principal.name!).toLowerCase() === "various"),
    formatOriginal: descreverFormatoOriginal(bruto.formats),
    mediaType: mapearCategoria(bruto.formats),
    cover: imagem?.uri || imagem?.resource_url || null,
    thumb: bruto.thumb || imagem?.uri150 || null,
    discogsUrl: bruto.uri || `https://www.discogs.com/release/${bruto.id}`,
    tracks: achatarFaixas(bruto.tracklist ?? []),
  };
}
