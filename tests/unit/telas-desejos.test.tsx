import { renderToString } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { converterItemBasico, type ItemBruto } from "@/lib/sync/plano";
import { montarDesejo } from "@/lib/wantlist/logica";
import type { DesejoDoc, QueroConhecerDoc, WantlistRunDoc } from "@/lib/wantlist/tipos";
import { dupla, rick, various } from "./fixtures/albuns";

const estado = vi.hoisted(() => ({
  desejos: null as unknown,
  quero: null as unknown,
  runs: undefined as unknown,
  avisos: [] as unknown,
  colecao: null as unknown,
  params: {} as Record<string, string>,
}));

vi.mock("@/lib/auth-context", () => ({
  useAuth: () => ({ user: { uid: "u1", displayName: "Ana", email: "a@x.com" }, carregando: false, sair: async () => {}, atualizar: async () => {} }),
}));
vi.mock("@/lib/colecao-context", () => ({ useColecao: () => estado.colecao }));
vi.mock("next/navigation", () => ({ useParams: () => estado.params, usePathname: () => "/", useRouter: () => ({ push() {}, replace() {} }) }));
vi.mock("@/lib/sync/use-sync", () => ({ formatarMomento: (m: unknown) => (m ? "15/11/2026 11:05" : "—") }));
vi.mock("@/lib/wantlist/use-wantlist", () => ({
  useDesejos: () => estado.desejos,
  useQueroConhecer: () => estado.quero,
  useRunsWantlist: () => estado.runs,
  useNotificacoesNaoLidas: () => estado.avisos,
}));

import { AvisosDoSistema } from "@/components/AvisosDoSistema";
import { OpcoesQueroConhecer } from "@/components/OpcoesQueroConhecer";
import ListaDeDesejos from "@/app/(app)/desejos/page";
import DiscoDesejado from "@/app/(app)/desejos/[id]/page";
import DesejosDoArtista from "@/app/(app)/desejos/artista/[key]/page";
import QueroConhecer from "@/app/(app)/quero-conhecer/page";
import PaginaDoArtista from "@/app/(app)/artista/[key]/page";

const semTags = (html: string) => html.replace(/<!-- -->/g, "");
const momento = { toMillis: () => 1, toDate: () => new Date(1) };

const bruto = (id: number, titulo: string, artista: string, formato = "Vinyl", artistaId = id * 10): ItemBruto => ({
  id,
  basic_information: { id, title: titulo, artists: [{ id: artistaId, name: artista }], formats: [{ name: formato, qty: "1" }], thumb: `https://i.discogs.com/${id}.jpg` },
});
const desejo = (id: number, titulo: string, artista: string, formato = "Vinyl", artistaId?: number): DesejoDoc => ({
  id: String(id), ...montarDesejo(converterItemBasico(bruto(id, titulo, artista, formato, artistaId))!),
});
const run = (extra: Partial<WantlistRunDoc> = {}): WantlistRunDoc => ({ id: "r", origem: "automatica", status: "concluida", criadaEm: momento, concluidaEm: momento, resultado: { total: 3, adicionados: 2, removidos: 1, atualizados: 0 }, ...extra });

beforeEach(() => {
  estado.desejos = [
    desejo(249504, "Never Gonna Give You Up", "Rick Astley", "Vinyl", 72872), // já está na coleção
    desejo(2, "Zebra Azul", "Banda B"),
    desejo(3, "Alfa Verde", "Banda Z", "CD"),
    desejo(4, "Outro da B", "Banda B", "Cassette", 20),
  ];
  estado.quero = [];
  estado.runs = { ultima: run(), concluida: run() };
  estado.avisos = [];
  estado.colecao = { todos: [rick(), various(), dupla()], ativos: [rick(), various(), dupla()], audicoes: [], idsOuvidos: new Set(), carregando: false, erro: null };
  estado.params = {};
});

describe("lista de desejos", () => {
  it("mostra nome do artista, título, formato e capa de cada disco", () => {
    const html = semTags(renderToString(<ListaDeDesejos />));
    expect(html).toContain("Zebra Azul");
    expect(html).toContain("Banda B");
    expect(html).toContain("Alfa Verde");
    expect(html).toContain(">CD<");
    expect(html).toContain(">Cassette<"); // formato que não é Vinyl nem CD aparece como o Discogs informa
    expect(html).toContain("https://i.discogs.com/2.jpg");
  });

  it("retira da lista o disco que já consta na coleção e avisa", () => {
    const html = semTags(renderToString(<ListaDeDesejos />));
    expect(html).not.toContain("Never Gonna Give You Up");
    expect(html).toContain("3 discos");
    expect(html).toContain("1 disco da wantlist já está na sua coleção e não aparece aqui.");
  });

  it("ordena por artista por padrão e oferece ordenar por álbum", () => {
    const html = semTags(renderToString(<ListaDeDesejos />));
    expect(html).toContain("Por artista (A–Z)");
    expect(html).toContain("Por álbum (A–Z)");
    expect(html.indexOf("Outro da B")).toBeGreaterThan(-1);
    // Banda B (dois discos) vem antes de Banda Z; dentro do artista, pelo título
    expect(html.indexOf("Outro da B")).toBeLessThan(html.indexOf("Zebra Azul"));
    expect(html.indexOf("Zebra Azul")).toBeLessThan(html.indexOf("Alfa Verde"));
  });

  it("tem busca própria e botão de atualização manual", () => {
    const html = semTags(renderToString(<ListaDeDesejos />));
    expect(html).toContain("Buscar artista ou álbum");
    expect(html).toContain("Atualizar lista de desejos");
  });

  it("cada artista leva à lista de desejos dele e cada disco, à sua página", () => {
    const html = semTags(renderToString(<ListaDeDesejos />));
    expect(html).toContain('href="/desejos/artista/20"'); // Banda B (id 20)
    expect(html).toContain('href="/desejos/2"');
  });

  it("mostra a data da última atualização, o tipo e o resultado", () => {
    const html = semTags(renderToString(<ListaDeDesejos />));
    expect(html).toContain("15/11/2026 11:05 (automática)");
    expect(html).toContain("Resultado da última tentativa");
    expect(html).toContain("Concluída");
    expect(html).toContain("aos domingos, às 11h");
  });

  it("indica falha da última tentativa com a mensagem de erro", () => {
    estado.runs = { ultima: run({ status: "falhou", erro: "O Discogs recusou o acesso.", concluidaEm: undefined }), concluida: run() };
    const html = semTags(renderToString(<ListaDeDesejos />));
    expect(html).toContain("Falhou");
    expect(html).toContain("O Discogs recusou o acesso.");
  });

  it("indica atualização interrompida pelo limite do Discogs", () => {
    estado.runs = { ultima: run({ status: "coletando", ultimoErro: "O Discogs limitou as requisições." }), concluida: null };
    const html = semTags(renderToString(<ListaDeDesejos />));
    expect(html).toContain("A atualização foi interrompida");
    expect(html).toContain("nenhuma ainda");
  });

  it("estados vazios", () => {
    estado.desejos = [];
    expect(semTags(renderToString(<ListaDeDesejos />))).toContain("Sua lista de desejos está vazia.");
    estado.desejos = [desejo(249504, "Never Gonna Give You Up", "Rick Astley")];
    expect(semTags(renderToString(<ListaDeDesejos />))).toContain("Todos os discos da sua wantlist já estão na sua coleção.");
    estado.desejos = null;
    expect(semTags(renderToString(<ListaDeDesejos />))).toContain("Carregando…");
  });
});

describe("página do disco desejado", () => {
  it("oferece abrir no Discogs e pesquisar em Shopee, Mercado Livre, Amazon e na web", () => {
    estado.params = { id: "2" };
    const html = semTags(renderToString(<DiscoDesejado />));
    expect(html).toContain("Abrir no Discogs");
    expect(html).toContain('href="https://www.discogs.com/release/2"');
    expect(html).toContain("Pesquisar em marketplaces");
    for (const nome of ["Shopee", "Mercado Livre", "Amazon", "Pesquisar na web"]) expect(html).toContain(nome);
    expect(html).toContain("https://shopee.com.br/search?keyword=Banda%20B%20Zebra%20Azul");
    expect(html).toContain("https://lista.mercadolivre.com.br/Banda-B-Zebra-Azul");
    expect(html).toContain("https://www.amazon.com.br/s?k=Banda%20B%20Zebra%20Azul");
    expect(html).toContain("https://www.google.com/search?q=Banda%20B%20Zebra%20Azul");
  });

  it("avisa quando o disco já está na coleção", () => {
    estado.params = { id: "249504" };
    const html = semTags(renderToString(<DiscoDesejado />));
    expect(html).toContain("já está na sua coleção");
    expect(html).toContain('href="/album/249504"');
  });

  it("avisa quando o disco não está na lista", () => {
    estado.params = { id: "999" };
    expect(semTags(renderToString(<DiscoDesejado />))).toContain("Disco não encontrado");
  });
});

describe("desejos de um artista", () => {
  it("lista todos os discos do artista que estão na wantlist", () => {
    estado.params = { key: "20" };
    const html = semTags(renderToString(<DesejosDoArtista />));
    expect(html).toContain("Banda B");
    expect(html).toContain("2 discos na lista de desejos");
    expect(html).toContain("Zebra Azul");
    expect(html).toContain("Outro da B");
    expect(html).not.toContain("Alfa Verde");
  });
  it("não mostra discos do artista que já estão na coleção", () => {
    estado.params = { key: "72872" }; // Rick Astley: o único desejo dele está na coleção
    expect(semTags(renderToString(<DesejosDoArtista />))).toContain("Este artista não tem discos na sua lista de desejos.");
  });
});

describe("página do artista (coleção e lista de desejos)", () => {
  it("mostra os álbuns da coleção e os da lista de desejos, com link do Discogs", () => {
    estado.desejos = [desejo(2, "Zebra Azul", "Rick Astley", "Vinyl", 72872)];
    estado.params = { key: "72872" };
    const html = semTags(renderToString(<PaginaDoArtista />));
    expect(html).toContain("Rick Astley");
    expect(html).toContain("Na coleção");
    expect(html).toContain("Na lista de desejos");
    expect(html).toContain("Never Gonna Give You Up");
    expect(html).toContain("Zebra Azul");
    expect(html).toContain('href="/desejos/2"');
    expect(html).toContain('href="https://www.discogs.com/artist/72872"');
  });
  it("funciona para um artista que só aparece na lista de desejos", () => {
    estado.params = { key: "20" };
    const html = semTags(renderToString(<PaginaDoArtista />));
    expect(html).toContain("Banda B");
    expect(html).toContain("Nenhum álbum deste artista na coleção.");
    expect(html).toContain("Zebra Azul");
  });
});

describe("Quero Conhecer", () => {
  const item = (id: number, titulo: string, artista: string): QueroConhecerDoc => ({
    id: String(id), releaseId: id, titulo, artista, artists: [], artistKeys: [], formatoOriginal: "CD", capa: null, discogsUrl: `https://www.discogs.com/release/${id}`, adicionadoEm: momento,
  });

  it("tem o campo de código do Discogs e lista os álbuns, independente de coleção e desejos", () => {
    estado.quero = [item(5, "Disco Para Ouvir", "Banda Y")];
    const html = semTags(renderToString(<QueroConhecer />));
    expect(html).toContain("Código do álbum no Discogs");
    expect(html).toContain("R123456, 123456 ou [R123456]");
    expect(html).toContain("Disco Para Ouvir");
    expect(html).toContain("independente da coleção e da lista de desejos");
  });

  it("estado vazio", () => {
    estado.quero = [];
    expect(semTags(renderToString(<QueroConhecer />))).toContain("Nenhum álbum na lista ainda.");
  });

  it("as três opções de um álbum: Discogs, excluir e YouTube Music", () => {
    const html = semTags(renderToString(<OpcoesQueroConhecer item={item(5, "Disco Para Ouvir", "Banda Y")} aoExcluir={() => {}} />));
    expect(html).toContain("Abrir no Discogs");
    expect(html).toContain('href="https://www.discogs.com/release/5"');
    expect(html).toContain("Excluir");
    expect(html).toContain("Ouvir no YouTube Music");
    expect(html).toContain('href="https://music.youtube.com/search?q=Banda%20Y%20Disco%20Para%20Ouvir"');
  });
});

describe("avisos do sistema", () => {
  it("mostra a falha da atualização com a opção de dispensar", () => {
    estado.avisos = [{ id: "wantlist-erro", tipo: "wantlist_erro", mensagem: "Não foi possível atualizar a lista de desejos: O Discogs recusou o acesso.", lida: false }];
    const html = semTags(renderToString(<AvisosDoSistema />));
    expect(html).toContain("Não foi possível atualizar a lista de desejos");
    expect(html).toContain("Dispensar");
  });
  it("não mostra nada quando não há avisos", () => {
    estado.avisos = [];
    expect(renderToString(<AvisosDoSistema />)).toBe("");
  });
});
