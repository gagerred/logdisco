import { renderToString } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { dataLocal } from "@/lib/diario/datas";
import type { AudicaoDoc } from "@/lib/tipos";
import { albumDe, dupla, rick, various } from "./fixtures/albuns";

const estado = vi.hoisted(() => ({ ctx: null as unknown, params: {} as Record<string, string> }));

vi.mock("@/lib/auth-context", () => ({
  useAuth: () => ({ user: { uid: "u1", displayName: "Ana", email: "ana@exemplo.com" }, carregando: false, sair: async () => {}, atualizar: async () => {} }),
}));
vi.mock("@/lib/colecao-context", () => ({ useColecao: () => estado.ctx }));
vi.mock("next/navigation", () => ({
  useParams: () => estado.params,
  usePathname: () => "/",
  useRouter: () => ({ push() {}, replace() {} }),
}));

import Inicio from "@/app/(app)/page";
import Diario from "@/app/(app)/diario/page";
import Sorteio from "@/app/(app)/sorteio/page";
import PaginaDoAlbum from "@/app/(app)/album/[id]/page";

const momento = (ms: number) => ({ toMillis: () => ms, toDate: () => new Date(ms) });
const aud = (id: string, releaseId: string, date: string, time: string): AudicaoDoc => ({ id, releaseId, date, time, listenedAt: momento(0) });

function contexto(audicoes: AudicaoDoc[], albuns = [rick(), various(), dupla()]) {
  return {
    todos: albuns,
    ativos: albuns.filter((a) => a.status !== "removed"),
    audicoes,
    idsOuvidos: new Set(audicoes.map((a) => a.releaseId)),
    carregando: false,
    erro: null,
  };
}

beforeEach(() => {
  estado.params = {};
});

describe("Início", () => {
  // Cadastradas fora de ordem: valem a data e o horário da audição.
  const audicoes = [
    aud("a", "249504", "2026-11-05", "09:30"),
    aud("b", "555", "2026-11-12", "21:00"),
    aud("c", "777", "2026-11-12", "08:00"),
    aud("d", "249504", "2025-01-01", "23:59"),
    aud("e", "555", "2026-10-31", "10:00"),
    aud("f", "777", "2026-11-13", "07:15"),
    aud("g", "555", "2026-09-30", "18:00"),
  ];

  it("mostra só as 5 últimas audições, da mais recente para a mais antiga", () => {
    estado.ctx = contexto(audicoes);
    const html = renderToString(<Inicio />);
    const datas = [...html.matchAll(/(\d{2}\/\d{2}\/\d{4}) às (\d{2}:\d{2})/g)].map((m) => `${m[1]} ${m[2]}`);
    expect(datas).toEqual(["13/11/2026 07:15", "12/11/2026 21:00", "12/11/2026 08:00", "05/11/2026 09:30", "31/10/2026 10:00"]);
    expect(html).not.toContain("30/09/2026");
    expect(html).not.toContain("01/01/2025");
  });

  it("oferece a pesquisa de música e o sorteio", () => {
    estado.ctx = contexto(audicoes);
    const html = renderToString(<Inicio />);
    expect(html).toContain("Pesquisar música");
    expect(html).toContain("Nome da música");
    expect(html).toContain('href="/sorteio"');
  });

  it("explica quando ainda não há audições", () => {
    estado.ctx = contexto([]);
    expect(renderToString(<Inicio />)).toContain("Nenhuma audição registrada ainda");
  });
});

describe("Diário de audições", () => {
  it("mostra o mês atual com a contagem de audições no dia e a lista do dia selecionado", () => {
    const hoje = dataLocal();
    estado.ctx = contexto([aud("1", "249504", hoje, "08:00"), aud("2", "555", hoje, "21:00"), aud("3", "777", "2020-01-01", "10:00")]);
    const html = renderToString(<Diario />);
    const dia = Number(hoje.slice(8));
    expect(html).toContain("2 audições");
    expect(html).toMatch(new RegExp(`aria-label="${dia} de [a-zç]+, 2 audições"`));
    // hoje vem selecionado: aparecem as duas audições, com ações de editar e excluir
    expect(html).toContain("Never Gonna Give You Up");
    expect(html).toContain("Now That");
    expect((html.match(/Editar audição de/g) ?? []).length).toBe(2);
    expect((html.match(/Excluir audição de/g) ?? []).length).toBe(2);
    // não há como escolher um mês futuro
    expect(html).toContain('aria-label="Próximo mês"');
  });

  it("indica quando o dia não tem audições", () => {
    estado.ctx = contexto([]);
    expect(renderToString(<Diario />)).toContain("Nenhuma audição registrada neste dia.");
  });
});

describe("Sortear disco", () => {
  it("mostra os dois grupos de filtros, independentes e opcionais, e quantos discos atendem", () => {
    estado.ctx = contexto([aud("1", "249504", "2026-11-01", "10:00")]);
    const html = renderToString(<Sorteio />);
    for (const rotulo of ["Todos os discos", "Somente nunca ouvidos", "Somente CD", "Somente Vinyl"]) expect(html).toContain(rotulo);
    expect((html.match(/aria-pressed="false"/g) ?? []).length).toBe(4);
    // o React separa trechos de texto com marcadores de comentário no HTML gerado
    expect(html.replace(/<!-- -->/g, "")).toContain("3 discos atendem aos filtros");
  });
});

describe("Página do álbum", () => {
  it("álbum Various: mostra o artista de cada faixa e a pesquisa de letra por faixa", () => {
    estado.ctx = contexto([]);
    estado.params = { id: "555" };
    const html = renderToString(<PaginaDoAlbum />);
    expect(html).toContain("Banda A");
    expect(html).toContain("Banda B feat. Cantor C");
    expect(html).toContain("Pesquisar a letra de Faixa Um");
    expect(html).toContain("Pesquisar a letra de Parte II");
    expect(html).toContain("Banda%20A%20Faixa%20Um%20letra"); // usa o artista da faixa na pesquisa
    expect(html).toContain("Registrar audição");
    expect(html).toContain("Recarregar informações");
    expect(html).toContain("Você ainda não registrou nenhuma audição deste álbum.");
  });

  it("álbum comum: faixas normais, sem artista por faixa, letra com o artista do álbum", () => {
    estado.ctx = contexto([aud("1", "249504", "2026-11-01", "20:00")]);
    estado.params = { id: "249504" };
    const html = renderToString(<PaginaDoAlbum />);
    expect(html).toContain("Rick%20Astley%20Never%20Gonna%20Give%20You%20Up%20letra");
    expect(html).toContain("01/11/2026 às 20:00");
    expect(html).toContain("Audições <span");
  });

  it("álbum removido da coleção ativa: avisa, não permite registrar e mantém o histórico", () => {
    const removido = { ...rick(), status: "removed" as const };
    estado.ctx = contexto([aud("1", "249504", "2026-11-01", "20:00")], [removido]);
    estado.params = { id: "249504" };
    const html = renderToString(<PaginaDoAlbum />);
    expect(html).toContain("removido da coleção ativa");
    expect(html).not.toContain(">Registrar audição<");
    expect(html).toContain("01/11/2026 às 20:00");
  });

  it("avisa quando o álbum não existe", () => {
    estado.ctx = contexto([], [albumDe({ id: 1, title: "X", artists: [{ id: 1, name: "A" }], formats: [{ name: "CD" }] })]);
    estado.params = { id: "999" };
    expect(renderToString(<PaginaDoAlbum />)).toContain("Álbum não encontrado");
  });
});
