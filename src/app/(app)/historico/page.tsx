"use client";

import { useEffect, useMemo, useState } from "react";
import { collection, limit, onSnapshot, orderBy, query } from "firebase/firestore";
import { ListaHistorico } from "@/components/ListaHistorico";
import { useAuth } from "@/lib/auth-context";
import { getDb } from "@/lib/firebase-client";
import { filtrarHistorico, rotuloDoTipo, tiposPresentes, type EntradaHistorico } from "@/lib/historico";

const PASSO = 200;

export default function HistoricoDeAlteracoes() {
  const { user } = useAuth();
  const [limite, setLimite] = useState(PASSO);
  const [entradas, setEntradas] = useState<EntradaHistorico[] | null>(null);
  const [tipo, setTipo] = useState("todos");

  useEffect(() => {
    if (!user) return;
    const q = query(collection(getDb(), "users", user.uid, "changeLog"), orderBy("at", "desc"), limit(limite));
    return onSnapshot(q, (s) => setEntradas(s.docs.map((d) => ({ ...(d.data() as object), id: d.id }) as EntradaHistorico)), () => setEntradas([]));
  }, [user, limite]);

  const tipos = useMemo(() => tiposPresentes(entradas ?? []), [entradas]);
  const lista = useMemo(() => filtrarHistorico(entradas ?? [], tipo), [entradas, tipo]);

  return (
    <div className="max-w-3xl space-y-5">
      <div>
        <h1 className="text-2xl font-extrabold tracking-tight text-verde-950 md:text-3xl">Histórico de alterações</h1>
        <p className="text-sm text-verde-800">Inclusões, edições, remoções, sincronizações, importações e demais operações relevantes, da mais recente para a mais antiga.</p>
      </div>

      <div className="max-w-xs">
        <label htmlFor="filtro-tipo" className="campo-rotulo">Tipo de operação</label>
        <select id="filtro-tipo" className="campo" value={tipo} onChange={(e) => setTipo(e.target.value)}>
          <option value="todos">Todas</option>
          {tipos.map((t) => <option key={t} value={t}>{rotuloDoTipo(t)}</option>)}
        </select>
      </div>

      {entradas === null ? <p className="text-verde-800">Carregando…</p> : <ListaHistorico entradas={lista} />}

      {entradas !== null && entradas.length >= limite && (
        <button className="btn-contorno" onClick={() => setLimite((l) => l + PASSO)}>Carregar registros mais antigos</button>
      )}
    </div>
  );
}
