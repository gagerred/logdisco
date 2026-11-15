"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { collection, getDocs, limit, onSnapshot, orderBy, query } from "firebase/firestore";
import { ChevronLeft, ChevronDown } from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { getDb } from "@/lib/firebase-client";
import { formatarMomento } from "@/lib/sync/use-sync";
import { ROTULO_STATUS, type SyncItemDoc, type SyncRunDoc } from "@/lib/sync/tipos";

const COR: Record<SyncRunDoc["status"], string> = {
  coletando: "border-verde-200 bg-white text-verde-900",
  conferencia: "border-verde-200 bg-white text-verde-900",
  aplicando: "border-verde-200 bg-white text-verde-900",
  concluida: "border-verde-200 bg-verde-50 text-verde-900",
  concluida_com_erros: "border-verm-100 bg-verm-50 text-verm-700",
  cancelada: "border-verde-200 bg-white text-verde-700",
  falhou: "border-verm-100 bg-verm-50 text-verm-700",
};

function resumo(r: SyncRunDoc): string {
  if (r.resultado) return `${r.resultado.adicionados + r.resultado.reativados} adicionados · ${r.resultado.removidos} removidos · ${r.resultado.inalterados} inalterados${r.resultado.erros ? ` · ${r.resultado.erros} com erro` : ""}`;
  if (r.contagens) return `Plano não aplicado: ${r.contagens.adicionar + r.contagens.reativar} a adicionar · ${r.contagens.remover} a remover · ${r.contagens.manter} inalterados`;
  return "";
}

function Detalhes({ run }: { run: SyncRunDoc }) {
  const { user } = useAuth();
  const [itens, setItens] = useState<SyncItemDoc[] | null>(null);
  useEffect(() => {
    if (!user) return;
    getDocs(collection(getDb(), "users", user.uid, "syncRuns", run.id, "items"))
      .then((s) => setItens(s.docs.map((d) => ({ ...(d.data() as object), id: d.id }) as SyncItemDoc)))
      .catch(() => setItens([]));
  }, [user, run.id]);

  if (itens === null) return <p className="p-3 text-sm text-verde-800">Carregando…</p>;
  const aplicada = !!run.resultado;
  const grupos: [string, SyncItemDoc[]][] = [
    [aplicada ? "Adicionados" : "A adicionar", itens.filter((i) => i.grupo === "entrada" && i.selecionado && i.estado !== "erro" && !i.semMudanca)],
    [aplicada ? "Removidos da coleção ativa" : "A remover", itens.filter((i) => i.grupo === "saida" && i.selecionado && i.estado !== "erro" && !i.semMudanca)],
    ["Com erro", itens.filter((i) => i.estado === "erro")],
  ];
  const mensagem = run.erro ?? run.ultimoErro;
  return (
    <div className="space-y-4 border-t border-verde-200 p-3">
      {mensagem && <p className="aviso-erro">{mensagem}</p>}
      {grupos.map(([titulo, lista]) =>
        lista.length === 0 ? null : (
          <div key={titulo}>
            <h3 className="text-sm font-bold text-verde-950">{titulo} ({lista.length})</h3>
            <ul className="mt-1 max-h-64 space-y-1 overflow-y-auto text-sm">
              {lista.sort((a, b) => a.artista.localeCompare(b.artista, "pt-BR")).map((i) => (
                <li key={i.id} className="break-words">
                  {i.artista} — {i.titulo}{i.estado === "erro" && <span className="text-verm-700"> · {i.observacao}</span>}
                </li>
              ))}
            </ul>
          </div>
        ),
      )}
      {grupos.every(([, l]) => l.length === 0) && !mensagem && <p className="text-sm text-verde-800">Sem álbuns adicionados, removidos ou com erro nesta execução.</p>}
    </div>
  );
}

function Linha({ run }: { run: SyncRunDoc }) {
  const [aberto, setAberto] = useState(false);
  const podeDetalhar = run.status !== "coletando" && run.status !== "falhou" ? true : !!run.erro || !!run.ultimoErro;
  return (
    <li className="rounded-md border border-verde-200 bg-white">
      <button className="flex min-h-14 w-full items-center gap-3 p-3 text-left" onClick={() => setAberto((v) => !v)} aria-expanded={aberto} disabled={!podeDetalhar}>
        <div className="min-w-0 flex-1">
          <p className="font-semibold tabular-nums text-verde-950">{formatarMomento(run.concluidaEm ?? run.criadaEm)}</p>
          <p className="break-words text-sm text-verde-800">{resumo(run)}</p>
        </div>
        <span className={`shrink-0 rounded border px-2 py-0.5 text-xs font-semibold ${COR[run.status]}`}>{ROTULO_STATUS[run.status]}</span>
        <ChevronDown className={`h-5 w-5 shrink-0 text-verde-700 transition-transform ${aberto ? "rotate-180" : ""}`} aria-hidden="true" />
      </button>
      {aberto && <Detalhes run={run} />}
    </li>
  );
}

export default function HistoricoDeSincronizacoes() {
  const { user } = useAuth();
  const [runs, setRuns] = useState<SyncRunDoc[] | null>(null);
  useEffect(() => {
    if (!user) return;
    const q = query(collection(getDb(), "users", user.uid, "syncRuns"), orderBy("criadaEm", "desc"), limit(50));
    return onSnapshot(q, (s) => setRuns(s.docs.map((d) => ({ ...(d.data() as object), id: d.id }) as SyncRunDoc)), () => setRuns([]));
  }, [user]);

  return (
    <div className="max-w-3xl space-y-5">
      <Link href="/colecao" className="inline-flex min-h-11 items-center gap-1 text-sm font-medium text-verde-800 hover:underline">
        <ChevronLeft className="h-4 w-4" aria-hidden="true" /> Coleção
      </Link>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-extrabold tracking-tight text-verde-950 md:text-3xl">Histórico de sincronizações</h1>
        <Link href="/colecao/sincronizar" className="btn-primario">Sincronizar</Link>
      </div>
      {runs === null ? (
        <p className="text-verde-800">Carregando…</p>
      ) : runs.length === 0 ? (
        <p className="text-verde-800">Nenhuma sincronização realizada ainda.</p>
      ) : (
        <ul className="space-y-2">{runs.map((r) => <Linha key={r.id} run={r} />)}</ul>
      )}
    </div>
  );
}
