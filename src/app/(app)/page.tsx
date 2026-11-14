"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { Dices, Search } from "lucide-react";
import { CapaAlbum } from "@/components/CapaAlbum";
import { SeloMidia } from "@/components/LinhaAlbum";
import { LinhaAudicao } from "@/components/LinhaAudicao";
import { tituloExibido } from "@/lib/colecao/filtros";
import { useColecao } from "@/lib/colecao-context";
import { identificarAudicao, ultimasAudicoes } from "@/lib/diario/datas";
import { buscarMusicas, indexarFaixas } from "@/lib/diario/musicas";

export default function Inicio() {
  const { ativos, todos, audicoes, carregando } = useColecao();
  const [texto, setTexto] = useState("");

  const porId = useMemo(() => new Map(todos.map((a) => [a.id, a])), [todos]);
  const ultimas = useMemo(() => ultimasAudicoes(audicoes, 5), [audicoes]);
  const indice = useMemo(() => indexarFaixas(ativos), [ativos]);
  const resultados = useMemo(() => buscarMusicas(indice, texto), [indice, texto]);
  const busca = texto.trim();

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-extrabold tracking-tight text-verde-950 md:text-3xl">Início</h1>
        <Link href="/sorteio" className="btn-primario">
          <Dices className="h-4 w-4" aria-hidden="true" /> Sortear disco
        </Link>
      </div>

      <section aria-labelledby="ultimas">
        <h2 id="ultimas" className="mb-2 text-xl font-bold text-verde-950">Últimas audições</h2>
        {carregando ? (
          <p className="text-verde-800">Carregando…</p>
        ) : ultimas.length === 0 ? (
          <div className="painel max-w-xl">
            <p>Nenhuma audição registrada ainda.</p>
            <p className="mt-1 text-sm text-verde-800">Abra um álbum da coleção e use “Registrar audição”.</p>
          </div>
        ) : (
          <ul className="grid gap-2 lg:grid-cols-2">
            {ultimas.map((a) => (
              <li key={a.id}><LinhaAudicao audicao={a} ident={identificarAudicao(a, porId)} /></li>
            ))}
          </ul>
        )}
        {ultimas.length > 0 && (
          <Link href="/diario" className="mt-3 inline-flex min-h-11 items-center text-sm font-semibold text-verde-800 underline underline-offset-2">
            Ver o diário de audições
          </Link>
        )}
      </section>

      <section aria-labelledby="musica">
        <h2 id="musica" className="mb-2 text-xl font-bold text-verde-950">Pesquisar música</h2>
        <label htmlFor="busca-musica" className="sr-only">Nome da música</label>
        <div className="relative max-w-xl">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-verde-700" aria-hidden="true" />
          <input id="busca-musica" type="search" className="campo pl-10" placeholder="Nome da música" value={texto} onChange={(e) => setTexto(e.target.value)} autoComplete="off" />
        </div>
        <p className="mt-1 text-xs text-verde-700">Procura nas faixas de todos os álbuns da coleção e mostra em quais deles a música aparece.</p>

        <div className="mt-4" aria-live="polite">
          {busca.length === 1 ? (
            <p className="text-sm text-verde-800">Digite pelo menos 2 letras.</p>
          ) : busca && resultados.length === 0 ? (
            <p className="text-verde-800">Nenhuma música encontrada na coleção.</p>
          ) : (
            <ul className="space-y-3">
              {resultados.map((r) => (
                <li key={r.titulo} className="painel !p-3">
                  <p className="break-words font-semibold text-verde-950">{r.titulo}</p>
                  <p className="mb-2 text-xs text-verde-700">
                    {r.ocorrencias.length === 1 ? "em 1 álbum" : `em ${r.ocorrencias.length} álbuns`}
                  </p>
                  <ul className="space-y-2">
                    {r.ocorrencias.map((o) => (
                      <li key={o.album.id + o.posicao}>
                        <Link href={`/album/${o.album.id}`} className="flex min-h-14 items-center gap-3 rounded-md border border-verde-200 p-2 hover:bg-verde-50">
                          <CapaAlbum album={o.album} className="h-12 w-12 shrink-0 rounded" />
                          <div className="min-w-0 flex-1">
                            <p className="break-words leading-snug">
                              <span className="font-medium text-verde-950">{tituloExibido(o.album)}</span> <SeloMidia tipo={o.album.mediaType} />
                            </p>
                            <p className="break-words text-sm text-verde-800">
                              {o.album.artistName}{o.posicao ? ` · faixa ${o.posicao}` : ""}{o.artistaDaFaixa ? ` · ${o.artistaDaFaixa}` : ""}
                            </p>
                          </div>
                        </Link>
                      </li>
                    ))}
                  </ul>
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>
    </div>
  );
}
