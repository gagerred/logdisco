import { NextRequest, NextResponse } from "next/server";
import { ErroConfiguracao, getAdminDb } from "@/lib/firebase-admin";
import { ErroAutenticacao, verificarRequisicao } from "@/lib/server/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Confirma que o servidor consegue validar o login e ler o Firestore. */
export async function GET(req: NextRequest) {
  try {
    const { uid, email } = await verificarRequisicao(req);
    const perfil = await getAdminDb().doc(`users/${uid}`).get();
    return NextResponse.json({ ok: true, uid, email, perfilExiste: perfil.exists });
  } catch (e) {
    if (e instanceof ErroAutenticacao) {
      return NextResponse.json({ ok: false, erro: e.message }, { status: 401 });
    }
    if (e instanceof ErroConfiguracao) {
      return NextResponse.json({ ok: false, erro: e.message }, { status: 500 });
    }
    console.error("Erro em /api/me", e);
    return NextResponse.json({ ok: false, erro: "Erro interno do servidor." }, { status: 500 });
  }
}
