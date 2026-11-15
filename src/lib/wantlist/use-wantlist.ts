"use client";

import { useEffect, useMemo, useState } from "react";
import { collection, limit, onSnapshot, orderBy, query } from "firebase/firestore";
import { useAuth } from "@/lib/auth-context";
import { getDb } from "@/lib/firebase-client";
import type { DesejoDoc, NotificacaoDoc, QueroConhecerDoc, WantlistRunDoc } from "./tipos";

const comId = <T,>(id: string, dados: unknown) => ({ ...(dados as object), id }) as T;

/** Ouve uma coleção do usuário; devolve null enquanto carrega. */
function useColecaoDoUsuario<T>(nome: string, restricao?: "runs"): T[] | null {
  const { user } = useAuth();
  const uid = user?.uid;
  const [lista, setLista] = useState<T[] | null>(null);
  useEffect(() => {
    if (!uid) return;
    const base = collection(getDb(), "users", uid, nome);
    const alvo = restricao === "runs" ? query(base, orderBy("criadaEm", "desc"), limit(10)) : base;
    return onSnapshot(alvo, (snap) => setLista(snap.docs.map((d) => comId<T>(d.id, d.data()))), () => setLista([]));
  }, [uid, nome, restricao]);
  return lista;
}

/** Lista de desejos guardada (espelho da wantlist). Quem aparece na tela depende de `desejosVisiveis`. */
export const useDesejos = () => useColecaoDoUsuario<DesejoDoc>("wantlist");
export const useQueroConhecer = () => useColecaoDoUsuario<QueroConhecerDoc>("discover");

/** As últimas execuções da atualização da lista de desejos (a mais recente primeiro). */
export function useRunsWantlist() {
  const runs = useColecaoDoUsuario<WantlistRunDoc>("wantlistRuns", "runs");
  return useMemo(() => {
    if (runs === null) return undefined;
    const ordenadas = [...runs].sort((a, b) => (b.criadaEm?.toMillis() ?? Infinity) - (a.criadaEm?.toMillis() ?? Infinity));
    return {
      ultima: ordenadas[0] ?? null,
      concluida: ordenadas.find((r) => r.status === "concluida") ?? null,
    };
  }, [runs]);
}

export function useNotificacoesNaoLidas(): NotificacaoDoc[] {
  const todas = useColecaoDoUsuario<NotificacaoDoc>("notifications");
  return useMemo(() => (todas ?? []).filter((n) => !n.lida), [todas]);
}
