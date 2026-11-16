import Link from "next/link";
import { ChevronRight } from "lucide-react";

/** Indicador numérico em destaque. */
export function Indicador({ rotulo, valor, detalhe, alerta }: { rotulo: string; valor: number | string; detalhe?: string; alerta?: boolean }) {
  return (
    <div className={`painel !p-4 ${alerta ? "border-verm-100 bg-verm-50" : ""}`}>
      <p className="text-sm font-medium text-verde-800">{rotulo}</p>
      <p className={`mt-1 text-3xl font-extrabold tabular-nums tracking-tight ${alerta ? "text-verm-700" : "text-verde-950"}`}>{valor}</p>
      {detalhe && <p className="mt-1 text-xs text-verde-700">{detalhe}</p>}
    </div>
  );
}

export type ItemBarra = { id: string; rotulo: string; valor: number; detalhe?: string; href?: string };

/** Barras horizontais; o texto sempre quebra em várias linhas, sem rolagem lateral no celular. */
export function BarrasHorizontais({ itens, unidade = "", cor = "verde" }: { itens: ItemBarra[]; unidade?: string; cor?: "verde" | "vermelho" }) {
  const maximo = Math.max(1, ...itens.map((i) => i.valor));
  const barra = cor === "vermelho" ? "bg-verm-600" : "bg-verde-600";
  return (
    <ul className="space-y-1">
      {itens.map((i) => {
        const largura = i.valor > 0 ? Math.max(3, (i.valor / maximo) * 100) : 0;
        const corpo = (
          <>
            <div className="flex items-baseline justify-between gap-3">
              <span className="min-w-0 break-words font-medium text-verde-950">
                {i.rotulo}
                {i.detalhe && <span className="block text-xs font-normal text-verde-700">{i.detalhe}</span>}
              </span>
              <span className="flex shrink-0 items-center gap-1 tabular-nums">
                <strong className="text-lg text-verde-950">{i.valor}</strong>
                {unidade && <span className="text-xs text-verde-700">{unidade}</span>}
                {i.href && <ChevronRight className="h-4 w-4 text-verde-700" aria-hidden="true" />}
              </span>
            </div>
            <div className="mt-1.5 h-2.5 overflow-hidden rounded bg-verde-100" aria-hidden="true">
              <div className={`h-full rounded ${barra}`} style={{ width: `${largura}%` }} />
            </div>
          </>
        );
        return (
          <li key={i.id}>
            {i.href ? (
              <Link href={i.href} className="block min-h-11 rounded-md p-2 hover:bg-verde-50">{corpo}</Link>
            ) : (
              <div className="p-2">{corpo}</div>
            )}
          </li>
        );
      })}
    </ul>
  );
}

const MESES_CURTOS = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];
const MESES_LONGOS = ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];

/** Audições por mês, em colunas. */
export function GraficoMensal({ valores }: { valores: number[] }) {
  const maximo = Math.max(1, ...valores);
  return (
    <ol className="flex h-44 items-end gap-1 sm:gap-2" aria-label="Audições por mês">
      {valores.map((v, i) => (
        <li key={i} className="flex h-full min-w-0 flex-1 flex-col items-center justify-end">
          <span className="sr-only">{MESES_LONGOS[i]}: {v} {v === 1 ? "audição" : "audições"}</span>
          <span className="mb-1 text-[11px] font-bold tabular-nums text-verde-900" aria-hidden="true">{v > 0 ? v : ""}</span>
          <div className="flex w-full flex-1 items-end" aria-hidden="true">
            <div className={`w-full rounded-t ${v > 0 ? "bg-verde-600" : "bg-verde-100"}`} style={{ height: v > 0 ? `${Math.max(4, (v / maximo) * 100)}%` : "3px" }} />
          </div>
          <span className="mt-1 text-[10px] font-medium uppercase text-verde-700 sm:text-xs" aria-hidden="true">{MESES_CURTOS[i]}</span>
        </li>
      ))}
    </ol>
  );
}
