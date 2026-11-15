"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useMemo } from "react";
import { ChevronLeft, ExternalLink } from "lucide-react";
import { LinhaAlbum } from "@/components/LinhaAlbum";
import { LinhaDesejo } from "@/components/LinhaDesejo";
import { ordenarAlbuns } from "@/lib/colecao/filtros";
import { useColecao } from "@/lib/colecao-context";
import type { AlbumDoc } from "@/lib/tipos";
import { urlDoArtistaNoDiscogs } from "@/lib/links";
import { desejosDoArtista, desejosVisiveis, ordenarDesejos } from "@/lib/wantlist/logica";
import { useDesejos } from "@/lib/wantlist/use-wantlist";

const ordenarDesejosOuAlbuns = (ativos: AlbumDoc[], key: string) => ordenarAlbuns(ativos.filter((a) => a.artistKeys.includes(key)), "titulo");

export default function PaginaDoArtista() {
  const { key } = useParams<{ key: string }>();
  const { ativos, carregando } = useColecao();
  const desejos = useDesejos();

  const albuns = useMemo(() => ordenarDesejosOuAlbuns(ativos, key), [ativos, key]);
  const quero = useMemo(
    () => ordenarDesejos(desejosDoArtista(desejosVisiveis(desejos ?? [], ativos).visiveis, key), "album"),
    [desejos, ativos, key],
  );
  const artista = albuns[0]?.artists.find((a) => a.key === key) ?? quero[0]?.artists.find((a) => a.key === key);
  const linkDiscogs = urlDoArtistaNoDiscogs(artista?.id);

  if (carregando || desejos === null) return <p className="text-verde-800">Carregando…</p>;
  if (!artista) {
    return (
      <div className="space-y-3">
        <p>Este artista não tem álbuns na sua coleção nem na sua lista de desejos.</p>
        <Link href="/colecao/artistas" className="btn-contorno">Ver todos os artistas</Link>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <Link href="/colecao/artistas" className="inline-flex min-h-11 items-center gap-1 text-sm font-medium text-verde-800 hover:underline">
        <ChevronLeft className="h-4 w-4" aria-hidden="true" /> Artistas
      </Link>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <h1 className="break-words text-2xl font-extrabold tracking-tight text-verde-950 md:text-3xl">{artista.name}</h1>
          <p className="text-sm text-verde-800">{albuns.length} {albuns.length === 1 ? "álbum" : "álbuns"} na coleção · {quero.length} na lista de desejos</p>
        </div>
        {linkDiscogs && (
          <a href={linkDiscogs} target="_blank" rel="noopener noreferrer" className="btn-contorno">
            <ExternalLink className="h-4 w-4" aria-hidden="true" /> Página no Discogs
          </a>
        )}
      </div>

      <section aria-labelledby="na-colecao">
        <h2 id="na-colecao" className="mb-2 text-xl font-bold text-verde-950">Na coleção <span className="text-base font-normal text-verde-700">({albuns.length})</span></h2>
        {albuns.length === 0 ? (
          <p className="text-sm text-verde-800">Nenhum álbum deste artista na coleção.</p>
        ) : (
          <ul className="grid gap-2 lg:grid-cols-2">
            {albuns.map((a) => <li key={a.id}><LinhaAlbum album={a} /></li>)}
          </ul>
        )}
      </section>

      <section aria-labelledby="nos-desejos">
        <h2 id="nos-desejos" className="mb-2 text-xl font-bold text-verde-950">Na lista de desejos <span className="text-base font-normal text-verde-700">({quero.length})</span></h2>
        {quero.length === 0 ? (
          <p className="text-sm text-verde-800">Nenhum álbum deste artista na lista de desejos.</p>
        ) : (
          <ul className="grid gap-2 lg:grid-cols-2">
            {quero.map((d) => <li key={d.id}><LinhaDesejo d={d} /></li>)}
          </ul>
        )}
      </section>
    </div>
  );
}
