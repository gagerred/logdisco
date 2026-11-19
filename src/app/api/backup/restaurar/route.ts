import { NextRequest, NextResponse } from "next/server";
import { verificarRequisicao } from "@/lib/server/auth";
import { restaurarLote } from "@/lib/server/backup";
import { respostaDeErro } from "@/lib/server/respostas";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

/** Restaura uma parte da cópia de segurança (só adiciona; nunca sobrescreve o que já existe). */
export async function POST(req: NextRequest) {
  try {
    const { uid } = await verificarRequisicao(req);
    const corpo = (await req.json().catch(() => null)) as { colecao?: unknown; itens?: unknown } | null;
    return NextResponse.json({ ok: true, ...(await restaurarLote(uid, corpo?.colecao, corpo?.itens)) });
  } catch (e) {
    return respostaDeErro(e);
  }
}
