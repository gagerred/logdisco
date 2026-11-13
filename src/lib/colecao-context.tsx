"use client";

import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { collection, onSnapshot } from "firebase/firestore";
import { useAuth } from "./auth-context";
import { getDb } from "./firebase-client";
import type { AlbumDoc, AudicaoDoc } from "./tipos";

type Contexto = {
  /** Todos os álbuns, inclusive os removidos da coleção ativa (exclusão lógica). */
  todos: AlbumDoc[];
  /** Somente a coleção ativa. */
  ativos: AlbumDoc[];
  audicoes: AudicaoDoc[];
  /** IDs dos álbuns que têm ao menos uma audição registrada. */
  idsOuvidos: Set<string>;
  carregando: boolean;
  erro: string | null;
};

const ColecaoContext = createContext<Contexto | null>(null);

/** Mantém coleção e audições sincronizadas em tempo real para todas as telas. */
export function ColecaoProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const uid = user?.uid;
  const [todos, setTodos] = useState<AlbumDoc[]>([]);
  const [audicoes, setAudicoes] = useState<AudicaoDoc[]>([]);
  const [prontoAlbuns, setProntoAlbuns] = useState(false);
  const [prontoAudicoes, setProntoAudicoes] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    if (!uid) return;
    const db = getDb();
    const falha = () => setErro("Não foi possível carregar sua coleção. Verifique a conexão e recarregue a página.");
    const sairAlbuns = onSnapshot(
      collection(db, "users", uid, "releases"),
      (snap) => {
        setTodos(snap.docs.map((d) => ({ ...(d.data() as Omit<AlbumDoc, "id">), id: d.id })));
        setProntoAlbuns(true);
      },
      falha,
    );
    const sairAudicoes = onSnapshot(
      collection(db, "users", uid, "listens"),
      (snap) => {
        setAudicoes(snap.docs.map((d) => ({ ...(d.data() as Omit<AudicaoDoc, "id">), id: d.id })));
        setProntoAudicoes(true);
      },
      falha,
    );
    return () => {
      sairAlbuns();
      sairAudicoes();
    };
  }, [uid]);

  const valor = useMemo<Contexto>(
    () => ({
      todos,
      ativos: todos.filter((a) => a.status !== "removed"),
      audicoes,
      idsOuvidos: new Set(audicoes.map((a) => a.releaseId)),
      carregando: !(prontoAlbuns && prontoAudicoes) && !erro,
      erro,
    }),
    [todos, audicoes, prontoAlbuns, prontoAudicoes, erro],
  );
  return <ColecaoContext.Provider value={valor}>{children}</ColecaoContext.Provider>;
}

export function useColecao(): Contexto {
  const ctx = useContext(ColecaoContext);
  if (!ctx) throw new Error("useColecao deve ser usado dentro de ColecaoProvider");
  return ctx;
}
