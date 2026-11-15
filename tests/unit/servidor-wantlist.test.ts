import { Timestamp } from "firebase-admin/firestore";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { montarAlbumNovo } from "@/lib/colecao/atualizacao";
import type { DiscogsClient } from "@/lib/discogs/cliente";
import { DiscogsErro } from "@/lib/discogs/erros";
import { converterRelease, type ReleaseBruto } from "@/lib/discogs/release";
import type { ItemBruto } from "@/lib/sync/plano";
import { BancoFalso } from "./fixtures/firestore-falso";

const { banco } = vi.hoisted(() => ({ banco: { atual: null as unknown as BancoFalso } }));
vi.mock("@/lib/firebase-admin", () => ({
  getAdminDb: () => banco.atual,
  ErroConfiguracao: class extends Error {},
}));

import { executarCronWantlist } from "@/lib/server/cron-wantlist";
import { adicionarQueroConhecer } from "@/lib/server/descobrir";
import { atualizarWantlist } from "@/lib/server/wantlist";

const UID = "u1";
const raiz = `users/${UID}`;
const utc = (s: string) => Date.parse(s);

const querido = (id: number, titulo: string, artista: string, formato = "Vinyl"): ItemBruto => ({
  id,
  basic_information: { id, title: titulo, artists: [{ id: id * 10, name: artista }], formats: [{ name: formato, qty: "1" }], thumb: `https://i.discogs.com/${id}.jpg` },
});
const relBruto = (id: number, titulo: string, artista: string): ReleaseBruto => ({
  id, title: titulo, year: 2000, artists: [{ id: id * 10, name: artista }], formats: [{ name: "Vinyl", qty: "1" }],
  tracklist: [{ position: "1", type_: "track", title: "Faixa" }],
});

type Cfg = { paginas?: ItemBruto[][]; custoMs?: number; falhaNaPagina?: { pagina: number; erro: Error } };
function discogsFalso(cfg: Cfg = {}) {
  const paginas = cfg.paginas ?? [[querido(1, "Desejo Um", "Banda A"), querido(2, "Desejo Dois", "Banda B")], [querido(3, "Desejo Três", "Banda C", "CD")]];
  const relogio = { t: 0 };
  const chamadas: number[] = [];
  let falhou = false;
  const cliente = {
    listarWantlist: async (_u: string, pagina: number) => {
      chamadas.push(pagina);
      relogio.t += cfg.custoMs ?? 0;
      if (cfg.falhaNaPagina && cfg.falhaNaPagina.pagina === pagina && !falhou) {
        falhou = true;
        throw cfg.falhaNaPagina.erro;
      }
      return { pagination: { page: pagina, pages: paginas.length, per_page: 100, items: 0 }, wants: paginas[pagina - 1] ?? [] };
    },
  } as unknown as DiscogsClient;
  return { cliente, chamadas, relogio, agora: () => relogio.t };
}

const runs = () => banco.atual.sob(`${raiz}/wantlistRuns/`).filter(([p]) => p.split("/").length === 4);
const ultimaRun = () => runs().map(([p, d]) => ({ id: p.split("/").pop()!, ...d }))[0] as Record<string, unknown> & { id: string };
const desejo = (id: number) => banco.atual.dados.get(`${raiz}/wantlist/${id}`);
const idsDesejos = () => banco.atual.sob(`${raiz}/wantlist/`).map(([p]) => p.split("/").pop()).sort();
const aviso = () => banco.atual.dados.get(`${raiz}/notifications/wantlist-erro`);

function semearColecaoEAudicoes(db: BancoFalso) {
  const novo = montarAlbumNovo(converterRelease(relBruto(249504, "Álbum da Coleção", "Banda X")), "Vinyl");
  db.semear(`${raiz}/releases/249504`, JSON.parse(JSON.stringify({ ...novo, status: "active" })));
  db.semear(`${raiz}/listens/l1`, { releaseId: "249504", date: "2026-11-01", time: "20:00" });
  db.semear(`${raiz}/listens/l2`, { releaseId: "249504", date: "2026-11-05", time: "09:30" });
  db.semear(`${raiz}/quero-nada`, {});
}
const preservados = (db: BancoFalso) => JSON.stringify([...db.sob(`${raiz}/releases/`), ...db.sob(`${raiz}/listens/`), ...db.sob(`${raiz}/discover/`)]);

beforeEach(() => {
  banco.atual = new BancoFalso();
  semearColecaoEAudicoes(banco.atual);
});

describe("atualização da lista de desejos", () => {
  it("cria a lista a partir da wantlist do Discogs e registra o resultado", async () => {
    const d = discogsFalso();
    const r = await atualizarWantlist(UID, d.cliente, "colecionador", { origem: "manual" });
    expect(r.fase).toBe("concluida");
    expect(idsDesejos()).toEqual(["1", "2", "3"]);
    expect(desejo(3)).toMatchObject({ titulo: "Desejo Três", artista: "Banda C", formatos: ["CD"], categoria: "CD", artistKeys: ["30"], discogsUrl: "https://www.discogs.com/release/3" });
    expect(ultimaRun()).toMatchObject({ status: "concluida", origem: "manual", resultado: { total: 3, adicionados: 3, removidos: 0, atualizados: 0 } });
    expect(ultimaRun()).toHaveProperty("concluidaEm");
    expect(typeof ultimaRun().concluidaEmMs).toBe("number");
    expect(banco.atual.sob(`${raiz}/wantlistRuns/${ultimaRun().id}/paginas`)).toHaveLength(0);
    expect(aviso()).toBeUndefined();
  });

  it("NÃO ALTERA coleção, audições nem Quero Conhecer", async () => {
    banco.atual.semear(`${raiz}/discover/9`, { titulo: "Quero ouvir" });
    const antes = preservados(banco.atual);
    await atualizarWantlist(UID, discogsFalso().cliente, "u", { origem: "automatica" });
    expect(preservados(banco.atual)).toBe(antes);
    expect(banco.atual.escritas.some((p) => p.includes("/releases/") || p.includes("/listens/") || p.includes("/discover/"))).toBe(false);
  });

  it("guarda também os discos que já estão na coleção; é a tela que os oculta", async () => {
    const d = discogsFalso({ paginas: [[querido(249504, "Álbum da Coleção", "Banda X"), querido(2, "Outro", "Banda B")]] });
    await atualizarWantlist(UID, d.cliente, "u", { origem: "manual" });
    expect(idsDesejos()).toEqual(["2", "249504"]);
  });

  it("deixa a lista igual à do Discogs: adiciona, atualiza e remove", async () => {
    await atualizarWantlist(UID, discogsFalso().cliente, "u", { origem: "manual" });
    const segunda = discogsFalso({ paginas: [[querido(1, "Desejo Um", "Banda A"), querido(3, "Desejo Três (Remaster)", "Banda C", "CD"), querido(4, "Novo Desejo", "Banda D")]] });
    const r = await atualizarWantlist(UID, segunda.cliente, "u", { origem: "automatica" });
    expect(r.fase === "concluida" && r.resultado).toEqual({ total: 3, adicionados: 1, removidos: 1, atualizados: 1 });
    expect(idsDesejos()).toEqual(["1", "3", "4"]);
    expect(desejo(3)).toMatchObject({ titulo: "Desejo Três (Remaster)" });
    expect(desejo(2)).toBeUndefined();
  });

  it("trabalha em partes e a chamada seguinte retoma a mesma execução", async () => {
    const d = discogsFalso({ paginas: [[querido(1, "A", "X")], [querido(2, "B", "Y")], [querido(3, "C", "Z")]], custoMs: 100 });
    const p1 = await atualizarWantlist(UID, d.cliente, "u", { origem: "manual", orcamentoMs: 150, agora: d.agora });
    expect(p1).toMatchObject({ fase: "coletando", pagina: 2, totalPaginas: 3 });
    expect(idsDesejos()).toEqual([]); // nada visível até coletar tudo
    const p2 = await atualizarWantlist(UID, d.cliente, "u", { origem: "manual", orcamentoMs: 150, agora: d.agora });
    expect(p2.fase).toBe("concluida");
    expect(p2.runId).toBe(p1.runId);
    expect(d.chamadas).toEqual([1, 2, 3]);
    expect(idsDesejos()).toEqual(["1", "2", "3"]);
  });

  it("no limite do Discogs, avisa o usuário, guarda o erro e retoma sem refazer as páginas já lidas", async () => {
    const limite = new DiscogsErro("limite", "O Discogs limitou as requisições.", { status: 429, retryAfterSegundos: 60 });
    const d = discogsFalso({ falhaNaPagina: { pagina: 2, erro: limite } });
    await expect(atualizarWantlist(UID, d.cliente, "u", { origem: "automatica" })).rejects.toMatchObject({ tipo: "limite" });
    expect(ultimaRun()).toMatchObject({ status: "coletando", proximaPagina: 2, ultimoErro: "O Discogs limitou as requisições." });
    expect(aviso()).toMatchObject({ tipo: "wantlist_erro", lida: false });
    expect(String(aviso()!.mensagem)).toContain("O Discogs limitou as requisições.");
    expect(banco.atual.dados.has(`${raiz}/locks/wantlist`)).toBe(false);

    const r = await atualizarWantlist(UID, d.cliente, "u", { origem: "automatica" });
    expect(r.fase).toBe("concluida");
    expect(d.chamadas).toEqual([1, 2, 2]); // a página 1 não foi lida de novo
    expect(ultimaRun()).not.toHaveProperty("ultimoErro");
    expect(aviso()).toBeUndefined(); // o aviso some quando a atualização dá certo
  });

  it("falha de autenticação encerra a execução, avisa e mantém a lista como estava", async () => {
    await atualizarWantlist(UID, discogsFalso().cliente, "u", { origem: "manual" });
    const antes = JSON.stringify(banco.atual.sob(`${raiz}/wantlist/`));
    const recusa = new DiscogsErro("autenticacao", "O Discogs recusou o acesso.", { status: 401 });
    const d = discogsFalso({ falhaNaPagina: { pagina: 1, erro: recusa } });
    await expect(atualizarWantlist(UID, d.cliente, "u", { origem: "automatica" })).rejects.toMatchObject({ tipo: "autenticacao" });
    const falha = runs().map(([, r]) => r).find((r) => r.status === "falhou");
    expect(falha).toMatchObject({ status: "falhou", erro: "O Discogs recusou o acesso.", origem: "automatica" });
    expect(JSON.stringify(banco.atual.sob(`${raiz}/wantlist/`))).toBe(antes);
    expect(aviso()).toMatchObject({ lida: false });
  });

  it("impede execuções simultâneas e libera a trava depois", async () => {
    banco.atual.semear(`${raiz}/locks/wantlist`, { expiraEm: Timestamp.fromMillis(Date.now() + 60_000) });
    await expect(atualizarWantlist(UID, discogsFalso().cliente, "u", { origem: "manual" })).rejects.toMatchObject({ codigo: "trava", status: 409 });
    expect(runs()).toHaveLength(0);
    banco.atual.semear(`${raiz}/locks/wantlist`, { expiraEm: Timestamp.fromMillis(Date.now() - 1000) }); // trava vencida
    await expect(atualizarWantlist(UID, discogsFalso().cliente, "u", { origem: "manual" })).resolves.toMatchObject({ fase: "concluida" });
    expect(banco.atual.dados.has(`${raiz}/locks/wantlist`)).toBe(false);
  });

  it("descarta uma execução incompleta antiga em vez de retomar dados velhos", async () => {
    banco.atual.semear(`${raiz}/wantlistRuns/velha`, { status: "coletando", origem: "manual", criadaEmMs: Date.now() - 3 * 86_400_000, proximaPagina: 2, totalPaginas: 3 });
    const r = await atualizarWantlist(UID, discogsFalso().cliente, "u", { origem: "manual" });
    expect(r.runId).not.toBe("velha");
    expect(banco.atual.dados.get(`${raiz}/wantlistRuns/velha`)).toMatchObject({ status: "falhou" });
  });

  it("uma wantlist vazia esvazia a lista de desejos", async () => {
    await atualizarWantlist(UID, discogsFalso().cliente, "u", { origem: "manual" });
    const r = await atualizarWantlist(UID, discogsFalso({ paginas: [[]] }).cliente, "u", { origem: "manual" });
    expect(r.fase === "concluida" && r.resultado).toMatchObject({ total: 0, removidos: 3 });
    expect(idsDesejos()).toEqual([]);
  });
});

describe("tarefa agendada de domingo", () => {
  const DOMINGO = utc("2026-11-15T14:05:00Z"); // 11h05 em Brasília
  const run = (uid: string, concluidaEm: string) =>
    banco.atual.semear(`users/${uid}/wantlistRuns/anterior`, { status: "concluida", origem: "automatica", concluidaEmMs: utc(concluidaEm) });
  const usuario = (uid: string, timezone?: unknown, vinculo = "2026-10-01T12:00:00Z") => {
    banco.atual.semear(`users/${uid}`, timezone === undefined ? {} : { timezone });
    banco.atual.semear(`users/${uid}/integrations/discogs`, { username: uid, linkedAt: Timestamp.fromMillis(utc(vinculo)) });
  };
  const clientes = () => {
    const chamadas: string[] = [];
    return {
      chamadas,
      contaDiscogs: async (uid: string) => {
        chamadas.push(uid);
        return { cliente: discogsFalso().cliente, username: uid };
      },
    };
  };
  const por = (r: { uid: string; resultado: string }[]) => Object.fromEntries(r.map((x) => [x.uid, x.resultado]));
  const runsDe = (uid: string) => banco.atual.sob(`users/${uid}/wantlistRuns/`).filter(([p]) => p.split("/").length === 4 && !p.endsWith("/anterior"));

  it("só atualiza quem está pendente, respeitando o fuso de cada usuário", async () => {
    usuario("a", "America/Sao_Paulo"); run("a", "2026-11-08T14:10:00Z"); // concluída no domingo passado → pendente
    usuario("b", "America/Sao_Paulo"); run("b", "2026-11-15T14:01:00Z"); // já feita hoje → pula
    usuario("c", "Asia/Tokyo"); run("c", "2026-11-15T03:00:00Z"); // feita depois do domingo 11h de Tóquio → pula
    usuario("d", "America/Sao_Paulo"); run("d", "2026-11-15T03:00:00Z"); // mesma hora, mas antes das 11h de Brasília → pendente
    const k = clientes();
    const r = await executarCronWantlist({ uids: ["a", "b", "c", "d"], contaDiscogs: k.contaDiscogs, agora: () => DOMINGO });
    expect(por(r)).toEqual({ a: "executada", b: "pulada", c: "pulada", d: "executada" });
    expect(k.chamadas).toEqual(["a", "d"]); // quem foi pulado nem consulta o Discogs
    expect(runsDe("a")[0][1]).toMatchObject({ origem: "automatica", status: "concluida" });
    expect(runsDe("b")).toHaveLength(0);
  });

  it("não age antes das 11h do domingo", async () => {
    usuario("a"); run("a", "2026-11-08T14:10:00Z");
    const r = await executarCronWantlist({ uids: ["a"], contaDiscogs: clientes().contaDiscogs, agora: () => utc("2026-11-15T13:30:00Z") });
    expect(por(r)).toEqual({ a: "pulada" });
  });

  it("se o domingo falhou, a segunda-feira detecta a semana pendente", async () => {
    usuario("a"); run("a", "2026-11-08T14:10:00Z");
    const r = await executarCronWantlist({ uids: ["a"], contaDiscogs: clientes().contaDiscogs, agora: () => utc("2026-11-16T14:00:00Z") });
    expect(por(r)).toEqual({ a: "executada" });
  });

  it("uma atualização manual feita nesta semana evita a automática", async () => {
    usuario("a"); run("a", "2026-11-16T10:00:00Z"); // segunda, manual
    const r = await executarCronWantlist({ uids: ["a"], contaDiscogs: clientes().contaDiscogs, agora: () => utc("2026-11-17T14:00:00Z") });
    expect(por(r)).toEqual({ a: "pulada" });
  });

  it("quem vinculou o Discogs depois do último domingo espera o próximo", async () => {
    usuario("novo", undefined, "2026-11-11T12:00:00Z"); // vinculou na quarta, sem nenhuma atualização
    usuario("antigo", undefined, "2026-11-03T12:00:00Z"); // vinculou na terça da semana anterior
    const r = await executarCronWantlist({ uids: ["novo", "antigo"], contaDiscogs: clientes().contaDiscogs, agora: () => DOMINGO });
    expect(por(r)).toEqual({ novo: "executada", antigo: "executada" }); // ambos: domingo 15 é depois dos dois vínculos
    const r2 = await executarCronWantlist({ uids: ["novo"], contaDiscogs: clientes().contaDiscogs, agora: () => utc("2026-11-12T14:00:00Z") });
    expect(por(r2)).toEqual({ novo: "pulada" });
  });

  it("fuso ausente ou inválido usa Brasília", async () => {
    usuario("a", "Marte/Olympus"); run("a", "2026-11-08T14:10:00Z");
    usuario("b"); run("b", "2026-11-08T14:10:00Z");
    const r = await executarCronWantlist({ uids: ["a", "b"], contaDiscogs: clientes().contaDiscogs, agora: () => DOMINGO });
    expect(por(r)).toEqual({ a: "executada", b: "executada" });
  });

  it("o erro de um usuário não impede os demais, e fica registrado e notificado", async () => {
    usuario("ruim"); run("ruim", "2026-11-08T14:10:00Z");
    usuario("bom"); run("bom", "2026-11-08T14:10:00Z");
    const falha = new DiscogsErro("autenticacao", "O Discogs recusou o acesso.", { status: 401 });
    const contaDiscogs = async (uid: string) => ({
      cliente: uid === "ruim" ? ({ listarWantlist: async () => { throw falha; } } as unknown as DiscogsClient) : discogsFalso().cliente,
      username: uid,
    });
    const r = await executarCronWantlist({ uids: ["ruim", "bom"], contaDiscogs, agora: () => DOMINGO });
    expect(por(r)).toEqual({ ruim: "erro", bom: "executada" });
    expect(r[0].detalhe).toBe("O Discogs recusou o acesso.");
    expect(banco.atual.dados.get("users/ruim/notifications/wantlist-erro")).toMatchObject({ lida: false });
    expect(runsDe("ruim")[0][1]).toMatchObject({ status: "falhou" });
    expect(runsDe("bom")[0][1]).toMatchObject({ status: "concluida" });
  });

  it("sem tempo, deixa os usuários restantes para a próxima execução", async () => {
    usuario("a"); run("a", "2026-11-08T14:10:00Z");
    const r = await executarCronWantlist({ uids: ["a"], contaDiscogs: clientes().contaDiscogs, agora: () => DOMINGO, orcamentoMs: 2000 });
    expect(por(r)).toEqual({ a: "adiada" });
    expect(runsDe("a")).toHaveLength(0);
  });

  it("NÃO ALTERA coleção, audições nem Quero Conhecer de nenhum usuário", async () => {
    usuario(UID); run(UID, "2026-11-08T14:10:00Z");
    banco.atual.semear(`${raiz}/discover/9`, { titulo: "Quero ouvir" });
    const antes = preservados(banco.atual);
    await executarCronWantlist({ uids: [UID], contaDiscogs: clientes().contaDiscogs, agora: () => DOMINGO });
    expect(preservados(banco.atual)).toBe(antes);
    expect(banco.atual.escritas.some((p) => p.includes("/releases/") || p.includes("/listens/") || p.includes("/discover/"))).toBe(false);
  });
});

describe("Quero Conhecer", () => {
  const release = () => converterRelease(relBruto(555, "Disco Para Ouvir", "Banda Y"));

  it("guarda o álbum sem mexer na coleção nem na lista de desejos", async () => {
    const antes = preservados(banco.atual);
    await expect(adicionarQueroConhecer(UID, release())).resolves.toEqual({ releaseId: "555" });
    expect(banco.atual.dados.get(`${raiz}/discover/555`)).toMatchObject({ titulo: "Disco Para Ouvir", artista: "Banda Y", artistKeys: ["5550"], discogsUrl: expect.stringContaining("/release/555") });
    expect(banco.atual.sob(`${raiz}/wantlist/`)).toHaveLength(0);
    expect(banco.atual.dados.has(`${raiz}/releases/555`)).toBe(false);
    expect(preservados(banco.atual).startsWith(antes.slice(0, -1))).toBe(true); // só ganhou o novo item em discover
  });

  it("não duplica o mesmo álbum", async () => {
    await adicionarQueroConhecer(UID, release());
    await expect(adicionarQueroConhecer(UID, release())).rejects.toMatchObject({ codigo: "duplicado", status: 409 });
    expect(banco.atual.sob(`${raiz}/discover/`)).toHaveLength(1);
  });

  it("um álbum pode estar ao mesmo tempo no Quero Conhecer e na coleção", async () => {
    await adicionarQueroConhecer(UID, converterRelease(relBruto(249504, "Álbum da Coleção", "Banda X")));
    expect(banco.atual.dados.has(`${raiz}/discover/249504`)).toBe(true);
    expect(banco.atual.dados.get(`${raiz}/releases/249504`)).toMatchObject({ status: "active" });
  });
});
