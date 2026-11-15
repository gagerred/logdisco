import { NextRequest, NextResponse } from "next/server";
import { verificarRequisicao } from "@/lib/server/auth";
import { contaDiscogsDoUsuario } from "@/lib/server/discogs-conta";
import { respostaDeErro } from "@/lib/server/respostas";
import { atualizarWantlist } from "@/lib/server/wantlist";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

/** Atualização manual da lista de desejos. Chame de novo com o runId enquanto a fase for "coletando". */
export async function POST(req: NextRequest) {
  try {
    const { uid } = await verificarRequisicao(req);
    const corpo = (await req.json().catch(() => null)) as { runId?: unknown } | null;
    const runId = typeof corpo?.runId === "string" && /^[A-Za-z0-9]{1,40}$/.test(corpo.runId) ? corpo.runId : null;
    const { cliente, username } = await contaDiscogsDoUsuario(uid);
    return NextResponse.json({ ok: true, ...(await atualizarWantlist(uid, cliente, username, { runId, origem: "manual" })) });
  } catch (e) {
    return respostaDeErro(e);
  }
}
