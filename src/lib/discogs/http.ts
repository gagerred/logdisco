import { DiscogsErro } from "./erros";
import { limitadorGlobal, type Dormir, type LimitadorDeRequisicoes } from "./limitador";

export type DepsHttp = {
  fetchImpl: typeof fetch;
  limitador: LimitadorDeRequisicoes;
  dormir: Dormir;
  agora: () => number;
  /** Maior espera aceita após um 429 antes de desistir e avisar o usuário. */
  maxEsperaMs: number;
  maxTentativas: number;
  timeoutMs: number;
};

export function resolverDeps(parcial: Partial<DepsHttp> = {}): DepsHttp {
  return {
    fetchImpl: parcial.fetchImpl ?? fetch,
    limitador: parcial.limitador ?? limitadorGlobal,
    dormir: parcial.dormir ?? ((ms) => new Promise((r) => setTimeout(r, ms))),
    agora: parcial.agora ?? Date.now,
    maxEsperaMs: parcial.maxEsperaMs ?? 10_000,
    maxTentativas: parcial.maxTentativas ?? 3,
    timeoutMs: parcial.timeoutMs ?? 15_000,
  };
}

function segundosDe(valor: string | null): number | null {
  if (!valor) return null;
  const n = Number(valor);
  return Number.isFinite(n) && n >= 0 ? Math.ceil(n) : null;
}

/**
 * Faz uma requisição respeitando o limite do Discogs: passa pela fila,
 * repete em caso de falha de rede ou erro 5xx e trata o 429 (Retry-After).
 */
export async function requisitar(url: string, init: RequestInit, deps: DepsHttp): Promise<Response> {
  for (let tentativa = 0; tentativa < deps.maxTentativas; tentativa++) {
    const ultima = tentativa === deps.maxTentativas - 1;
    let resposta: Response;
    try {
      resposta = await deps.limitador.agendar(() =>
        deps.fetchImpl(url, { ...init, signal: AbortSignal.timeout(deps.timeoutMs) }),
      );
    } catch {
      if (ultima) {
        throw new DiscogsErro("indisponivel", "Não foi possível se conectar ao Discogs. Tente novamente em instantes.");
      }
      await deps.dormir(1000 * 2 ** tentativa);
      continue;
    }

    if (resposta.status === 429) {
      const espera = segundosDe(resposta.headers.get("retry-after")) ?? 60;
      deps.limitador.pausarAte(deps.agora() + espera * 1000);
      if (espera * 1000 > deps.maxEsperaMs || ultima) {
        throw new DiscogsErro(
          "limite",
          `O Discogs limitou as requisições. Tente de novo em cerca de ${espera} segundos.`,
          { status: 429, retryAfterSegundos: espera },
        );
      }
      continue; // o limitador aguarda o intervalo antes da nova tentativa
    }

    if (resposta.status >= 500 && !ultima) {
      await deps.dormir(1000 * 2 ** tentativa);
      continue;
    }
    return resposta;
  }
  throw new DiscogsErro("indisponivel", "O Discogs está indisponível no momento. Tente novamente em instantes.");
}
