import { describe, expect, it } from "vitest";
import { agruparPorArtista, artistasRecentes, chaveDoArtista, inicialDe } from "@/lib/colecao/artistas";
import { buscarAlbuns, FILTROS_VAZIOS, filtrarAlbuns, ordenarAlbuns, tituloExibido } from "@/lib/colecao/filtros";
import { normalizarTexto } from "@/lib/colecao/texto";
import { urlDaLetra, urlDoArtistaNoDiscogs } from "@/lib/links";
import { dupla, rick, various } from "./fixtures/albuns";

const todos = () => [rick(), various(), dupla()];

describe("texto e artistas", () => {
  it("ignora acentos e maiúsculas", () => {
    expect(normalizarTexto("  Coração DE Ônix ")).toBe("coracao de onix");
  });
  it("usa o ID do Discogs como chave e um slug quando não há ID", () => {
    expect(chaveDoArtista(72872, "Rick Astley")).toBe("72872");
    expect(chaveDoArtista(null, "Zé do Pandeiro!")).toBe("n-ze-do-pandeiro");
  });
  it("agrupa por artista, com álbum de dois artistas nos dois grupos, em ordem alfabética", () => {
    const g = agruparPorArtista(todos());
    expect(g.map((x) => x.name)).toEqual(["Dupla X", "Dupla Y", "Rick Astley", "Various"]);
    expect(g.find((x) => x.name === "Dupla Y")!.albuns.map((a) => a.id)).toEqual(["777"]);
  });
  it("lista artistas recentes sem repetição, do mais novo ao mais antigo", () => {
    expect(artistasRecentes(todos(), 3).map((x) => x.name)).toEqual(["Rick Astley", "Dupla X", "Dupla Y"]);
  });
  it("separa a lista por inicial, com # para números e símbolos", () => {
    expect(inicialDe("Ágatha")).toBe("A");
    expect(inicialDe("2Pac")).toBe("#");
  });
});

describe("filtros combinados", () => {
  const ouvidos = new Set(["249504"]);
  it("sem filtros devolve tudo", () => {
    expect(filtrarAlbuns(todos(), FILTROS_VAZIOS, ouvidos)).toHaveLength(3);
  });
  it("filtra por artista, ignorando acentos e maiúsculas, inclusive o segundo artista", () => {
    expect(filtrarAlbuns(todos(), { ...FILTROS_VAZIOS, artista: "RICK" }, ouvidos).map((a) => a.id)).toEqual(["249504"]);
    expect(filtrarAlbuns(todos(), { ...FILTROS_VAZIOS, artista: "dupla y" }, ouvidos).map((a) => a.id)).toEqual(["777"]);
  });
  it("filtra por título exibido (personalizado) e também pelo título do Discogs", () => {
    expect(filtrarAlbuns(todos(), { ...FILTROS_VAZIOS, titulo: "remasterizado" }, ouvidos).map((a) => a.id)).toEqual(["777"]);
    expect(filtrarAlbuns(todos(), { ...FILTROS_VAZIOS, titulo: "ao vivo" }, ouvidos).map((a) => a.id)).toEqual(["777"]);
  });
  it("filtra por formato", () => {
    expect(filtrarAlbuns(todos(), { ...FILTROS_VAZIOS, formato: "Vinyl" }, ouvidos).map((a) => a.id)).toEqual(["249504"]);
    expect(filtrarAlbuns(todos(), { ...FILTROS_VAZIOS, formato: "CD/DVD" }, ouvidos).map((a) => a.id)).toEqual(["777"]);
  });
  it("filtra por situação de audição", () => {
    expect(filtrarAlbuns(todos(), { ...FILTROS_VAZIOS, situacao: "ouvidos" }, ouvidos).map((a) => a.id)).toEqual(["249504"]);
    expect(filtrarAlbuns(todos(), { ...FILTROS_VAZIOS, situacao: "nunca" }, ouvidos).map((a) => a.id).sort()).toEqual(["555", "777"]);
  });
  it("combina vários filtros ao mesmo tempo", () => {
    expect(filtrarAlbuns(todos(), { artista: "", titulo: "", formato: "CD", situacao: "nunca" }, ouvidos).map((a) => a.id)).toEqual(["555"]);
    expect(filtrarAlbuns(todos(), { artista: "rick", titulo: "", formato: "CD", situacao: "todos" }, ouvidos)).toEqual([]);
  });
});

describe("busca e ordenação", () => {
  it("busca por artista ou título, e devolve vazio para texto vazio", () => {
    expect(buscarAlbuns(todos(), "never").map((a) => a.id)).toEqual(["249504"]);
    expect(buscarAlbuns(todos(), "various").map((a) => a.id)).toEqual(["555"]);
    expect(buscarAlbuns(todos(), "   ")).toEqual([]);
  });
  it("ordena por artista, título e mais recentes", () => {
    expect(ordenarAlbuns(todos(), "artista").map((a) => a.id)).toEqual(["777", "249504", "555"]);
    expect(ordenarAlbuns(todos(), "titulo").map((a) => a.id)).toEqual(["777", "249504", "555"]);
    expect(ordenarAlbuns(todos(), "recentes").map((a) => a.id)).toEqual(["249504", "777", "555"]);
  });
  it("exibe o título personalizado quando existe", () => {
    expect(tituloExibido(dupla())).toBe("Ao Vivo (Remasterizado)");
    expect(tituloExibido(rick())).toBe("Never Gonna Give You Up");
  });
});

describe("links externos", () => {
  it("monta a pesquisa de letra com artista e música", () => {
    expect(urlDaLetra("Rick Astley", "Never Gonna Give You Up")).toBe(
      "https://www.google.com/search?q=Rick%20Astley%20Never%20Gonna%20Give%20You%20Up%20letra",
    );
  });
  it("monta o link do artista no Discogs", () => {
    expect(urlDoArtistaNoDiscogs(72872)).toBe("https://www.discogs.com/artist/72872");
    expect(urlDoArtistaNoDiscogs(null)).toBeNull();
  });
});
