import { describe, expect, it } from "vitest";
import { LimitadorDeRequisicoes } from "@/lib/discogs/limitador";

function relogioFalso() {
  let t = 1_000_000;
  const esperas: number[] = [];
  return {
    agora: () => t,
    dormir: async (ms: number) => {
      esperas.push(ms);
      t += ms;
    },
    esperas,
    inicios: [] as number[],
  };
}

describe("LimitadorDeRequisicoes", () => {
  it("espaça o início das requisições pelo intervalo configurado", async () => {
    const r = relogioFalso();
    const lim = new LimitadorDeRequisicoes({ intervaloMs: 1000, agora: r.agora, dormir: r.dormir });
    await Promise.all([1, 2, 3, 4].map(() => lim.agendar(async () => r.inicios.push(r.agora()))));
    expect(r.inicios.length).toBe(4);
    for (let i = 1; i < r.inicios.length; i++) expect(r.inicios[i] - r.inicios[i - 1]).toBeGreaterThanOrEqual(1000);
  });

  it("não deixa mais de 60 requisições começarem em um minuto no ritmo padrão", async () => {
    const r = relogioFalso();
    const lim = new LimitadorDeRequisicoes({ agora: r.agora, dormir: r.dormir }); // 1100 ms
    await Promise.all(Array.from({ length: 30 }, () => lim.agendar(async () => r.inicios.push(r.agora()))));
    const janela = r.inicios.filter((i) => i < r.inicios[0] + 60_000).length;
    expect(janela).toBeLessThanOrEqual(55);
  });

  it("mantém a ordem de chegada e continua depois de uma tarefa que falha", async () => {
    const r = relogioFalso();
    const lim = new LimitadorDeRequisicoes({ intervaloMs: 10, agora: r.agora, dormir: r.dormir });
    const ordem: number[] = [];
    const a = lim.agendar(async () => ordem.push(1));
    const b = lim.agendar(async () => {
      ordem.push(2);
      throw new Error("falhou");
    });
    const c = lim.agendar(async () => ordem.push(3));
    await a;
    await expect(b).rejects.toThrow("falhou");
    await c;
    expect(ordem).toEqual([1, 2, 3]);
  });

  it("pausarAte adia a próxima requisição", async () => {
    const r = relogioFalso();
    const lim = new LimitadorDeRequisicoes({ intervaloMs: 10, agora: r.agora, dormir: r.dormir });
    const inicio = r.agora();
    lim.pausarAte(inicio + 5000);
    await lim.agendar(async () => undefined);
    expect(r.agora() - inicio).toBeGreaterThanOrEqual(5000);
  });
});
