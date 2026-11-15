import { getAdminDb } from "@/lib/firebase-admin";
import { DiscogsClient } from "@/lib/discogs/cliente";
import { lerConfigDiscogs } from "@/lib/discogs/config";

export class ErroSemVinculo extends Error {
  constructor() {
    super("Vincule sua conta do Discogs em Configurações para usar este recurso.");
  }
}

type DadosPrivados = { accessToken: string; accessTokenSecret: string; username: string };

/** Cria o cliente do Discogs com o OAuth guardado para o usuário (documento acessível só ao servidor). */
export async function contaDiscogsDoUsuario(uid: string): Promise<{ cliente: DiscogsClient; username: string }> {
  const cfg = lerConfigDiscogs();
  const snap = await getAdminDb().doc(`users/${uid}/private/discogs`).get();
  const d = snap.data() as DadosPrivados | undefined;
  if (!snap.exists || !d?.accessToken || !d?.accessTokenSecret || !d?.username) throw new ErroSemVinculo();
  const cliente = new DiscogsClient({
    userAgent: cfg.userAgent,
    credenciais: {
      consumerKey: cfg.consumerKey,
      consumerSecret: cfg.consumerSecret,
      token: d.accessToken,
      tokenSecret: d.accessTokenSecret,
    },
  });
  return { cliente, username: d.username };
}

export async function clienteDoUsuario(uid: string): Promise<DiscogsClient> {
  return (await contaDiscogsDoUsuario(uid)).cliente;
}
