import { NextRequest, NextResponse } from "next/server";
import { verificarRequisicao } from "@/lib/server/auth";
import { contaDiscogsDoUsuario } from "@/lib/server/discogs-conta";
import { respostaDeErro } from "@/lib/server/respostas";
import { coletarColecao } from "@/lib/server/sincronizacao";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * Consulta a coleção do Discogs e monta o plano de alterações. Não altera a coleção.
 * Chame de novo com o runId devolvido enquanto a resposta for fase "coletando".
 */
export async function POST(req: NextRequest) {
  try {
    const { uid } = await verificarRequisicao(req);
    const corpo = (await req.json().catch(() => null)) as { runId?: unknown } | null;
    const runId = typeof corpo?.runId === "string" && /^[A-Za-z0-9]{1,40}$/.test(corpo.runId) ? corpo.runId : null;
    const { cliente, username } = await contaDiscogsDoUsuario(uid);
    return NextResponse.json({ ok: true, ...(await coletarColecao(uid, cliente, username, runId)) });
  } catch (e) {
    return respostaDeErro(e);
  }
}
