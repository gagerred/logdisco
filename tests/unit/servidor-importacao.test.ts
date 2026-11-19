import { Timestamp } from "firebase-admin/firestore";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { montarAlbumNovo } from "@/lib/colecao/atualizacao";
import { converterRelease, type ReleaseBruto } from "@/lib/discogs/release";
import { BancoFalso } from "./fixtures/firestore-falso";

const { banco } = vi.hoisted(() => ({ banco: { atual: null as unknown as BancoFalso } }));
vi.mock("@/lib/firebase-admin", () => ({ getAdminDb: () => banco.atual, ErroConfiguracao: class extends Error {} }));

import { aplicarAudicoes, verificarAudicoes } from "@/lib/server/importacao";

const UID = "u1";
const raiz = `users/${UID}`;
const AGORA = Date.parse("2026-11-16T15:00:00Z");
const op = { agora: () => AGORA };

const rel = (id: number, titulo: string, artista: string, formato: string): ReleaseBruto => ({
  id, title: titulo, artists: [{ id: id * 10, name: artista }], formats: [{ name: formato, qty: "1" }], images: [{ type: "primary", uri150: `https://i/${id}.jpg` }], thumb: `https://i/${id}-t.jpg`,
  tracklist: [{ position: "1", type_: "track", title: "Faixa" }],
});
function semearAlbum(db: BancoFalso, id: number, titulo: string, artista: string, formato: string, status: "active" | "removed") {
  const novo = montarAlbumNovo(converterRelease(rel(id, titulo, artista, formato)), formato === "CD" ? "CD" : "Vinyl");
  db.semear(`${raiz}/releases/${id}`, JSON.parse(JSON.stringify({ ...novo, status })));
}

const listens = () => banco.atual.sob(`${raiz}/listens/`);
const csv = (...linhas: string[]) => ["discogs_id;date;time", ...linhas].join("\n");
const log = () => banco.atual.sob(`${raiz}/changeLog`).map(([, d]) => d);
const albunsAntes = () => JSON.stringify(banco.atual.sob(`${raiz}/releases/`));

beforeEach(() => {
  banco.atual = new BancoFalso();
  banco.atual.semear(`users/${UID}`, { timezone: "America/Sao_Paulo" });
  semearAlbum(banco.atual, 249504, "Never Gonna Give You Up", "Rick Astley", "Vinyl", "active");
  semearAlbum(banco.atual, 555, "Now", "Various", "CD", "active");
  semearAlbum(banco.atual, 777, "Ao Vivo", "Dupla", "CD", "removed");
  banco.atual.semear(`${raiz}/listens/l1`, { releaseId: "249504", date: "2026-11-01", time: "20:00" });
});

describe("prévia da importação", () => {
  it("mostra o que seria importado, o que já está registrado e os releases fora da coleção, sem gravar nada", async () => {
    const p = await verificarAudicoes(UID, csv("249504;2026-11-01;20:00", "R249504;2026-11-02;20:00", "999;2026-11-03;10:00", "555;2026-11-04;10:00", "abc;2026-11-05;10:00"), op);
    expect(p.estruturaOk).toBe(true);
    expect(p.contagens).toEqual({ total: 5, novas: 2, duplicadas: 1, semAlbum: 1, erros: 1, foraDaColecaoAtiva: 0 });
    expect(p.semAlbum).toEqual([{ releaseId: 999, audicoes: 1, linhas: [4] }]);
    expect(p.amostra.map((l) => l.releaseId)).toEqual([249504, 555]);
    expect(p.ignoradas).toHaveLength(1);
    expect(p.erros[0].linha).toBe(6);
    expect(banco.atual.escritas).toEqual([]);
  });

  it("informa estrutura inválida e recusa arquivo vazio ou grande demais", async () => {
    const p = await verificarAudicoes(UID, "id;dia\n1;2026-11-01", op);
    expect(p.estruturaOk).toBe(false);
    expect(p.erroEstrutura).toContain("discogs_id");
    await expect(verificarAudicoes(UID, "   ", op)).rejects.toMatchObject({ codigo: "arquivo_vazio", status: 400 });
    await expect(verificarAudicoes(UID, undefined, op)).rejects.toMatchObject({ codigo: "arquivo_vazio" });
    await expect(verificarAudicoes(UID, "x".repeat(3_000_001), op)).rejects.toMatchObject({ codigo: "arquivo_grande", status: 413 });
  });
});

describe("importação das audições", () => {
  it("grava só as audições novas de álbuns da coleção, com data, horário e identificação do álbum", async () => {
    const r = await aplicarAudicoes(UID, csv("249504;2026-11-02;20:00", "R555;03/11/2026;9:30"), op);
    expect(r).toMatchObject({ importadas: 2, pendentes: 0 });
    const novas = listens().filter(([p]) => !p.endsWith("/l1"));
    expect(novas).toHaveLength(2);
    const d = novas.map(([, x]) => x);
    expect(d.find((x) => x.releaseId === "249504")).toMatchObject({
      date: "2026-11-02", time: "20:00",
      snapshot: { artistName: "Rick Astley", title: "Never Gonna Give You Up", mediaType: "Vinyl" },
    });
    expect(d.find((x) => x.releaseId === "555")).toMatchObject({ date: "2026-11-03", time: "09:30" });
  });

  it("guarda o horário no fuso do usuário", async () => {
    await aplicarAudicoes(UID, csv("249504;2026-11-02;20:00"), op);
    const nova = listens().find(([p]) => !p.endsWith("/l1"))![1];
    expect((nova.listenedAt as Timestamp).toMillis()).toBe(Date.parse("2026-11-02T23:00:00Z")); // 20h em Brasília
    banco.atual.semear(`users/${UID}`, { timezone: "Asia/Tokyo" });
    await aplicarAudicoes(UID, csv("249504;2026-11-03;20:00"), op);
    const t = listens().find(([, x]) => x.date === "2026-11-03")![1];
    expect((t.listenedAt as Timestamp).toMillis()).toBe(Date.parse("2026-11-03T11:00:00Z")); // 20h em Tóquio
  });

  it("IGNORA a audição já registrada e NÃO importa a de release fora da coleção", async () => {
    const r = await aplicarAudicoes(UID, csv("249504;2026-11-01;20:00", "999;2026-11-02;20:00", "249504;2026-11-04;08:00"), op);
    expect(r.importadas).toBe(1);
    expect(r.contagens).toMatchObject({ duplicadas: 1, semAlbum: 1, novas: 1 });
    expect(listens()).toHaveLength(2); // a que já existia + 1 nova
    expect(listens().some(([, x]) => x.releaseId === "999")).toBe(false);
  });

  it("importar o mesmo arquivo de novo não duplica nada", async () => {
    const arquivo = csv("249504;2026-11-02;20:00", "555;2026-11-03;10:00", "249504;2026-11-02;20:00");
    expect((await aplicarAudicoes(UID, arquivo, op)).importadas).toBe(2);
    const antes = listens().length;
    const gravacoes = () => banco.atual.escritas.filter((p) => !p.includes("/locks/")).length; // a trava não conta
    const escritas = gravacoes();
    const segunda = await aplicarAudicoes(UID, arquivo, op);
    expect(segunda).toMatchObject({ importadas: 0, pendentes: 0 });
    expect(listens()).toHaveLength(antes);
    expect(gravacoes()).toBe(escritas); // nenhuma gravação, nem no histórico
  });

  it("álbum removido da coleção ativa: a audição é importada e o álbum não é alterado", async () => {
    const antes = albunsAntes();
    const r = await aplicarAudicoes(UID, csv("777;2026-11-02;20:00"), op);
    expect(r.importadas).toBe(1);
    expect(r.contagens.foraDaColecaoAtiva).toBe(1);
    expect(albunsAntes()).toBe(antes);
  });

  it("só escreve em audições e no histórico: coleção, álbuns e demais dados ficam intactos", async () => {
    const antes = albunsAntes();
    await aplicarAudicoes(UID, csv("249504;2026-11-02;20:00", "999;2026-11-02;21:00"), op);
    expect(albunsAntes()).toBe(antes);
    const caminhos = banco.atual.escritas.filter((p) => !p.includes("/locks/"));
    expect(caminhos.every((p) => p.startsWith(`${raiz}/listens/`) || p.startsWith(`${raiz}/changeLog/`))).toBe(true);
  });

  it("registra a importação no histórico de alterações, com o resumo", async () => {
    await aplicarAudicoes(UID, csv("249504;2026-11-02;20:00", "249504;2026-11-01;20:00", "999;2026-11-03;10:00"), op);
    const entrada = log().find((l) => l.tipo === "importacao")!;
    expect(entrada).toBeDefined();
    expect(String(entrada.resumo)).toContain("1 importada(s)");
    expect(String(entrada.resumo)).toContain("1 já registrada(s)");
    expect(String(entrada.resumo)).toContain("1 de releases fora da coleção");
    expect(entrada.at).toEqual({ _servidor: true });
  });

  it("sem nada a importar, não registra no histórico", async () => {
    await aplicarAudicoes(UID, csv("249504;2026-11-01;20:00"), op);
    expect(log()).toHaveLength(0);
  });

  it("recusa arquivo inválido e libera a trava", async () => {
    await expect(aplicarAudicoes(UID, "id;dia\n1;x", op)).rejects.toMatchObject({ codigo: "arquivo_invalido", status: 400 });
    expect(banco.atual.dados.has(`${raiz}/locks/importacao`)).toBe(false);
    expect(listens()).toHaveLength(1);
  });

  it("impede duas importações simultâneas", async () => {
    banco.atual.semear(`${raiz}/locks/importacao`, { expiraEm: Timestamp.fromMillis(AGORA + 60_000) });
    await expect(aplicarAudicoes(UID, csv("249504;2026-11-02;20:00"), op)).rejects.toMatchObject({ codigo: "trava", status: 409 });
    expect(listens()).toHaveLength(1);
  });

  it("arquivos grandes são gravados em partes e podem ser retomados sem duplicar", async () => {
    // 900 audições em horários diferentes
    const linhas = Array.from({ length: 900 }, (_, i) => `555;2026-0${1 + (i % 9)}-${String(1 + Math.floor(i / 9) % 28).padStart(2, "0")};${String(Math.floor(i / 252)).padStart(2, "0")}:${String(i % 60).padStart(2, "0")}`);
    const unicas = new Set(linhas).size;
    const relogio = { t: AGORA };
    const original = banco.atual.batch.bind(banco.atual);
    (banco.atual as unknown as { batch: () => unknown }).batch = () => {
      const b = original();
      const confirmar = b.commit;
      b.commit = async () => {
        await confirmar();
        relogio.t += 1000; // cada gravação em lote "gasta" 1 segundo
      };
      return b;
    };
    const parcial = await aplicarAudicoes(UID, csv(...linhas), { agora: () => relogio.t, orcamentoMs: 1500 });
    expect(parcial.importadas).toBe(800); // dois lotes de 400
    expect(parcial.pendentes).toBe(unicas - 800);
    const fim = await aplicarAudicoes(UID, csv(...linhas), { agora: () => relogio.t, orcamentoMs: 1500 });
    expect(fim.pendentes).toBe(0);
    expect(parcial.importadas + fim.importadas).toBe(unicas);
    expect(listens().filter(([, x]) => x.releaseId === "555")).toHaveLength(unicas);
  });
});
