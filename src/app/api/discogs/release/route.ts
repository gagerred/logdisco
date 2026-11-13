import { NextRequest, NextResponse } from "next/server";
import { normalizarCodigoRelease } from "@/lib/discogs/codigo";
import { converterRelease } from "@/lib/discogs/release";
import { verificarRequisicao } from "@/lib/server/auth";
import { clienteDoUsuario } from "@/lib/server/discogs-conta";
import { respostaDeErro } from "@/lib/server/respostas";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Consulta um lançamento no Discogs e devolve os dados já convertidos (não grava nada). */
export async function GET(req: NextRequest) {
  try {
    const { uid } = await verificarRequisicao(req);
    const codigo = normalizarCodigoRelease(req.nextUrl.searchParams.get("codigo") ?? "");
    if (!codigo.ok) return NextResponse.json({ ok: false, erro: codigo.erro, codigo: "codigo_invalido" }, { status: 400 });

    const cliente = await clienteDoUsuario(uid);
    const bruto = await cliente.buscarRelease(codigo.id);
    return NextResponse.json({ ok: true, release: converterRelease(bruto) });
  } catch (e) {
    return respostaDeErro(e);
  }
}
