import type { CategoriaMidia } from "@/lib/discogs/formato";
import type { ReleaseDoc } from "@/lib/discogs/release";

/** Compatível com o Timestamp do Firestore (navegador e servidor). */
export type Momento = { toMillis(): number; toDate(): Date };

export type ArtistaAlbum = { id: number | null; name: string; key: string };

/** Álbum (edição física) guardado em users/{uid}/releases/{releaseId}. */
export type AlbumDoc = Omit<ReleaseDoc, "artists" | "mediaType"> & {
  id: string;
  artists: ArtistaAlbum[];
  artistKeys: string[];
  /** Sempre uma das 4 categorias; editável pelo usuário. */
  mediaType: CategoriaMidia;
  /** Título editado pelo usuário; o título do Discogs (title) é preservado. */
  titleCustom?: string;
  /** Quando true, recarregar do Discogs nunca altera o nome do artista. */
  artistNameLocked: boolean;
  status: "active" | "removed";
  /** null enquanto o servidor ainda não confirmou a gravação. */
  addedAt: Momento | null;
  removedAt?: Momento | null;
  lastRefreshedAt?: Momento | null;
};

export type AudicaoDoc = {
  id: string;
  releaseId: string;
  date: string;
  time: string;
  listenedAt: Momento;
};

export type DetalheMudanca = { campo: string; rotulo: string; de: string; para: string };
