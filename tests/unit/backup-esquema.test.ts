import { describe, expect, it } from "vitest";
import { converterDatas, montarBackup, sanitizarDoc, serializar, validarBackup, VERSAO_BACKUP, type BackupV1, type ItemBackup } from "@/lib/backup/esquema";
import { montarDesejo } from "@/lib/wantlist/logica";
import { converterItemBasico } from "@/lib/sync/plano";
import { rick, various } from "./fixtures/albuns";

const ts = (iso: string) => ({ toDate: () => new Date(iso) });
const itemRelease = (a = rick()): ItemBackup => {
  const { id, ...resto } = a;
  return { id, dados: { ...resto, addedAt: ts("2026-03-05T15:00:00Z") } };
};
const desejo = montarDesejo(converterItemBasico({ id: 7, basic_information: { id: 7, title: "Desejo", artists: [{ id: 70, name: "Banda" }], formats: [{ name: "CD" }], thumb: "https://i/7.jpg" } })!);
const dadosCompletos = (): Record<"artists" | "releases" | "listens" | "wantlist" | "discover", ItemBackup[]> => ({
  artists: [{ id: "72872", dados: { name: "Rick Astley", discogsId: 72872, discogsUrl: "https://www.discogs.com/artist/72872", updatedAt: ts("2026-03-05T15:00:00Z") } }],
  releases: [itemRelease(rick()), itemRelease(various())],
  listens: [{ id: "abc123", dados: { releaseId: "249504", date: "2026-11-01", time: "20:00", listenedAt: ts("2026-11-01T23:00:00Z"), snapshot: { artistName: "Rick Astley", title: "X", thumb: null, mediaType: "Vinyl" }, createdAt: ts("2026-11-02T10:00:00Z") } }],
  wantlist: [{ id: "7", dados: { ...desejo } }],
  discover: [{ id: "9", dados: { releaseId: 9, titulo: "Quero ouvir", artista: "Banda Y", artists: [{ id: 90, name: "Banda Y", key: "90" }], artistKeys: ["90"], formatoOriginal: "CD", capa: null, discogsUrl: "https://www.discogs.com/release/9", adicionadoEm: ts("2026-04-01T10:00:00Z") } }],
});

describe("montarBackup", () => {
  it("contém as seis informações pedidas e converte datas em texto ISO", () => {
    const b = montarBackup(dadosCompletos(), new Date("2026-11-16T12:00:00Z"));
    expect(b).toMatchObject({ app: "LogDisco", versao: VERSAO_BACKUP, criadoEm: "2026-11-16T12:00:00.000Z" });
    expect(Object.keys(b.dados)).toEqual(["artists", "releases", "listens", "wantlist", "discover"]);
    expect(b.dados.releases[0].dados.addedAt).toBe("2026-03-05T15:00:00.000Z");
    expect(b.dados.listens[0].dados.listenedAt).toBe("2026-11-01T23:00:00.000Z");
    expect(b.dados.releases[0].dados.tracks).toBeInstanceOf(Array);
  });
  it("serializa recursivamente, sem alterar valores comuns", () => {
    expect(serializar({ a: [ts("2026-01-01T00:00:00Z"), 3, "x", null], b: { c: ts("2026-02-01T00:00:00Z") } })).toEqual({ a: ["2026-01-01T00:00:00.000Z", 3, "x", null], b: { c: "2026-02-01T00:00:00.000Z" } });
  });
  it("é um JSON que sobrevive ao ciclo de salvar e ler", () => {
    const b = montarBackup(dadosCompletos());
    expect(JSON.parse(JSON.stringify(b))).toEqual(b);
  });
});

describe("validarBackup", () => {
  const arquivo = () => JSON.parse(JSON.stringify(montarBackup(dadosCompletos())));

  it("aceita a cópia gerada pelo próprio app e conta os itens de cada seção", () => {
    const r = validarBackup(arquivo());
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.contagens).toEqual({
      artists: { noArquivo: 1, validos: 1, invalidos: 0 },
      releases: { noArquivo: 2, validos: 2, invalidos: 0 },
      listens: { noArquivo: 1, validos: 1, invalidos: 0 },
      wantlist: { noArquivo: 1, validos: 1, invalidos: 0 },
      discover: { noArquivo: 1, validos: 1, invalidos: 0 },
    });
    expect(r.invalidos).toEqual([]);
    expect(r.avisos).toEqual([]);
  });

  it("recusa arquivos que não são uma cópia do LogDisco", () => {
    for (const ruim of [null, "texto", [], {}, { app: "Outro", versao: 1, dados: {} }]) expect(validarBackup(ruim).ok).toBe(false);
    expect(validarBackup({ ...arquivo(), app: "OutroApp" }).ok).toBe(false);
  });
  it("recusa versão mais nova que a suportada e seções faltando", () => {
    const nova = validarBackup({ ...arquivo(), versao: 99 });
    expect(nova.ok === false && nova.erros[0]).toMatch(/Versão/);
    const b = arquivo();
    delete b.dados.listens;
    const r = validarBackup(b);
    expect(r.ok === false && r.erros[0]).toContain("Audições");
  });

  it("separa os itens inválidos e descreve o problema, sem impedir os válidos", () => {
    const b = arquivo();
    b.dados.releases.push({ id: "abc", dados: {} });
    b.dados.releases.push({ id: "5", dados: { ...b.dados.releases[0].dados, releaseId: 6 } }); // código não confere
    b.dados.listens.push({ id: "zz9", dados: { releaseId: "249504", date: "01/11/2026", time: "20:00", listenedAt: "2026-11-01T00:00:00Z" } });
    b.dados.releases.push("lixo");
    const r = validarBackup(b);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.contagens.releases).toEqual({ noArquivo: 5, validos: 2, invalidos: 3 });
    expect(r.contagens.listens.invalidos).toBe(1);
    expect(r.invalidos.map((i) => i.erro).join("|")).toMatch(/Identificador inválido/);
    expect(r.invalidos.map((i) => i.erro).join("|")).toMatch(/não confere/);
    expect(r.invalidos.map((i) => i.erro).join("|")).toMatch(/Valor inválido no campo date/);
  });

  it("avisa sobre audições de álbuns que não estão no arquivo", () => {
    const b = arquivo();
    b.dados.listens.push({ id: "orfa", dados: { releaseId: "999", date: "2026-11-01", time: "20:00", listenedAt: "2026-11-01T00:00:00Z" } });
    const r = validarBackup(b);
    expect(r.ok && r.avisos[0]).toMatch(/1 audição/);
  });
});

/** Álbum como aparece dentro de um arquivo de backup: JSON puro, com a data em texto ISO. */
const albumJson = () => ({ ...JSON.parse(JSON.stringify({ ...rick(), addedAt: undefined })), addedAt: "2026-03-05T15:00:00.000Z" });

describe("sanitizarDoc", () => {
  it("descarta campos desconhecidos (não deixa gravar nada fora do esquema)", () => {
    const r = sanitizarDoc("releases", "249504", { ...albumJson(), isAdmin: true, __proto_extra: { x: 1 }, id: "outro" });
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.dados).not.toHaveProperty("isAdmin");
      expect(r.dados).not.toHaveProperty("__proto_extra");
      expect(r.dados).not.toHaveProperty("id");
      expect(r.dados.mediaType).toBe("Vinyl");
    }
  });
  it("só aceita as quatro categorias de mídia e os dois status", () => {
    const base = albumJson();
    expect(sanitizarDoc("releases", "249504", { ...base, mediaType: "Cassette" }).ok).toBe(false);
    expect(sanitizarDoc("releases", "249504", { ...base, status: "apagado" }).ok).toBe(false);
    expect(sanitizarDoc("releases", "249504", { ...base, status: "removed" }).ok).toBe(true);
  });
  it("valida campos obrigatórios e tipos", () => {
    expect(sanitizarDoc("artists", "1", {}).ok).toBe(false);
    expect(sanitizarDoc("artists", "1", { name: 5 }).ok).toBe(false);
    expect(sanitizarDoc("artists", "n-banda", { name: "Banda" }).ok).toBe(true);
    expect(sanitizarDoc("listens", "a1", { releaseId: "1", date: "2026-11-01", time: "9:00", listenedAt: "2026-11-01T00:00:00Z" }).ok).toBe(false);
  });
  it("recusa identificadores com caracteres perigosos", () => {
    expect(sanitizarDoc("artists", "../outro", { name: "x" }).ok).toBe(false);
    expect(sanitizarDoc("listens", "a/b", { releaseId: "1", date: "2026-11-01", time: "09:00", listenedAt: "2026-11-01T00:00:00Z" }).ok).toBe(false);
  });
  it("converte datas de texto para Date na restauração", () => {
    const r = sanitizarDoc("listens", "a1", { releaseId: "1", date: "2026-11-01", time: "09:00", listenedAt: "2026-11-01T12:00:00.000Z", createdAt: "2026-11-02T00:00:00.000Z" });
    if (!r.ok) throw new Error("deveria ser válido");
    const c = converterDatas("listens", r.dados);
    expect(c.listenedAt).toBeInstanceOf(Date);
    expect((c.listenedAt as Date).toISOString()).toBe("2026-11-01T12:00:00.000Z");
    expect(c.date).toBe("2026-11-01"); // o texto da data efetiva não é convertido
  });
});
