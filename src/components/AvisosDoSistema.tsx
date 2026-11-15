"use client";

import { doc, updateDoc } from "firebase/firestore";
import { AlertTriangle } from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { getDb } from "@/lib/firebase-client";
import { useNotificacoesNaoLidas } from "@/lib/wantlist/use-wantlist";

/** Avisos do sistema, como a falha da atualização automática da lista de desejos. */
export function AvisosDoSistema() {
  const { user } = useAuth();
  const avisos = useNotificacoesNaoLidas();
  if (!user || avisos.length === 0) return null;

  const dispensar = (id: string) => updateDoc(doc(getDb(), "users", user.uid, "notifications", id), { lida: true }).catch(() => undefined);
  return (
    <div className="space-y-2" role="region" aria-label="Avisos">
      {avisos.map((a) => (
        <div key={a.id} role="alert" className="aviso-erro flex items-start gap-3">
          <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0" aria-hidden="true" />
          <p className="min-w-0 flex-1 break-words">{a.mensagem}</p>
          <button onClick={() => dispensar(a.id)} className="min-h-11 shrink-0 px-2 text-sm font-semibold underline underline-offset-2">Dispensar</button>
        </div>
      ))}
    </div>
  );
}
