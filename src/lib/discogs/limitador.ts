export type Dormir = (ms: number) => Promise<void>;

const dormirDeVerdade: Dormir = (ms) => new Promise((r) => setTimeout(r, ms));

/**
 * Fila que espaça o início das requisições ao Discogs (limite de 60 por minuto
 * com autenticação). As requisições são executadas uma de cada vez.
 */
export class LimitadorDeRequisicoes {
  private proximoInicio = 0;
  private fila: Promise<unknown> = Promise.resolve();
  private readonly intervaloMs: number;
  private readonly agora: () => number;
  private readonly dormir: Dormir;

  constructor(opcoes: { intervaloMs?: number; agora?: () => number; dormir?: Dormir } = {}) {
    this.intervaloMs = opcoes.intervaloMs ?? 1100;
    this.agora = opcoes.agora ?? Date.now;
    this.dormir = opcoes.dormir ?? dormirDeVerdade;
  }

  agendar<T>(tarefa: () => Promise<T>): Promise<T> {
    const executar = async () => {
      const espera = this.proximoInicio - this.agora();
      if (espera > 0) await this.dormir(espera);
      this.proximoInicio = Math.max(this.agora(), this.proximoInicio) + this.intervaloMs;
      return tarefa();
    };
    const resultado = this.fila.then(executar, executar);
    this.fila = resultado.catch(() => undefined);
    return resultado;
  }

  /** Adia o início da próxima requisição (usado após um 429 do Discogs). */
  pausarAte(instanteMs: number): void {
    this.proximoInicio = Math.max(this.proximoInicio, instanteMs);
  }
}

/** Compartilhado por todas as requisições feitas pela mesma instância do servidor. */
export const limitadorGlobal = new LimitadorDeRequisicoes();
