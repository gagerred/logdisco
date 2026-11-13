"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useMemo } from "react";
import { ChevronLeft, ExternalLink } from "lucide-react";
import { LinhaAlbum } from "@/components/LinhaAlbum";
import { ordenarAlbuns } from "@/lib/colecao/filtros";
import { useColecao } from "@/lib/colecao-context";
import { urlDoArtistaNoDiscogs } from "@/lib/links";

export default function PaginaDoArtista() {
  const { key } = useParams<{ key: string }>();
  const { ativos, carregando } = useColecao();

  const albuns = useMemo(() => ordenarAlbuns(ativos.filter((a) => a.artistKeys.includes(key)), "titulo"), [ativos, key]);
  const artista = albuns[0]?.artists.find((a) => a.key === key);
  const linkDiscogs = urlDoArtistaNoDiscogs(artista?.id);

  if (carregando) return <p className="text-verde-800">Carregando…</p>;
  if (!artista) {
    return (
      <div className="space-y-3">
        <p>Este artista não tem álbuns na sua coleção.</p>
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
          <p className="text-sm text-verde-800">{albuns.length} {albuns.length === 1 ? "álbum" : "álbuns"} na coleção</p>
        </div>
        {linkDiscogs && (
          <a href={linkDiscogs} target="_blank" rel="noopener noreferrer" className="btn-contorno">
            <ExternalLink className="h-4 w-4" aria-hidden="true" /> Página no Discogs
          </a>
        )}
      </div>

      <section>
        <h2 className="mb-2 text-xl font-bold text-verde-950">Na coleção</h2>
        <ul className="grid gap-2 lg:grid-cols-2">
          {albuns.map((a) => <li key={a.id}><LinhaAlbum album={a} /></li>)}
        </ul>
      </section>
    </div>
  );
}
