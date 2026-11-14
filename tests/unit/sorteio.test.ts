import { describe, expect, it } from "vitest";
import { candidatosDoSorteio, sortear } from "@/lib/diario/sorteio";
import { albumDe, dupla, rick, various } from "./fixtures/albuns";
import { releaseSimples } from "./fixtures/releases";

// rick = Vinyl (ouvido), various = CD (nunca ouvido), dupla = CD/DVD (nunca ouvido)
const cd2 = () => albumDe({ ...releaseSimples, id: 888, title: "Outro CD", formats: [{ name: "CD", qty: "1" }] });
const colecao = () => [rick(), various(), dupla(), cd2()];
const ouvidos = new Set(["249504"]);
const ids = (l: { id: string }[]) => l.map((a) => a.id).sort();

describe("candidatos do sorteio", () => {
  it("sem filtro, vale toda a coleção ativa", () => {
    expect(ids(candidatosDoSorteio(colecao(), ouvidos, { historico: null, midia: null }))).toEqual(["249504", "555", "777", "888"]);
  });
  it("'Todos os discos' (grupo A) inclui os já ouvidos", () => {
    expect(candidatosDoSorteio(colecao(), ouvidos, { historico: "todos", midia: null })).toHaveLength(4);
  });
  it("'Somente nunca ouvidos' exclui os que têm audição", () => {
    expect(ids(candidatosDoSorteio(colecao(), ouvidos, { historico: "nunca", midia: null }))).toEqual(["555", "777", "888"]);
  });
  it("filtra por mídia: só CD e só Vinyl (CD/DVD não entra em 'só CD')", () => {
    expect(ids(candidatosDoSorteio(colecao(), ouvidos, { historico: null, midia: "CD" }))).toEqual(["555", "888"]);
    expect(ids(candidatosDoSorteio(colecao(), ouvidos, { historico: null, midia: "Vinyl" }))).toEqual(["249504"]);
  });
  it("combina um filtro de cada grupo", () => {
    expect(ids(candidatosDoSorteio(colecao(), ouvidos, { historico: "nunca", midia: "CD" }))).toEqual(["555", "888"]);
    expect(candidatosDoSorteio(colecao(), ouvidos, { historico: "nunca", midia: "Vinyl" })).toEqual([]);
  });
  it("ignora álbuns removidos da coleção", () => {
    const l = [rick(), { ...various(), status: "removed" as const }];
    expect(ids(candidatosDoSorteio(l, new Set(), { historico: null, midia: null }))).toEqual(["249504"]);
  });
});

describe("sortear", () => {
  const f = { historico: null, midia: null } as const;
  it("escolhe um dos candidatos usando o gerador informado", () => {
    expect(sortear(colecao(), ouvidos, f, { rng: () => 0 }).album?.id).toBe("249504");
    expect(sortear(colecao(), ouvidos, f, { rng: () => 0.999999 }).album?.id).toBe("888");
    expect(sortear(colecao(), ouvidos, f, { rng: () => 0 }).total).toBe(4);
  });
  it("só sorteia álbuns que atendem aos filtros", () => {
    for (let i = 0; i < 50; i++) {
      const r = sortear(colecao(), ouvidos, { historico: "nunca", midia: "CD" });
      expect(["555", "888"]).toContain(r.album?.id);
    }
  });
  it("avisa que não há discos quando nada atende aos critérios", () => {
    expect(sortear(colecao(), ouvidos, { historico: "nunca", midia: "Vinyl" })).toEqual({ album: null, total: 0 });
    expect(sortear([], new Set(), f)).toEqual({ album: null, total: 0 });
  });
  it("ao sortear de novo, não repete o anterior se houver outra opção", () => {
    for (let i = 0; i < 30; i++) {
      expect(sortear(colecao(), ouvidos, f, { excluirId: "249504" }).album?.id).not.toBe("249504");
    }
  });
  it("repete o único candidato quando não há outro", () => {
    expect(sortear([rick()], new Set(), f, { excluirId: "249504" }).album?.id).toBe("249504");
  });
  it("distribui o sorteio entre todos os candidatos", () => {
    const vistos = new Set<string>();
    for (let i = 0; i < 400; i++) vistos.add(sortear(colecao(), ouvidos, f).album!.id);
    expect(vistos.size).toBe(4);
  });
});
