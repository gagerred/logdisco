"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useMemo, useState } from "react";
import { ChevronLeft, ExternalLink, Pencil, RefreshCw, Search } from "lucide-react";
import { CapaAlbum } from "@/components/CapaAlbum";
import { EditarAlbum } from "@/components/EditarAlbum";
import { SeloMidia } from "@/components/LinhaAlbum";
import { LinhaAudicao } from "@/components/LinhaAudicao";
import { RecarregarAlbum } from "@/components/RecarregarAlbum";
import { RegistrarAudicao } from "@/components/RegistrarAudicao";
import { tituloExibido } from "@/lib/colecao/filtros";
import { useColecao } from "@/lib/colecao-context";
import { identificarAudicao, ordenarAudicoes } from "@/lib/diario/datas";
import { urlDaLetra } from "@/lib/links";

const dataBR = (m: { toDate(): Date } | null | undefined) => m?.toDate().toLocaleDateString("pt-BR") ?? "—";

export default function PaginaDoAlbum() {
  const { id } = useParams<{ id: string }>();
  const { todos, audicoes, carregando } = useColecao();
  const [editando, setEditando] = useState(false);
  const [recarregando, setRecarregando] = useState(false);
  const [registrando, setRegistrando] = useState(false);
  const album = todos.find((a) => a.id === id);
  const minhasAudicoes = useMemo(() => ordenarAudicoes(audicoes.filter((a) => a.releaseId === id)), [audicoes, id]);

  if (carregando) return <p className="text-verde-800">Carregando…</p>;
  if (!album) {
    return (
      <div className="space-y-3">
        <p>Álbum não encontrado na sua coleção.</p>
        <Link href="/colecao" className="btn-contorno">Voltar para a coleção</Link>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Link href="/colecao" className="inline-flex min-h-11 items-center gap-1 text-sm font-medium text-verde-800 hover:underline">
        <ChevronLeft className="h-4 w-4" aria-hidden="true" /> Coleção
      </Link>

      {album.status === "removed" && (
        <p role="status" className="aviso-erro">Este álbum foi removido da coleção ativa. As audições registradas continuam guardadas.</p>
      )}

      <div className="grid gap-6 md:grid-cols-[16rem_1fr]">
        <CapaAlbum album={album} grande className="aspect-square w-full max-w-64 rounded-md md:max-w-none" />

        <div className="min-w-0">
          <h1 className="break-words text-2xl font-extrabold leading-tight tracking-tight text-verde-950 md:text-3xl">
            {tituloExibido(album)}
          </h1>
          <p className="mt-1 text-lg text-verde-900">
            {album.artists.map((a, i) => (
              <span key={a.key}>
                {i > 0 && ", "}
                <Link href={`/artista/${a.key}`} className="underline decoration-verm-600 decoration-2 underline-offset-4 hover:text-verm-700">{a.name}</Link>
              </span>
            ))}
          </p>

          <dl className="mt-4 grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-sm">
            <dt className="font-medium text-verde-800">Formato</dt>
            <dd><SeloMidia tipo={album.mediaType} /> <span className="text-verde-700">no Discogs: {album.formatOriginal || "—"}</span></dd>
            {album.year && (<><dt className="font-medium text-verde-800">Ano</dt><dd>{album.year}</dd></>)}
            <dt className="font-medium text-verde-800">Na coleção desde</dt>
            <dd>{dataBR(album.addedAt)}</dd>
            {album.titleCustom && (<><dt className="font-medium text-verde-800">Título no Discogs</dt><dd className="break-words">{album.title}</dd></>)}
          </dl>

          <div className="mt-5 flex flex-wrap gap-2">
            {album.status !== "removed" && (
              <button className="btn-primario" onClick={() => setRegistrando(true)}>Registrar audição</button>
            )}
            <button className="btn-contorno" onClick={() => setEditando(true)}>
              <Pencil className="h-4 w-4" aria-hidden="true" /> Editar
            </button>
            <button className="btn-contorno" onClick={() => setRecarregando(true)} disabled={album.status === "removed"}>
              <RefreshCw className="h-4 w-4" aria-hidden="true" /> Recarregar informações
            </button>
            <a href={album.discogsUrl} target="_blank" rel="noopener noreferrer" className="btn-contorno">
              <ExternalLink className="h-4 w-4" aria-hidden="true" /> Abrir no Discogs
            </a>
          </div>
        </div>
      </div>

      <section aria-labelledby="faixas">
        <h2 id="faixas" className="mb-2 text-xl font-bold text-verde-950">Faixas <span className="text-base font-normal text-verde-700">({album.tracks.length})</span></h2>
        {album.tracks.length === 0 ? (
          <p className="text-verde-800">O Discogs não informa a lista de faixas deste lançamento.</p>
        ) : (
          <ol className="divide-y divide-verde-100 rounded-md border border-verde-200 bg-white">
            {album.tracks.map((t, i) => {
              // Em álbuns "Various", mostra o artista de cada faixa; nos demais, a apresentação é normal.
              const artistaDaFaixa = album.isVarious && t.artist ? t.artist : null;
              return (
                <li key={`${t.position}-${i}`} className="flex items-center gap-3 px-3 py-2">
                  <span className="w-10 shrink-0 text-sm tabular-nums text-verde-700">{t.position}</span>
                  <div className="min-w-0 flex-1">
                    <p className="break-words">{t.title}</p>
                    {artistaDaFaixa && <p className="break-words text-sm text-verde-800">{artistaDaFaixa}</p>}
                  </div>
                  {t.duration && <span className="shrink-0 text-sm tabular-nums text-verde-700">{t.duration}</span>}
                  <a
                    href={urlDaLetra(artistaDaFaixa ?? album.artistName, t.title)}
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label={`Pesquisar a letra de ${t.title}`}
                    className="grid h-11 w-11 shrink-0 place-items-center rounded-md text-verde-800 hover:bg-verde-50"
                  >
                    <Search className="h-5 w-5" aria-hidden="true" />
                  </a>
                </li>
              );
            })}
          </ol>
        )}
      </section>

      <section aria-labelledby="audicoes">
        <h2 id="audicoes" className="mb-2 text-xl font-bold text-verde-950">
          Audições <span className="text-base font-normal text-verde-700">({minhasAudicoes.length})</span>
        </h2>
        {minhasAudicoes.length === 0 ? (
          <p className="text-verde-800">Você ainda não registrou nenhuma audição deste álbum.</p>
        ) : (
          <ul className="space-y-2">
            {minhasAudicoes.map((a) => (
              <li key={a.id}><LinhaAudicao audicao={a} ident={identificarAudicao(a, new Map([[album.id, album]]))} mostrarAlbum={false} acoes /></li>
            ))}
          </ul>
        )}
      </section>

      <EditarAlbum album={album} aberto={editando} aoFechar={() => setEditando(false)} />
      <RecarregarAlbum album={album} aberto={recarregando} aoFechar={() => setRecarregando(false)} />
      <RegistrarAudicao album={album} aberto={registrando} aoFechar={() => setRegistrando(false)} />
    </div>
  );
}
