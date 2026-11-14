import { describe, expect, it } from "vitest";
import { buscarMusicas, indexarFaixas } from "@/lib/diario/musicas";
import { albumDe, rick, various } from "./fixtures/albuns";
import { releaseSimples } from "./fixtures/releases";

// "Never Gonna Give You Up" também está num segundo álbum (edição diferente)
const rick2 = () => albumDe({ ...releaseSimples, id: 300001, title: "Greatest Hits" });
const indice = () => indexarFaixas([rick(), rick2(), various()]);

describe("buscarMusicas", () => {
  it("identifica em quais álbuns a música está presente", () => {
    const r = buscarMusicas(indice(), "never gonna give you up");
    // a faixa exata vem primeiro; a versão "(Instrumental)" também contém o texto buscado
    expect(r.map((x) => x.titulo)).toEqual(["Never Gonna Give You Up", "Never Gonna Give You Up (Instrumental)"]);
    expect(r[0].ocorrencias.map((o) => o.album.id).sort()).toEqual(["249504", "300001"]);
    expect(r[0].ocorrencias[0].posicao).toBe("A");
    expect(r[1].ocorrencias).toHaveLength(2);
  });
  it("ignora maiúsculas e acentos, e aceita parte do título", () => {
    expect(buscarMusicas(indice(), "SUÍTE")).toEqual([]); // "Suíte" é título de index, não de faixa
    expect(buscarMusicas(indice(), "parte i").map((r) => r.titulo)).toEqual(["Parte I", "Parte II"]);
    expect(buscarMusicas(indice(), "GONNA")).toHaveLength(2);
  });
  it("coloca primeiro a correspondência exata e depois as que começam com o texto", () => {
    const l = indexarFaixas([
      albumDe({ id: 1, title: "A", artists: [{ id: 1, name: "X" }], formats: [{ name: "CD" }], tracklist: [
        { position: "1", title: "Amor e Paz" }, { position: "2", title: "Paz" }, { position: "3", title: "Guerra e Paz" },
      ] }),
    ]);
    expect(buscarMusicas(l, "paz").map((r) => r.titulo)).toEqual(["Paz", "Amor e Paz", "Guerra e Paz"]);
  });
  it("exige ao menos 2 caracteres e devolve vazio sem correspondência", () => {
    expect(buscarMusicas(indice(), "n")).toEqual([]);
    expect(buscarMusicas(indice(), "  ")).toEqual([]);
    expect(buscarMusicas(indice(), "zzzz")).toEqual([]);
  });
  it("mostra o artista da faixa somente em álbuns Various", () => {
    const r = buscarMusicas(indice(), "faixa dois");
    expect(r[0].ocorrencias[0].artistaDaFaixa).toBe("Banda B feat. Cantor C");
    expect(buscarMusicas(indice(), "instrumental")[0].ocorrencias[0].artistaDaFaixa).toBeNull();
  });
  it("só considera álbuns da coleção ativa e respeita o limite", () => {
    const removido = { ...rick(), status: "removed" as const };
    expect(buscarMusicas(indexarFaixas([removido]), "never")).toEqual([]);
    expect(buscarMusicas(indice(), "a", 5)).toEqual([]); // 1 caractere não busca
    expect(buscarMusicas(indice(), "fa", 2).length).toBeLessThanOrEqual(2);
  });
});
