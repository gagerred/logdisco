import { describe, expect, it } from "vitest";
import {
  audicoesDoDia, contarPorDia, dataLocal, formatarData, formatarDataExtensa, gradeDoMes, horaLocal,
  identificarAudicao, ordenarAudicoes, ultimasAudicoes, validarDataHora,
} from "@/lib/diario/datas";
import type { AudicaoDoc } from "@/lib/tipos";
import { dupla, rick, various } from "./fixtures/albuns";

const momento = (ms: number) => ({ toMillis: () => ms, toDate: () => new Date(ms) });
const aud = (id: string, releaseId: string, date: string, time: string, criadoEm = 0): AudicaoDoc => ({
  id, releaseId, date, time, listenedAt: momento(criadoEm),
});

describe("validarDataHora", () => {
  const agora = new Date(2026, 10, 13, 15, 30); // 13/11/2026 15:30
  it("aceita datas e horários passados, e o momento atual", () => {
    expect(validarDataHora("2026-11-01", "20:00", agora).ok).toBe(true);
    expect(validarDataHora("2026-11-13", "15:30", agora).ok).toBe(true);
    expect(validarDataHora("1999-12-31", "23:59", agora).ok).toBe(true);
  });
  it("devolve a data e hora como momento local", () => {
    const r = validarDataHora("2026-11-01", "20:05", agora);
    expect(r.ok && r.listenedAt.getTime()).toBe(new Date(2026, 10, 1, 20, 5).getTime());
  });
  it("rejeita datas que não existem no calendário", () => {
    expect(validarDataHora("2026-02-30", "10:00", agora).ok).toBe(false);
    expect(validarDataHora("2026-13-01", "10:00", agora).ok).toBe(false);
    expect(validarDataHora("2026-04-31", "10:00", agora).ok).toBe(false);
  });
  it("trata anos bissextos", () => {
    expect(validarDataHora("2024-02-29", "10:00", agora).ok).toBe(true);
    expect(validarDataHora("2025-02-29", "10:00", agora).ok).toBe(false);
  });
  it("rejeita horário inválido ou campos vazios", () => {
    expect(validarDataHora("2026-11-01", "24:00", agora).ok).toBe(false);
    expect(validarDataHora("2026-11-01", "10:60", agora).ok).toBe(false);
    expect(validarDataHora("", "10:00", agora).ok).toBe(false);
    expect(validarDataHora("2026-11-01", "", agora).ok).toBe(false);
    expect(validarDataHora("0001-01-01", "10:00", agora).ok).toBe(false);
  });
  it("rejeita momentos no futuro, inclusive hoje mais tarde", () => {
    expect(validarDataHora("2026-11-14", "00:00", agora).ok).toBe(false);
    const r = validarDataHora("2026-11-13", "15:31", agora);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.erro).toMatch(/futuro/);
  });
});

describe("formatação", () => {
  it("formata data e hora locais", () => {
    expect(dataLocal(new Date(2026, 0, 5))).toBe("2026-01-05");
    expect(horaLocal(new Date(2026, 0, 5, 7, 4))).toBe("07:04");
    expect(formatarData("2026-11-13")).toBe("13/11/2026");
    expect(formatarDataExtensa("2026-03-01")).toBe("1 de março de 2026");
  });
});

describe("ordem das audições", () => {
  // O registro mais antigo foi cadastrado por último: a ordem de cadastro não pode valer.
  const lista = [
    aud("a", "249504", "2026-11-05", "09:30", 3000),
    aud("b", "555", "2026-11-12", "21:00", 1000),
    aud("c", "777", "2026-11-12", "08:00", 2000),
    aud("d", "249504", "2025-01-01", "23:59", 4000),
    aud("e", "555", "2026-11-12", "21:00", 500),
    aud("f", "777", "2026-10-31", "10:00", 5000),
  ];
  it("ordena pela data e horário da audição, não pelo cadastro", () => {
    expect(ordenarAudicoes(lista).map((a) => a.id)).toEqual(["e", "b", "c", "a", "f", "d"]);
  });
  it("as últimas 5 são as 5 mais recentes pela data efetiva", () => {
    const ult = ultimasAudicoes(lista, 5);
    expect(ult).toHaveLength(5);
    expect(ult.map((a) => a.id)).not.toContain("d");
    expect(ult[0].date + ult[0].time >= ult[4].date + ult[4].time).toBe(true);
  });
  it("não altera a lista original", () => {
    const copia = [...lista];
    ordenarAudicoes(lista);
    expect(lista).toEqual(copia);
  });
});

describe("calendário", () => {
  it("lista as audições de um dia na ordem do dia", () => {
    const l = [aud("1", "a", "2026-11-12", "21:00"), aud("2", "b", "2026-11-12", "08:00"), aud("3", "c", "2026-11-13", "10:00")];
    expect(audicoesDoDia(l, "2026-11-12").map((a) => a.id)).toEqual(["2", "1"]);
    expect(audicoesDoDia(l, "2026-11-20")).toEqual([]);
  });
  it("conta audições por dia", () => {
    const m = contarPorDia([aud("1", "a", "2026-11-12", "21:00"), aud("2", "b", "2026-11-12", "08:00"), aud("3", "c", "2026-11-13", "10:00")]);
    expect(m.get("2026-11-12")).toBe(2);
    expect(m.get("2026-11-13")).toBe(1);
    expect(m.get("2026-11-14")).toBeUndefined();
  });
  it("monta novembro de 2026 (começa no domingo, 30 dias)", () => {
    const g = gradeDoMes(2026, 11);
    expect(g).toHaveLength(5);
    expect(g.every((s) => s.length === 7)).toBe(true);
    expect(g[0][0]).toBe("2026-11-01");
    expect(g[4][1]).toBe("2026-11-30");
    expect(g[4][2]).toBeNull();
  });
  it("monta meses que começam no meio da semana e fevereiro bissexto", () => {
    const g = gradeDoMes(2026, 8); // 1/8/2026 é sábado
    expect(g[0].slice(0, 6).every((c) => c === null)).toBe(true);
    expect(g[0][6]).toBe("2026-08-01");
    expect(g.flat().filter(Boolean)).toHaveLength(31);
    expect(gradeDoMes(2028, 2).flat().filter(Boolean)).toHaveLength(29);
    expect(gradeDoMes(2026, 2).flat().filter(Boolean)).toHaveLength(28);
  });
});

describe("identificarAudicao", () => {
  const albuns = new Map([rick(), various()].map((a) => [a.id, a]));
  it("usa o álbum da coleção, com o título exibido", () => {
    const i = identificarAudicao(aud("1", "249504", "2026-11-01", "10:00"), albuns);
    expect(i).toMatchObject({ titulo: "Never Gonna Give You Up", artista: "Rick Astley", removido: false });
  });
  it("marca como removido um álbum que saiu da coleção, mantendo a identificação", () => {
    const removido = new Map([["777", { ...dupla(), status: "removed" as const }]]);
    const i = identificarAudicao(aud("1", "777", "2026-11-01", "10:00"), removido);
    expect(i.removido).toBe(true);
    expect(i.titulo).toBe("Ao Vivo (Remasterizado)");
  });
  it("cai no snapshot quando o registro do álbum não existe mais", () => {
    const a = { ...aud("1", "999", "2026-11-01", "10:00"), snapshot: { artistName: "Banda", title: "Disco Antigo", thumb: null, mediaType: "CD" } };
    expect(identificarAudicao(a, albuns)).toMatchObject({ album: null, titulo: "Disco Antigo", artista: "Banda", removido: true });
    expect(identificarAudicao(aud("2", "999", "2026-11-01", "10:00"), albuns).titulo).toBe("Álbum desconhecido");
  });
});
