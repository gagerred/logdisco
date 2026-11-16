"use client";

import Link from "next/link";
import { useState } from "react";
import { CapaAlbum } from "./CapaAlbum";
import { LinhaAlbum } from "./LinhaAlbum";
import { formatarData } from "@/lib/diario/datas";
import type { AlbumRanking, ArtistaRanking, RegistroAudicao } from "@/lib/relatorios/calculos";
import type { AlbumDoc } from "@/lib/tipos";

const INICIAL = 10;

function VerMais({ total, mostrados, aoMostrar, passo = 40 }: { total: number; mostrados: number; aoMostrar: () => void; passo?: number }) {
  if (mostrados >= total) return null;
  return (
    <button className="btn-contorno mt-3" onClick={aoMostrar}>
      Ver mais ({Math.min(passo, total - mostrados)} de {total - mostrados} restantes)
    </button>
  );
}

const rotuloAudicoes = (n: number) => `${n} ${n === 1 ? "audição" : "audições"}`;

export function RankingAlbuns({ itens }: { itens: AlbumRanking[] }) {
  const [mostrar, setMostrar] = useState(INICIAL);
  if (itens.length === 0) return <p className="text-sm text-verde-800">Nenhuma audição registrada no período.</p>;
  const maximo = itens[0].audicoes;
  return (
    <>
      <ol className="grid gap-2 lg:grid-cols-2">
        {itens.slice(0, mostrar).map((a, i) => (
          <li key={a.releaseId}>
            <Link href={`/album/${a.releaseId}`} className="flex min-h-[4.5rem] items-center gap-3 rounded-md border border-verde-200 bg-white p-2 hover:bg-verde-50">
              <span className="w-6 shrink-0 text-center text-sm font-bold tabular-nums text-verm-700">{i + 1}</span>
              <CapaAlbum album={{ cover: null, thumb: a.thumb }} className="h-12 w-12 shrink-0 rounded" />
              <div className="min-w-0 flex-1">
                <p className="break-words font-semibold leading-snug text-verde-950">{a.titulo}</p>
                <p className="break-words text-sm text-verde-800">{a.artista}{!a.ativo && <span className="text-verm-700"> · fora da coleção ativa</span>}</p>
                <div className="mt-1 h-1.5 overflow-hidden rounded bg-verde-100" aria-hidden="true">
                  <div className="h-full rounded bg-verde-600" style={{ width: `${(a.audicoes / maximo) * 100}%` }} />
                </div>
              </div>
              <span className="shrink-0 text-right text-sm tabular-nums"><strong className="text-lg text-verde-950">{a.audicoes}</strong><span className="block text-xs text-verde-700">{a.audicoes === 1 ? "audição" : "audições"}</span></span>
            </Link>
          </li>
        ))}
      </ol>
      <VerMais total={itens.length} mostrados={mostrar} aoMostrar={() => setMostrar((m) => m + 40)} />
    </>
  );
}

export function RankingArtistas({ itens }: { itens: ArtistaRanking[] }) {
  const [mostrar, setMostrar] = useState(INICIAL);
  if (itens.length === 0) return <p className="text-sm text-verde-800">Nenhuma audição registrada no período.</p>;
  const maximo = itens[0].audicoes;
  return (
    <>
      <ol className="grid gap-2 lg:grid-cols-2">
        {itens.slice(0, mostrar).map((a, i) => (
          <li key={a.key}>
            <Link href={`/artista/${a.key}`} className="flex min-h-14 items-center gap-3 rounded-md border border-verde-200 bg-white p-2 hover:bg-verde-50">
              <span className="w-6 shrink-0 text-center text-sm font-bold tabular-nums text-verm-700">{i + 1}</span>
              <div className="min-w-0 flex-1">
                <p className="break-words font-semibold leading-snug text-verde-950">{a.nome}</p>
                <p className="text-xs text-verde-700">{a.albuns} {a.albuns === 1 ? "álbum ouvido" : "álbuns ouvidos"}</p>
                <div className="mt-1 h-1.5 overflow-hidden rounded bg-verde-100" aria-hidden="true">
                  <div className="h-full rounded bg-verde-600" style={{ width: `${(a.audicoes / maximo) * 100}%` }} />
                </div>
              </div>
              <span className="shrink-0 text-right text-sm tabular-nums"><strong className="text-lg text-verde-950">{a.audicoes}</strong><span className="block text-xs text-verde-700">{a.audicoes === 1 ? "audição" : "audições"}</span></span>
            </Link>
          </li>
        ))}
      </ol>
      <VerMais total={itens.length} mostrados={mostrar} aoMostrar={() => setMostrar((m) => m + 40)} />
    </>
  );
}

/** Álbuns da coleção ativa que nunca foram ouvidos. */
export function ListaNuncaOuvidos({ albuns }: { albuns: AlbumDoc[] }) {
  const [mostrar, setMostrar] = useState(20);
  if (albuns.length === 0) return <p className="aviso-ok">Você já ouviu todos os álbuns da coleção.</p>;
  return (
    <>
      <ul className="grid gap-2 lg:grid-cols-2">
        {albuns.slice(0, mostrar).map((a) => <li key={a.id}><LinhaAlbum album={a} /></li>)}
      </ul>
      <VerMais total={albuns.length} mostrados={mostrar} aoMostrar={() => setMostrar((m) => m + 40)} />
    </>
  );
}

/** Registros de audição de um tipo de mídia: artista, título, data e horário. Os títulos quebram em várias linhas. */
export function ListaRegistros({ registros }: { registros: RegistroAudicao[] }) {
  const [mostrar, setMostrar] = useState(50);
  if (registros.length === 0) return <p className="text-verde-800">Nenhuma audição registrada de álbuns deste tipo.</p>;
  return (
    <>
      <div className="hidden grid-cols-[minmax(0,2fr)_minmax(0,1.5fr)_7rem_4rem] gap-3 px-3 pb-1 text-xs font-semibold uppercase text-verde-700 md:grid" aria-hidden="true">
        <span>Álbum</span><span>Artista</span><span className="text-right">Data</span><span className="text-right">Horário</span>
      </div>
      <ul className="space-y-2">
        {registros.slice(0, mostrar).map((r) => (
          <li key={r.id} className="rounded-md border border-verde-200 bg-white p-3 md:grid md:grid-cols-[minmax(0,2fr)_minmax(0,1.5fr)_7rem_4rem] md:items-center md:gap-3">
            <p className="break-words font-semibold leading-snug">
              <Link href={`/album/${r.releaseId}`} className="text-verde-950 hover:underline">{r.titulo}</Link>
              {!r.ativo && <span className="text-xs font-normal text-verm-700"> · fora da coleção ativa</span>}
            </p>
            <p className="break-words text-sm text-verde-800">{r.artista}</p>
            <p className="text-sm tabular-nums md:text-right"><span className="sr-only">Data: </span>{formatarData(r.date)}</p>
            <p className="text-sm tabular-nums text-verde-700 md:text-right"><span className="sr-only">Horário: </span>{r.time}</p>
          </li>
        ))}
      </ul>
      <VerMais total={registros.length} mostrados={mostrar} aoMostrar={() => setMostrar((m) => m + 100)} passo={100} />
    </>
  );
}

export { rotuloAudicoes };
