import { beforeEach, describe, expect, it, vi } from "vitest";
import { montarBackup, validarBackup, COLECOES_BACKUP, type ColecaoBackup, type ItemBackup } from "@/lib/backup/esquema";
import { BancoFalso } from "./fixtures/firestore-falso";
import { rick, various } from "./fixtures/albuns";

const { banco } = vi.hoisted(() => ({ banco: { atual: null as unknown as BancoFalso } }));
vi.mock("@/lib/firebase-admin", () => ({ getAdminDb: () => banco.atual, ErroConfiguracao: class extends Error {} }));

import { MAX_ITENS_POR_LOTE, restaurarLote } from "@/lib/server/backup";

const UID = "u1";
const raiz = `users/${UID}`;
const ts = (iso: string) => ({ toDate: () => new Date(iso) });

const albumJson = (a = rick(), extra: Record<string, unknown> = {}): ItemBackup => {
  const { id, ...resto } = a;
  return { id, dados: { ...JSON.parse(JSON.stringify({ ...resto, addedAt: undefined })), addedAt: "2026-03-05T15:00:00.000Z", ...extra } };
};
const audicao = (id: string, releaseId: string, date = "2026-11-01", time = "20:00"): ItemBackup => ({
  id, dados: { releaseId, date, time, listenedAt: "2026-11-01T23:00:00.000Z", snapshot: { artistName: "Rick", title: "X", thumb: null, mediaType: "Vinyl" }, createdAt: "2026-11-02T10:00:00.000Z" },
});

beforeEach(() => {
  banco.atual = new BancoFalso();
});

describe("restauração da cópia de segurança", () => {
  it("restaura álbuns convertendo as datas e descartando campos desconhecidos", async () => {
    const r = await restaurarLote(UID, "releases", [albumJson(rick(), { isAdmin: true, campoExtra: "x" }), albumJson({ ...various(), status: "removed" })]);
    expect(r).toEqual({ colecao: "releases", adicionados: 2, ignorados: 0, erros: [] });
    const doc = banco.atual.dados.get(`${raiz}/releases/249504`)!;
    expect(doc).toMatchObject({ title: "Never Gonna Give You Up", status: "active", mediaType: "Vinyl", artistNameLocked: true });
    expect(doc.addedAt).toBeInstanceOf(Date);
    expect((doc.addedAt as Date).toISOString()).toBe("2026-03-05T15:00:00.000Z");
    expect(doc).not.toHaveProperty("isAdmin");
    expect(doc).not.toHaveProperty("campoExtra");
    expect(banco.atual.dados.get(`${raiz}/releases/555`)).toMatchObject({ status: "removed" });
  });

  it("só ADICIONA: o que já existe na conta é mantido, nunca sobrescrito", async () => {
    banco.atual.semear(`${raiz}/releases/249504`, { ...albumJson().dados, title: "Título editado na conta", status: "active" });
    const r = await restaurarLote(UID, "releases", [albumJson(rick(), { title: "Título do backup" }), albumJson(various())]);
    expect(r).toMatchObject({ adicionados: 1, ignorados: 1 });
    expect(banco.atual.dados.get(`${raiz}/releases/249504`)!.title).toBe("Título editado na conta");
  });

  it("audições só entram se o álbum existir na conta", async () => {
    const r1 = await restaurarLote(UID, "listens", [audicao("a1", "249504")]);
    expect(r1).toMatchObject({ adicionados: 0 });
    expect(r1.erros[0].erro).toContain("não existe na conta");
    await restaurarLote(UID, "releases", [albumJson()]);
    const r2 = await restaurarLote(UID, "listens", [audicao("a1", "249504"), audicao("a2", "249504", "2026-11-02", "08:00"), audicao("a3", "999")]);
    expect(r2).toMatchObject({ adicionados: 2, ignorados: 0 });
    expect(r2.erros).toHaveLength(1);
    expect(banco.atual.dados.get(`${raiz}/listens/a1`)).toMatchObject({ releaseId: "249504", date: "2026-11-01", time: "20:00" });
    expect((banco.atual.dados.get(`${raiz}/listens/a1`)!.listenedAt as Date).toISOString()).toBe("2026-11-01T23:00:00.000Z");
  });

  it("restaurar de novo a mesma parte não duplica nada", async () => {
    await restaurarLote(UID, "releases", [albumJson()]);
    await restaurarLote(UID, "listens", [audicao("a1", "249504")]);
    const escritas = banco.atual.escritas.length;
    expect(await restaurarLote(UID, "releases", [albumJson()])).toMatchObject({ adicionados: 0, ignorados: 1 });
    expect(await restaurarLote(UID, "listens", [audicao("a1", "249504")])).toMatchObject({ adicionados: 0, ignorados: 1 });
    expect(banco.atual.escritas.length).toBe(escritas);
  });

  it("relata itens inválidos e repetidos sem impedir os válidos", async () => {
    const r = await restaurarLote(UID, "artists", [
      { id: "72872", dados: { name: "Rick Astley" } },
      { id: "../x", dados: { name: "Hack" } },
      { id: "72872", dados: { name: "Repetido" } },
      { id: "n-banda", dados: {} },
      "lixo",
    ]);
    expect(r.adicionados).toBe(1);
    expect(r.erros.map((e) => e.id).sort()).toEqual(["../x", "72872", "?", "n-banda"].sort());
    expect(banco.atual.dados.get(`${raiz}/artists/72872`)).toMatchObject({ name: "Rick Astley" });
  });

  it("recusa seção desconhecida, corpo inválido e lotes grandes demais", async () => {
    await expect(restaurarLote(UID, "private", [])).rejects.toMatchObject({ codigo: "colecao_invalida", status: 400 });
    await expect(restaurarLote(UID, "changeLog", [])).rejects.toMatchObject({ codigo: "colecao_invalida" });
    await expect(restaurarLote(UID, "releases", "texto")).rejects.toMatchObject({ codigo: "corpo_invalido" });
    await expect(restaurarLote(UID, "artists", Array.from({ length: MAX_ITENS_POR_LOTE + 1 }, (_, i) => ({ id: `a${i}`, dados: { name: "x" } })))).rejects.toMatchObject({ status: 413 });
  });

  it("só escreve na seção pedida: tokens, vínculos, travas e avisos nunca são tocados", async () => {
    banco.atual.semear(`${raiz}/private/discogs`, { accessToken: "segredo" });
    banco.atual.semear(`${raiz}/integrations/discogs`, { username: "ana" });
    await restaurarLote(UID, "releases", [albumJson()]);
    await restaurarLote(UID, "wantlist", [{ id: "7", dados: { releaseId: 7, titulo: "D", artista: "A", artists: [], artistKeys: [], formatos: ["CD"], formatoOriginal: "CD", categoria: "CD", capa: null, discogsUrl: "https://www.discogs.com/release/7" } }]);
    expect(banco.atual.escritas.every((p) => p.startsWith(`${raiz}/releases/`) || p.startsWith(`${raiz}/wantlist/`))).toBe(true);
    expect(banco.atual.dados.get(`${raiz}/private/discogs`)).toEqual({ accessToken: "segredo" });
  });

  it("ciclo completo: o backup de uma conta restaura os mesmos dados numa conta vazia", async () => {
    const dados = Object.fromEntries(COLECOES_BACKUP.map((c) => [c, [] as ItemBackup[]])) as Record<ColecaoBackup, ItemBackup[]>;
    dados.artists.push({ id: "72872", dados: { name: "Rick Astley", discogsId: 72872, updatedAt: ts("2026-03-05T15:00:00Z") } });
    dados.releases.push({ id: "249504", dados: { ...albumJson().dados, addedAt: ts("2026-03-05T15:00:00Z") } });
    dados.listens.push({ id: "a1", dados: { ...audicao("a1", "249504").dados, listenedAt: ts("2026-11-01T23:00:00Z") } });
    dados.discover.push({ id: "9", dados: { releaseId: 9, titulo: "Quero ouvir", artista: "Banda", artists: [], artistKeys: [], formatoOriginal: "CD", capa: null, discogsUrl: "https://www.discogs.com/release/9" } });

    const arquivo = JSON.parse(JSON.stringify(montarBackup(dados)));
    const v = validarBackup(arquivo);
    if (!v.ok) throw new Error(v.erros.join());
    expect(v.invalidos).toEqual([]);

    for (const c of COLECOES_BACKUP) {
      if (v.docs[c].length) expect(await restaurarLote(UID, c, v.docs[c])).toMatchObject({ adicionados: v.docs[c].length, erros: [] });
    }
    expect(banco.atual.dados.get(`${raiz}/artists/72872`)).toMatchObject({ name: "Rick Astley" });
    expect(banco.atual.dados.get(`${raiz}/releases/249504`)).toMatchObject({ title: "Never Gonna Give You Up", mediaType: "Vinyl" });
    expect(banco.atual.dados.get(`${raiz}/listens/a1`)).toMatchObject({ date: "2026-11-01", time: "20:00" });
    expect(banco.atual.dados.get(`${raiz}/discover/9`)).toMatchObject({ titulo: "Quero ouvir" });
  });
});
