import { describe, expect, it } from "vitest";
import { descreverFormatoOriginal, mapearCategoria } from "@/lib/discogs/formato";

const f = (...nomes: string[]) => nomes.map((name) => ({ name }));

describe("mapearCategoria", () => {
  it("reconhece as quatro categorias", () => {
    expect(mapearCategoria(f("Vinyl"))).toBe("Vinyl");
    expect(mapearCategoria(f("CD"))).toBe("CD");
    expect(mapearCategoria(f("DVD"))).toBe("DVD");
    expect(mapearCategoria(f("CD", "DVD"))).toBe("CD/DVD");
    expect(mapearCategoria(f("DVD", "CD"))).toBe("CD/DVD");
  });
  it("trata CDr e DVDr como CD e DVD, sem diferenciar maiúsculas", () => {
    expect(mapearCategoria(f("CDr"))).toBe("CD");
    expect(mapearCategoria(f("dvdr"))).toBe("DVD");
    expect(mapearCategoria(f("vinyl"))).toBe("Vinyl");
  });
  it("ignora embalagem como Box Set e All Media", () => {
    expect(mapearCategoria(f("Box Set", "CD", "DVD"))).toBe("CD/DVD");
    expect(mapearCategoria(f("All Media", "Vinyl"))).toBe("Vinyl");
  });
  it("devolve null quando não há correspondência segura", () => {
    expect(mapearCategoria(f("Cassette"))).toBeNull();
    expect(mapearCategoria(f("Blu-ray"))).toBeNull();
    expect(mapearCategoria(f("CD", "Blu-ray"))).toBeNull();
    expect(mapearCategoria(f("Vinyl", "CD"))).toBeNull();
    expect(mapearCategoria(f("Box Set"))).toBeNull();
    expect(mapearCategoria([])).toBeNull();
    expect(mapearCategoria(undefined)).toBeNull();
  });
});

describe("descreverFormatoOriginal", () => {
  it("preserva o texto original, com quantidade e descrições", () => {
    expect(
      descreverFormatoOriginal([
        { name: "Vinyl", qty: "2", descriptions: ["LP", "Album"] },
        { name: "DVD", qty: 1 },
      ]),
    ).toBe("2 × Vinyl, LP, Album + DVD");
  });
  it("devolve texto vazio sem formatos", () => {
    expect(descreverFormatoOriginal(undefined)).toBe("");
  });
});
