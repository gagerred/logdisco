import { renderToString } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { dataLocal } from "@/lib/diario/datas";
import { subtrairDias } from "@/lib/relatorios/calculos";
import type { AlbumDoc, AudicaoDoc } from "@/lib/tipos";
import { albumDe, dupla, rick, various } from "./fixtures/albuns";
import { releaseSimples } from "./fixtures/releases";

const estado = vi.hoisted(() => ({ colecao: null as unknown, params: {} as Record<string, string> }));

vi.mock("@/lib/colecao-context", () => ({ useColecao: () => estado.colecao }));
vi.mock("next/navigation", () => ({ useParams: () => estado.params, usePathname: () => "/relatorios", useRouter: () => ({ push() {}, replace() {} }) }));

import RelatorioGeral from "@/app/(app)/relatorios/page";
import RelatorioAnual from "@/app/(app)/relatorios/anual/page";
import RelatorioPorMidia from "@/app/(app)/relatorios/midia/page";
import AudicoesDoTipo from "@/app/(app)/relatorios/midia/[tipo]/page";
import LayoutRelatorios from "@/app/(app)/relatorios/layout";

const semTags = (html: string) => html.replace(/<!-- -->/g, "");
const momento = (ms: number) => ({ toMillis: () => ms, toDate: () => new Date(ms) });
const aud = (id: string, releaseId: string, date: string, time = "20:00"): AudicaoDoc => ({ id, releaseId, date, time, listenedAt: momento(0) });

const TITULO_LONGO = "Uma Obra Extremamente Longa Com Um Título Que Precisa Quebrar em Várias Linhas Para Caber na Tela do Celular Sem Rolagem Horizontal";

// rick = Vinyl, various = CD, dupla = CD/DVD, longo = CD (removido da coleção ativa), dvd = DVD (nunca ouvido)
const longo = (): AlbumDoc => ({ ...albumDe({ ...releaseSimples, id: 901, title: TITULO_LONGO, artists: [{ id: 5, name: "Banda Longa" }], formats: [{ name: "CD" }] }), status: "removed" });
const dvd = () => albumDe({ ...releaseSimples, id: 902, title: "Concerto em DVD", artists: [{ id: 6, name: "Banda D" }], formats: [{ name: "DVD" }] });

function contexto(audicoes: AudicaoDoc[], todos: AlbumDoc[] = [rick(), various(), dupla(), longo(), dvd()]) {
  return { todos, ativos: todos.filter((a) => a.status !== "removed"), audicoes, idsOuvidos: new Set(audicoes.map((a) => a.releaseId)), carregando: false, erro: null };
}

const hoje = dataLocal();
const dias = (n: number) => subtrairDias(hoje, n);

beforeEach(() => {
  estado.params = {};
  estado.colecao = contexto([
    aud("1", "249504", hoje), // hoje
    aud("2", "249504", dias(10)),
    aud("3", "555", dias(50)),
    aud("4", "777", dias(100)),
    aud("5", "901", dias(200)), // álbum removido, mas o histórico conta
  ]);
});

describe("relatório geral", () => {
  it("tem todas as seções pedidas no requisito 11.1", () => {
    const html = semTags(renderToString(<RelatorioGeral />));
    for (const titulo of ["Visão geral", "Álbuns por formato de mídia", "Artistas mais ouvidos", "Álbuns mais ouvidos", "Álbuns nunca ouvidos"]) expect(html).toContain(titulo);
    expect(html).toContain("Álbuns na coleção ativa");
    expect(html).toContain("pela data em que o disco foi ouvido");
  });

  it("mostra as audições dos últimos 30, 60, 90 e 180 dias pela data da audição", () => {
    const html = semTags(renderToString(<RelatorioGeral />));
    const valor = (rotulo: string) => new RegExp(`${rotulo}</p><p[^>]*>(\\d+)<`).exec(html)?.[1];
    expect(valor("Últimos 30 dias")).toBe("2"); // hoje e 10 dias atrás
    expect(valor("Últimos 60 dias")).toBe("3");
    expect(valor("Últimos 90 dias")).toBe("3");
    expect(valor("Últimos 180 dias")).toBe("4");
    expect(valor("Audições registradas")).toBe("5");
  });

  it("conta só a coleção ativa em 'álbuns na coleção' e em 'nunca ouvidos'", () => {
    const html = semTags(renderToString(<RelatorioGeral />));
    expect(new RegExp("Álbuns na coleção ativa</p><p[^>]*>(\\d+)<").exec(html)?.[1]).toBe("4"); // o removido não entra
    expect(new RegExp("Álbuns nunca ouvidos</p><p[^>]*>(\\d+)<").exec(html)?.[1]).toBe("1"); // só o DVD
    expect(html).toContain("Concerto em DVD");
  });

  it("mostra os álbuns por formato, com as quatro categorias", () => {
    const html = semTags(renderToString(<RelatorioGeral />));
    const secao = html.slice(html.indexOf("Álbuns por formato de mídia"), html.indexOf("Artistas mais ouvidos"));
    for (const f of ["CD", "Vinyl", "DVD", "CD/DVD"]) expect(secao).toContain(`>${f}<`);
    // coleção ativa: 1 Vinyl, 1 CD, 1 DVD e 1 CD/DVD (o CD removido da coleção não entra)
    expect(secao.match(/<strong[^>]*>(\d+)<\/strong>/g)?.map((x) => x.replace(/<[^>]+>/g, ""))).toEqual(["1", "1", "1", "1"]);
    expect(secao).toContain("álbuns");
  });

  it("marca no ranking os álbuns que saíram da coleção ativa e não ranqueia 'Various' como artista", () => {
    const html = semTags(renderToString(<RelatorioGeral />));
    expect(html).toContain("fora da coleção ativa");
    expect(html).toContain("Coletâneas “Various” não entram neste ranking");
    const artistas = html.slice(html.indexOf('id="artistas"'), html.indexOf('id="albuns"'));
    expect(artistas).not.toContain(">Various<");
    expect(artistas).toContain("Rick Astley");
  });

  it("títulos longos quebram em várias linhas, sem rolagem horizontal", () => {
    const html = semTags(renderToString(<RelatorioGeral />));
    expect(html).toContain(TITULO_LONGO);
    expect(html).toMatch(/break-words[^>]*>[^<]*Uma Obra Extremamente Longa/);
    expect(html).not.toContain("overflow-x-auto");
    expect(html).not.toContain("<table");
  });

  it("sem audições, avisa e mostra todos os álbuns ativos como nunca ouvidos", () => {
    estado.colecao = contexto([]);
    const html = semTags(renderToString(<RelatorioGeral />));
    expect(html).toContain("Nenhuma audição registrada no período.");
    expect(new RegExp("Álbuns nunca ouvidos</p><p[^>]*>(\\d+)<").exec(html)?.[1]).toBe("4");
  });
});

describe("estatísticas anuais", () => {
  const ano = Number(hoje.slice(0, 4));
  beforeEach(() => {
    estado.colecao = contexto([
      aud("1", "249504", `${ano}-01-10`), aud("2", "249504", `${ano}-01-20`), aud("3", "249504", `${ano}-06-01`),
      aud("4", "555", `${ano}-03-05`),
      aud("5", "777", `${ano - 1}-12-31`),
    ]);
  });

  it("permite escolher o ano e mostra o ano atual por padrão", () => {
    const html = semTags(renderToString(<RelatorioAnual />));
    expect(html).toContain('id="ano"');
    expect(html).toContain(`<option value="${ano}" selected`.replace(" selected", ""));
    expect(html).toContain(`<option value="${ano - 1}"`);
    expect(html).toContain(`Resumo de ${ano}`);
  });

  it("diferencia total de discos ouvidos (distintos) de total de audições (registros)", () => {
    const html = semTags(renderToString(<RelatorioAnual />));
    expect(new RegExp("Total de discos ouvidos</p><p[^>]*>(\\d+)<").exec(html)?.[1]).toBe("2");
    expect(new RegExp("Total de audições</p><p[^>]*>(\\d+)<").exec(html)?.[1]).toBe("4");
    expect(html).toContain("Álbuns diferentes com pelo menos uma audição no ano");
    expect(html).toContain("Quantidade de registros de audição no ano");
  });

  it("mostra os artistas e discos mais ouvidos do ano e o gráfico mensal", () => {
    const html = semTags(renderToString(<RelatorioAnual />));
    expect(html).toContain(`Artistas mais ouvidos em ${ano}`);
    expect(html).toContain(`Discos mais ouvidos em ${ano}`);
    expect(html).toContain("Never Gonna Give You Up");
    expect(html).toContain("janeiro: 2 audições");
    expect(html).toContain("junho: 1 audição");
    expect(html).not.toContain("Banda B"); // só o que foi ouvido no ano
  });

  it("sem audições no ano atual, abre o ano mais recente que tem audições", () => {
    estado.colecao = contexto([aud("1", "249504", `${ano - 2}-05-05`)]);
    const html = semTags(renderToString(<RelatorioAnual />));
    expect(html).toContain(`Resumo de ${ano - 2}`);
  });
});

describe("relatório por tipo de mídia", () => {
  it("mostra as audições por formato, cada um levando à lista de registros", () => {
    const html = semTags(renderToString(<RelatorioPorMidia />));
    expect(html).toContain("Audições por tipo de mídia");
    for (const slug of ["cd", "vinyl", "dvd", "cd-dvd"]) expect(html).toContain(`href="/relatorios/midia/${slug}"`);
    expect(html).toContain("formato atual cadastrado em cada álbum");
    // Vinyl: 2 audições (249504); CD: 2 (555 e 901 removido); CD/DVD: 1 (777); DVD: 0
    expect(html).toMatch(/href="\/relatorios\/midia\/vinyl"[^>]*>.*?<strong[^>]*>2<\/strong>/);
    expect(html).toMatch(/href="\/relatorios\/midia\/cd"[^>]*>.*?<strong[^>]*>2<\/strong>/);
    expect(html).toMatch(/href="\/relatorios\/midia\/dvd"[^>]*>.*?<strong[^>]*>0<\/strong>/);
  });

  it("a contagem segue o formato atual do álbum quando o usuário o altera", () => {
    const todos = [{ ...rick(), mediaType: "CD" as const }, various(), dupla(), longo(), dvd()];
    estado.colecao = contexto([aud("1", "249504", hoje)], todos);
    const html = semTags(renderToString(<RelatorioPorMidia />));
    expect(html).toMatch(/href="\/relatorios\/midia\/cd"[^>]*>.*?<strong[^>]*>1<\/strong>/);
    expect(html).toMatch(/href="\/relatorios\/midia\/vinyl"[^>]*>.*?<strong[^>]*>0<\/strong>/);
  });
});

describe("registros de audição por formato", () => {
  it("lista artista, título, data e horário de cada audição, da mais recente para a mais antiga", () => {
    estado.params = { tipo: "cd" };
    const html = semTags(renderToString(<AudicoesDoTipo />));
    expect(html).toContain("Audições de CD");
    expect(html).toContain("2 audições");
    for (const cab of ["Álbum", "Artista", "Data", "Horário"]) expect(html).toContain(cab);
    expect(html).toContain("Now That");
    expect(html).toContain("Banda Longa");
    expect(html).toContain("20:00");
    const [d1, d2] = [dias(50), dias(200)].map((d) => d.split("-").reverse().join("/"));
    expect(html).toContain(d1);
    expect(html.indexOf(d1)).toBeLessThan(html.indexOf(d2)); // mais recente primeiro
  });

  it("os títulos longos quebram linha e os álbuns removidos são identificados", () => {
    estado.params = { tipo: "cd" };
    const html = semTags(renderToString(<AudicoesDoTipo />));
    expect(html).toContain(TITULO_LONGO);
    expect(html).toMatch(/break-words[^>]*>.*?Uma Obra Extremamente Longa/s);
    expect(html).toContain("fora da coleção ativa");
    expect(html).not.toContain("<table");
  });

  it("não mostra audições de álbuns de outros formatos", () => {
    estado.params = { tipo: "vinyl" };
    const html = semTags(renderToString(<AudicoesDoTipo />));
    expect(html).toContain("Never Gonna Give You Up");
    expect(html).not.toContain("Now That");
  });

  it("trata formato sem audições e endereço inválido", () => {
    estado.params = { tipo: "dvd" };
    expect(semTags(renderToString(<AudicoesDoTipo />))).toContain("Nenhuma audição registrada de álbuns deste tipo.");
    estado.params = { tipo: "fita" };
    expect(semTags(renderToString(<AudicoesDoTipo />))).toContain("Tipo de mídia desconhecido.");
  });
});

describe("navegação dos relatórios", () => {
  it("tem as abas Geral, Por ano e Por mídia", () => {
    const html = semTags(renderToString(<LayoutRelatorios>conteúdo</LayoutRelatorios>));
    for (const [rotulo, href] of [["Geral", "/relatorios"], ["Por ano", "/relatorios/anual"], ["Por mídia", "/relatorios/midia"]]) {
      expect(html).toContain(`href="${href}"`);
      expect(html).toContain(rotulo);
    }
    expect(html).toContain('aria-current="page"'); // a aba "Geral" está ativa em /relatorios
  });
});
