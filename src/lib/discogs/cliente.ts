import { DiscogsErro, erroPorStatus } from "./erros";
import { requisitar, resolverDeps, type DepsHttp } from "./http";
import { cabecalhoOAuth } from "./oauth";
import type { ReleaseBruto } from "./release";

export const BASE_API = "https://api.discogs.com";

export type CredenciaisOAuth = {
  consumerKey: string;
  consumerSecret: string;
  token: string;
  tokenSecret: string;
};

/** Cliente da API do Discogs autenticado com o OAuth de um usuário. */
export class DiscogsClient {
  private deps: DepsHttp;

  constructor(
    private config: { userAgent: string; credenciais: CredenciaisOAuth },
    deps: Partial<DepsHttp> = {},
  ) {
    this.deps = resolverDeps(deps);
  }

  private cabecalhos(): HeadersInit {
    const c = this.config.credenciais;
    return {
      "User-Agent": this.config.userAgent,
      Accept: "application/vnd.discogs.v2.discogs+json",
      Authorization: cabecalhoOAuth({
        consumerKey: c.consumerKey,
        consumerSecret: c.consumerSecret,
        token: c.token,
        tokenSecret: c.tokenSecret,
      }),
    };
  }

  async get<T>(caminho: string): Promise<T> {
    const resposta = await requisitar(`${BASE_API}${caminho}`, { headers: this.cabecalhos() }, this.deps);
    if (!resposta.ok) throw erroPorStatus(resposta.status);
    try {
      return (await resposta.json()) as T;
    } catch {
      throw new DiscogsErro("resposta_invalida", "O Discogs devolveu uma resposta que não pôde ser lida.");
    }
  }

  buscarRelease(id: number): Promise<ReleaseBruto> {
    return this.get<ReleaseBruto>(`/releases/${id}`);
  }

  identidade(): Promise<{ id: number; username: string }> {
    return this.get<{ id: number; username: string }>("/oauth/identity");
  }
}
