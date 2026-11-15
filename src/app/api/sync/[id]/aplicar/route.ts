import { NextRequest, NextResponse } from "next/server";
import { verificarRequisicao } from "@/lib/server/auth";
import { clienteDoUsuario } from "@/lib/server/discogs-conta";
import { respostaDeErro } from "@/lib/server/respostas";
import { aplicarLote } from "@/lib/server/sincronizacao";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

/** Aplica as alterações aprovadas, em partes. Chame de novo enquanto a resposta for fase "aplicando". */
export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { uid } = await verificarRequisicao(req);
    const { id } = await ctx.params;
    const cliente = await clienteDoUsuario(uid);
    return NextResponse.json({ ok: true, ...(await aplicarLote(uid, id, cliente)) });
  } catch (e) {
    return respostaDeErro(e);
  }
}
