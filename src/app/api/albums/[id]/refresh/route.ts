import { NextRequest, NextResponse } from "next/server";
import { converterRelease } from "@/lib/discogs/release";
import { verificarRequisicao } from "@/lib/server/auth";
import { atualizarAlbum } from "@/lib/server/colecao";
import { clienteDoUsuario } from "@/lib/server/discogs-conta";
import { ErroNegocio } from "@/lib/server/erros-negocio";
import { respostaDeErro } from "@/lib/server/respostas";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Recarrega um álbum do Discogs. Corpo: { aplicar: false } mostra a prévia; { aplicar: true } grava. */
export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { uid } = await verificarRequisicao(req);
    const { id } = await ctx.params;
    if (!/^\d{1,10}$/.test(id)) throw new ErroNegocio("codigo_invalido", "Álbum inválido.", 400);
    const corpo = (await req.json().catch(() => null)) as { aplicar?: unknown } | null;

    const cliente = await clienteDoUsuario(uid);
    const novo = converterRelease(await cliente.buscarRelease(Number(id)));
    const resultado = await atualizarAlbum(uid, id, novo, corpo?.aplicar === true);
    return NextResponse.json({ ok: true, ...resultado });
  } catch (e) {
    return respostaDeErro(e);
  }
}
