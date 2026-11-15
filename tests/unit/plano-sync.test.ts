import { describe, expect, it } from "vitest";
import { compararColecao, converterItemBasico, deduplicarItens, removalEmMassa, type AlbumParaComparar, type ItemBruto } from "@/lib/sync/plano";

const bruto = (id: number, titulo: string, artista: string, formato = "Vinyl", extra: Partial<ItemBruto["basic_information"]> = {}): ItemBruto => ({
  id,
  basic_information: { id, title: titulo, artists: [{ id: id * 10, name: artista }], formats: [{ name: formato, qty: "1" }], thumb: `https://i.discogs.com/${id}.jpg`, ...extra },
});

const album = (id: string, titulo: string, artista: string, status: "active" | "removed" = "active"): AlbumParaComparar => ({
  id, title: titulo, artistName: artista, mediaType: "Vinyl", status, thumb: null, cover: null,
});

describe("converterItemBasico", () => {
  it("lê identificação, artista, formato, categoria e capa", () => {
    expect(converterItemBasico(bruto(10, "Abbey Road", "The Beatles"))).toEqual({
      id: 10, titulo: "Abbey Road", artista: "The Beatles", artistas: [{ id: 100, name: "The Beatles" }], formatos: ["Vinyl"],
      formatoOriginal: "Vinyl", categoria: "Vinyl", capa: "https://i.discogs.com/10.jpg",
    });
  });
  it("tira o sufixo de homônimo e usa a capa grande quando não há miniatura", () => {
    const r = converterItemBasico(bruto(11, "Nevermind", "Nirvana (2)", "CD", { thumb: "", cover_image: "https://i.discogs.com/capa.jpg" }));
    expect(r).toMatchObject({ artista: "Nirvana", categoria: "CD", capa: "https://i.discogs.com/capa.jpg" });
  });
  it("deixa a categoria em branco quando o formato não tem correspondência", () => {
    expect(converterItemBasico(bruto(12, "Fita", "Banda", "Cassette"))?.categoria).toBeNull();
  });
  it("ignora itens sem ID ou sem título", () => {
    expect(converterItemBasico({ basic_information: { title: "Sem id" } })).toBeNull();
    expect(converterItemBasico({ id: 5, basic_information: {} })).toBeNull();
    expect(converterItemBasico({} as ItemBruto)).toBeNull();
  });
  it("usa o ID do item quando o resumo não o traz", () => {
    expect(converterItemBasico({ id: 77, basic_information: { title: "X", artists: [{ name: "Y" }] } })?.id).toBe(77);
  });
});

describe("deduplicarItens", () => {
  it("conta cada Release uma só vez, mesmo com várias cópias na coleção", () => {
    const a = converterItemBasico(bruto(1, "A", "X"))!;
    expect(deduplicarItens([a, { ...a }, converterItemBasico(bruto(2, "B", "X"))!])).toHaveLength(2);
  });
});

describe("compararColecao", () => {
  const discogs = [bruto(1, "Igual", "Banda"), bruto(2, "Novo", "Banda"), bruto(3, "Voltou", "Banda")].map((b) => converterItemBasico(b)!);
  const logdisco = [
    album("1", "Igual", "Banda"),
    album("3", "Voltou", "Banda", "removed"),
    album("9", "Saiu do Discogs", "Outro"),
    album("8", "Já estava removido", "Outro", "removed"),
  ];

  it("separa os quatro casos: adicionar, reativar, manter e remover", () => {
    const p = compararColecao(discogs, logdisco);
    expect(p.adicionar.map((i) => i.id)).toEqual([2]);
    expect(p.reativar.map((i) => i.id)).toEqual([3]);
    expect(p.manter).toEqual([1]);
    expect(p.remover.map((i) => i.id)).toEqual([9]);
  });
  it("não cadastra duplicados: edições diferentes são Releases diferentes", () => {
    const p = compararColecao([converterItemBasico(bruto(100, "Mesmo Álbum", "Banda"))!, converterItemBasico(bruto(101, "Mesmo Álbum", "Banda", "CD"))!], [album("100", "Mesmo Álbum", "Banda")]);
    expect(p.adicionar.map((i) => i.id)).toEqual([101]);
    expect(p.manter).toEqual([100]);
  });
  it("ignora cópias repetidas ao comparar", () => {
    const item = converterItemBasico(bruto(5, "X", "Y"))!;
    const p = compararColecao([item, item, item], []);
    expect(p.adicionar).toHaveLength(1);
  });
  it("álbum removido antes e ausente do Discogs não volta nem é removido de novo", () => {
    const p = compararColecao([], [album("8", "Já estava removido", "Outro", "removed")]);
    expect(p).toEqual({ adicionar: [], reativar: [], manter: [], remover: [] });
  });
  it("coleção do Discogs vazia marca todos os ativos para remoção", () => {
    const p = compararColecao([], [album("1", "A", "X"), album("2", "B", "Y")]);
    expect(p.remover).toHaveLength(2);
  });
  it("ordena por artista e título", () => {
    const p = compararColecao(
      [bruto(1, "Zeta", "Banda B"), bruto(2, "Alfa", "Banda B"), bruto(3, "Beta", "Banda A")].map((b) => converterItemBasico(b)!),
      [],
    );
    expect(p.adicionar.map((i) => i.titulo)).toEqual(["Beta", "Alfa", "Zeta"]);
  });
  it("usa o título personalizado ao listar o que será removido", () => {
    const p = compararColecao([], [{ ...album("1", "Original", "X"), titleCustom: "Meu título" }]);
    expect(p.remover[0].titulo).toBe("Meu título");
  });
});

describe("removalEmMassa", () => {
  it("exige confirmação extra quando a remoção atinge metade ou mais da coleção", () => {
    expect(removalEmMassa(50, 100)).toBe(true);
    expect(removalEmMassa(100, 100)).toBe(true);
    expect(removalEmMassa(49, 100)).toBe(false);
  });
  it("não incomoda em remoções pequenas", () => {
    expect(removalEmMassa(3, 4)).toBe(false);
    expect(removalEmMassa(4, 5)).toBe(false);
    expect(removalEmMassa(5, 10)).toBe(true);
  });
});
