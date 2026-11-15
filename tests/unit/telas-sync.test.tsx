import { renderToString } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { SyncItemDoc, SyncRunDoc } from "@/lib/sync/tipos";
import { dupla, rick, various } from "./fixtures/albuns";

const estado = vi.hoisted(() => ({
  emAndamento: null as unknown,
  ultima: null as unknown,
  run: null as unknown,
  itens: null as unknown,
  colecao: null as unknown,
}));

vi.mock("@/lib/auth-context", () => ({
  useAuth: () => ({ user: { uid: "u1", displayName: "Ana", email: "a@x.com" }, carregando: false, sair: async () => {}, atualizar: async () => {} }),
}));
vi.mock("@/lib/colecao-context", () => ({ useColecao: () => estado.colecao }));
vi.mock("@/lib/sync/use-sync", () => ({
  useSyncEmAndamento: () => estado.emAndamento,
  useUltimaSincronizacao: () => estado.ultima,
  useRun: () => estado.run,
  useItensSync: () => estado.itens,
  formatarMomento: (m: unknown) => (m ? "14/11/2026 10:00" : "—"),
}));

import { ConferenciaSync } from "@/components/ConferenciaSync";
import Colecao from "@/app/(app)/colecao/page";
import Sincronizar from "@/app/(app)/colecao/sincronizar/page";

const momento = { toMillis: () => 0, toDate: () => new Date(0) };
const semTags = (html: string) => html.replace(/<!-- -->/g, "");

const item = (id: number, acao: SyncItemDoc["acao"], titulo: string, categoria: SyncItemDoc["categoria"] = "Vinyl"): SyncItemDoc => ({
  id: String(id), releaseId: id, acao, grupo: acao === "remover" ? "saida" : "entrada", titulo, artista: "Banda", categoria,
  capa: null, selecionado: true, estado: "pendente", formatoOriginal: categoria ?? "Cassette",
});
const run = (extra: Partial<SyncRunDoc> = {}): SyncRunDoc => ({
  id: "r1", status: "conferencia", criadaEm: momento, discogsUsername: "colecionador",
  contagens: { totalDiscogs: 4, totalAtivos: 3, adicionar: 2, reativar: 1, manter: 1, remover: 1 },
  manterIds: [249504], ...extra,
});
const noop = () => {};
const propsBase = { ativos: [rick(), various(), dupla()], ocupado: false, erro: null, aoAprovar: noop, aoCancelar: noop };

beforeEach(() => {
  estado.emAndamento = null;
  estado.ultima = null;
  estado.run = null;
  estado.itens = null;
  estado.colecao = { todos: [], ativos: [rick(), various(), dupla()], audicoes: [], idsOuvidos: new Set(), carregando: false, erro: null };
});

describe("tela de conferência", () => {
  const itens = [item(5, "adicionar", "Álbum Cinco"), item(6, "adicionar", "Álbum Seis", null), item(3, "reativar", "Álbum Três"), item(2, "remover", "Álbum Dois")];

  it("separa as alterações nas categorias exigidas e mostra as contagens", () => {
    const html = semTags(renderToString(<ConferenciaSync run={run()} itens={itens} {...propsBase} />));
    expect(html).toContain("Álbuns que serão adicionados");
    expect(html).toContain("Álbuns que já existem e não precisam de alteração");
    expect(html).toContain("Álbuns que serão removidos da coleção ativa");
    expect(html).toContain("(3)"); // 2 adicionar + 1 reativar
    expect(html).toContain("(1)");
    expect(html).toContain("Álbum Cinco");
    expect(html).toContain("Álbum Dois");
    expect(html).toContain("Nada foi alterado ainda");
  });

  it("deixa claro que o histórico de audições é mantido e que a remoção é lógica", () => {
    const html = semTags(renderToString(<ConferenciaSync run={run()} itens={itens} {...propsBase} />));
    expect(html).toContain("histórico de audições é mantido");
    expect(html).toContain("nunca são alterados");
    expect(html).toContain("já esteve na coleção e voltará com o histórico");
  });

  it("pede a categoria quando o formato do Discogs não é reconhecido e bloqueia a aprovação", () => {
    const html = semTags(renderToString(<ConferenciaSync run={run()} itens={itens} {...propsBase} />));
    expect(html).toContain("Escolha o tipo de mídia…");
    expect(html).toContain("Escolha o tipo de mídia de 1 álbum(ns).");
    expect(html).toMatch(/<button[^>]*disabled=""[^>]*>[^<]*(<svg.*?<\/svg>)?\s*Aprovar e sincronizar/s);
  });

  it("libera a aprovação quando todas as categorias estão definidas", () => {
    const ok = [item(5, "adicionar", "Álbum Cinco"), item(2, "remover", "Álbum Dois")];
    const html = semTags(renderToString(<ConferenciaSync run={run()} itens={ok} {...propsBase} />));
    expect(html).not.toMatch(/disabled=""[^>]*>[^<]*Aprovar e sincronizar/);
    expect(html).toContain("1 a adicionar · 1 a remover");
  });

  it("alerta e exige confirmação extra quando a remoção atinge metade da coleção", () => {
    const remocoes = [1, 2, 3, 4, 5, 6].map((n) => item(n, "remover", `Disco ${n}`));
    const r = run({ contagens: { totalDiscogs: 0, totalAtivos: 6, adicionar: 0, reativar: 0, manter: 0, remover: 6 }, manterIds: [] });
    const html = semTags(renderToString(<ConferenciaSync run={r} itens={remocoes} {...propsBase} />));
    expect(html).toContain("isso remove 6 de 6 álbuns");
    expect(html).toContain("Confirmo que quero remover");
    expect(html).toMatch(/disabled=""[^>]*>[^<]*(<svg.*?<\/svg>)?\s*Aprovar e sincronizar/s);
  });

  it("avisa quando as duas coleções estão iguais", () => {
    const html = semTags(renderToString(<ConferenciaSync run={run({ contagens: { totalDiscogs: 3, totalAtivos: 3, adicionar: 0, reativar: 0, manter: 3, remover: 0 } })} itens={[]} {...propsBase} />));
    expect(html).toContain("As duas coleções estão iguais");
  });
});

describe("página Sincronizar", () => {
  it("sem sincronização em andamento, oferece verificar as diferenças e mostra a última", () => {
    estado.emAndamento = null;
    estado.run = null;
    let html = semTags(renderToString(<Sincronizar />));
    expect(html).toContain("Verificar diferenças");
    expect(html).toContain("nenhuma realizada ainda");
    expect(html).toContain("Só depois da sua aprovação alguma coisa é alterada");

    estado.ultima = { id: "x", status: "concluida", concluidaEm: momento };
    html = semTags(renderToString(<Sincronizar />));
    expect(html).toContain("14/11/2026 10:00 · Concluída");
  });

  it("verificação interrompida pode ser retomada ou descartada", () => {
    estado.emAndamento = run({ status: "coletando", totalPaginas: 12, proximaPagina: 4, ultimoErro: "O Discogs limitou as requisições." });
    estado.run = estado.emAndamento;
    const html = semTags(renderToString(<Sincronizar />));
    expect(html).toContain("Retomar verificação");
    expect(html).toContain("Descartar");
    expect(html).toContain("parou na página 3 de 12");
    expect(html).toContain("O Discogs limitou as requisições.");
  });

  it("sincronização aprovada que não terminou pode ser continuada", () => {
    estado.emAndamento = run({ status: "aplicando", totalSelecionados: 40 });
    estado.run = estado.emAndamento;
    const html = semTags(renderToString(<Sincronizar />));
    expect(html).toContain("Continuar sincronização");
    expect(html).toContain("40 álbuns aprovados");
  });

  it("na conferência, mostra as três categorias", () => {
    estado.emAndamento = run();
    estado.run = estado.emAndamento;
    estado.itens = [item(5, "adicionar", "Álbum Cinco"), item(2, "remover", "Álbum Dois")];
    const html = semTags(renderToString(<Sincronizar />));
    expect(html).toContain("Álbuns que serão adicionados");
    expect(html).toContain("Aprovar e sincronizar");
  });

  it("depois de concluir, mostra o resultado e os álbuns com erro", () => {
    const r = run({ status: "concluida_com_erros", resultado: { adicionados: 2, reativados: 1, removidos: 2, inalterados: 5, naoSelecionados: 0, erros: 1 } });
    estado.emAndamento = null;
    estado.run = r;
    estado.itens = [{ ...item(7, "adicionar", "Álbum Sete"), estado: "erro", observacao: "Lançamento não encontrado no Discogs." }];
    const html = semTags(renderToString(<Sincronizar />));
    expect(html).toContain("alguns álbuns não puderam ser incluídos");
    expect(html).toMatch(/Adicionados<\/dt><dd[^>]*>3</); // 2 adicionados + 1 reativado
    expect(html).toMatch(/Removidos da coleção ativa<\/dt><dd[^>]*>2</);
    expect(html).toMatch(/Inalterados<\/dt><dd[^>]*>5</);
    expect(html).toContain("Álbuns com erro");
    expect(html).toContain("Lançamento não encontrado no Discogs.");
    expect(html).toContain('href="/colecao/sincronizacoes"');
  });

  it("uma sincronização sem erros termina com mensagem de sucesso", () => {
    estado.run = run({ status: "concluida", resultado: { adicionados: 0, reativados: 0, removidos: 0, inalterados: 3, naoSelecionados: 0, erros: 0 } });
    estado.itens = [];
    const html = semTags(renderToString(<Sincronizar />));
    expect(html).toContain("Sincronização concluída.");
    expect(html).not.toContain("Álbuns com erro");
  });
});

describe("tela da coleção", () => {
  it("tem o botão Sincronizar, o indicador da última sincronização e o histórico", () => {
    estado.ultima = { id: "x", status: "concluida_com_erros", concluidaEm: momento };
    const html = semTags(renderToString(<Colecao />));
    expect(html).toContain("Sincronizar");
    expect(html).toContain('href="/colecao/sincronizar"');
    expect(html).toContain("Última sincronização:");
    expect(html).toContain("14/11/2026 10:00 · Concluída com erros");
    expect(html).toContain('href="/colecao/sincronizacoes"');
    expect(html).toContain("Ver todos os artistas");
  });
  it("informa quando nunca houve sincronização", () => {
    estado.ultima = null;
    expect(semTags(renderToString(<Colecao />))).toContain("nenhuma realizada ainda");
  });
});
