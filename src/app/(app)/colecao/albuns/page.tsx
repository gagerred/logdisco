"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { ChevronLeft } from "lucide-react";
import { LinhaAlbum } from "@/components/LinhaAlbum";
import { FILTROS_VAZIOS, filtrarAlbuns, ordenarAlbuns, type Filtros, type Ordem } from "@/lib/colecao/filtros";
import { useColecao } from "@/lib/colecao-context";
import { CATEGORIAS_MIDIA } from "@/lib/discogs/formato";

export default function TodosOsAlbuns() {
  const { ativos, idsOuvidos, carregando } = useColecao();
  const [f, setF] = useState<Filtros>(FILTROS_VAZIOS);
  const [ordem, setOrdem] = useState<Ordem>("artista");

  const lista = useMemo(() => ordenarAlbuns(filtrarAlbuns(ativos, f, idsOuvidos), ordem), [ativos, f, idsOuvidos, ordem]);
  const filtrando = JSON.stringify(f) !== JSON.stringify(FILTROS_VAZIOS);

  return (
    <div className="space-y-5">
      <Link href="/colecao" className="inline-flex min-h-11 items-center gap-1 text-sm font-medium text-verde-800 hover:underline">
        <ChevronLeft className="h-4 w-4" aria-hidden="true" /> Coleção
      </Link>
      <h1 className="text-2xl font-extrabold tracking-tight text-verde-950 md:text-3xl">Todos os álbuns</h1>

      <form className="painel grid gap-4 sm:grid-cols-2 lg:grid-cols-3" onSubmit={(e) => e.preventDefault()} aria-label="Filtros">
        <div>
          <label htmlFor="f-artista" className="campo-rotulo">Artista</label>
          <input id="f-artista" type="search" className="campo" value={f.artista} onChange={(e) => setF({ ...f, artista: e.target.value })} autoComplete="off" />
        </div>
        <div>
          <label htmlFor="f-titulo" className="campo-rotulo">Título do álbum</label>
          <input id="f-titulo" type="search" className="campo" value={f.titulo} onChange={(e) => setF({ ...f, titulo: e.target.value })} autoComplete="off" />
        </div>
        <div>
          <label htmlFor="f-formato" className="campo-rotulo">Formato</label>
          <select id="f-formato" className="campo" value={f.formato} onChange={(e) => setF({ ...f, formato: e.target.value as Filtros["formato"] })}>
            <option value="todos">Todos</option>
            {CATEGORIAS_MIDIA.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>
        <div>
          <label htmlFor="f-situacao" className="campo-rotulo">Situação</label>
          <select id="f-situacao" className="campo" value={f.situacao} onChange={(e) => setF({ ...f, situacao: e.target.value as Filtros["situacao"] })}>
            <option value="todos">Todos</option>
            <option value="ouvidos">Já ouvidos</option>
            <option value="nunca">Nunca ouvidos</option>
          </select>
        </div>
        <div>
          <label htmlFor="f-ordem" className="campo-rotulo">Ordenar por</label>
          <select id="f-ordem" className="campo" value={ordem} onChange={(e) => setOrdem(e.target.value as Ordem)}>
            <option value="artista">Artista</option>
            <option value="titulo">Título</option>
            <option value="recentes">Adicionados recentemente</option>
          </select>
        </div>
        <div className="flex items-end">
          <button type="button" className="btn-contorno w-full sm:w-auto" disabled={!filtrando} onClick={() => setF(FILTROS_VAZIOS)}>Limpar filtros</button>
        </div>
      </form>

      {carregando ? (
        <p className="text-verde-800">Carregando…</p>
      ) : (
        <section aria-live="polite">
          <p className="mb-3 text-sm text-verde-800">
            {lista.length} {lista.length === 1 ? "álbum" : "álbuns"}{filtrando ? ` de ${ativos.length}` : ""}
          </p>
          {lista.length === 0 ? (
            <p className="text-verde-800">{ativos.length ? "Nenhum álbum corresponde aos filtros." : "Sua coleção ainda está vazia."}</p>
          ) : (
            <ul className="grid gap-2 lg:grid-cols-2">
              {lista.map((a) => <li key={a.id}><LinhaAlbum album={a} /></li>)}
            </ul>
          )}
        </section>
      )}
    </div>
  );
}
