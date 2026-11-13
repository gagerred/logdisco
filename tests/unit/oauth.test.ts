import { describe, expect, it } from "vitest";
import { cabecalhoOAuth, codificar, lerRespostaOAuth } from "@/lib/discogs/oauth";

describe("cabecalhoOAuth", () => {
  const base = { consumerKey: "ck", consumerSecret: "cs", nonce: "n1", timestamp: 1700000000 };

  it("assina o pedido de request token só com o segredo do app", () => {
    const h = cabecalhoOAuth({ ...base, callback: "http://localhost:3000/api/discogs/oauth/callback" });
    expect(h.startsWith("OAuth ")).toBe(true);
    expect(h).toContain('oauth_consumer_key="ck"');
    expect(h).toContain('oauth_signature="cs&"');
    expect(h).toContain('oauth_signature_method="PLAINTEXT"');
    expect(h).toContain('oauth_timestamp="1700000000"');
    expect(h).toContain('oauth_callback="http%3A%2F%2Flocalhost%3A3000%2Fapi%2Fdiscogs%2Foauth%2Fcallback"');
    expect(h).not.toContain("oauth_token=");
  });

  it("inclui token e os dois segredos nas chamadas autenticadas", () => {
    const h = cabecalhoOAuth({ ...base, token: "tk", tokenSecret: "ts" });
    expect(h).toContain('oauth_token="tk"');
    expect(h).toContain('oauth_signature="cs&ts"');
  });

  it("inclui o verifier na troca pelo access token", () => {
    const h = cabecalhoOAuth({ ...base, token: "rt", tokenSecret: "rs", verifier: "v123" });
    expect(h).toContain('oauth_verifier="v123"');
    expect(h).toContain('oauth_signature="cs&rs"');
  });

  it("gera um nonce diferente a cada chamada quando não informado", () => {
    const a = cabecalhoOAuth({ consumerKey: "ck", consumerSecret: "cs" });
    const b = cabecalhoOAuth({ consumerKey: "ck", consumerSecret: "cs" });
    expect(a).not.toBe(b);
  });
});

describe("auxiliares", () => {
  it("codifica caracteres reservados do OAuth", () => {
    expect(codificar("a b&c!*'()")).toBe("a%20b%26c%21%2A%27%28%29");
  });
  it("lê a resposta dos endpoints de token", () => {
    expect(lerRespostaOAuth("oauth_token=abc&oauth_token_secret=d%2Fe&oauth_callback_confirmed=true\n")).toEqual({
      oauth_token: "abc",
      oauth_token_secret: "d/e",
      oauth_callback_confirmed: "true",
    });
  });
});
