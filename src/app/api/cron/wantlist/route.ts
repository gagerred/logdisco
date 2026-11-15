import { NextRequest, NextResponse } from "next/server";
import { getAdminDb } from "@/lib/firebase-admin";
import { executarCronWantlist } from "@/lib/server/cron-wantlist";
import { contaDiscogsDoUsuario } from "@/lib/server/discogs-conta";
import { respostaDeErro } from "@/lib/server/respostas";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * Tarefa agendada (vercel.json), chamada todos os dias às 14:00 UTC (11h em Brasília).
 * Para cada usuário, só atualiza se a atualização da semana (domingo às 11h locais) estiver pendente.
 * O Vercel envia "Authorization: Bearer <CRON_SECRET>"; qualquer outra chamada é recusada.
 */
export async function GET(req: NextRequest) {
  const segredo = process.env.CRON_SECRET?.trim();
  if (!segredo) return NextResponse.json({ ok: false, erro: "CRON_SECRET não está configurado." }, { status: 500 });
  if (req.headers.get("authorization") !== `Bearer ${segredo}`) {
    return NextResponse.json({ ok: false, erro: "Não autorizado." }, { status: 401 });
  }
  try {
    const vinculos = await getAdminDb().collectionGroup("integrations").get();
    const uids = vinculos.docs.filter((d) => d.id === "discogs").map((d) => d.ref.parent.parent!.id);
    const resultado = await executarCronWantlist({ uids, contaDiscogs: contaDiscogsDoUsuario });
    return NextResponse.json({ ok: true, usuarios: resultado.length, resultado });
  } catch (e) {
    return respostaDeErro(e);
  }
}
