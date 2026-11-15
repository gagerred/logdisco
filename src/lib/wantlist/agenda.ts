/**
 * Agenda da atualização automática: todo domingo às 11h, no horário local do usuário.
 * No plano Hobby do Vercel o gatilho roda uma vez por dia; estas funções decidem, por usuário,
 * se a atualização da semana já foi feita ou ainda está pendente (inclusive nos dias seguintes
 * a um domingo em que a execução falhou).
 */

const DIAS: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };

function partesNoFuso(instanteMs: number, fuso: string) {
  const f = new Intl.DateTimeFormat("en-US", {
    timeZone: fuso, hourCycle: "h23", weekday: "short",
    year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit",
  });
  const p = Object.fromEntries(f.formatToParts(new Date(instanteMs)).map((x) => [x.type, x.value]));
  return { ano: +p.year, mes: +p.month, dia: +p.day, hora: +p.hour, min: +p.minute, seg: +p.second, diaSemana: DIAS[p.weekday] };
}

/** Diferença, em ms, entre o horário local do fuso e UTC naquele instante. */
function deslocamentoMs(fuso: string, instanteMs: number): number {
  const p = partesNoFuso(instanteMs, fuso);
  return Date.UTC(p.ano, p.mes - 1, p.dia, p.hora, p.min, p.seg) - Math.floor(instanteMs / 1000) * 1000;
}

/** Instante (UTC, em ms) em que o relógio do fuso marca a data e a hora informadas. */
export function instanteLocal(fuso: string, ano: number, mes: number, dia: number, hora: number, min = 0): number {
  const ingenuo = Date.UTC(ano, mes - 1, dia, hora, min);
  let t = ingenuo - deslocamentoMs(fuso, ingenuo);
  t = ingenuo - deslocamentoMs(fuso, t); // segunda passada: cobre a mudança de horário de verão
  return t;
}

export function fusoValido(fuso: unknown): fuso is string {
  if (typeof fuso !== "string" || !fuso) return false;
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: fuso });
    return true;
  } catch {
    return false;
  }
}

export const FUSO_PADRAO = "America/Sao_Paulo";

/** O domingo às 11h (horário local) mais recente que já passou. */
export function ultimaJanelaDeDomingo(agoraMs: number, fuso: string, hora = 11): number {
  const p = partesNoFuso(agoraMs, fuso);
  const recuar = p.diaSemana === 0 && p.hora < hora ? 7 : p.diaSemana;
  const d = new Date(Date.UTC(p.ano, p.mes - 1, p.dia) - recuar * 86_400_000);
  return instanteLocal(fuso, d.getUTCFullYear(), d.getUTCMonth() + 1, d.getUTCDate(), hora, 0);
}

/**
 * A atualização da semana está pendente quando nada foi concluído desde o último domingo às 11h.
 * `referenciaMs` é a última atualização concluída (manual ou automática) ou, se nunca houve, a data do vínculo.
 */
export function atualizacaoPendente(agoraMs: number, fuso: string, referenciaMs: number | null): boolean {
  return (referenciaMs ?? 0) < ultimaJanelaDeDomingo(agoraMs, fuso);
}
