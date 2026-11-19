import { describe, expect, it } from "vitest";
import { gerarCsvAudicoes } from "@/lib/csv/formatos";
import { analisarAudicoes, chaveDaAudicao, interpretarData, interpretarHorario, LIMITE_LINHAS, type EstadoAudicoes } from "@/lib/csv/importacao";
import type { AudicaoDoc } from "@/lib/tipos";

describe("interpretação de data e horário", () => {
  it("data: aceita AAAA-MM-DD e DD/MM/AAAA e rejeita datas inexistentes", () => {
    expect(interpretarData("2026-11-05")).toBe("2026-11-05");
    expect(interpretarData("5/11/2026")).toBe("2026-11-05");
    expect(interpretarData("05/11/2026")).toBe("2026-11-05");
    expect(interpretarData("2026-11-05 20:15:00")).toBe("2026-11-05");
    expect(interpretarData("2024-02-29")).toBe("2024-02-29");
    for (const ruim of ["2026-02-30", "31/04/2026", "2026-13-01", "abc", "", "0001-01-01", "11/05/26"]) expect(interpretarData(ruim)).toBeNull();
  });
  it("horário: aceita HH:mm, H:mm, HH:mm:ss e 20h30", () => {
    expect(interpretarHorario("20:05")).toBe("20:05");
    expect(interpretarHorario("9:05")).toBe("09:05");
    expect(interpretarHorario("20:05:59")).toBe("20:05");
    expect(interpretarHorario("20h30")).toBe("20:30");
    for (const ruim of ["24:00", "10:60", "abc", "", "10"]) expect(interpretarHorario(ruim)).toBeNull();
  });
});

describe("importação do diário de audições", () => {
  const agora = new Date(2026, 10, 16, 12, 0);
  const estado = (extra: Partial<EstadoAudicoes> = {}): EstadoAudicoes => ({
    albuns: new Map([
      ["249504", { artista: "Rick Astley", titulo: "Never Gonna Give You Up", ativo: true }],
      ["555", { artista: "Various", titulo: "Now", ativo: true }],
      ["777", { artista: "Dupla", titulo: "Ao Vivo", ativo: false }], // removido da coleção ativa
    ]),
    chaves: new Set(),
    ...extra,
  });
  const csv = (...linhas: string[]) => ["discogs_id;date;time", ...linhas].join("\n");

  it("importa audições de álbuns da coleção", () => {
    const p = analisarAudicoes(csv("249504;2026-11-01;20:00", "555;05/11/2026;9:30"), estado(), agora);
    expect(p.estruturaOk).toBe(true);
    expect(p.contagens).toEqual({ total: 2, novas: 2, duplicadas: 0, semAlbum: 0, erros: 0, foraDaColecaoAtiva: 0 });
    expect(p.linhas[0]).toMatchObject({ status: "nova", releaseId: 249504, data: "2026-11-01", horario: "20:00", artista: "Rick Astley", titulo: "Never Gonna Give You Up" });
    expect(p.linhas[1]).toMatchObject({ data: "2026-11-05", horario: "09:30" });
  });

  it("o código do Discogs vale com ou sem o R, e também entre colchetes", () => {
    const p = analisarAudicoes(csv("249504;2026-11-01;10:00", "R249504;2026-11-02;10:00", "r249504;2026-11-03;10:00", "[R249504];2026-11-04;10:00"), estado(), agora);
    expect(p.contagens.novas).toBe(4);
    expect(new Set(p.linhas.map((l) => l.releaseId))).toEqual(new Set([249504]));
  });

  it("INDICA as audições de um release que não consta na coleção, agrupadas por release, e não as importa", () => {
    const p = analisarAudicoes(
      csv("249504;2026-11-01;20:00", "999;2026-11-02;20:00", "R999;2026-11-03;21:00", "888;2026-11-04;08:00", "R999;2026-11-05;22:00"),
      estado(), agora,
    );
    expect(p.contagens).toMatchObject({ total: 5, novas: 1, semAlbum: 4, erros: 0 });
    expect(p.linhas.filter((l) => l.status === "sem_album").every((l) => l.detalhe?.includes("não consta na sua coleção"))).toBe(true);
    expect(p.semAlbum).toEqual([
      { releaseId: 888, audicoes: 1, linhas: [5] },
      { releaseId: 999, audicoes: 3, linhas: [3, 4, 6] }, // números das linhas no arquivo (o cabeçalho é a linha 1)
    ]);
  });

  it("IGNORA a audição que já está registrada (mesmo release, data e horário)", () => {
    const p = analisarAudicoes(
      csv("249504;2026-11-01;20:00", "249504;2026-11-02;20:00", "555;2026-11-03;10:00"),
      estado({ chaves: new Set([chaveDaAudicao(249504, "2026-11-01", "20:00"), chaveDaAudicao(555, "2026-11-03", "10:00")]) }),
      agora,
    );
    expect(p.linhas.map((l) => l.status)).toEqual(["duplicada", "nova", "duplicada"]);
    expect(p.linhas[0].detalhe).toBe("Já está registrada.");
    expect(p.contagens).toMatchObject({ novas: 1, duplicadas: 2, erros: 0 });
  });

  it("repetições dentro do próprio arquivo contam uma vez só", () => {
    const p = analisarAudicoes(csv("249504;2026-11-01;20:00", "R249504;01/11/2026;20:00", "249504;2026-11-01;20:00:30"), estado(), agora);
    expect(p.linhas.map((l) => l.status)).toEqual(["nova", "duplicada", "duplicada"]);
    expect(p.linhas[1].detalhe).toBe("Repetida no arquivo.");
  });

  it("o mesmo álbum em horários ou dias diferentes são audições diferentes", () => {
    const p = analisarAudicoes(csv("249504;2026-11-01;08:00", "249504;2026-11-01;21:00", "249504;2026-11-02;08:00"), estado(), agora);
    expect(p.contagens.novas).toBe(3);
  });

  it("álbum removido da coleção ativa: a audição é importada e o usuário é informado", () => {
    const p = analisarAudicoes(csv("777;2026-11-01;20:00", "777;2026-11-02;20:00", "249504;2026-11-03;20:00"), estado(), agora);
    expect(p.contagens).toMatchObject({ novas: 3, foraDaColecaoAtiva: 2, semAlbum: 0 });
    expect(p.foraDaColecao).toEqual([{ releaseId: 777, titulo: "Ao Vivo", artista: "Dupla", audicoes: 2 }]);
  });

  it("valida data, horário, futuro e código, informando a linha de cada erro", () => {
    const p = analisarAudicoes(
      csv("249504;2026-02-30;10:00", "249504;2026-11-01;25:00", "249504;2026-12-25;10:00", "abc;2026-11-01;10:00", "249504;;10:00", "249504;2026-11-01;", "M99;2026-11-01;10:00"),
      estado(), agora,
    );
    expect(p.contagens).toMatchObject({ total: 7, erros: 7, novas: 0 });
    expect(p.erros.map((e) => e.linha)).toEqual([2, 3, 4, 5, 6, 7, 8]);
    expect(p.erros[0].mensagem).toMatch(/Data inválida|não existe/);
    expect(p.erros[1].mensagem).toMatch(/Horário inválido/);
    expect(p.erros[2].mensagem).toMatch(/futuro/);
    expect(p.erros[3].mensagem).toMatch(/Código inválido/);
    expect(p.erros[6].mensagem).toMatch(/Master/);
  });

  it("linhas com erro não impedem as válidas", () => {
    const p = analisarAudicoes(csv("abc;2026-11-01;10:00", "249504;2026-11-01;10:00"), estado(), agora);
    expect(p.contagens).toMatchObject({ erros: 1, novas: 1 });
  });

  it("recusa arquivo sem as colunas discogs_id, date e time, dizendo o que falta", () => {
    const p = analisarAudicoes("id_do_disco;dia\n1;2026-11-01", estado(), agora);
    expect(p.estruturaOk).toBe(false);
    expect(p.erroEstrutura).toContain("discogs_id");
    expect(p.erroEstrutura).toContain("time");
    expect(p.erroEstrutura).toContain("id_do_disco, dia");
    expect(analisarAudicoes("discogs_id;date\n1;2026-11-01", estado(), agora).erroEstrutura).toMatch(/ausente\(s\): time/);
    expect(analisarAudicoes("", estado(), agora).estruturaOk).toBe(false);
    expect(analisarAudicoes("discogs_id;date;time\n", estado(), agora).erroEstrutura).toMatch(/nenhuma linha/);
    const grande = "discogs_id;date;time\n" + Array.from({ length: LIMITE_LINHAS + 1 }, () => "1;2026-11-01;10:00").join("\n");
    expect(analisarAudicoes(grande, estado(), agora).erroEstrutura).toMatch(/limite/);
  });

  it("aceita vírgula, cabeçalho em maiúsculas e colunas extras na ordem que vierem", () => {
    const p = analisarAudicoes("Time,Observação,DISCOGS_ID,Date\n20:00,boa,249504,2026-11-01", estado(), agora);
    expect(p.estruturaOk).toBe(true);
    expect(p.linhas[0]).toMatchObject({ status: "nova", releaseId: 249504, horario: "20:00" });
  });

  it("o arquivo exportado pelo próprio app é aceito, e importá-lo de novo não duplica nada", () => {
    const m = { toMillis: () => 0, toDate: () => new Date(0) };
    const auds: AudicaoDoc[] = [
      { id: "z1", releaseId: "249504", date: "2026-11-01", time: "20:00", listenedAt: m },
      { id: "z2", releaseId: "555", date: "2026-11-02", time: "08:15", listenedAt: m },
    ];
    const texto = gerarCsvAudicoes(auds);
    expect(analisarAudicoes(texto, estado(), agora).contagens).toMatchObject({ total: 2, novas: 2, duplicadas: 0, erros: 0 });
    const jaRegistradas = estado({ chaves: new Set(auds.map((a) => chaveDaAudicao(a.releaseId, a.date, a.time))) });
    expect(analisarAudicoes(texto, jaRegistradas, agora).contagens).toMatchObject({ total: 2, novas: 0, duplicadas: 2, erros: 0 });
  });
});
