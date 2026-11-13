import { describe, expect, it } from "vitest";
import { converterRelease, limparNomeArtista } from "@/lib/discogs/release";
import { DiscogsErro } from "@/lib/discogs/erros";
import { releaseCdDvd, releaseSimples, releaseVarious } from "./fixtures/releases";

describe("converterRelease", () => {
  it("converte um single em vinil", () => {
    const r = converterRelease(releaseSimples);
    expect(r.releaseId).toBe(249504);
    expect(r.masterId).toBe(96559);
    expect(r.artistName).toBe("Rick Astley"); // sem o "(2)" do Discogs
    expect(r.artistId).toBe(72872);
    expect(r.title).toBe("Never Gonna Give You Up");
    expect(r.year).toBe(1987);
    expect(r.mediaType).toBe("Vinyl");
    expect(r.formatOriginal).toBe('Vinyl, 7", 45 RPM, Single');
    expect(r.isVarious).toBe(false);
    expect(r.discogsUrl).toContain("/release/249504");
  });

  it("usa a imagem primária como capa, e não a primeira da lista", () => {
    const r = converterRelease(releaseSimples);
    expect(r.cover).toBe("https://i.discogs.com/primaria.jpg");
    expect(r.thumb).toBe("https://i.discogs.com/thumb-249504.jpg");
  });

  it("descarta cabeçalhos e mantém só as faixas", () => {
    const r = converterRelease(releaseSimples);
    expect(r.tracks.map((t) => t.title)).toEqual([
      "Never Gonna Give You Up",
      "Never Gonna Give You Up (Instrumental)",
    ]);
    expect(r.tracks[0]).toEqual({ position: "A", title: "Never Gonna Give You Up", duration: "3:32", artist: null });
  });

  it("identifica Various e guarda o artista de cada faixa", () => {
    const r = converterRelease(releaseVarious);
    expect(r.isVarious).toBe(true);
    expect(r.artistName).toBe("Various");
    expect(r.year).toBeNull(); // ano 0 do Discogs significa "desconhecido"
    expect(r.mediaType).toBe("CD");
    expect(r.formatOriginal).toBe("2 × CD, Compilation");
    expect(r.tracks[0].artist).toBe("Banda A");
    expect(r.tracks[1].artist).toBe("Banda B feat. Cantor C");
  });

  it("expande faixas agrupadas em 'index'", () => {
    const r = converterRelease(releaseVarious);
    expect(r.tracks.map((t) => t.position)).toEqual(["1-1", "1-2", "2.1", "2.2"]);
    expect(r.tracks[2].artist).toBeNull();
  });

  it("junta vários artistas e mapeia CD + DVD", () => {
    const r = converterRelease(releaseCdDvd);
    expect(r.artistName).toBe("Dupla X & Dupla Y");
    expect(r.artistId).toBe(10);
    expect(r.artists).toEqual([
      { id: 10, name: "Dupla X" },
      { id: 11, name: "Dupla Y" },
    ]);
    expect(r.mediaType).toBe("CD/DVD");
    expect(r.masterId).toBeNull();
    expect(r.cover).toBeNull();
    expect(r.isVarious).toBe(false);
  });

  it("monta o link do Discogs quando a resposta não traz uri", () => {
    expect(converterRelease({ id: 5, title: "X" }).discogsUrl).toBe("https://www.discogs.com/release/5");
  });

  it("rejeita respostas sem id ou título", () => {
    expect(() => converterRelease({} as never)).toThrow(DiscogsErro);
    expect(() => converterRelease({ id: 1 } as never)).toThrow(DiscogsErro);
  });
});

describe("limparNomeArtista", () => {
  it("remove só o sufixo numérico de homônimos", () => {
    expect(limparNomeArtista("Nirvana (2)")).toBe("Nirvana");
    expect(limparNomeArtista("Blink-182")).toBe("Blink-182");
    expect(limparNomeArtista("Sunn O))) (live)")).toBe("Sunn O))) (live)");
  });
});
