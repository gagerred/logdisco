import { NextRequest, NextResponse } from "next/server";
import { FieldValue, Timestamp } from "firebase-admin/firestore";
import { getAdminDb } from "@/lib/firebase-admin";
import { obterRequestToken, urlDeAutorizacao } from "@/lib/discogs/autorizacao";
import { lerConfigDiscogs } from "@/lib/discogs/config";
import { verificarRequisicao } from "@/lib/server/auth";
import { origemDaRequisicao } from "@/lib/server/origem";
import { respostaDeErro } from "@/lib/server/respostas";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Passos 1–2 do OAuth: obtém o request token e devolve a URL de autorização do Discogs. */
export async function POST(req: NextRequest) {
  try {
    const { uid } = await verificarRequisicao(req);
    const cfg = lerConfigDiscogs();
    const callback = `${origemDaRequisicao(req)}/api/discogs/oauth/callback`;
    const rt = await obterRequestToken(cfg, callback);

    // Coleção de nível superior, sem regra de acesso: só o servidor lê e grava.
    await getAdminDb()
      .collection("discogsOAuthPending")
      .doc(rt.token)
      .set({
        uid,
        secret: rt.secret,
        createdAt: FieldValue.serverTimestamp(),
        expiresAt: Timestamp.fromMillis(Date.now() + 10 * 60 * 1000),
      });

    return NextResponse.json({ ok: true, url: urlDeAutorizacao(rt.token) });
  } catch (e) {
    return respostaDeErro(e);
  }
}
