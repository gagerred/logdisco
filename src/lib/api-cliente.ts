import type { User } from "firebase/auth";

export type RespostaApi<T> = { status: number; ok: boolean; dados: (T & { erro?: string; codigo?: string }) | null };

/** Chama uma rota da API enviando o token de login do Firebase. */
export async function chamarApi<T = Record<string, unknown>>(
  user: User,
  caminho: string,
  init: RequestInit = {},
): Promise<RespostaApi<T>> {
  const token = await user.getIdToken();
  const resposta = await fetch(caminho, {
    ...init,
    headers: { ...(init.headers ?? {}), Authorization: `Bearer ${token}` },
  });
  const dados = await resposta.json().catch(() => null);
  return { status: resposta.status, ok: resposta.ok && !!dados?.ok, dados };
}
