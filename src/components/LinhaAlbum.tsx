import Link from "next/link";
import { tituloExibido } from "@/lib/colecao/filtros";
import type { CategoriaMidia } from "@/lib/discogs/formato";
import type { AlbumDoc } from "@/lib/tipos";
import { CapaAlbum } from "./CapaAlbum";

const ESTILOS: Record<CategoriaMidia, string> = {
  CD: "border-verm-100 bg-verm-50 text-verm-700",
  Vinyl: "border-verde-200 bg-verde-50 text-verde-900",
  DVD: "border-verde-200 bg-white text-verde-900",
  "CD/DVD": "border-verde-200 bg-white text-verde-900",
};

export function SeloMidia({ tipo }: { tipo: CategoriaMidia }) {
  return (
    <span className={`inline-block whitespace-nowrap rounded border px-1.5 py-0.5 align-middle text-xs font-semibold ${ESTILOS[tipo]}`}>{tipo}</span>
  );
}

/** Linha de lista: capa, título com o formato ao lado e artista. Títulos longos quebram em várias linhas. */
export function LinhaAlbum({ album, aoClicar }: { album: AlbumDoc; aoClicar?: () => void }) {
  return (
    <Link
      href={`/album/${album.id}`}
      onClick={aoClicar}
      className="flex min-h-[4.5rem] items-center gap-3 rounded-md border border-verde-200 bg-white p-2 hover:bg-verde-50"
    >
      <CapaAlbum album={album} className="h-14 w-14 shrink-0 rounded" />
      <div className="min-w-0 flex-1">
        <p className="break-words leading-snug">
          <span className="font-semibold text-verde-950">{tituloExibido(album)}</span> <SeloMidia tipo={album.mediaType} />
        </p>
        <p className="break-words text-sm text-verde-800">{album.artistName}</p>
      </div>
    </Link>
  );
}
