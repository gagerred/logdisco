"use client";

import { useEffect, useState } from "react";
import { collection, doc, limit, onSnapshot, orderBy, query, where } from "firebase/firestore";
import { useAuth } from "@/lib/auth-context";
import { getDb } from "@/lib/firebase-client";
import type { Momento } from "@/lib/tipos";
import { STATUS_EM_ANDAMENTO, type SyncItemDoc, type SyncRunDoc } from "./tipos";

type Estado<T> = T | null | undefined; // undefined = carregando

const comId = <T,>(id: string, dados: unknown) => ({ ...(dados as object), id }) as T;

/** Data e hora de um registro do Firestore, no formato brasileiro. */
export function formatarMomento(m: Momento | null | undefined): string {
  if (!m) return "—";
  return m.toDate().toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

/** A última sincronização efetivamente aplicada (concluída, com ou sem erros). */
export function useUltimaSincronizacao(): Estado<SyncRunDoc> {
  const { user } = useAuth();
  const uid = user?.uid;
  const [run, setRun] = useState<Estado<SyncRunDoc>>(undefined);
  useEffect(() => {
    if (!uid) return;
    const q = query(collection(getDb(), "users", uid, "syncRuns"), orderBy("concluidaEm", "desc"), limit(1));
    return onSnapshot(q, (snap) => setRun(snap.docs[0] ? comId<SyncRunDoc>(snap.docs[0].id, snap.docs[0].data()) : null), () => setRun(null));
  }, [uid]);
  return run;
}

/** Verificação ou sincronização que ainda não terminou (para retomar depois de fechar a página). */
export function useSyncEmAndamento(): Estado<SyncRunDoc> {
  const { user } = useAuth();
  const uid = user?.uid;
  const [run, setRun] = useState<Estado<SyncRunDoc>>(undefined);
  useEffect(() => {
    if (!uid) return;
    const q = query(collection(getDb(), "users", uid, "syncRuns"), where("status", "in", STATUS_EM_ANDAMENTO));
    return onSnapshot(
      q,
      (snap) => {
        const runs = snap.docs.map((d) => comId<SyncRunDoc>(d.id, d.data()));
        runs.sort((a, b) => (b.criadaEm?.toMillis() ?? Infinity) - (a.criadaEm?.toMillis() ?? Infinity));
        setRun(runs[0] ?? null);
      },
      () => setRun(null),
    );
  }, [uid]);
  return run;
}

export function useRun(runId: string | null): Estado<SyncRunDoc> {
  const { user } = useAuth();
  const uid = user?.uid;
  const [run, setRun] = useState<Estado<SyncRunDoc>>(undefined);
  useEffect(() => {
    if (!uid || !runId) {
      setRun(runId ? undefined : null);
      return;
    }
    return onSnapshot(doc(getDb(), "users", uid, "syncRuns", runId), (snap) => setRun(snap.exists() ? comId<SyncRunDoc>(snap.id, snap.data()) : null), () => setRun(null));
  }, [uid, runId]);
  return run;
}

export function useItensSync(runId: string | null): SyncItemDoc[] | null {
  const { user } = useAuth();
  const uid = user?.uid;
  const [itens, setItens] = useState<SyncItemDoc[] | null>(null);
  useEffect(() => {
    setItens(null);
    if (!uid || !runId) return;
    return onSnapshot(
      collection(getDb(), "users", uid, "syncRuns", runId, "items"),
      (snap) => setItens(snap.docs.map((d) => comId<SyncItemDoc>(d.id, d.data()))),
      () => setItens([]),
    );
  }, [uid, runId]);
  return itens;
}
