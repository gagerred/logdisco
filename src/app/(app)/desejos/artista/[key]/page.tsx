"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useMemo } from "react";
import { ChevronLeft, ExternalLink } from "lucide-react";
import { LinhaDesejo } from "@/components/LinhaDesejo";
import { useColecao } from "@/lib/colecao-context";
import { urlDoArtistaNoDiscogs } from "@/lib/links";
import { desejosDoArtista, desejosVisiveis, ordenarDesejos } from "@/lib/wantlist/logica";
import { useDesejos } from "@/lib/wantlist/use-wantlist";

/** Todos os álbuns de um artista que estão na lista de desejos. */
export default function DesejosDoArtista() {
  const { key } = useParams<{ key: string }>();
  const desejos = useDesejos();
  const { ativos } = useColecao();

  const lista = useMemo(() => ordenarDesejos(desejosDoArtista(desejosVisiveis(desejos ?? [], ativos).visiveis, key), "album"), [desejos, ativos, key]);
  const artista = lista[0]?.artists.find((a) => a.key === key);
  const linkDiscogs = urlDoArtistaNoDiscogs(artista?.id);
  const naColecao = ativos.some((a) => a.artistKeys.includes(key));

  if (desejos === null) return <p className="text-verde-800">Carregando…</p>;
  if (!artista) {
    return (
      <div className="space-y-3">
        <p>Este artista não tem discos na sua lista de desejos.</p>
        <Link href="/desejos" className="btn-contorno">Voltar para a lista de desejos</Link>
      </div>
    );
  }
  return (
    <div className="space-y-5">
      <Link href="/desejos" className="inline-flex min-h-11 items-center gap-1 text-sm font-medium text-verde-800 hover:underline">
        <ChevronLeft className="h-4 w-4" aria-hidden="true" /> Lista de desejos
      </Link>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <h1 className="break-words text-2xl font-extrabold tracking-tight text-verde-950 md:text-3xl">{artista.name}</h1>
          <p className="text-sm text-verde-800">{lista.length} {lista.length === 1 ? "disco" : "discos"} na lista de desejos</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {naColecao && <Link href={`/artista/${key}`} className="btn-contorno">Ver na coleção</Link>}
          {linkDiscogs && (
            <a href={linkDiscogs} target="_blank" rel="noopener noreferrer" className="btn-contorno">
              <ExternalLink className="h-4 w-4" aria-hidden="true" /> Página no Discogs
            </a>
          )}
        </div>
      </div>
      <ul className="grid gap-2 lg:grid-cols-2">
        {lista.map((d) => <li key={d.id}><LinhaDesejo d={d} /></li>)}
      </ul>
    </div>
  );
}
