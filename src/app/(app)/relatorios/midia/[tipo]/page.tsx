"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useMemo } from "react";
import { ChevronLeft } from "lucide-react";
import { ListaRegistros } from "@/components/Rankings";
import { useColecao } from "@/lib/colecao-context";
import { audicoesDoFormato, formatoDoSlug, indexarAlbuns } from "@/lib/relatorios/calculos";

export default function AudicoesDoTipo() {
  const { tipo } = useParams<{ tipo: string }>();
  const { todos, audicoes, carregando } = useColecao();
  const formato = formatoDoSlug(tipo);
  const registros = useMemo(() => (formato ? audicoesDoFormato(audicoes, indexarAlbuns(todos), formato) : []), [formato, audicoes, todos]);

  if (!formato) {
    return (
      <div className="space-y-3">
        <p>Tipo de mídia desconhecido.</p>
        <Link href="/relatorios/midia" className="btn-contorno">Voltar ao relatório por mídia</Link>
      </div>
    );
  }
  if (carregando) return <p className="text-verde-800">Carregando…</p>;

  return (
    <div className="space-y-5">
      <Link href="/relatorios/midia" className="inline-flex min-h-11 items-center gap-1 text-sm font-medium text-verde-800 hover:underline">
        <ChevronLeft className="h-4 w-4" aria-hidden="true" /> Por mídia
      </Link>
      <div>
        <h2 className="text-xl font-bold text-verde-950">Audições de {formato}</h2>
        <p className="text-sm text-verde-800">{registros.length} {registros.length === 1 ? "audição" : "audições"}, da mais recente para a mais antiga.</p>
      </div>
      <ListaRegistros registros={registros} />
    </div>
  );
}
