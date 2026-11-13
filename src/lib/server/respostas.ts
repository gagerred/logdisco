import { NextResponse } from "next/server";
import { ErroConfiguracao } from "@/lib/firebase-admin";
import { DiscogsErro, type TipoErroDiscogs } from "@/lib/discogs/erros";
import { ErroAutenticacao } from "./auth";
import { ErroSemVinculo } from "./discogs-conta";

const STATUS_DISCOGS: Record<TipoErroDiscogs, number> = {
  nao_encontrado: 404,
  limite: 429,
  autenticacao: 409, // 401 já significa "não logado no LogDisco"
  indisponivel: 502,
  resposta_invalida: 502,
  requisicao_invalida: 400,
};

/** Traduz erros conhecidos em respostas JSON com mensagem em português. */
export function respostaDeErro(e: unknown): NextResponse {
  if (e instanceof ErroAutenticacao) return NextResponse.json({ ok: false, erro: e.message }, { status: 401 });
  if (e instanceof ErroSemVinculo) return NextResponse.json({ ok: false, erro: e.message, codigo: "sem_vinculo" }, { status: 409 });
  if (e instanceof ErroConfiguracao) return NextResponse.json({ ok: false, erro: e.message }, { status: 500 });
  if (e instanceof DiscogsErro) {
    const corpo: Record<string, unknown> = { ok: false, erro: e.message, codigo: e.tipo };
    if (e.extra.retryAfterSegundos) corpo.retryAfterSegundos = e.extra.retryAfterSegundos;
    return NextResponse.json(corpo, { status: STATUS_DISCOGS[e.tipo] });
  }
  console.error("Erro inesperado na API", e);
  return NextResponse.json({ ok: false, erro: "Erro interno do servidor." }, { status: 500 });
}
