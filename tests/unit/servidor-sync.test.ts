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

import { aplicarLote, aprovarPlano, cancelarSync, coletarColecao } from "@/lib/server/sincronizacao";

const UID = "u1";
const raiz = `users/${UID}`;

// ── dados de exemplo ──
const itemBruto = (id: number, titulo: string, artista: string, formato = "Vinyl"): ItemBruto => ({
  id,
  basic_information: { id, title: titulo, artists: [{ id: id * 10, name: artista }], formats: [{ name: formato, qty: "1" }], thumb: `https://i.discogs.com/${id}.jpg` },
});
const relBruto = (id: number, titulo: string, artista: string, formato = "Vinyl"): ReleaseBruto => ({
  id,
  title: titulo,
  year: 2000,
  artists: [{ id: id * 10, name: artista }],
  formats: [{ name: formato, qty: "1" }],
  tracklist: [{ position: "1", type_: "track", title: `Faixa de ${titulo}`, duration: "3:00" }],
});

function semearAlbum(db: BancoFalso, id: number, titulo: string, artista: string, status: "active" | "removed") {
  const novo = montarAlbumNovo(converterRelease(relBruto(id, titulo, artista)), "Vinyl");
  db.semear(`${raiz}/releases/${id}`, JSON.parse(JSON.stringify({ ...novo, status })));
}
function semearAudicoes(db: BancoFalso) {
  for (const [id, rel, data] of [["l1", "2", "2026-11-01"], ["l2", "2", "2026-11-05"], ["l3", "4", "2026-10-20"], ["l4", "1", "2026-11-10"]]) {
    db.semear(`${raiz}/listens/${id}`, { releaseId: rel, date: data, time: "20:00", snapshot: { artistName: "X", title: "Y", thumb: null, mediaType: "Vinyl" } });
  }
}
const audicoes = (db: BancoFalso) => JSON.stringify(db.sob(`${raiz}/listens`));

/**
 * Cenário: LogDisco tem 1 (ativo), 2 (ativo), 3 (removido) e 4 (ativo).
 * O Discogs tem 1, 3, 5 e 6 (este em Cassette) — o 1 aparece duas vezes (duas cópias).
 */
function cenario(db: BancoFalso) {
  semearAlbum(db, 1, "Álbum Um", "Banda A", "active");
  semearAlbum(db, 2, "Álbum Dois", "Banda B", "active");
  semearAlbum(db, 3, "Álbum Três", "Banda C", "removed");
  semearAlbum(db, 4, "Álbum Quatro", "Banda D", "active");
  semearAudicoes(db);
}

type Cfg = {
  paginas?: ItemBruto[][];
  releases?: Record<number, ReleaseBruto | Error>;
  custoMs?: number;
};
const PADRAO: Required<Cfg> = {
  paginas: [
    [itemBruto(1, "Álbum Um", "Banda A"), itemBruto(3, "Álbum Três", "Banda C"), itemBruto(5, "Álbum Cinco", "Banda E")],
    [itemBruto(6, "Álbum Seis", "Banda F", "Cassette"), itemBruto(1, "Álbum Um", "Banda A")],
  ],
  releases: {
    3: relBruto(3, "Álbum Três", "Banda C"),
    5: relBruto(5, "Álbum Cinco", "Banda E"),
    6: relBruto(6, "Álbum Seis", "Banda F", "Cassette"),
  },
  custoMs: 0,
};

function discogsFalso(cfg: Cfg = {}) {
  const c = { ...PADRAO, ...cfg };
  const relogio = { t: 0 };
  const chamadas = { colecao: [] as number[], releases: [] as number[] };
  const cliente = {
    listarColecao: async (_u: string, pagina: number) => {
      chamadas.colecao.push(pagina);
      relogio.t += c.custoMs;
      return { pagination: { page: pagina, pages: c.paginas.length, per_page: 100, items: 0 }, releases: c.paginas[pagina - 1] ?? [] };
    },
    buscarRelease: async (id: number) => {
      chamadas.releases.push(id);
      relogio.t += c.custoMs;
      const r = c.releases[id];
      if (r instanceof Error) throw r;
      if (!r) throw new DiscogsErro("nao_encontrado", "Não encontrado no Discogs.");
      return r;
    },
  } as unknown as DiscogsClient;
  return { cliente, relogio, chamadas, agora: () => relogio.t };
}

async function prepararPlano(cfg: Cfg = {}) {
  const d = discogsFalso(cfg);
  const r = await coletarColecao(UID, d.cliente, "colecionador", null);
  if (r.fase !== "pronto") throw new Error("o plano deveria estar pronto");
  return { ...d, runId: r.runId };
}
const run = (runId: string) => banco.atual.dados.get(`${raiz}/syncRuns/${runId}`)!;
const item = (runId: string, id: number) => banco.atual.dados.get(`${raiz}/syncRuns/${runId}/items/${id}`)!;
const release = (id: number) => banco.atual.dados.get(`${raiz}/releases/${id}`);
const tiposDoHistorico = () => banco.atual.sob(`${raiz}/changeLog`).map(([, d]) => d.tipo as string).sort();

beforeEach(() => {
  banco.atual = new BancoFalso();
  cenario(banco.atual);
});

describe("coleta e plano de alterações", () => {
  it("compara as coleções e separa o que será adicionado, reativado, mantido e removido", async () => {
    const { runId, chamadas } = await prepararPlano();
    expect(chamadas.colecao).toEqual([1, 2]);
    expect(run(runId).status).toBe("conferencia");
    expect(run(runId).contagens).toEqual({ totalDiscogs: 4, totalAtivos: 3, adicionar: 2, reativar: 1, manter: 1, remover: 2 });
    expect(run(runId).manterIds).toEqual([1]);
    const acoes = Object.fromEntries([5, 6, 3, 2, 4].map((id) => [id, item(runId, id).acao]));
    expect(acoes).toEqual({ 5: "adicionar", 6: "adicionar", 3: "reativar", 2: "remover", 4: "remover" });
    expect(item(runId, 6).categoria).toBeNull(); // Cassette: o usuário precisa escolher
    expect(item(runId, 5)).toMatchObject({ categoria: "Vinyl", selecionado: true, estado: "pendente" });
  });

  it("não altera a coleção nem as audições durante a verificação", async () => {
    const antes = audicoes(banco.atual);
    const albumAntes = JSON.stringify(release(2));
    const { runId } = await prepararPlano();
    expect(audicoes(banco.atual)).toBe(antes);
    expect(JSON.stringify(release(2))).toBe(albumAntes);
    expect(banco.atual.escritas.some((p) => p.includes("/releases/") || p.includes("/listens/"))).toBe(false);
    expect(release(5)).toBeUndefined();
    expect(banco.atual.sob(`${raiz}/syncRuns/${runId}/paginas`)).toHaveLength(0); // páginas temporárias apagadas
  });

  it("registra no histórico a falha da consulta e descarta o que foi coletado", async () => {
    const d = discogsFalso();
    d.cliente.listarColecao = async () => {
      throw new DiscogsErro("autenticacao", "O Discogs recusou o acesso.", { status: 401 });
    };
    await expect(coletarColecao(UID, d.cliente, "u", null)).rejects.toMatchObject({ tipo: "autenticacao" });
    const [[, falhou]] = banco.atual.sob(`${raiz}/syncRuns/`).filter(([p]) => p.split("/").length === 4);
    expect(falhou).toMatchObject({ status: "falhou", erro: "O Discogs recusou o acesso." });
    expect(release(5)).toBeUndefined();
  });

  it("no limite de requisições a verificação continua possível e o erro fica registrado", async () => {
    const d = discogsFalso();
    const original = d.cliente.listarColecao.bind(d.cliente);
    let chamadas = 0;
    d.cliente.listarColecao = async (u: string, p: number) => {
      if (++chamadas === 2) throw new DiscogsErro("limite", "O Discogs limitou as requisições.", { status: 429, retryAfterSegundos: 60 });
      return original(u, p);
    };
    const erro = await coletarColecao(UID, d.cliente, "u", null).catch((e) => e);
    expect(erro).toMatchObject({ tipo: "limite" });
    const [[caminho, parcial]] = banco.atual.sob(`${raiz}/syncRuns/`).filter(([p]) => p.split("/").length === 4);
    expect(parcial).toMatchObject({ status: "coletando", proximaPagina: 2, ultimoErro: "O Discogs limitou as requisições." });
    const runId = caminho.split("/").pop()!;
    const fim = await coletarColecao(UID, d.cliente, "u", runId);
    expect(fim.fase).toBe("pronto");
    expect(run(runId)).not.toHaveProperty("ultimoErro");
  });

  it("continua de onde parou quando o tempo de uma chamada acaba", async () => {
    const d = discogsFalso({ paginas: [[itemBruto(1, "A", "X")], [itemBruto(5, "B", "Y")], [itemBruto(6, "C", "Z")]], custoMs: 100 });
    const p1 = await coletarColecao(UID, d.cliente, "u", null, { orcamentoMs: 150, agora: d.agora });
    expect(p1).toMatchObject({ fase: "coletando", pagina: 2, totalPaginas: 3 });
    const p2 = await coletarColecao(UID, d.cliente, "u", p1.runId, { orcamentoMs: 150, agora: d.agora });
    expect(p2.fase).toBe("pronto");
    expect(d.chamadas.colecao).toEqual([1, 2, 3]);
    expect(run(p1.runId).contagens).toMatchObject({ totalDiscogs: 3 });
  });

  it("trata coleção vazia no Discogs: tudo que está ativo no LogDisco vira candidato à remoção", async () => {
    const { runId } = await prepararPlano({ paginas: [[]] });
    expect(run(runId).contagens).toMatchObject({ adicionar: 0, reativar: 0, manter: 0, remover: 3 });
  });

  it("uma nova verificação descarta a anterior que ninguém aprovou", async () => {
    const primeira = await prepararPlano();
    const segunda = await prepararPlano();
    expect(run(primeira.runId).status).toBe("cancelada");
    expect(run(segunda.runId).status).toBe("conferencia");
  });

  it("não inicia outra enquanto há uma sincronização aprovada em andamento", async () => {
    const { runId } = await prepararPlano();
    await aprovarPlano(UID, runId, { adicionar: [{ id: 5 }, { id: 6, mediaType: "CD" }], remover: [] });
    const erro = await coletarColecao(UID, discogsFalso().cliente, "u", null).catch((e) => e);
    expect(erro).toMatchObject({ codigo: "sync_em_andamento", status: 409, extra: { runId } });
  });
});

describe("aprovação", () => {
  it("só aceita álbuns que fazem parte do plano", async () => {
    const { runId } = await prepararPlano();
    await expect(aprovarPlano(UID, runId, { adicionar: [{ id: 999 }], remover: [] })).rejects.toMatchObject({ codigo: "selecao_invalida", status: 400 });
    await expect(aprovarPlano(UID, runId, { adicionar: [{ id: 2 }], remover: [] })).rejects.toMatchObject({ codigo: "selecao_invalida" }); // 2 é uma remoção
    await expect(aprovarPlano(UID, runId, { adicionar: [], remover: [5] })).rejects.toMatchObject({ codigo: "selecao_invalida" }); // 5 é uma adição
    expect(run(runId).status).toBe("conferencia");
  });

  it("exige escolher a categoria quando o Discogs não permite identificá-la", async () => {
    const { runId } = await prepararPlano();
    await expect(aprovarPlano(UID, runId, { adicionar: [{ id: 6 }], remover: [] })).rejects.toMatchObject({ codigo: "categoria_obrigatoria", status: 400, extra: { ids: [6] } });
    await expect(aprovarPlano(UID, runId, { adicionar: [{ id: 6, mediaType: "Fita" }], remover: [] })).rejects.toMatchObject({ codigo: "categoria_invalida" });
  });

  it("exige confirmação extra para remover metade ou mais da coleção", async () => {
    const db = banco.atual;
    for (let id = 10; id < 16; id++) semearAlbum(db, id, `Disco ${id}`, "Banda", "active");
    const { runId } = await prepararPlano({ paginas: [[]] }); // 9 ativos, nenhum no Discogs
    const todos = [1, 2, 4, 10, 11, 12, 13, 14, 15];
    await expect(aprovarPlano(UID, runId, { adicionar: [], remover: todos })).rejects.toMatchObject({ codigo: "confirmacao_necessaria", status: 409 });
    await expect(aprovarPlano(UID, runId, { adicionar: [], remover: todos, confirmouRemocaoEmMassa: true })).resolves.toEqual({ totalSelecionados: 9 });
  });

  it("marca como não selecionado o que o usuário desmarcou e só aprova uma vez", async () => {
    const { runId } = await prepararPlano();
    await aprovarPlano(UID, runId, { adicionar: [{ id: 5 }], remover: [2] });
    expect(item(runId, 5).selecionado).toBe(true);
    expect(item(runId, 2).selecionado).toBe(true);
    for (const id of [6, 3, 4]) expect(item(runId, id).selecionado).toBe(false);
    expect(run(runId)).toMatchObject({ status: "aplicando", totalSelecionados: 2 });
    await expect(aprovarPlano(UID, runId, { adicionar: [], remover: [] })).rejects.toMatchObject({ codigo: "estado_invalido" });
  });

  it("não aplica nada sem aprovação e permite cancelar só antes de aprovar", async () => {
    const { runId, cliente } = await prepararPlano();
    await expect(aplicarLote(UID, runId, cliente)).rejects.toMatchObject({ codigo: "estado_invalido" });
    await cancelarSync(UID, runId);
    expect(run(runId).status).toBe("cancelada");
    const outro = await prepararPlano();
    await aprovarPlano(UID, outro.runId, { adicionar: [], remover: [] });
    await expect(cancelarSync(UID, outro.runId)).rejects.toMatchObject({ codigo: "estado_invalido" });
  });
});

describe("aplicação das alterações aprovadas", () => {
  async function aprovarTudo() {
    const p = await prepararPlano();
    await aprovarPlano(UID, p.runId, {
      adicionar: [{ id: 3 }, { id: 5 }, { id: 6, mediaType: "CD" }],
      remover: [2, 4],
    });
    return p;
  }

  it("adiciona, reativa e remove; o histórico de audições fica intacto (exclusão lógica)", async () => {
    const antes = audicoes(banco.atual);
    const { runId, cliente } = await aprovarTudo();
    const r = await aplicarLote(UID, runId, cliente);

    expect(r.fase).toBe("concluida");
    expect(release(5)).toMatchObject({ status: "active", mediaType: "Vinyl", artistName: "Banda E" });
    expect(release(6)).toMatchObject({ status: "active", mediaType: "CD" }); // categoria escolhida pelo usuário
    expect(release(3)).toMatchObject({ status: "active" }); // reativado
    // removidos do Discogs: continuam gravados, só saem da coleção ativa
    expect(release(2)).toMatchObject({ status: "removed", artistName: "Banda B", title: "Álbum Dois" });
    expect(release(4)).toMatchObject({ status: "removed" });
    expect(release(2)).toHaveProperty("removedAt");
    expect(release(1)).toMatchObject({ status: "active" });

    expect(audicoes(banco.atual)).toBe(antes);
    expect(banco.atual.escritas.some((p) => p.includes("/listens/"))).toBe(false);
    expect(run(runId)).toMatchObject({
      status: "concluida",
      resultado: { adicionados: 2, reativados: 1, removidos: 2, inalterados: 1, naoSelecionados: 0, erros: 0 },
    });
    expect(run(runId)).toHaveProperty("concluidaEm");
    expect(tiposDoHistorico()).toEqual(["inclusao", "inclusao", "inclusao", "remocao", "remocao", "sincronizacao"]);
  });

  it("não duplica álbuns: repetir a chamada depois de concluída não faz nada", async () => {
    const { runId, cliente, chamadas } = await aprovarTudo();
    await aplicarLote(UID, runId, cliente);
    const albuns = banco.atual.sob(`${raiz}/releases/`).length;
    const escritas = banco.atual.escritas.length;
    const r = await aplicarLote(UID, runId, cliente);
    expect(r.fase).toBe("concluida");
    expect(banco.atual.sob(`${raiz}/releases/`).length).toBe(albuns);
    expect(banco.atual.escritas.length).toBe(escritas);
    expect(chamadas.releases).toEqual([3, 5, 6]);
  });

  it("só aplica o que foi selecionado", async () => {
    const { runId, cliente } = await prepararPlano();
    await aprovarPlano(UID, runId, { adicionar: [{ id: 5 }], remover: [2] });
    const r = await aplicarLote(UID, runId, cliente);
    expect(release(5)).toMatchObject({ status: "active" });
    expect(release(6)).toBeUndefined();
    expect(release(3)).toMatchObject({ status: "removed" }); // continua removido
    expect(release(2)).toMatchObject({ status: "removed" });
    expect(release(4)).toMatchObject({ status: "active" }); // não foi aprovado
    expect(r.resultado).toMatchObject({ adicionados: 1, removidos: 1, naoSelecionados: 3 });
  });

  it("trabalha em partes quando o tempo acaba e conclui na chamada seguinte", async () => {
    const p = await prepararPlano({ custoMs: 100 });
    await aprovarPlano(UID, p.runId, { adicionar: [{ id: 3 }, { id: 5 }, { id: 6, mediaType: "CD" }], remover: [] });
    const parte = await aplicarLote(UID, p.runId, p.cliente, { orcamentoMs: 150, agora: p.agora });
    expect(parte).toMatchObject({ fase: "aplicando", total: 3, feitos: 2 });
    expect(run(p.runId).status).toBe("aplicando");
    const fim = await aplicarLote(UID, p.runId, p.cliente, { orcamentoMs: 150, agora: p.agora });
    expect(fim).toMatchObject({ fase: "concluida", feitos: 3, total: 3 });
    expect(p.chamadas.releases).toEqual([3, 5, 6]); // cada álbum é consultado uma vez
  });

  it("registra erro de um álbum sem impedir os demais", async () => {
    const p = await prepararPlano({ releases: { 3: relBruto(3, "Álbum Três", "Banda C"), 6: relBruto(6, "Álbum Seis", "Banda F", "Cassette") } }); // 5 não existe
    await aprovarPlano(UID, p.runId, { adicionar: [{ id: 3 }, { id: 5 }, { id: 6, mediaType: "DVD" }], remover: [2] });
    const r = await aplicarLote(UID, p.runId, p.cliente);
    expect(r.fase).toBe("concluida");
    expect(run(p.runId).status).toBe("concluida_com_erros");
    expect(item(p.runId, 5)).toMatchObject({ estado: "erro", observacao: "Lançamento não encontrado no Discogs." });
    expect(release(5)).toBeUndefined();
    expect(release(6)).toMatchObject({ mediaType: "DVD" });
    expect(run(p.runId).resultado).toMatchObject({ adicionados: 1, reativados: 1, removidos: 1, erros: 1 });
  });

  it("interrompe no limite de requisições do Discogs e retoma depois, sem repetir o que já foi feito", async () => {
    const limite = new DiscogsErro("limite", "O Discogs limitou as requisições.", { status: 429, retryAfterSegundos: 60 });
    const p = await prepararPlano({ releases: { 3: relBruto(3, "Álbum Três", "Banda C"), 5: limite, 6: relBruto(6, "Álbum Seis", "Banda F", "Cassette") } });
    await aprovarPlano(UID, p.runId, { adicionar: [{ id: 3 }, { id: 5 }, { id: 6, mediaType: "CD" }], remover: [] });
    await expect(aplicarLote(UID, p.runId, p.cliente)).rejects.toMatchObject({ tipo: "limite" });
    expect(run(p.runId).status).toBe("aplicando");
    expect(item(p.runId, 5).estado).toBe("pendente");
    expect(banco.atual.dados.has(`${raiz}/locks/sync`)).toBe(false); // a trava é liberada mesmo com erro
    expect(run(p.runId).ultimoErro).toBe("O Discogs limitou as requisições.");

    const ok = discogsFalso();
    const fim = await aplicarLote(UID, p.runId, ok.cliente);
    expect(fim.fase).toBe("concluida");
    expect(ok.chamadas.releases).toEqual([5, 6]); // o álbum 3, já concluído antes da interrupção, não é consultado de novo
    expect(release(5)).toMatchObject({ status: "active" });
    expect(release(3)).toMatchObject({ status: "active" });
  });

  it("não deixa duas sincronizações aplicarem ao mesmo tempo", async () => {
    const { runId, cliente } = await aprovarTudo();
    banco.atual.semear(`${raiz}/locks/sync`, { expiraEm: Timestamp.fromMillis(Date.now() + 60_000) });
    await expect(aplicarLote(UID, runId, cliente)).rejects.toMatchObject({ codigo: "trava", status: 409 });
    expect(release(5)).toBeUndefined();
    // uma trava vencida (execução que caiu) não bloqueia
    banco.atual.semear(`${raiz}/locks/sync`, { expiraEm: Timestamp.fromMillis(Date.now() - 1000) });
    await expect(aplicarLote(UID, runId, cliente)).resolves.toMatchObject({ fase: "concluida" });
  });

  it("um álbum que já entrou na coleção entre a verificação e a aplicação não é duplicado", async () => {
    const { runId, cliente } = await aprovarTudo();
    semearAlbum(banco.atual, 5, "Álbum Cinco", "Banda E", "active"); // alguém cadastrou nesse meio tempo
    const antes = JSON.stringify(release(5));
    const r = await aplicarLote(UID, runId, cliente);
    expect(item(runId, 5)).toMatchObject({ estado: "feito", semMudanca: true });
    expect(JSON.stringify(release(5))).toBe(antes);
    expect(r.resultado).toMatchObject({ adicionados: 1, inalterados: 2 }); // 6 foi adicionado; 1 mantido + 5 já existia
  });

  it("um álbum que já saiu da coleção ativa é registrado sem mudança", async () => {
    const { runId, cliente } = await aprovarTudo();
    banco.atual.dados.get(`${raiz}/releases/2`)!.status = "removed";
    await aplicarLote(UID, runId, cliente);
    expect(item(runId, 2)).toMatchObject({ estado: "feito", semMudanca: true });
    expect(tiposDoHistorico().filter((t) => t === "remocao")).toHaveLength(1); // só o álbum 4
  });
});
