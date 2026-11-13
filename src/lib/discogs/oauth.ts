import { randomBytes } from "node:crypto";

/** Codificação percentual estrita (RFC 3986), exigida pelo OAuth 1.0a. */
export function codificar(valor: string): string {
  return encodeURIComponent(valor).replace(/[!'()*]/g, (c) => "%" + c.charCodeAt(0).toString(16).toUpperCase());
}

export type ParamsOAuth = {
  consumerKey: string;
  consumerSecret: string;
  token?: string;
  tokenSecret?: string;
  callback?: string;
  verifier?: string;
  nonce?: string;
  timestamp?: number;
};

/**
 * Monta o cabeçalho Authorization do OAuth 1.0a com assinatura PLAINTEXT,
 * que é o método usado pelo Discogs (sempre sobre HTTPS).
 */
export function cabecalhoOAuth(p: ParamsOAuth): string {
  const partes: [string, string][] = [["oauth_consumer_key", p.consumerKey]];
  if (p.token) partes.push(["oauth_token", p.token]);
  partes.push(
    ["oauth_nonce", p.nonce ?? randomBytes(8).toString("hex")],
    ["oauth_signature", `${codificar(p.consumerSecret)}&${codificar(p.tokenSecret ?? "")}`],
    ["oauth_signature_method", "PLAINTEXT"],
    ["oauth_timestamp", String(p.timestamp ?? Math.floor(Date.now() / 1000))],
  );
  if (p.callback) partes.push(["oauth_callback", codificar(p.callback)]);
  if (p.verifier) partes.push(["oauth_verifier", p.verifier]);
  return "OAuth " + partes.map(([k, v]) => `${k}="${v}"`).join(", ");
}

/** Lê respostas no formato "oauth_token=abc&oauth_token_secret=def". */
export function lerRespostaOAuth(texto: string): Record<string, string> {
  return Object.fromEntries(new URLSearchParams(texto.trim()));
}
