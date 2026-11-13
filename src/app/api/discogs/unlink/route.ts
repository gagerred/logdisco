import { NextRequest, NextResponse } from "next/server";
import { getAdminDb } from "@/lib/firebase-admin";
import { verificarRequisicao } from "@/lib/server/auth";
import { respostaDeErro } from "@/lib/server/respostas";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Remove o vínculo. Coleção, audições e demais dados do usuário não são tocados. */
export async function POST(req: NextRequest) {
  try {
    const { uid } = await verificarRequisicao(req);
    const db = getAdminDb();
    const lote = db.batch();
    lote.delete(db.doc(`users/${uid}/private/discogs`));
    lote.delete(db.doc(`users/${uid}/integrations/discogs`));
    await lote.commit();
    return NextResponse.json({ ok: true });
  } catch (e) {
    return respostaDeErro(e);
  }
}
