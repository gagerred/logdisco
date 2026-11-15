"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { ChevronLeft, ExternalLink, ShoppingBag } from "lucide-react";
import { CapaAlbum } from "@/components/CapaAlbum";
import { useColecao } from "@/lib/colecao-context";
import { urlsDeBusca } from "@/lib/links";
import { rotuloFormato } from "@/lib/wantlist/logica";
import { useDesejos } from "@/lib/wantlist/use-wantlist";

export default function DiscoDesejado() {
  const { id } = useParams<{ id: string }>();
  const desejos = useDesejos();
  const { ativos } = useColecao();
  const d = desejos?.find((x) => x.id === id);

  if (desejos === null) return <p className="text-verde-800">Carregando…</p>;
  if (!d) {
    return (
      <div className="space-y-3">
        <p>Disco não encontrado na sua lista de desejos.</p>
        <Link href="/desejos" className="btn-contorno">Voltar para a lista de desejos</Link>
      </div>
    );
  }
  const busca = urlsDeBusca(d.artista, d.titulo);
  const naColecao = ativos.some((a) => a.id === d.id);
  const mercados: [string, string][] = [
    ["Shopee", busca.shopee],
    ["Mercado Livre", busca.mercadoLivre],
    ["Amazon", busca.amazon],
    ["Pesquisar na web", busca.web],
  ];

  return (
    <div className="max-w-3xl space-y-6">
      <Link href="/desejos" className="inline-flex min-h-11 items-center gap-1 text-sm font-medium text-verde-800 hover:underline">
        <ChevronLeft className="h-4 w-4" aria-hidden="true" /> Lista de desejos
      </Link>

      {naColecao && (
        <p role="status" className="aviso-ok">
          Este disco já está na sua coleção, por isso não aparece mais na lista de desejos. <Link href={`/album/${d.id}`} className="font-semibold underline">Abrir álbum</Link>
        </p>
      )}

      <div className="flex flex-col gap-5 sm:flex-row">
        <CapaAlbum album={{ cover: d.capa, thumb: d.capa }} grande className="aspect-square w-full max-w-60 rounded-md sm:w-52 sm:shrink-0" />
        <div className="min-w-0">
          <h1 className="break-words text-2xl font-extrabold leading-tight tracking-tight text-verde-950 md:text-3xl">{d.titulo}</h1>
          <p className="mt-1 text-lg text-verde-900">
            {d.artists.map((a, i) => (
              <span key={a.key}>
                {i > 0 && ", "}
                <Link href={`/desejos/artista/${a.key}`} className="underline decoration-verm-600 decoration-2 underline-offset-4 hover:text-verm-700">{a.name}</Link>
              </span>
            ))}
          </p>
          <p className="mt-2 text-sm text-verde-800">Formato: <strong>{rotuloFormato(d)}</strong></p>
        </div>
      </div>

      <section aria-labelledby="opcao-discogs" className="painel">
        <h2 id="opcao-discogs" className="text-lg font-bold text-verde-950">Abrir no Discogs</h2>
        <p className="mt-1 text-sm text-verde-800">Veja a página deste lançamento no Discogs.</p>
        <a href={d.discogsUrl} target="_blank" rel="noopener noreferrer" className="btn-primario mt-3">
          <ExternalLink className="h-4 w-4" aria-hidden="true" /> Abrir no Discogs
        </a>
      </section>

      <section aria-labelledby="opcao-mercados" className="painel">
        <h2 id="opcao-mercados" className="text-lg font-bold text-verde-950">Pesquisar em marketplaces</h2>
        <p className="mt-1 text-sm text-verde-800">Abre uma pesquisa pelo artista e título do álbum.</p>
        <div className="mt-3 grid gap-2 sm:grid-cols-2">
          {mercados.map(([nome, url]) => (
            <a key={nome} href={url} target="_blank" rel="noopener noreferrer" className="btn-contorno justify-start">
              <ShoppingBag className="h-4 w-4" aria-hidden="true" /> {nome}
            </a>
          ))}
        </div>
      </section>
    </div>
  );
}
