"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { onAuthStateChanged, type User } from "firebase/auth";
import { doc, getDoc, setDoc, serverTimestamp } from "firebase/firestore";
import { getDb, getFirebaseAuth, sairELimparCache } from "./firebase-client";

type Contexto = {
  user: User | null;
  carregando: boolean;
  sair: () => Promise<void>;
  /** Recarrega os dados do usuário (ex.: após vincular uma senha). */
  atualizar: () => Promise<void>;
};

const AuthContext = createContext<Contexto | null>(null);

export function fusoDoNavegador(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || "America/Sao_Paulo";
  } catch {
    return "America/Sao_Paulo";
  }
}

/** Cria users/{uid} no primeiro acesso, guardando apenas nome, e-mail e fuso horário. */
async function garantirPerfil(user: User) {
  const ref = doc(getDb(), "users", user.uid);
  const snap = await getDoc(ref);
  if (snap.exists()) return;
  await setDoc(
    ref,
    {
      email: user.email ?? "",
      timezone: fusoDoNavegador(),
      createdAt: serverTimestamp(),
      ...(user.displayName ? { name: user.displayName } : {}),
    },
    { merge: true },
  );
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [versao, setVersao] = useState(0);

  useEffect(() => {
    return onAuthStateChanged(getFirebaseAuth(), (u) => {
      setUser(u);
      setCarregando(false);
      if (u) garantirPerfil(u).catch((e) => console.error("Falha ao criar perfil", e));
    });
  }, []);

  const atualizar = useCallback(async () => {
    const atual = getFirebaseAuth().currentUser;
    if (atual) await atual.reload();
    setVersao((v) => v + 1);
  }, []);

  const valor = useMemo<Contexto>(
    // `versao` força novo objeto quando o usuário é recarregado
    () => ({ user, carregando, sair: sairELimparCache, atualizar }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [user, carregando, atualizar, versao],
  );

  return <AuthContext.Provider value={valor}>{children}</AuthContext.Provider>;
}

export function useAuth(): Contexto {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth deve ser usado dentro de AuthProvider");
  return ctx;
}
