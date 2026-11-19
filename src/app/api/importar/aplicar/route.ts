import { NextRequest, NextResponse } from "next/server";
import { verificarRequisicao } from "@/lib/server/auth";
import { aplicarAudicoes } from "@/lib/server/importacao";
import { respostaDeErro } from "@/lib/server/respostas";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

/** Importa as audições novas do arquivo. Chame de novo enquanto houver `pendentes`. */
export async function POST(req: NextRequest) {
  try {
    const { uid } = await verificarRequisicao(req);
    const corpo = (await req.json().catch(() => null)) as { csv?: unknown } | null;
    return NextResponse.json({ ok: true, ...(await aplicarAudicoes(uid, corpo?.csv)) });
  } catch (e) {
    return respostaDeErro(e);
  }
}
