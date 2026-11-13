import { DiscogsErro, erroPorStatus } from "./erros";
import { requisitar, resolverDeps, type DepsHttp } from "./http";
import { cabecalhoOAuth, lerRespostaOAuth } from "./oauth";
import { BASE_API } from "./cliente";

export type ConfigApp = { consumerKey: string; consumerSecret: string; userAgent: string };

export const URL_AUTORIZACAO = "https://www.discogs.com/oauth/authorize";

export function urlDeAutorizacao(requestToken: string): string {
  return `${URL_AUTORIZACAO}?oauth_token=${encodeURIComponent(requestToken)}`;
}

async function lerTokens(resposta: Response): Promise<{ token: string; secret: string }> {
  if (!resposta.ok) throw erroPorStatus(resposta.status);
  const dados = lerRespostaOAuth(await resposta.text());
  const token = dados.oauth_token;
  const secret = dados.oauth_token_secret;
  if (!token || !secret) {
    throw new DiscogsErro("resposta_invalida", "O Discogs não devolveu os tokens esperados.");
  }
  return { token, secret };
}

/** Passo 1 do fluxo: pede um request token informando para onde o Discogs deve voltar. */
export async function obterRequestToken(cfg: ConfigApp, callback: string, deps: Partial<DepsHttp> = {}) {
  const resposta = await requisitar(
    `${BASE_API}/oauth/request_token`,
    {
      method: "GET",
      headers: {
        "User-Agent": cfg.userAgent,
        Authorization: cabecalhoOAuth({ consumerKey: cfg.consumerKey, consumerSecret: cfg.consumerSecret, callback }),
      },
    },
    resolverDeps(deps),
  );
  return lerTokens(resposta);
}

/** Passo 4: troca o request token autorizado pelo access token definitivo do usuário. */
export async function trocarPorAccessToken(
  cfg: ConfigApp,
  req: { token: string; secret: string; verifier: string },
  deps: Partial<DepsHttp> = {},
) {
  const resposta = await requisitar(
    `${BASE_API}/oauth/access_token`,
    {
      method: "POST",
      headers: {
        "User-Agent": cfg.userAgent,
        "Content-Type": "application/x-www-form-urlencoded",
        Authorization: cabecalhoOAuth({
          consumerKey: cfg.consumerKey,
          consumerSecret: cfg.consumerSecret,
          token: req.token,
          tokenSecret: req.secret,
          verifier: req.verifier,
        }),
      },
    },
    resolverDeps(deps),
  );
  return lerTokens(resposta);
}
