import { NextRequest, NextResponse } from "next/server";
import { verificarRequisicao } from "@/lib/server/auth";
import { ErroNegocio } from "@/lib/server/erros-negocio";
import { respostaDeErro } from "@/lib/server/respostas";
import { aprovarPlano } from "@/lib/server/sincronizacao";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const invalido = () => new ErroNegocio("corpo_invalido", "Seleção inválida.", 400);
const idValido = (v: unknown): v is number => typeof v === "number" && Number.isSafeInteger(v) && v > 0;

/** Registra o que o usuário aprovou na tela de conferência. */
export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { uid } = await verificarRequisicao(req);
    const { id } = await ctx.params;
    const corpo = (await req.json().catch(() => null)) as {
      adicionar?: { id?: unknown; mediaType?: unknown }[];
      remover?: unknown[];
      confirmouRemocaoEmMassa?: unknown;
    } | null;
    if (!corpo || !Array.isArray(corpo.adicionar) || !Array.isArray(corpo.remover)) throw invalido();

    const adicionar = corpo.adicionar.map((a) => {
      if (!a || !idValido(a.id)) throw invalido();
      return { id: a.id, mediaType: a.mediaType };
    });
    const remover = corpo.remover.map((r) => {
      if (!idValido(r)) throw invalido();
      return r;
    });
    const r = await aprovarPlano(uid, id, { adicionar, remover, confirmouRemocaoEmMassa: corpo.confirmouRemocaoEmMassa === true });
    return NextResponse.json({ ok: true, ...r });
  } catch (e) {
    return respostaDeErro(e);
  }
}
