import { ErroConfiguracao } from "@/lib/firebase-admin";
import type { ConfigApp } from "./autorizacao";

/** Lê as credenciais do app Discogs. Só pode ser usado no servidor. */
export function lerConfigDiscogs(): ConfigApp {
  const consumerKey = process.env.DISCOGS_CONSUMER_KEY;
  const consumerSecret = process.env.DISCOGS_CONSUMER_SECRET;
  const faltando = [
    !consumerKey && "DISCOGS_CONSUMER_KEY",
    !consumerSecret && "DISCOGS_CONSUMER_SECRET",
  ].filter(Boolean);
  if (faltando.length) throw new ErroConfiguracao(`Variáveis de ambiente ausentes: ${faltando.join(", ")}`);
  return {
    consumerKey: consumerKey!.trim(),
    consumerSecret: consumerSecret!.trim(),
    userAgent: (process.env.DISCOGS_USER_AGENT || "LogDisco/1.0").replace(/^"|"$/g, "").trim(),
  };
}
