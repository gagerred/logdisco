import { NextRequest, NextResponse } from "next/server";
import { normalizarCodigoRelease } from "@/lib/discogs/codigo";
import { converterRelease } from "@/lib/discogs/release";
import { verificarRequisicao } from "@/lib/server/auth";
import { adicionarQueroConhecer } from "@/lib/server/descobrir";
import { clienteDoUsuario } from "@/lib/server/discogs-conta";
import { respostaDeErro } from "@/lib/server/respostas";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Adiciona um álbum à lista "Quero Conhecer" a partir do código do Discogs. */
export async function POST(req: NextRequest) {
  try {
    const { uid } = await verificarRequisicao(req);
    const corpo = (await req.json().catch(() => null)) as { codigo?: unknown } | null;
    const codigo = normalizarCodigoRelease(typeof corpo?.codigo === "string" ? corpo.codigo : "");
    if (!codigo.ok) return NextResponse.json({ ok: false, erro: codigo.erro, codigo: "codigo_invalido" }, { status: 400 });

    const cliente = await clienteDoUsuario(uid);
    const release = converterRelease(await cliente.buscarRelease(codigo.id));
    return NextResponse.json({ ok: true, ...(await adicionarQueroConhecer(uid, release)) }, { status: 201 });
  } catch (e) {
    return respostaDeErro(e);
  }
}
