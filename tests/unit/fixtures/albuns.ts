import { montarAlbumNovo } from "@/lib/colecao/atualizacao";
import { converterRelease } from "@/lib/discogs/release";
import type { AlbumDoc } from "@/lib/tipos";
import { releaseCdDvd, releaseSimples, releaseVarious } from "./releases";

const momento = (ms: number) => ({ toMillis: () => ms, toDate: () => new Date(ms) });

export function albumDe(bruto: Parameters<typeof converterRelease>[0], extra: Partial<AlbumDoc> = {}): AlbumDoc {
  const r = converterRelease(bruto);
  return {
    id: String(r.releaseId),
    ...montarAlbumNovo(r, r.mediaType ?? "CD"),
    addedAt: momento(1_000),
    ...extra,
  } as AlbumDoc;
}

export const rick = () => albumDe(releaseSimples, { addedAt: momento(3_000) });
export const various = () => albumDe(releaseVarious, { addedAt: momento(1_000) });
export const dupla = () => albumDe(releaseCdDvd, { addedAt: momento(2_000), titleCustom: "Ao Vivo (Remasterizado)" });
