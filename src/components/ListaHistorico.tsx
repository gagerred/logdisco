"use client";

import { useState } from "react";
import { ChevronDown } from "lucide-react";
import { rotuloDoTipo, type EntradaHistorico } from "@/lib/historico";
import { formatarMomento } from "@/lib/sync/use-sync";

const COR: Record<string, string> = {
  remocao: "border-verm-100 bg-verm-50 text-verm-700",
  sincronizacao: "border-verde-200 bg-verde-50 text-verde-900",
  importacao: "border-verde-200 bg-verde-50 text-verde-900",
  restauracao: "border-verde-200 bg-verde-50 text-verde-900",
};

function Linha({ e }: { e: EntradaHistorico }) {
  const [aberto, setAberto] = useState(false);
  const temDetalhes = !!e.detalhes?.length;
  return (
    <li className="rounded-md border border-verde-200 bg-white">
      <button className="flex min-h-14 w-full items-start gap-3 p-3 text-left disabled:cursor-default" onClick={() => setAberto((v) => !v)} aria-expanded={temDetalhes ? aberto : undefined} disabled={!temDetalhes}>
        <div className="min-w-0 flex-1">
          <p className="text-sm tabular-nums text-verde-700">{formatarMomento(e.at)}</p>
          <p className="break-words font-medium text-verde-950">{e.resumo}</p>
        </div>
        <span className={`shrink-0 rounded border px-2 py-0.5 text-xs font-semibold ${COR[e.tipo] ?? "border-verde-200 bg-white text-verde-900"}`}>{rotuloDoTipo(e.tipo)}</span>
        {temDetalhes && <ChevronDown className={`mt-0.5 h-5 w-5 shrink-0 text-verde-700 transition-transform ${aberto ? "rotate-180" : ""}`} aria-hidden="true" />}
      </button>
      {aberto && temDetalhes && (
        <ul className="space-y-1 border-t border-verde-200 p-3 text-sm">
          {e.detalhes!.map((d) => (
            <li key={d.campo} className="break-words"><strong>{d.rotulo}:</strong> {d.de ? `${d.de} → ${d.para}` : d.para}</li>
          ))}
        </ul>
      )}
    </li>
  );
}

/** Lista dos registros do histórico de alterações: data e horário, tipo da operação e o que mudou. */
export function ListaHistorico({ entradas }: { entradas: EntradaHistorico[] }) {
  if (entradas.length === 0) return <p className="text-verde-800">Nenhum registro encontrado.</p>;
  return <ul className="space-y-2">{entradas.map((e) => <Linha key={e.id} e={e} />)}</ul>;
}
