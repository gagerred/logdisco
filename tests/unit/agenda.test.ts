import { describe, expect, it } from "vitest";
import { atualizacaoPendente, fusoValido, instanteLocal, ultimaJanelaDeDomingo } from "@/lib/wantlist/agenda";

const utc = (s: string) => Date.parse(s);
const SP = "America/Sao_Paulo";

describe("instanteLocal", () => {
  it("converte o horário local de Brasília (UTC-3) para UTC", () => {
    expect(instanteLocal(SP, 2026, 11, 15, 11, 0)).toBe(utc("2026-11-15T14:00:00Z"));
  });
  it("respeita o horário de verão em outros fusos", () => {
    // Nova York: EDT (UTC-4) até 1/11/2026; depois EST (UTC-5)
    expect(instanteLocal("America/New_York", 2026, 10, 25, 11, 0)).toBe(utc("2026-10-25T15:00:00Z"));
    expect(instanteLocal("America/New_York", 2026, 11, 8, 11, 0)).toBe(utc("2026-11-08T16:00:00Z"));
    // Lisboa: UTC+0 no inverno, UTC+1 no verão
    expect(instanteLocal("Europe/Lisbon", 2026, 11, 15, 11, 0)).toBe(utc("2026-11-15T11:00:00Z"));
    expect(instanteLocal("Europe/Lisbon", 2026, 7, 5, 11, 0)).toBe(utc("2026-07-05T10:00:00Z"));
    // Tóquio não tem horário de verão (UTC+9)
    expect(instanteLocal("Asia/Tokyo", 2026, 11, 15, 11, 0)).toBe(utc("2026-11-15T02:00:00Z"));
  });
});

describe("ultimaJanelaDeDomingo", () => {
  it("no domingo às 11h (Brasília) a janela é a de hoje", () => {
    expect(ultimaJanelaDeDomingo(utc("2026-11-15T14:00:00Z"), SP)).toBe(utc("2026-11-15T14:00:00Z"));
    expect(ultimaJanelaDeDomingo(utc("2026-11-15T14:59:00Z"), SP)).toBe(utc("2026-11-15T14:00:00Z"));
  });
  it("no domingo antes das 11h ainda vale o domingo anterior", () => {
    expect(ultimaJanelaDeDomingo(utc("2026-11-15T13:59:00Z"), SP)).toBe(utc("2026-11-08T14:00:00Z"));
    expect(ultimaJanelaDeDomingo(utc("2026-11-15T02:00:00Z"), SP)).toBe(utc("2026-11-08T14:00:00Z"));
  });
  it("de segunda a sábado vale o último domingo", () => {
    expect(ultimaJanelaDeDomingo(utc("2026-11-16T14:00:00Z"), SP)).toBe(utc("2026-11-15T14:00:00Z")); // segunda
    expect(ultimaJanelaDeDomingo(utc("2026-11-21T20:00:00Z"), SP)).toBe(utc("2026-11-15T14:00:00Z")); // sábado
  });
  it("usa o dia local do usuário, e não o dia em UTC", () => {
    // 2026-11-16 01:00 UTC ainda é domingo à noite em Brasília (22:00 de 15/11)
    expect(ultimaJanelaDeDomingo(utc("2026-11-16T01:00:00Z"), SP)).toBe(utc("2026-11-15T14:00:00Z"));
    // Em Tóquio já é segunda-feira 10:00 (16/11): a janela foi o domingo 15/11 às 11h locais (02:00Z)
    expect(ultimaJanelaDeDomingo(utc("2026-11-16T01:00:00Z"), "Asia/Tokyo")).toBe(utc("2026-11-15T02:00:00Z"));
  });
  it("atravessa a mudança de horário de verão", () => {
    // Nova York: domingo 1/11/2026 11:00 já é EST (UTC-5) = 16:00Z
    expect(ultimaJanelaDeDomingo(utc("2026-11-03T12:00:00Z"), "America/New_York")).toBe(utc("2026-11-01T16:00:00Z"));
    // domingo anterior, 25/10, ainda em EDT (UTC-4) = 15:00Z
    expect(ultimaJanelaDeDomingo(utc("2026-10-28T12:00:00Z"), "America/New_York")).toBe(utc("2026-10-25T15:00:00Z"));
  });
});

describe("atualizacaoPendente", () => {
  const referenciaDaSemanaAnterior = utc("2026-11-08T14:05:00Z"); // concluída no domingo passado, 11h05
  it("domingo às 11h: pendente se a última atualização é da semana anterior", () => {
    expect(atualizacaoPendente(utc("2026-11-15T14:10:00Z"), SP, referenciaDaSemanaAnterior)).toBe(true);
  });
  it("domingo antes das 11h: ainda não é hora", () => {
    expect(atualizacaoPendente(utc("2026-11-15T13:30:00Z"), SP, referenciaDaSemanaAnterior)).toBe(false);
  });
  it("já atualizada nesta semana (inclusive manualmente): não repete", () => {
    expect(atualizacaoPendente(utc("2026-11-15T14:30:00Z"), SP, utc("2026-11-15T14:10:00Z"))).toBe(false);
    expect(atualizacaoPendente(utc("2026-11-17T14:00:00Z"), SP, utc("2026-11-15T20:00:00Z"))).toBe(false);
    expect(atualizacaoPendente(utc("2026-11-17T14:00:00Z"), SP, utc("2026-11-16T10:00:00Z"))).toBe(false); // manual na segunda
  });
  it("se o domingo falhou, a segunda-feira detecta a semana pendente", () => {
    expect(atualizacaoPendente(utc("2026-11-16T14:00:00Z"), SP, referenciaDaSemanaAnterior)).toBe(true);
    expect(atualizacaoPendente(utc("2026-11-19T14:00:00Z"), SP, referenciaDaSemanaAnterior)).toBe(true);
  });
  it("uma atualização manual feita no sábado não impede a de domingo", () => {
    expect(atualizacaoPendente(utc("2026-11-15T14:00:00Z"), SP, utc("2026-11-14T18:00:00Z"))).toBe(true);
  });
  it("quem vinculou a conta no meio da semana espera o próximo domingo", () => {
    const vinculo = utc("2026-11-11T12:00:00Z"); // quarta
    expect(atualizacaoPendente(utc("2026-11-12T14:00:00Z"), SP, vinculo)).toBe(false);
    expect(atualizacaoPendente(utc("2026-11-15T14:00:00Z"), SP, vinculo)).toBe(true);
  });
  it("sem nenhuma referência, fica pendente", () => {
    expect(atualizacaoPendente(utc("2026-11-17T14:00:00Z"), SP, null)).toBe(true);
  });
});

describe("fusoValido", () => {
  it("aceita nomes IANA e recusa o resto", () => {
    expect(fusoValido("America/Sao_Paulo")).toBe(true);
    expect(fusoValido("UTC")).toBe(true);
    expect(fusoValido("Marte/Olympus")).toBe(false);
    expect(fusoValido("")).toBe(false);
    expect(fusoValido(undefined)).toBe(false);
    expect(fusoValido(3)).toBe(false);
  });
});
