import { NextRequest, NextResponse } from "next/server";
import { FieldValue, type Timestamp } from "firebase-admin/firestore";
import { getAdminDb } from "@/lib/firebase-admin";
import { trocarPorAccessToken } from "@/lib/discogs/autorizacao";
import { DiscogsClient } from "@/lib/discogs/cliente";
import { lerConfigDiscogs } from "@/lib/discogs/config";
import { origemDaRequisicao } from "@/lib/server/origem";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Pendente = { uid: string; secret: string; expiresAt: Timestamp };

/** Passos 3–5 do OAuth: o Discogs devolve o usuário para cá com o verifier. */
export async function GET(req: NextRequest) {
  const base = origemDaRequisicao(req);
  const voltar = (estado: string) => NextResponse.redirect(new URL(`/configuracoes?discogs=${estado}`, base));

  const token = req.nextUrl.searchParams.get("oauth_token");
  const verifier = req.nextUrl.searchParams.get("oauth_verifier");
  if (!token) return voltar("erro");

  try {
    const db = getAdminDb();
    const ref = db.collection("discogsOAuthPending").doc(token);
    const snap = await ref.get();
    if (!snap.exists) return voltar("expirado");
    const pendente = snap.data() as Pendente;
    await ref.delete(); // uso único
    if (pendente.expiresAt.toMillis() < Date.now()) return voltar("expirado");
    if (!verifier) return voltar("negado");

    const cfg = lerConfigDiscogs();
    const acesso = await trocarPorAccessToken(cfg, { token, secret: pendente.secret, verifier });
    const cliente = new DiscogsClient({
      userAgent: cfg.userAgent,
      credenciais: {
        consumerKey: cfg.consumerKey,
        consumerSecret: cfg.consumerSecret,
        token: acesso.token,
        tokenSecret: acesso.secret,
      },
    });
    const identidade = await cliente.identidade();

    const lote = db.batch();
    lote.set(db.doc(`users/${pendente.uid}/private/discogs`), {
      accessToken: acesso.token,
      accessTokenSecret: acesso.secret,
      username: identidade.username,
      discogsUserId: identidade.id,
      linkedAt: FieldValue.serverTimestamp(),
    });
    // Parte legível pelo navegador: só o nome de usuário e a data do vínculo.
    lote.set(db.doc(`users/${pendente.uid}/integrations/discogs`), {
      username: identidade.username,
      linkedAt: FieldValue.serverTimestamp(),
    });
    await lote.commit();
    return voltar("ok");
  } catch (e) {
    console.error("Falha ao concluir o vínculo com o Discogs", e);
    return voltar("erro");
  }
}
