"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { ChevronLeft, Search } from "lucide-react";
import { ListaArtistas } from "@/components/ListaArtistas";
import { agruparPorArtista, inicialDe } from "@/lib/colecao/artistas";
import { normalizarTexto } from "@/lib/colecao/texto";
import { useColecao } from "@/lib/colecao-context";

export default function TodosOsArtistas() {
  const { ativos, carregando } = useColecao();
  const [texto, setTexto] = useState("");

  const grupos = useMemo(() => {
    const t = normalizarTexto(texto);
    const todos = agruparPorArtista(ativos).filter((g) => !t || normalizarTexto(g.name).includes(t));
    const porLetra = new Map<string, typeof todos>();
    for (const g of todos) porLetra.set(inicialDe(g.name), [...(porLetra.get(inicialDe(g.name)) ?? []), g]);
    return { total: todos.length, letras: [...porLetra.entries()] };
  }, [ativos, texto]);

  return (
    <div className="space-y-5">
      <Link href="/colecao" className="inline-flex min-h-11 items-center gap-1 text-sm font-medium text-verde-800 hover:underline">
        <ChevronLeft className="h-4 w-4" aria-hidden="true" /> Coleção
      </Link>
      <h1 className="text-2xl font-extrabold tracking-tight text-verde-950 md:text-3xl">Todos os artistas</h1>

      <div className="relative max-w-xl">
        <label htmlFor="busca-artistas" className="sr-only">Buscar artista</label>
        <Search className="pointer-events-none absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-verde-700" aria-hidden="true" />
        <input id="busca-artistas" type="search" className="campo pl-10" placeholder="Buscar artista" value={texto} onChange={(e) => setTexto(e.target.value)} autoComplete="off" />
      </div>

      {carregando ? (
        <p className="text-verde-800">Carregando…</p>
      ) : grupos.total === 0 ? (
        <p className="text-verde-800">Nenhum artista encontrado.</p>
      ) : (
        <>
          <nav aria-label="Ir para a letra" className="flex flex-wrap gap-1">
            {grupos.letras.map(([letra]) => (
              <a key={letra} href={`#letra-${letra === "#" ? "num" : letra}`} className="grid h-9 min-w-9 place-items-center rounded border border-verde-200 bg-white px-2 text-sm font-semibold text-verde-900 hover:bg-verde-50">{letra}</a>
            ))}
          </nav>
          {grupos.letras.map(([letra, lista]) => (
            <section key={letra} id={`letra-${letra === "#" ? "num" : letra}`} className="scroll-mt-20">
              <h2 className="mb-2 text-xl font-extrabold text-verm-700">{letra}</h2>
              <ListaArtistas artistas={lista} />
            </section>
          ))}
        </>
      )}
    </div>
  );
}
