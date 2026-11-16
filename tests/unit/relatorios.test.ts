import { describe, expect, it } from "vitest";
import {
  albunsMaisOuvidos, albunsNuncaOuvidos, albunsPorFormato, anosDisponiveis, artistasMaisOuvidos, audicoesDoFormato,
  audicoesNosUltimosDias, audicoesPorFormato, contagemPorJanela, estatisticasDoAno, formatoDoSlug, identificar, indexarAlbuns,
  SLUG_FORMATO, subtrairDias, totalAlbunsAtivos,
} from "@/lib/relatorios/calculos";
import type { AlbumDoc, AudicaoDoc } from "@/lib/tipos";
import { albumDe, dupla, rick, various } from "./fixtures/albuns";
import { releaseSimples } from "./fixtures/releases";

const momento = (ms: number) => ({ toMillis: () => ms, toDate: () => new Date(ms) });
/** `criadoEm` simula a data de cadastro: ela não pode influenciar nenhum relatório. */
const aud = (id: string, releaseId: string, date: string, time = "20:00", criadoEm = 0): AudicaoDoc => ({
  id, releaseId, date, time, listenedAt: momento(criadoEm),
});

// rick = Vinyl (249504), various = CD (555), dupla = CD/DVD (777, dois artistas), cd2 = CD (888)
const cd2 = () => albumDe({ ...releaseSimples, id: 888, title: "Outro CD", artists: [{ id: 72872, name: "Rick Astley" }], formats: [{ name: "CD", qty: "1" }] });
const colecao = (): AlbumDoc[] => [rick(), various(), dupla(), cd2()];
const mapa = (albuns = colecao()) => indexarAlbuns(albuns);

describe("datas", () => {
  it("subtrai dias atravessando mês, ano e ano bissexto", () => {
    expect(subtrairDias("2026-11-15", 29)).toBe("2026-10-17");
    expect(subtrairDias("2026-01-05", 10)).toBe("2025-12-26");
    expect(subtrairDias("2024-03-01", 1)).toBe("2024-02-29");
    expect(subtrairDias("2026-11-15", 0)).toBe("2026-11-15");
  });
});

describe("audições nos últimos 30, 60, 90 e 180 dias", () => {
  const hoje = "2026-11-15";
  it("a janela tem N dias corridos e inclui hoje", () => {
    const l = [aud("a", "1", "2026-11-15"), aud("b", "1", "2026-10-17"), aud("c", "1", "2026-10-16")];
    expect(audicoesNosUltimosDias(l, 30, hoje)).toBe(2); // 17/10 ainda entra (hoje + 29 dias atrás); 16/10 não
    expect(audicoesNosUltimosDias(l, 60, hoje)).toBe(3);
  });
  it("não conta audições de datas futuras", () => {
    expect(audicoesNosUltimosDias([aud("a", "1", "2026-11-16")], 30, hoje)).toBe(0);
  });
  it("calcula as quatro janelas, cada uma contendo as anteriores", () => {
    const l = [
      aud("1", "1", "2026-11-14"), // 1 dia
      aud("2", "1", "2026-10-20"), // 26 dias
      aud("3", "1", "2026-09-30"), // 46 dias
      aud("4", "1", "2026-08-20"), // 87 dias
      aud("5", "1", "2026-06-10"), // 158 dias
      aud("6", "1", "2025-01-01"), // fora de todas
    ];
    expect(contagemPorJanela(l, hoje)).toEqual([
      { dias: 30, total: 2 }, { dias: 60, total: 3 }, { dias: 90, total: 4 }, { dias: 180, total: 5 },
    ]);
  });
  it("conta pela data da audição, e não pela data em que o registro foi criado", () => {
    // registrada hoje, mas ouvida em março: fora das janelas; registrada em 2020, mas ouvida ontem: dentro
    const l = [aud("a", "1", "2026-03-01", "10:00", Date.parse("2026-11-15")), aud("b", "1", "2026-11-14", "10:00", Date.parse("2020-01-01"))];
    expect(audicoesNosUltimosDias(l, 30, hoje)).toBe(1);
  });
});

describe("álbuns mais ouvidos", () => {
  it("ordena pelo número de audições, com desempate estável, e informa a última audição", () => {
    const l = [aud("1", "249504", "2026-11-01"), aud("2", "249504", "2026-11-10"), aud("3", "888", "2026-11-05"), aud("4", "777", "2026-11-06"), aud("5", "777", "2026-11-07"), aud("6", "555", "2026-11-08")];
    const r = albunsMaisOuvidos(l, mapa());
    // empates (2 e 2; 1 e 1) são desfeitos pelo nome do artista: Dupla… < Rick… e Rick… < Various
    expect(r.map((x) => [x.releaseId, x.audicoes])).toEqual([["777", 2], ["249504", 2], ["888", 1], ["555", 1]]);
    expect(r[1]).toMatchObject({ titulo: "Never Gonna Give You Up", artista: "Rick Astley", ultima: "2026-11-10", ativo: true });
  });
  it("respeita o limite pedido", () => {
    const l = ["249504", "555", "777", "888"].map((id, i) => aud(String(i), id, "2026-11-01"));
    expect(albunsMaisOuvidos(l, mapa(), 2)).toHaveLength(2);
  });
  it("mantém no ranking as audições de um álbum removido da coleção (histórico preservado)", () => {
    const removido = { ...rick(), status: "removed" as const };
    const r = albunsMaisOuvidos([aud("1", "249504", "2026-11-01")], mapa([removido, various()]));
    expect(r).toHaveLength(1);
    expect(r[0]).toMatchObject({ releaseId: "249504", ativo: false, titulo: "Never Gonna Give You Up" });
  });
  it("identifica pelo snapshot quando o registro do álbum não existe mais", () => {
    const a = { ...aud("1", "999", "2026-11-01"), snapshot: { artistName: "Banda Antiga", title: "Disco Antigo", thumb: null, mediaType: "CD" } };
    expect(albunsMaisOuvidos([a], mapa())[0]).toMatchObject({ titulo: "Disco Antigo", artista: "Banda Antiga", ativo: false });
    expect(identificar(a, mapa()).mediaType).toBe("CD");
  });
});

describe("artistas mais ouvidos", () => {
  const l = [aud("1", "249504", "2026-11-01"), aud("2", "888", "2026-11-02"), aud("3", "777", "2026-11-03"), aud("4", "555", "2026-11-04"), aud("5", "555", "2026-11-05")];
  it("soma as audições de todos os álbuns do artista", () => {
    const r = artistasMaisOuvidos(l, mapa());
    expect(r[0]).toEqual({ key: "72872", nome: "Rick Astley", audicoes: 2, albuns: 2 });
  });
  it("uma audição de álbum com dois artistas conta para os dois", () => {
    const r = artistasMaisOuvidos([aud("1", "777", "2026-11-01")], mapa());
    expect(r.map((x) => x.nome)).toEqual(["Dupla X", "Dupla Y"]);
  });
  it("não inclui 'Various' (coletâneas) no ranking de artistas", () => {
    expect(artistasMaisOuvidos(l, mapa()).map((x) => x.nome)).not.toContain("Various");
  });
  it("desempata por ordem alfabética", () => {
    const r = artistasMaisOuvidos([aud("1", "777", "2026-11-01")], mapa());
    expect(r[0].nome < r[1].nome).toBe(true);
  });
  it("mantém as audições de artistas de álbuns removidos", () => {
    const removido = { ...rick(), status: "removed" as const };
    expect(artistasMaisOuvidos([aud("1", "249504", "2026-11-01")], mapa([removido]))[0]).toMatchObject({ nome: "Rick Astley", audicoes: 1 });
  });
});

describe("álbuns da coleção que nunca foram ouvidos", () => {
  it("lista só álbuns ativos sem audição", () => {
    const r = albunsNuncaOuvidos(colecao(), [aud("1", "249504", "2026-11-01")]);
    expect(r.map((a) => a.id).sort()).toEqual(["555", "777", "888"]);
  });
  it("álbum removido da coleção não é contado como 'nunca ouvido'", () => {
    const l = [rick(), { ...various(), status: "removed" as const }];
    expect(albunsNuncaOuvidos(l, []).map((a) => a.id)).toEqual(["249504"]);
  });
  it("um álbum removido que foi ouvido não afeta os demais", () => {
    const l = [{ ...rick(), status: "removed" as const }, various()];
    expect(albunsNuncaOuvidos(l, [aud("1", "249504", "2026-11-01")]).map((a) => a.id)).toEqual(["555"]);
  });
  it("sem audições, todos os ativos são nunca ouvidos; ordena por artista e título", () => {
    const r = albunsNuncaOuvidos(colecao(), []);
    expect(r).toHaveLength(4);
    expect(r[0].artistName).toBe("Dupla X & Dupla Y");
  });
});

describe("coleção ativa e formatos", () => {
  it("conta os álbuns ativos e por formato, com zero nas categorias vazias", () => {
    expect(totalAlbunsAtivos(colecao())).toBe(4);
    expect(albunsPorFormato(colecao())).toEqual({ CD: 2, Vinyl: 1, DVD: 0, "CD/DVD": 1 });
  });
  it("álbuns removidos não entram nesses totais", () => {
    const l = [rick(), { ...various(), status: "removed" as const }];
    expect(totalAlbunsAtivos(l)).toBe(1);
    expect(albunsPorFormato(l)).toEqual({ CD: 0, Vinyl: 1, DVD: 0, "CD/DVD": 0 });
  });
  it("audições por formato usam o formato ATUAL do álbum", () => {
    const l = [aud("1", "249504", "2026-11-01"), aud("2", "249504", "2026-11-02"), aud("3", "555", "2026-11-03")];
    expect(audicoesPorFormato(l, mapa())).toEqual({ CD: 1, Vinyl: 2, DVD: 0, "CD/DVD": 0 });
    // o usuário corrige o formato do álbum 249504 para CD: as audições passam a contar como CD
    const editado = colecao().map((a) => (a.id === "249504" ? { ...a, mediaType: "CD" as const } : a));
    expect(audicoesPorFormato(l, mapa(editado))).toEqual({ CD: 3, Vinyl: 0, DVD: 0, "CD/DVD": 0 });
  });
  it("audições de álbuns removidos continuam contando no formato", () => {
    const removido = { ...rick(), status: "removed" as const };
    expect(audicoesPorFormato([aud("1", "249504", "2026-11-01")], mapa([removido])).Vinyl).toBe(1);
  });
  it("lista os registros de um formato, mais recentes primeiro, com artista, título, data e horário", () => {
    const l = [aud("a", "555", "2026-11-01", "09:00"), aud("b", "888", "2026-11-05", "21:30"), aud("c", "249504", "2026-11-09", "10:00"), aud("d", "555", "2026-11-05", "08:00")];
    const r = audicoesDoFormato(l, mapa(), "CD");
    expect(r.map((x) => x.id)).toEqual(["b", "d", "a"]);
    expect(r[0]).toEqual({ id: "b", releaseId: "888", artista: "Rick Astley", titulo: "Outro CD", date: "2026-11-05", time: "21:30", ativo: true });
    expect(audicoesDoFormato(l, mapa(), "DVD")).toEqual([]);
  });
  it("mapeia os endereços (slugs) dos formatos", () => {
    expect(SLUG_FORMATO["CD/DVD"]).toBe("cd-dvd");
    expect(formatoDoSlug("cd-dvd")).toBe("CD/DVD");
    expect(formatoDoSlug("vinyl")).toBe("Vinyl");
    expect(formatoDoSlug("cassete")).toBeNull();
  });
});

describe("estatísticas anuais", () => {
  const l = [
    aud("1", "249504", "2026-01-01"), aud("2", "249504", "2026-01-15"), aud("3", "249504", "2026-12-31"),
    aud("4", "555", "2026-03-10"), aud("5", "777", "2025-12-31"), aud("6", "888", "2025-06-01"), aud("7", "555", "2027-01-01"),
  ];
  it("diferencia o total de discos ouvidos (álbuns distintos) do total de audições (registros)", () => {
    const r = estatisticasDoAno(l, mapa(), 2026);
    expect(r.totalAudicoes).toBe(4);
    expect(r.totalDiscosOuvidos).toBe(2); // 249504 três vezes + 555 uma vez
  });
  it("considera só o ano pedido, inclusive nas viradas de ano", () => {
    expect(estatisticasDoAno(l, mapa(), 2025)).toMatchObject({ totalAudicoes: 2, totalDiscosOuvidos: 2 });
    expect(estatisticasDoAno(l, mapa(), 2027)).toMatchObject({ totalAudicoes: 1, totalDiscosOuvidos: 1 });
    expect(estatisticasDoAno(l, mapa(), 2024)).toMatchObject({ totalAudicoes: 0, totalDiscosOuvidos: 0, artistas: [], albuns: [] });
  });
  it("rankings do ano usam apenas as audições do ano", () => {
    const r = estatisticasDoAno(l, mapa(), 2026);
    expect(r.albuns.map((x) => [x.releaseId, x.audicoes])).toEqual([["249504", 3], ["555", 1]]);
    expect(r.artistas.map((x) => [x.nome, x.audicoes])).toEqual([["Rick Astley", 3]]);
  });
  it("distribui as audições do ano por mês", () => {
    expect(estatisticasDoAno(l, mapa(), 2026).porMes).toEqual([2, 0, 1, 0, 0, 0, 0, 0, 0, 0, 0, 1]);
  });
  it("lista os anos disponíveis, do mais recente ao mais antigo, incluindo o atual", () => {
    expect(anosDisponiveis(l, 2026)).toEqual([2027, 2026, 2025]);
    expect(anosDisponiveis([], 2026)).toEqual([2026]);
  });
});
