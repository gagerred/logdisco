"use client";

import { useMemo } from "react";
import { BarrasHorizontais, Indicador } from "@/components/Graficos";
import { useColecao } from "@/lib/colecao-context";
import { CATEGORIAS_MIDIA } from "@/lib/discogs/formato";
import { audicoesPorFormato, indexarAlbuns, SLUG_FORMATO } from "@/lib/relatorios/calculos";

export default function RelatorioPorMidia() {
  const { todos, audicoes, carregando, erro } = useColecao();
  const porFormato = useMemo(() => audicoesPorFormato(audicoes, indexarAlbuns(todos)), [audicoes, todos]);
  const total = CATEGORIAS_MIDIA.reduce((s, c) => s + porFormato[c], 0);

  if (erro) return <p role="alert" className="aviso-erro">{erro}</p>;
  if (carregando) return <p className="text-verde-800">Carregando…</p>;

  return (
    <div className="max-w-3xl space-y-6">
      <div>
        <h2 className="text-xl font-bold text-verde-950">Audições por tipo de mídia</h2>
        <p className="text-sm text-verde-800">Considera o formato atual cadastrado em cada álbum. Toque em um tipo para ver todas as audições dele.</p>
      </div>
      <Indicador rotulo="Total de audições" valor={total} />
      <div className="painel !p-2">
        <BarrasHorizontais
          unidade="audições"
          itens={CATEGORIAS_MIDIA.map((c) => ({ id: c, rotulo: c, valor: porFormato[c], href: `/relatorios/midia/${SLUG_FORMATO[c]}` }))}
        />
      </div>
    </div>
  );
}
