import type { NextRequest } from "next/server";

/** Endereço público do app (ex.: https://logdisco.vercel.app), mesmo atrás do proxy do Vercel. */
export function origemDaRequisicao(req: NextRequest): string {
  const fixo = process.env.APP_URL?.trim().replace(/\/+$/, "");
  if (fixo) return fixo;
  const host = req.headers.get("x-forwarded-host") ?? req.headers.get("host") ?? req.nextUrl.host;
  const proto = req.headers.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
  return `${proto}://${host}`;
}
