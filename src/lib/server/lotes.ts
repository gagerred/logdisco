import { getAdminDb } from "@/lib/firebase-admin";

const TAMANHO_LOTE = 400;

/** Executa gravações em lotes de até 400 operações (o limite do Firestore é 500 por lote). */
export async function gravarEmLotes<T>(itens: T[], aplicar: (lote: ReturnType<ReturnType<typeof getAdminDb>["batch"]>, item: T) => void) {
  const db = getAdminDb();
  for (let i = 0; i < itens.length; i += TAMANHO_LOTE) {
    const lote = db.batch();
    for (const item of itens.slice(i, i + TAMANHO_LOTE)) aplicar(lote, item);
    await lote.commit();
  }
}
