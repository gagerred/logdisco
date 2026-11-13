import { describe, expect, it } from "vitest";
import { compararEdicao, compararRelease, ehCategoriaValida, montarAlbumNovo } from "@/lib/colecao/atualizacao";
import { converterRelease } from "@/lib/discogs/release";
import { releaseSimples, releaseVarious } from "./fixtures/releases";
import { rick, various } from "./fixtures/albuns";

const CAMPOS_PERMITIDOS_NA_ATUALIZACAO = new Set([
  "title", "year", "masterId", "formatOriginal", "discogsUrl", "tracks", "cover", "thumb",
]);

describe("montarAlbumNovo", () => {
  it("cria o álbum ativo, com artista protegido e chaves de todos os artistas", () => {
    const a = montarAlbumNovo(converterRelease(releaseSimples), "Vinyl");
    expect(a.status).toBe("active");
    expect(a.artistNameLocked).toBe(true);
    expect(a.mediaType).toBe("Vinyl");
    expect(a.artistKeys).toEqual(["72872"]);
    expect(a.artists).toEqual([{ id: 72872, name: "Rick Astley", key: "72872" }]);
    expect(a).not.toHaveProperty("addedAt");
  });
  it("valida as categorias de mídia", () => {
    expect(["CD", "Vinyl", "DVD", "CD/DVD"].every(ehCategoriaValida)).toBe(true);
    expect(ehCategoriaValida("Cassette")).toBe(false);
    expect(ehCategoriaValida(undefined)).toBe(false);
  });
});

describe("compararRelease (recarregar do Discogs)", () => {
  it("não encontra diferenças quando nada mudou", () => {
    const r = compararRelease(rick(), converterRelease(releaseSimples));
    expect(r.mudancas).toEqual([]);
    expect(r.patch).toEqual({});
  });

  it("detecta título, ano, faixas e capa alterados", () => {
    const novo = converterRelease({
      ...releaseSimples,
      title: "Never Gonna Give You Up (Remaster)",
      year: 1988,
      images: [{ type: "primary", uri: "https://i.discogs.com/outra-capa.jpg", uri150: "https://i.discogs.com/o150.jpg" }],
      tracklist: [...(releaseSimples.tracklist ?? []), { position: "B2", type_: "track", title: "Extra", duration: "1:00" }],
    });
    const r = compararRelease(rick(), novo);
    expect(r.mudancas.map((x) => x.campo).sort()).toEqual(["cover", "title", "tracks", "year"]);
    expect(r.mudancas.find((x) => x.campo === "tracks")).toMatchObject({ de: "2 faixas", para: "3 faixas" });
  });

  it("renova o endereço da capa em silêncio quando a imagem é a mesma", () => {
    const atual = rick();
    const novo = converterRelease({
      ...releaseSimples,
      images: [{ type: "primary", uri: "https://i.discogs.com/ASSINATURA-NOVA/rs:fit/primaria.jpg?x=2", uri150: "https://i.discogs.com/pri150.jpg" }],
    });
    const r = compararRelease({ ...atual, cover: "https://i.discogs.com/ASSINATURA-VELHA/rs:fit/primaria.jpg?x=1" }, novo);
    expect(r.mudancas.find((x) => x.campo === "cover")).toBeUndefined();
    expect(r.patch.cover).toBe("https://i.discogs.com/ASSINATURA-NOVA/rs:fit/primaria.jpg?x=2");
  });

  it("nunca altera o nome do artista enquanto ele estiver protegido", () => {
    const novo = converterRelease({ ...releaseSimples, artists: [{ id: 99, name: "Outro Nome" }], title: "Novo título" });
    const r = compararRelease(rick(), novo);
    expect(r.patch).not.toHaveProperty("artistName");
    expect(r.patch).not.toHaveProperty("artistId");
    expect(r.patch).not.toHaveProperty("artists");
    expect(r.patch).not.toHaveProperty("artistKeys");
    expect(r.patch.title).toBe("Novo título");
  });

  it("altera o artista apenas quando não está protegido", () => {
    const novo = converterRelease({ ...releaseSimples, artists: [{ id: 99, name: "Outro Nome" }] });
    const r = compararRelease({ ...rick(), artistNameLocked: false }, novo);
    expect(r.patch.artistName).toBe("Outro Nome");
    expect(r.patch.artistKeys).toEqual(["99"]);
  });

  it("atualiza faixas e artistas das faixas de álbuns Various", () => {
    const novo = converterRelease({
      ...releaseVarious,
      tracklist: [{ position: "1-1", type_: "track", title: "Faixa Um", artists: [{ id: 5, name: "Banda Nova" }] }],
    });
    const r = compararRelease(various(), novo);
    expect(r.mudancas.map((x) => x.campo)).toContain("tracks");
    expect((r.patch.tracks as { artist: string }[])[0].artist).toBe("Banda Nova");
  });

  it("PRESERVAÇÃO DO HISTÓRICO: o patch só contém campos de dados cadastrais", () => {
    const novo = converterRelease({
      ...releaseSimples,
      title: "Outro",
      year: 2000,
      master_id: 1,
      uri: "https://www.discogs.com/release/1-x",
      formats: [{ name: "CD", qty: "1" }],
      images: [{ type: "primary", uri: "https://i.discogs.com/x.jpg" }],
      tracklist: [{ position: "1", type_: "track", title: "Nova" }],
    });
    const { patch } = compararRelease(rick(), novo);
    for (const chave of Object.keys(patch)) expect(CAMPOS_PERMITIDOS_NA_ATUALIZACAO.has(chave)).toBe(true);
    for (const proibido of ["status", "addedAt", "removedAt", "mediaType", "titleCustom", "artistNameLocked", "listens", "id", "releaseId"]) {
      expect(patch).not.toHaveProperty(proibido);
    }
  });

  it("não troca a categoria escolhida pelo usuário, mesmo que o formato original mude", () => {
    const novo = converterRelease({ ...releaseSimples, formats: [{ name: "CD", qty: "1" }] });
    const atual = { ...rick(), mediaType: "Vinyl" as const };
    const r = compararRelease(atual, novo);
    expect(r.patch.formatOriginal).toBe("CD");
    expect(r.patch).not.toHaveProperty("mediaType");
  });
});

describe("compararEdicao", () => {
  const album = { title: "Original", titleCustom: undefined, mediaType: "CD" as const };
  it("registra mudança de título e de formato", () => {
    const r = compararEdicao(album, { titulo: "Meu título", mediaType: "Vinyl" });
    expect(r.novoCustom).toBe("Meu título");
    expect(r.detalhes.map((d) => d.campo)).toEqual(["titleCustom", "mediaType"]);
  });
  it("título vazio ou igual ao do Discogs volta ao original", () => {
    expect(compararEdicao({ ...album, titleCustom: "Antigo" }, { titulo: "  ", mediaType: "CD" }).novoCustom).toBeNull();
    expect(compararEdicao({ ...album, titleCustom: "Antigo" }, { titulo: "Original", mediaType: "CD" }).mudouTitulo).toBe(true);
  });
  it("não registra nada quando não há mudança", () => {
    const r = compararEdicao(album, { titulo: "Original", mediaType: "CD" });
    expect(r.detalhes).toEqual([]);
    expect(r.mudouTitulo || r.mudouFormato).toBe(false);
  });
});
