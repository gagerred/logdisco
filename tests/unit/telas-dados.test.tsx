import { renderToString } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { validarBackup, montarBackup, dividirEmLotes, type ItemBackup } from "@/lib/backup/esquema";
import type { PrevisaoImportacao } from "@/lib/csv/importacao";
import { filtrarHistorico, rotuloDoTipo, tiposPresentes, type EntradaHistorico } from "@/lib/historico";
import type { AudicaoDoc } from "@/lib/tipos";
import { rick, various } from "./fixtures/albuns";

const estado = vi.hoisted(() => ({ audicoes: [] as unknown[] }));

vi.mock("@/lib/auth-context", () => ({
  useAuth: () => ({ user: { uid: "u1", displayName: "Ana", email: "a@x.com" }, carregando: false, sair: async () => {}, atualizar: async () => {} }),
}));
vi.mock("@/lib/colecao-context", () => ({
  useColecao: () => ({ todos: [], ativos: [], audicoes: estado.audicoes, idsOuvidos: new Set(), carregando: false, erro: null }),
}));
vi.mock("@/lib/sync/use-sync", () => ({ formatarMomento: (m: unknown) => (m ? "16/11/2026 10:30" : "—") }));

import { ConferenciaBackup } from "@/components/CopiaDeSeguranca";
import { ConferenciaImportacao } from "@/components/ImportadorAudicoes";
import { ListaHistorico } from "@/components/ListaHistorico";
import DadosEBackup from "@/app/(app)/configuracoes/dados/page";

const semTags = (html: string) => html.replace(/<!-- -->/g, "");
const noop = () => {};
const momento = { toMillis: () => 1, toDate: () => new Date(1) };

const previa = (extra: Partial<PrevisaoImportacao> = {}): PrevisaoImportacao => ({
  estruturaOk: true,
  contagens: { total: 10, novas: 5, duplicadas: 2, semAlbum: 3, erros: 0, foraDaColecaoAtiva: 0 },
  semAlbum: [{ releaseId: 999, audicoes: 3, linhas: [3, 4, 6] }],
  semAlbumGrupos: 1,
  foraDaColecao: [],
  erros: [],
  amostra: [{ linha: 2, releaseId: 249504, data: "2026-11-02", horario: "20:00", status: "nova", artista: "Rick Astley", titulo: "Never Gonna Give You Up" }],
  ignoradas: [{ linha: 5, releaseId: 249504, data: "2026-11-01", horario: "20:00", status: "duplicada", artista: "Rick Astley", titulo: "Never Gonna Give You Up", detalhe: "Já está registrada." }],
  ...extra,
});

describe("página de dados", () => {
  const aud = (id: string): AudicaoDoc => ({ id, releaseId: "249504", date: "2026-11-01", time: "20:00", listenedAt: momento });

  it("exporta só as audições, com as colunas discogs_id, date e time, e explica o formato da importação", () => {
    estado.audicoes = [aud("a"), aud("b"), aud("c")];
    const html = semTags(renderToString(<DadosEBackup />));
    expect(html).toContain("Exportar audições (CSV)");
    expect(html).toContain("discogs_id  date  time");
    expect(html).toContain("Exportar 3 audições");
    expect(html).toContain("A coleção não é exportada neste arquivo");
    expect(html).toContain("Importar audições (CSV)");
    for (const campo of ["discogs_id", "date", "time"]) expect(html).toContain(`<strong>${campo}</strong>`);
    expect(html).toContain("com ou sem o R no início");
    expect(html).toContain("Audições já registradas são ignoradas");
    expect(html).toContain("não constam na sua coleção");
  });

  it("oferece cópia de segurança e restauração", () => {
    estado.audicoes = [];
    const html = semTags(renderToString(<DadosEBackup />));
    expect(html).toContain("Criar e baixar cópia de segurança");
    expect(html).toContain("Restaurar cópia de segurança");
    expect(html).toContain("Você ainda não tem audições registradas.");
    expect(html).toMatch(/disabled=""[^>]*>[^<]*(<svg.*?<\/svg>)?\s*Exportar 0 audições/s);
  });
});

describe("conferência da importação de audições", () => {
  it("indica as audições de releases que não constam na coleção, agrupadas, com as linhas", () => {
    const html = semTags(renderToString(<ConferenciaImportacao previa={previa()} aoConfirmar={noop} aoCancelar={noop} ocupado={false} />));
    expect(html).toContain("Há audições de releases que não constam na sua coleção");
    expect(html).toContain("não serão importadas");
    expect(html).toContain("R999");
    expect(html).toContain("3 audições (linhas 3, 4, 6)");
    expect(html).toContain('href="https://www.discogs.com/release/999"');
    expect(html).toContain("Adicionar disco à coleção");
  });

  it("mostra as contagens e a prévia do que será importado, com confirmação", () => {
    const html = semTags(renderToString(<ConferenciaImportacao previa={previa()} aoConfirmar={noop} aoCancelar={noop} ocupado={false} />));
    for (const rotulo of ["Serão importadas", "Já registradas (ignoradas)", "De releases fora da coleção", "Linhas com erro"]) expect(html).toContain(rotulo);
    expect(html).toContain("Prévia do que será importado");
    expect(html).toContain("Never Gonna Give You Up");
    expect(html).toContain("02/11/2026 às 20:00");
    expect(html).toContain("Importar 5 audições");
    expect(html).not.toMatch(/disabled=""[^>]*>[^<]*Importar 5/);
    expect(html).toContain("Cancelar");
  });

  it("lista as audições já registradas, que serão ignoradas", () => {
    const html = semTags(renderToString(<ConferenciaImportacao previa={previa()} aoConfirmar={noop} aoCancelar={noop} ocupado={false} />));
    expect(html).toContain("Ver audições já registradas (serão ignoradas)");
  });

  it("mostra os erros com o número da linha", () => {
    const p = previa({ contagens: { total: 3, novas: 1, duplicadas: 0, semAlbum: 0, erros: 2, foraDaColecaoAtiva: 0 }, semAlbum: [], semAlbumGrupos: 0, erros: [{ linha: 4, mensagem: "Data inválida “31/02/2026”: use AAAA-MM-DD ou DD/MM/AAAA." }, { linha: 9, mensagem: "Horário inválido “25:00”: use HH:mm." }] });
    const html = semTags(renderToString(<ConferenciaImportacao previa={p} aoConfirmar={noop} aoCancelar={noop} ocupado={false} />));
    expect(html).toContain("Linha 4:");
    expect(html).toContain("Data inválida");
    expect(html).toContain("Linha 9:");
    expect(html).not.toContain("Há audições de releases que não constam");
  });

  it("informa os álbuns fora da coleção ativa, cujas audições serão importadas", () => {
    const p = previa({ foraDaColecao: [{ releaseId: 777, titulo: "Ao Vivo", artista: "Dupla", audicoes: 2 }], contagens: { total: 2, novas: 2, duplicadas: 0, semAlbum: 0, erros: 0, foraDaColecaoAtiva: 2 }, semAlbum: [], semAlbumGrupos: 0 });
    const html = semTags(renderToString(<ConferenciaImportacao previa={p} aoConfirmar={noop} aoCancelar={noop} ocupado={false} />));
    expect(html).toContain("Álbuns fora da coleção ativa");
    expect(html).toContain("Dupla — Ao Vivo (R777): 2 audições");
  });

  it("sem nada novo, desabilita a importação e avisa", () => {
    const p = previa({ contagens: { total: 2, novas: 0, duplicadas: 2, semAlbum: 0, erros: 0, foraDaColecaoAtiva: 0 }, semAlbum: [], semAlbumGrupos: 0, amostra: [] });
    const html = semTags(renderToString(<ConferenciaImportacao previa={p} aoConfirmar={noop} aoCancelar={noop} ocupado={false} />));
    expect(html).toContain("Não há nenhuma audição nova para importar.");
    expect(html).toMatch(/disabled=""[^>]*>[^<]*Importar 0 audições/);
  });
});

describe("conferência da restauração", () => {
  const item = (a = rick()): ItemBackup => { const { id, ...r } = a; return { id, dados: { ...JSON.parse(JSON.stringify({ ...r, addedAt: undefined })), addedAt: "2026-03-05T15:00:00.000Z" } }; };
  const arquivo = () => {
    const vazio = { artists: [], releases: [item(rick()), item(various())], listens: [], wantlist: [], discover: [] } as Record<"artists" | "releases" | "listens" | "wantlist" | "discover", ItemBackup[]>;
    const v = validarBackup(JSON.parse(JSON.stringify(montarBackup(vazio, new Date("2026-11-16T12:00:00Z")))));
    if (!v.ok) throw new Error("backup de teste inválido");
    return v;
  };

  it("mostra o que há em cada seção e que a restauração só adiciona", () => {
    const html = semTags(renderToString(<ConferenciaBackup v={arquivo()} nome="logdisco-backup.json" aoConfirmar={noop} aoCancelar={noop} ocupado={false} />));
    for (const secao of ["Artistas", "Álbuns da coleção", "Audições", "Lista de desejos", "Quero Conhecer"]) expect(html).toContain(secao);
    expect(html).toContain("2 no arquivo");
    expect(html).toContain("só adiciona");
    expect(html).toContain("não é alterado nem apagado");
    expect(html).toContain("Restaurar 2 itens");
    expect(html).toContain("logdisco-backup.json");
  });
});

describe("histórico de alterações", () => {
  const e = (id: string, tipo: string, resumo: string, detalhes?: EntradaHistorico["detalhes"]): EntradaHistorico => ({ id, tipo, resumo, at: momento, detalhes });
  const entradas = [
    e("1", "inclusao", "Incluiu Rick Astley — Never Gonna Give You Up (Vinyl)"),
    e("2", "edicao", "Editou Banda — Disco (título)", [{ campo: "titleCustom", rotulo: "Título", de: "Antigo", para: "Novo" }]),
    e("3", "remocao", "Removeu Banda — Outro da coleção ativa"),
    e("4", "sincronizacao", "Sincronização com o Discogs: 2 incluído(s)"),
    e("5", "importacao", "Importação de CSV (audições): 3 importada(s)"),
    e("6", "tipo_novo", "Algo diferente"),
  ];

  it("mostra data e horário, o tipo da operação e o resumo de cada registro", () => {
    const html = semTags(renderToString(<ListaHistorico entradas={entradas} />));
    expect(html).toContain("16/11/2026 10:30");
    for (const rotulo of ["Inclusão de álbum", "Edição de álbum", "Remoção de álbum", "Sincronização", "Importação de arquivo"]) expect(html).toContain(rotulo);
    expect(html).toContain("Incluiu Rick Astley");
    expect(html).toContain("tipo_novo"); // tipo desconhecido aparece como está
  });

  it("registros com detalhes podem ser expandidos", () => {
    const html = semTags(renderToString(<ListaHistorico entradas={entradas} />));
    expect(html.match(/aria-expanded="false"/g)).toHaveLength(1); // só a edição tem detalhes
  });

  it("estado vazio", () => {
    expect(semTags(renderToString(<ListaHistorico entradas={[]} />))).toContain("Nenhum registro encontrado.");
  });

  it("rótulos, tipos presentes e filtro", () => {
    expect(rotuloDoTipo("atualizacao_desejos")).toBe("Lista de desejos");
    expect(rotuloDoTipo("xyz")).toBe("xyz");
    expect(tiposPresentes(entradas)).toEqual(["inclusao", "edicao", "remocao", "sincronizacao", "importacao", "tipo_novo"]);
    expect(filtrarHistorico(entradas, "todos")).toHaveLength(6);
    expect(filtrarHistorico(entradas, "remocao").map((x) => x.id)).toEqual(["3"]);
  });
});

describe("dividirEmLotes", () => {
  const itens = (n: number, tamanho = 10): ItemBackup[] => Array.from({ length: n }, (_, i) => ({ id: String(i), dados: { x: "a".repeat(tamanho) } }));
  it("divide pelo número máximo de itens, mantendo a ordem", () => {
    const lotes = dividirEmLotes(itens(450), 200);
    expect(lotes.map((l) => l.length)).toEqual([200, 200, 50]);
    expect(lotes.flat().map((i) => i.id)).toEqual(itens(450).map((i) => i.id));
  });
  it("divide também pelo tamanho em bytes", () => {
    const lotes = dividirEmLotes(itens(10, 1000), 200, 3000);
    expect(lotes.every((l) => l.length <= 2)).toBe(true);
    expect(lotes.flat()).toHaveLength(10);
  });
  it("um item maior que o limite vai sozinho, e lista vazia gera nenhum lote", () => {
    expect(dividirEmLotes(itens(1, 5000), 200, 100)).toHaveLength(1);
    expect(dividirEmLotes([], 200)).toEqual([]);
  });
});
