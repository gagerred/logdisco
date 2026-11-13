import { beforeEach, describe, expect, it, vi } from "vitest";
import { converterRelease } from "@/lib/discogs/release";
import { ErroNegocio } from "@/lib/server/erros-negocio";
import { BancoFalso } from "./fixtures/firestore-falso";
import { releaseCdDvd, releaseSimples } from "./fixtures/releases";

const { banco } = vi.hoisted(() => ({ banco: { atual: null as unknown as BancoFalso } }));
vi.mock("@/lib/firebase-admin", () => ({
  getAdminDb: () => banco.atual,
  ErroConfiguracao: class extends Error {},
}));

import { adicionarAlbum, atualizarAlbum } from "@/lib/server/colecao";

const UID = "u1";
const rick = () => converterRelease(releaseSimples);
const pasta = (id: string | number) => `users/${UID}/releases/${id}`;

/** Duas audições de exemplo, que nenhuma operação do catálogo pode alterar. */
function semearAudicoes(db: BancoFalso) {
  db.semear(`users/${UID}/listens/l1`, { releaseId: "249504", date: "2026-11-01", time: "20:00" });
  db.semear(`users/${UID}/listens/l2`, { releaseId: "249504", date: "2026-11-05", time: "09:30" });
}
const audicoes = (db: BancoFalso) => JSON.stringify(db.sob(`users/${UID}/listens`));

beforeEach(() => {
  banco.atual = new BancoFalso();
});

describe("adicionarAlbum", () => {
  it("cadastra o álbum ativo com data de inclusão, artistas e histórico — sem tocar em audições", async () => {
    semearAudicoes(banco.atual);
    const antes = audicoes(banco.atual);
    const r = await adicionarAlbum(UID, rick(), "Vinyl");

    expect(r).toEqual({ releaseId: "249504", reativado: false });
    const doc = banco.atual.dados.get(pasta(249504))!;
    expect(doc).toMatchObject({ status: "active", mediaType: "Vinyl", artistName: "Rick Astley", artistNameLocked: true, artistKeys: ["72872"] });
    expect(doc.addedAt).toEqual({ _servidor: true });
    expect(banco.atual.dados.get(`users/${UID}/artists/72872`)).toMatchObject({ name: "Rick Astley" });
    const log = banco.atual.sob(`users/${UID}/changeLog`);
    expect(log).toHaveLength(1);
    expect(log[0][1]).toMatchObject({ tipo: "inclusao", releaseId: 249504 });
    expect(audicoes(banco.atual)).toBe(antes);
    expect(banco.atual.escritas.some((p) => p.includes("/listens/"))).toBe(false);
  });

  it("usa a categoria do Discogs quando o usuário não escolhe outra", async () => {
    await adicionarAlbum(UID, rick(), undefined);
    expect(banco.atual.dados.get(pasta(249504))).toMatchObject({ mediaType: "Vinyl" });
  });

  it("não cadastra o mesmo lançamento duas vezes", async () => {
    await adicionarAlbum(UID, rick(), "Vinyl");
    const antes = JSON.stringify(banco.atual.dados.get(pasta(249504)));
    const erro = await adicionarAlbum(UID, rick(), "CD").catch((e) => e);
    expect(erro).toBeInstanceOf(ErroNegocio);
    expect(erro).toMatchObject({ codigo: "duplicado", status: 409 });
    expect(JSON.stringify(banco.atual.dados.get(pasta(249504)))).toBe(antes);
    expect(banco.atual.sob(`users/${UID}/changeLog`)).toHaveLength(1);
  });

  it("trata edições diferentes do mesmo álbum como lançamentos separados", async () => {
    await adicionarAlbum(UID, rick(), "Vinyl");
    await adicionarAlbum(UID, converterRelease({ ...releaseSimples, id: 300001, title: "Never Gonna Give You Up" }), "CD");
    expect(banco.atual.sob(`users/${UID}/releases/`)).toHaveLength(2);
  });

  it("exige categoria quando o Discogs não permite identificá-la", async () => {
    const cassete = converterRelease({ ...releaseSimples, formats: [{ name: "Cassette", qty: "1" }] });
    expect(cassete.mediaType).toBeNull();
    await expect(adicionarAlbum(UID, cassete, undefined)).rejects.toMatchObject({ codigo: "categoria_obrigatoria", status: 400 });
    await expect(adicionarAlbum(UID, cassete, "CD")).resolves.toMatchObject({ releaseId: "249504" });
    expect(banco.atual.dados.get(pasta(249504))).toMatchObject({ mediaType: "CD" });
  });

  it("recusa categorias fora das quatro permitidas", async () => {
    await expect(adicionarAlbum(UID, rick(), "Cassette")).rejects.toMatchObject({ codigo: "categoria_invalida", status: 400 });
    expect(banco.atual.sob(`users/${UID}/releases/`)).toHaveLength(0);
  });

  it("cadastra um álbum com dois artistas nos dois cadastros de artista", async () => {
    await adicionarAlbum(UID, converterRelease(releaseCdDvd), undefined);
    expect(banco.atual.dados.get(pasta(777))).toMatchObject({ mediaType: "CD/DVD", artistKeys: ["10", "11"] });
    expect(banco.atual.dados.has(`users/${UID}/artists/10`)).toBe(true);
    expect(banco.atual.dados.has(`users/${UID}/artists/11`)).toBe(true);
  });

  it("EXCLUSÃO LÓGICA: reincluir um álbum removido o reativa e preserva audições, categoria e título", async () => {
    semearAudicoes(banco.atual);
    banco.atual.semear(pasta(249504), {
      ...JSON.parse(JSON.stringify({ ...rick(), id: "249504" })),
      artists: [{ id: 72872, name: "Rick Astley", key: "72872" }],
      artistKeys: ["72872"],
      mediaType: "CD",
      titleCustom: "Meu título",
      artistNameLocked: true,
      status: "removed",
      removedAt: { _servidor: true },
    });
    const antes = audicoes(banco.atual);

    const r = await adicionarAlbum(UID, rick(), "Vinyl");
    expect(r.reativado).toBe(true);
    const doc = banco.atual.dados.get(pasta(249504))!;
    expect(doc.status).toBe("active");
    expect(doc).not.toHaveProperty("removedAt");
    expect(doc).toMatchObject({ mediaType: "CD", titleCustom: "Meu título" });
    expect(audicoes(banco.atual)).toBe(antes);
    expect(banco.atual.escritas.some((p) => p.includes("/listens/"))).toBe(false);
  });
});

describe("atualizarAlbum", () => {
  async function comAlbum() {
    semearAudicoes(banco.atual);
    await adicionarAlbum(UID, rick(), "Vinyl");
    banco.atual.escritas.length = 0;
  }
  const alterado = () =>
    converterRelease({
      ...releaseSimples,
      title: "Never Gonna Give You Up (Remaster)",
      artists: [{ id: 999, name: "Nome Trocado" }],
      tracklist: [...(releaseSimples.tracklist ?? []), { position: "B2", type_: "track", title: "Bônus", duration: "2:00" }],
    });

  it("a prévia mostra as diferenças sem gravar nada", async () => {
    await comAlbum();
    const antes = JSON.stringify(banco.atual.dados.get(pasta(249504)));
    const r = await atualizarAlbum(UID, "249504", alterado(), false);
    expect(r.aplicado).toBe(false);
    expect(r.mudancas.map((m) => m.campo).sort()).toEqual(["title", "tracks"]);
    expect(JSON.stringify(banco.atual.dados.get(pasta(249504)))).toBe(antes);
    expect(banco.atual.escritas).toEqual([]);
  });

  it("aplicar grava os dados cadastrais, preserva o artista e registra no histórico", async () => {
    await comAlbum();
    const r = await atualizarAlbum(UID, "249504", alterado(), true);
    expect(r.aplicado).toBe(true);
    const doc = banco.atual.dados.get(pasta(249504))!;
    expect(doc.title).toBe("Never Gonna Give You Up (Remaster)");
    expect((doc.tracks as unknown[]).length).toBe(3);
    expect(doc).toMatchObject({ artistName: "Rick Astley", artistKeys: ["72872"], mediaType: "Vinyl", status: "active" });
    const tipos = banco.atual.sob(`users/${UID}/changeLog`).map(([, d]) => d.tipo);
    expect(tipos).toEqual(["inclusao", "atualizacao"]);
  });

  it("PRESERVAÇÃO DO HISTÓRICO: nenhuma audição é lida ou gravada ao atualizar", async () => {
    await comAlbum();
    const antes = audicoes(banco.atual);
    await atualizarAlbum(UID, "249504", alterado(), false);
    await atualizarAlbum(UID, "249504", alterado(), true);
    expect(audicoes(banco.atual)).toBe(antes);
    expect(banco.atual.escritas.some((p) => p.includes("/listens/"))).toBe(false);
    expect(banco.atual.escritas.every((p) => p.startsWith(pasta(249504)) || p.includes("/changeLog/"))).toBe(true);
  });

  it("sem diferenças, renova só os endereços de imagem e não polui o histórico", async () => {
    await comAlbum();
    const r = await atualizarAlbum(UID, "249504", rick(), false);
    expect(r).toEqual({ mudancas: [], aplicado: true });
    expect(banco.atual.sob(`users/${UID}/changeLog`)).toHaveLength(1);
  });

  it("recusa álbum removido e álbum inexistente", async () => {
    await comAlbum();
    banco.atual.dados.get(pasta(249504))!.status = "removed";
    await expect(atualizarAlbum(UID, "249504", rick(), true)).rejects.toMatchObject({ codigo: "removido", status: 409 });
    await expect(atualizarAlbum(UID, "123", rick(), true)).rejects.toMatchObject({ codigo: "nao_encontrado", status: 404 });
  });
});
