import { NextRequest, NextResponse } from "next/server";
import { verificarRequisicao } from "@/lib/server/auth";
import { verificarAudicoes } from "@/lib/server/importacao";
import { respostaDeErro } from "@/lib/server/respostas";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Prévia da importação de audições: confere o arquivo e mostra o que seria importado. Não grava nada. */
export async function POST(req: NextRequest) {
  try {
    const { uid } = await verificarRequisicao(req);
    const corpo = (await req.json().catch(() => null)) as { csv?: unknown } | null;
    return NextResponse.json({ ok: true, previa: await verificarAudicoes(uid, corpo?.csv) });
  } catch (e) {
    return respostaDeErro(e);
  }
}
