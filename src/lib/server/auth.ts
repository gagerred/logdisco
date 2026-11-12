import type { NextRequest } from "next/server";
import { getAdminAuth } from "@/lib/firebase-admin";

export class ErroAutenticacao extends Error {}

/** Valida o token do Firebase enviado em "Authorization: Bearer <token>". */
export async function verificarRequisicao(req: NextRequest) {
  const cabecalho = req.headers.get("authorization") ?? "";
  const token = cabecalho.startsWith("Bearer ") ? cabecalho.slice(7) : "";
  if (!token) throw new ErroAutenticacao("Token ausente.");
  // Fora do try: erro de configuração não pode ser confundido com token inválido.
  const adminAuth = getAdminAuth();
  try {
    const dec = await adminAuth.verifyIdToken(token);
    return { uid: dec.uid, email: dec.email ?? null };
  } catch {
    throw new ErroAutenticacao("Token inválido ou expirado.");
  }
}
