import { describe, expect, it } from "vitest";
import { DiscogsClient } from "@/lib/discogs/cliente";
import { DiscogsErro } from "@/lib/discogs/erros";
import { LimitadorDeRequisicoes } from "@/lib/discogs/limitador";
import { obterRequestToken, trocarPorAccessToken, urlDeAutorizacao } from "@/lib/discogs/autorizacao";
import { releaseSimples } from "./fixtures/releases";

type Chamada = { url: string; init: RequestInit };

/** Monta um fetch falso que devolve as respostas na ordem e registra as chamadas. */
function montar(respostas: (Response | Error)[]) {
  let t = 0;
  const chamadas: Chamada[] = [];
  const esperas: number[] = [];
  const dormir = async (ms: number) => {
    esperas.push(ms);
    t += ms;
  };
  const fetchImpl = (async (url: string, init: RequestInit) => {
    chamadas.push({ url, init });
    const r = respostas.shift();
    if (!r) throw new Error("sem resposta programada");
    if (r instanceof Error) throw r;
    return r;
  }) as unknown as typeof fetch;
  const deps = {
    fetchImpl,
    dormir,
    agora: () => t,
    limitador: new LimitadorDeRequisicoes({ intervaloMs: 1000, agora: () => t, dormir }),
  };
  return { deps, chamadas, esperas };
}

const json = (corpo: unknown, status = 200, headers: Record<string, string> = {}) =>
  new Response(JSON.stringify(corpo), { status, headers: { "content-type": "application/json", ...headers } });

const credenciais = { consumerKey: "ck", consumerSecret: "cs", token: "tk", tokenSecret: "ts" };
const novoCliente = (deps: ReturnType<typeof montar>["deps"]) =>
  new DiscogsClient({ userAgent: "LogDisco/1.0", credenciais }, deps);

describe("DiscogsClient", () => {
  it("envia User-Agent, versão da API e assinatura OAuth do usuário", async () => {
    const { deps, chamadas } = montar([json(releaseSimples)]);
    const r = await novoCliente(deps).buscarRelease(249504);
    expect(r.id).toBe(249504);
    expect(chamadas[0].url).toBe("https://api.discogs.com/releases/249504");
    const h = chamadas[0].init.headers as Record<string, string>;
    expect(h["User-Agent"]).toBe("LogDisco/1.0");
    expect(h.Accept).toContain("discogs.v2");
    expect(h.Authorization).toContain('oauth_token="tk"');
    expect(h.Authorization).toContain('oauth_signature="cs&ts"');
  });

  it("converte 404 em 'não encontrado'", async () => {
    const { deps } = montar([json({ message: "Release not found." }, 404)]);
    await expect(novoCliente(deps).buscarRelease(1)).rejects.toMatchObject({ tipo: "nao_encontrado" });
  });

  it("converte 401 em erro de autenticação (vínculo inválido)", async () => {
    const { deps } = montar([json({ message: "You must authenticate" }, 401)]);
    await expect(novoCliente(deps).identidade()).rejects.toMatchObject({ tipo: "autenticacao" });
  });

  it("repete após 429 curto, respeitando o Retry-After", async () => {
    const { deps, chamadas } = montar([json({}, 429, { "retry-after": "3" }), json(releaseSimples)]);
    const r = await novoCliente(deps).buscarRelease(249504);
    expect(r.id).toBe(249504);
    expect(chamadas.length).toBe(2);
  });

  it("desiste quando o Discogs pede uma espera muito longa e informa o tempo", async () => {
    const { deps, chamadas } = montar([json({}, 429, { "retry-after": "60" })]);
    const erro = await novoCliente(deps).buscarRelease(1).catch((e) => e);
    expect(erro).toBeInstanceOf(DiscogsErro);
    expect(erro.tipo).toBe("limite");
    expect(erro.extra.retryAfterSegundos).toBe(60);
    expect(chamadas.length).toBe(1);
  });

  it("repete após erro 500 e depois conclui", async () => {
    const { deps, chamadas, esperas } = montar([json({}, 500), json(releaseSimples)]);
    await novoCliente(deps).buscarRelease(249504);
    expect(chamadas.length).toBe(2);
    expect(esperas).toContain(1000);
  });

  it("repete após falha de rede e, esgotadas as tentativas, informa indisponibilidade", async () => {
    const { deps, chamadas } = montar([new Error("rede"), new Error("rede"), new Error("rede")]);
    await expect(novoCliente(deps).buscarRelease(1)).rejects.toMatchObject({ tipo: "indisponivel" });
    expect(chamadas.length).toBe(3);
  });

  it("detecta resposta que não é JSON", async () => {
    const { deps } = montar([new Response("<html>erro</html>", { status: 200 })]);
    await expect(novoCliente(deps).buscarRelease(1)).rejects.toMatchObject({ tipo: "resposta_invalida" });
  });
});

describe("fluxo OAuth", () => {
  const cfg = { consumerKey: "ck", consumerSecret: "cs", userAgent: "LogDisco/1.0" };

  it("pede o request token com callback e lê a resposta", async () => {
    const { deps, chamadas } = montar([
      new Response("oauth_token=rt&oauth_token_secret=rs&oauth_callback_confirmed=true"),
    ]);
    const r = await obterRequestToken(cfg, "https://app.exemplo.com/api/discogs/oauth/callback", deps);
    expect(r).toEqual({ token: "rt", secret: "rs" });
    expect(chamadas[0].url).toBe("https://api.discogs.com/oauth/request_token");
    const h = (chamadas[0].init.headers as Record<string, string>).Authorization;
    expect(h).toContain("oauth_callback=");
    expect(h).toContain('oauth_signature="cs&"');
  });

  it("troca o request token pelo access token usando o verifier", async () => {
    const { deps, chamadas } = montar([new Response("oauth_token=at&oauth_token_secret=as")]);
    const r = await trocarPorAccessToken(cfg, { token: "rt", secret: "rs", verifier: "v9" }, deps);
    expect(r).toEqual({ token: "at", secret: "as" });
    expect(chamadas[0].init.method).toBe("POST");
    const h = (chamadas[0].init.headers as Record<string, string>).Authorization;
    expect(h).toContain('oauth_verifier="v9"');
    expect(h).toContain('oauth_signature="cs&rs"');
  });

  it("falha com mensagem clara quando o Discogs não devolve tokens", async () => {
    const { deps } = montar([new Response("oauth_problem=algo", { status: 200 })]);
    await expect(obterRequestToken(cfg, "https://x/cb", deps)).rejects.toMatchObject({ tipo: "resposta_invalida" });
  });

  it("converte recusa do Discogs (401) em erro de autenticação", async () => {
    const { deps } = montar([new Response("Invalid consumer.", { status: 401 })]);
    await expect(obterRequestToken(cfg, "https://x/cb", deps)).rejects.toMatchObject({ tipo: "autenticacao" });
  });

  it("monta a URL de autorização", () => {
    expect(urlDeAutorizacao("rt 1")).toBe("https://www.discogs.com/oauth/authorize?oauth_token=rt%201");
  });
});
