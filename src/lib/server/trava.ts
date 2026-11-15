import { Timestamp } from "firebase-admin/firestore";
import { getAdminDb } from "@/lib/firebase-admin";

/**
 * Trava com prazo de validade, guardada em users/{uid}/locks/{nome} (documento só do servidor).
 * Evita duas execuções simultâneas da mesma tarefa (ex.: duas abas sincronizando ao mesmo tempo).
 * Se a execução cair sem liberar, a trava expira sozinha.
 */
export async function adquirirTrava(uid: string, nome: string, ttlMs: number, agora: () => number = Date.now): Promise<boolean> {
  const db = getAdminDb();
  const ref = db.doc(`users/${uid}/locks/${nome}`);
  return db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    const atual = snap.data() as { expiraEm?: { toMillis(): number } } | undefined;
    if (snap.exists && atual?.expiraEm && atual.expiraEm.toMillis() > agora()) return false;
    tx.set(ref, { expiraEm: Timestamp.fromMillis(agora() + ttlMs), adquiridaEm: Timestamp.fromMillis(agora()) });
    return true;
  });
}

export async function liberarTrava(uid: string, nome: string): Promise<void> {
  const db = getAdminDb();
  const lote = db.batch();
  lote.delete(db.doc(`users/${uid}/locks/${nome}`));
  await lote.commit();
}
