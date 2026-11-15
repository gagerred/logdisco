import { describe, expect, it } from "vitest";
import { urlsDeBusca, urlYouTubeMusic } from "@/lib/links";
import { converterItemBasico, type ItemBruto } from "@/lib/sync/plano";
import { buscarDesejos, compararWantlist, desejosDoArtista, desejosVisiveis, montarDesejo, ordenarDesejos, rotuloFormato } from "@/lib/wantlist/logica";
import type { DesejoDoc } from "@/lib/wantlist/tipos";
import { rick, various } from "./fixtures/albuns";

const bruto = (id: number, titulo: string, artista: string, formato = "Vinyl", extra: Partial<NonNullable<ItemBruto["basic_information"]>> = {}): ItemBruto => ({
  id,
  basic_information: { id, title: titulo, artists: [{ id: id * 10, name: artista }], formats: [{ name: formato, qty: "1" }], thumb: `https://i.discogs.com/${id}.jpg`, ...extra },
});
const item = (id: number, titulo: string, artista: string, formato = "Vinyl") => converterItemBasico(bruto(id, titulo, artista, formato))!;
const desejo = (id: number, titulo: string, artista: string, formato = "Vinyl"): DesejoDoc => ({ id: String(id), ...montarDesejo(item(id, titulo, artista, formato)) });

describe("lista de desejos visível", () => {
  const lista = [desejo(249504, "Never Gonna Give You Up", "Rick Astley"), desejo(2, "Outro Disco", "Banda B"), desejo(3, "Mais Um", "Banda C")];
  it("retira da lista os discos que já constam na coleção ativa", () => {
    const { visiveis, ocultos } = desejosVisiveis(lista, [rick(), various()]);
    expect(visiveis.map((d) => d.id)).toEqual(["2", "3"]);
    expect(ocultos).toBe(1);
  });
  it("um disco removido da coleção (exclusão lógica) volta a aparecer nos desejos", () => {
    const removido = { ...rick(), status: "removed" as const };
    expect(desejosVisiveis(lista, [removido]).visiveis).toHaveLength(3);
  });
  it("compara pela edição exata: outra edição do mesmo álbum continua desejada", () => {
    const outraEdicao = desejo(300001, "Never Gonna Give You Up", "Rick Astley", "CD");
    expect(desejosVisiveis([outraEdicao], [rick()]).visiveis).toHaveLength(1);
  });
});

describe("busca e ordenação", () => {
  const lista = [desejo(1, "Zebra", "Banda B"), desejo(2, "Alfa", "Banda Z"), desejo(3, "Beta", "Banda A"), desejo(4, "Álbum Acentuado", "Ágata")];
  it("ordena por artista, em ordem alfabética", () => {
    expect(ordenarDesejos(lista, "artista").map((d) => d.artista)).toEqual(["Ágata", "Banda A", "Banda B", "Banda Z"]);
  });
  it("ordena por álbum, em ordem alfabética", () => {
    expect(ordenarDesejos(lista, "album").map((d) => d.titulo)).toEqual(["Álbum Acentuado", "Alfa", "Beta", "Zebra"]);
  });
  it("busca por artista ou álbum, ignorando acentos e maiúsculas", () => {
    expect(buscarDesejos(lista, "agata").map((d) => d.id)).toEqual(["4"]);
    expect(buscarDesejos(lista, "ZEBRA").map((d) => d.id)).toEqual(["1"]);
    expect(buscarDesejos(lista, "banda").map((d) => d.id).sort()).toEqual(["1", "2", "3"]);
    expect(buscarDesejos(lista, "")).toHaveLength(4);
    expect(buscarDesejos(lista, "inexistente")).toEqual([]);
  });
  it("junta os desejos de um mesmo artista", () => {
    const dois = [desejo(1, "A", "Banda B"), desejo(5, "B", "Banda B")];
    dois[1] = { ...dois[1], artists: [{ id: 10, name: "Banda B", key: "10" }], artistKeys: ["10"] };
    expect(desejosDoArtista(dois, "10").map((d) => d.id)).toEqual(["1", "5"]);
    expect(desejosDoArtista(dois, "999")).toEqual([]);
  });
});

describe("formato exibido", () => {
  it("mostra o formato do Discogs: Vinyl, CD ou outro", () => {
    expect(rotuloFormato(desejo(1, "A", "X", "Vinyl"))).toBe("Vinyl");
    expect(rotuloFormato(desejo(2, "B", "X", "CD"))).toBe("CD");
    expect(rotuloFormato(desejo(3, "C", "X", "Cassette"))).toBe("Cassette");
    const duplo = montarDesejo(converterItemBasico({ id: 4, basic_information: { id: 4, title: "D", artists: [{ id: 1, name: "X" }], formats: [{ name: "CD" }, { name: "DVD" }, { name: "CD" }] } })!);
    expect(rotuloFormato(duplo)).toBe("CD + DVD");
    expect(rotuloFormato({ formatos: [] })).toBe("—");
  });
});

describe("compararWantlist", () => {
  const atuais = [desejo(1, "Igual", "Banda A"), desejo(2, "Vai Sair", "Banda B"), desejo(3, "Título Velho", "Banda C")];
  it("adiciona o que entrou, remove o que saiu e atualiza o que mudou", () => {
    const r = compararWantlist(atuais, [item(1, "Igual", "Banda A"), item(3, "Título Novo", "Banda C"), item(4, "Novo", "Banda D")]);
    expect(r.adicionar.map((d) => d.releaseId)).toEqual([4]);
    expect(r.remover).toEqual(["2"]);
    expect(r.atualizar).toHaveLength(1);
    expect(r.atualizar[0]).toMatchObject({ id: "3", visivel: true });
    expect(r.atualizar[0].patch.titulo).toBe("Título Novo");
  });
  it("não mexe em nada quando as listas são iguais", () => {
    const r = compararWantlist(atuais, [item(1, "Igual", "Banda A"), item(2, "Vai Sair", "Banda B"), item(3, "Título Velho", "Banda C")]);
    expect(r).toEqual({ adicionar: [], atualizar: [], remover: [] });
  });
  it("ignora cópias repetidas", () => {
    const r = compararWantlist([], [item(9, "X", "Y"), item(9, "X", "Y")]);
    expect(r.adicionar).toHaveLength(1);
  });
  it("renova o endereço da capa em silêncio quando a imagem é a mesma", () => {
    const atual = { ...atuais[0], capa: "https://i.discogs.com/ASSINATURA-VELHA/1.jpg?a=1" };
    const novo = converterItemBasico(bruto(1, "Igual", "Banda A", "Vinyl", { thumb: "https://i.discogs.com/ASSINATURA-NOVA/1.jpg?a=2" }))!;
    const r = compararWantlist([atual], [novo]);
    expect(r.atualizar).toHaveLength(1);
    expect(r.atualizar[0].visivel).toBe(false);
  });
  it("lista vazia no Discogs esvazia a lista de desejos", () => {
    expect(compararWantlist(atuais, []).remover).toEqual(["1", "2", "3"]);
  });
  it("a atualização tem os dados do disco da wantlist, sem campos de coleção ou audição", () => {
    const [novo] = compararWantlist([], [item(7, "Disco", "Banda")]).adicionar;
    expect(Object.keys(novo).sort()).toEqual(["artists", "artistKeys", "artista", "capa", "categoria", "discogsUrl", "formatoOriginal", "formatos", "releaseId", "titulo"].sort());
  });
});

describe("links de busca", () => {
  it("monta a pesquisa por artista e título em cada marketplace e na web", () => {
    const u = urlsDeBusca("Rick Astley", "Whenever You Need Somebody");
    expect(u.shopee).toBe("https://shopee.com.br/search?keyword=Rick%20Astley%20Whenever%20You%20Need%20Somebody");
    expect(u.mercadoLivre).toBe("https://lista.mercadolivre.com.br/Rick-Astley-Whenever-You-Need-Somebody");
    expect(u.amazon).toBe("https://www.amazon.com.br/s?k=Rick%20Astley%20Whenever%20You%20Need%20Somebody");
    expect(u.web).toBe("https://www.google.com/search?q=Rick%20Astley%20Whenever%20You%20Need%20Somebody");
  });
  it("codifica acentos e símbolos", () => {
    const u = urlsDeBusca("Chico Buarque", "Construção & Cia");
    expect(u.shopee).toContain("Constru%C3%A7%C3%A3o%20%26%20Cia");
    expect(u.mercadoLivre).toContain("Constru%C3%A7%C3%A3o-%26-Cia");
  });
  it("monta a pesquisa do YouTube Music", () => {
    expect(urlYouTubeMusic("Rick Astley", "Never Gonna Give You Up")).toBe("https://music.youtube.com/search?q=Rick%20Astley%20Never%20Gonna%20Give%20You%20Up");
  });
});
