"use client";

import { useMemo, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { LinhaAudicao } from "@/components/LinhaAudicao";
import { useColecao } from "@/lib/colecao-context";
import {
  audicoesDoDia, contarPorDia, DIAS_SEMANA, dataLocal, formatarDataExtensa, gradeDoMes, identificarAudicao, MESES,
} from "@/lib/diario/datas";

export default function DiarioDeAudicoes() {
  const { todos, audicoes, carregando } = useColecao();
  const hoje = dataLocal();
  const anoAtual = Number(hoje.slice(0, 4));
  const mesAtual = Number(hoje.slice(5, 7));

  const [ano, setAno] = useState(anoAtual);
  const [mes, setMes] = useState(mesAtual);
  const [selecionada, setSelecionada] = useState<string | null>(hoje);

  const porId = useMemo(() => new Map(todos.map((a) => [a.id, a])), [todos]);
  const contagem = useMemo(() => contarPorDia(audicoes), [audicoes]);
  const semanas = useMemo(() => gradeDoMes(ano, mes), [ano, mes]);
  const doDia = useMemo(() => (selecionada ? audicoesDoDia(audicoes, selecionada) : []), [audicoes, selecionada]);

  const prefixo = `${ano}-${String(mes).padStart(2, "0")}`;
  const totalDoMes = useMemo(
    () => audicoes.filter((a) => a.date.startsWith(prefixo)).length,
    [audicoes, prefixo],
  );
  const primeiroAno = useMemo(
    () => Math.min(anoAtual, ...audicoes.map((a) => Number(a.date.slice(0, 4))).filter(Number.isFinite)),
    [audicoes, anoAtual],
  );
  const anos = Array.from({ length: anoAtual - primeiroAno + 1 }, (_, i) => anoAtual - i);
  const noMesAtual = ano === anoAtual && mes === mesAtual;

  function irPara(novoAno: number, novoMes: number) {
    if (novoAno > anoAtual || (novoAno === anoAtual && novoMes > mesAtual)) return;
    setAno(novoAno);
    setMes(novoMes);
    setSelecionada(null);
  }
  const anterior = () => (mes === 1 ? irPara(ano - 1, 12) : irPara(ano, mes - 1));
  const proximo = () => (mes === 12 ? irPara(ano + 1, 1) : irPara(ano, mes + 1));

  return (
    <div className="space-y-5">
      <h1 className="text-2xl font-extrabold tracking-tight text-verde-950 md:text-3xl">Diário de audições</h1>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,26rem)_1fr]">
        <section aria-label="Calendário" className="painel !p-3">
          <div className="mb-3 flex items-center gap-2">
            <button onClick={anterior} aria-label="Mês anterior" className="grid h-11 w-11 shrink-0 place-items-center rounded-md border border-verde-200 hover:bg-verde-50">
              <ChevronLeft className="h-5 w-5" aria-hidden="true" />
            </button>
            <label className="sr-only" htmlFor="cal-mes">Mês</label>
            <select id="cal-mes" className="campo !px-2" value={mes} onChange={(e) => irPara(ano, Number(e.target.value))}>
              {MESES.map((nome, i) => (
                <option key={nome} value={i + 1} disabled={ano === anoAtual && i + 1 > mesAtual}>{nome[0].toUpperCase() + nome.slice(1)}</option>
              ))}
            </select>
            <label className="sr-only" htmlFor="cal-ano">Ano</label>
            <select id="cal-ano" className="campo !w-28 shrink-0 !px-2" value={ano} onChange={(e) => { const y = Number(e.target.value); irPara(y, y === anoAtual ? Math.min(mes, mesAtual) : mes); }}>
              {anos.map((a) => <option key={a} value={a}>{a}</option>)}
            </select>
            <button onClick={proximo} disabled={noMesAtual} aria-label="Próximo mês" className="grid h-11 w-11 shrink-0 place-items-center rounded-md border border-verde-200 hover:bg-verde-50 disabled:opacity-40">
              <ChevronRight className="h-5 w-5" aria-hidden="true" />
            </button>
          </div>

          <table className="w-full table-fixed border-separate border-spacing-1">
            <thead>
              <tr>
                {DIAS_SEMANA.map((d) => <th key={d} scope="col" className="pb-1 text-xs font-semibold uppercase text-verde-700">{d}</th>)}
              </tr>
            </thead>
            <tbody>
              {semanas.map((semana, i) => (
                <tr key={i}>
                  {semana.map((data, j) => {
                    if (!data) return <td key={j} />;
                    const n = contagem.get(data) ?? 0;
                    const dia = Number(data.slice(8));
                    const futuro = data > hoje;
                    const sel = data === selecionada;
                    return (
                      <td key={j} className="p-0">
                        <button
                          onClick={() => setSelecionada(data)}
                          disabled={futuro}
                          aria-pressed={sel}
                          aria-label={`${dia} de ${MESES[mes - 1]}${n ? `, ${n} ${n === 1 ? "audição" : "audições"}` : ""}`}
                          className={`relative h-12 w-full rounded-md border text-sm tabular-nums disabled:opacity-30 ${
                            sel ? "border-verde-900 bg-verde-800 font-bold text-white"
                              : n ? "border-verde-600 bg-verde-100 font-semibold text-verde-950 hover:bg-verde-200"
                              : "border-verde-100 bg-white text-verde-900 hover:bg-verde-50"
                          } ${data === hoje ? "ring-2 ring-verm-600 ring-offset-1" : ""}`}
                        >
                          {dia}
                          {n > 0 && (
                            <span className={`absolute right-0.5 top-0.5 min-w-4 rounded-full px-1 text-[10px] font-bold leading-4 ${sel ? "bg-white text-verde-900" : "bg-verm-600 text-white"}`}>{n}</span>
                          )}
                        </button>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>

          <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-sm text-verde-800">
            <span>{carregando ? "Carregando…" : `${totalDoMes} ${totalDoMes === 1 ? "audição" : "audições"} em ${MESES[mes - 1]} de ${ano}`}</span>
            <button className="btn-contorno !min-h-9 !px-3" onClick={() => { setAno(anoAtual); setMes(mesAtual); setSelecionada(hoje); }}>Hoje</button>
          </div>
        </section>

        <section aria-live="polite" aria-label="Audições do dia selecionado">
          {!selecionada ? (
            <p className="text-verde-800">Selecione um dia no calendário para ver os álbuns ouvidos.</p>
          ) : (
            <>
              <h2 className="mb-1 text-xl font-bold text-verde-950">{formatarDataExtensa(selecionada)}</h2>
              <p className="mb-3 text-sm text-verde-800">
                {doDia.length === 0 ? "Nenhuma audição registrada neste dia." : `${doDia.length} ${doDia.length === 1 ? "audição" : "audições"}`}
              </p>
              <ul className="space-y-2">
                {doDia.map((a) => (
                  <li key={a.id}><LinhaAudicao audicao={a} ident={identificarAudicao(a, porId)} acoes /></li>
                ))}
              </ul>
            </>
          )}
        </section>
      </div>
    </div>
  );
}
