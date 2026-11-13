"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { Plus, Search } from "lucide-react";
import { LinhaAlbum } from "@/components/LinhaAlbum";
import { ListaArtistas } from "@/components/ListaArtistas";
import { agruparPorArtista, artistasRecentes } from "@/lib/colecao/artistas";
import { buscarAlbuns, ordenarAlbuns } from "@/lib/colecao/filtros";
import { normalizarTexto } from "@/lib/colecao/texto";
import { useColecao } from "@/lib/colecao-context";

export default function Colecao() {
  const { ativos, carregando, erro } = useColecao();
  const [texto, setTexto] = useState("");
  const busca = texto.trim();

  const grupos = useMemo(() => agruparPorArtista(ativos), [ativos]);
  const recentes = useMemo(() => artistasRecentes(ativos, 12), [ativos]);
  const artistasEncontrados = useMemo(
    () => (busca ? grupos.filter((g) => normalizarTexto(g.name).includes(normalizarTexto(busca))) : []),
    [grupos, busca],
  );
  const albunsEncontrados = useMemo(() => ordenarAlbuns(buscarAlbuns(ativos, busca), "artista"), [ativos, busca]);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight text-verde-950 md:text-3xl">Coleção</h1>
          {!carregando && (
            <p className="text-sm text-verde-800">
              {ativos.length} {ativos.length === 1 ? "álbum" : "álbuns"} · {grupos.length} {grupos.length === 1 ? "artista" : "artistas"}
            </p>
          )}
        </div>
        <Link href="/colecao/adicionar" className="btn-primario">
          <Plus className="h-4 w-4" aria-hidden="true" /> Adicionar disco
        </Link>
      </div>

      {erro && <p role="alert" className="aviso-erro">{erro}</p>}

      <div>
        <label htmlFor="busca-colecao" className="campo-rotulo">Buscar na coleção</label>
        <div className="relative max-w-xl">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-verde-700" aria-hidden="true" />
          <input id="busca-colecao" type="search" className="campo pl-10" placeholder="Artista ou título do álbum" value={texto} onChange={(e) => setTexto(e.target.value)} autoComplete="off" />
        </div>
      </div>

      <div className="flex flex-wrap gap-3">
        <Link href="/colecao/artistas" className="btn-contorno">Ver todos os artistas</Link>
        <Link href="/colecao/albuns" className="btn-contorno">Ver todos os álbuns</Link>
      </div>

      {carregando ? (
        <p className="text-verde-800">Carregando coleção…</p>
      ) : ativos.length === 0 ? (
        <div className="painel max-w-xl">
          <p>Sua coleção ainda está vazia.</p>
          <p className="mt-1 text-sm text-verde-800">Adicione um disco informando o código do lançamento no Discogs.</p>
          <Link href="/colecao/adicionar" className="btn-primario mt-4">Adicionar o primeiro disco</Link>
        </div>
      ) : busca ? (
        <div className="space-y-6" aria-live="polite">
          <section>
            <h2 className="mb-2 text-lg font-bold text-verde-950">Artistas</h2>
            {artistasEncontrados.length ? <ListaArtistas artistas={artistasEncontrados} /> : <p className="text-sm text-verde-800">Nenhum artista encontrado.</p>}
          </section>
          <section>
            <h2 className="mb-2 text-lg font-bold text-verde-950">Álbuns</h2>
            {albunsEncontrados.length ? (
              <ul className="grid gap-2 lg:grid-cols-2">
                {albunsEncontrados.slice(0, 40).map((a) => <li key={a.id}><LinhaAlbum album={a} /></li>)}
              </ul>
            ) : <p className="text-sm text-verde-800">Nenhum álbum encontrado.</p>}
          </section>
        </div>
      ) : (
        <section>
          <h2 className="mb-2 text-lg font-bold text-verde-950">Artistas adicionados recentemente</h2>
          <ListaArtistas artistas={recentes} />
        </section>
      )}
    </div>
  );
}
