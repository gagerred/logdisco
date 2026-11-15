import { NextRequest, NextResponse } from "next/server";
import { verificarRequisicao } from "@/lib/server/auth";
import { respostaDeErro } from "@/lib/server/respostas";
import { cancelarSync } from "@/lib/server/sincronizacao";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Descarta uma verificação que ainda não foi aprovada. Nada é alterado na coleção. */
export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { uid } = await verificarRequisicao(req);
    const { id } = await ctx.params;
    await cancelarSync(uid, id);
    return NextResponse.json({ ok: true });
  } catch (e) {
    return respostaDeErro(e);
  }
}
