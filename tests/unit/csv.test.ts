import { describe, expect, it } from "vitest";
import { detectarDelimitador, ErroCsv, escaparCelula, gerarCsv, lerCsv, normalizarCabecalho, restaurarCelula } from "@/lib/csv/csv";
import { CABECALHO_AUDICOES, gerarCsvAudicoes, nomeDoArquivo } from "@/lib/csv/formatos";
import type { AudicaoDoc } from "@/lib/tipos";

describe("lerCsv", () => {
  it("lê cabeçalho e linhas, com separador ponto e vírgula", () => {
    const r = lerCsv("a;b;c\n1;2;3\n4;5;6\n");
    expect(r.delimitador).toBe(";");
    expect(r.cabecalho).toEqual(["a", "b", "c"]);
    expect(r.linhas).toEqual([["1", "2", "3"], ["4", "5", "6"]]);
  });
  it("detecta vírgula e tabulação", () => {
    expect(lerCsv("a,b\n1,2").delimitador).toBe(",");
    expect(lerCsv("a\tb\n1\t2").delimitador).toBe("\t");
    expect(detectarDelimitador("sem separador")).toBe(";");
    expect(detectarDelimitador('"a;b",c,d')).toBe(","); // o ';' entre aspas não conta
  });
  it("remove o BOM e aceita quebras CRLF", () => {
    const r = lerCsv("\uFEFFid;nome\r\n1;Ação\r\n2;Coração\r\n");
    expect(r.cabecalho[0]).toBe("id");
    expect(r.linhas).toEqual([["1", "Ação"], ["2", "Coração"]]);
  });
  it("entende aspas, aspas duplicadas, separador e quebra de linha dentro do campo", () => {
    const r = lerCsv('a;b\n"x;y";"ele disse ""oi"""\n"linha1\nlinha2";z\n');
    expect(r.linhas).toEqual([["x;y", 'ele disse "oi"'], ["linha1\nlinha2", "z"]]);
  });
  it("ignora linhas vazias e informa o número da linha de cada registro", () => {
    const r = lerCsv('a;b\n1;2\n\n"x\ny";3\n5;6');
    expect(r.linhas).toHaveLength(3);
    expect(r.numerosDeLinha).toEqual([2, 4, 6]);
  });
  it("mantém campos vazios e a última linha sem quebra final", () => {
    expect(lerCsv("a;b;c\n1;;3").linhas).toEqual([["1", "", "3"]]);
    expect(lerCsv("a;b\n;").linhas).toEqual([["", ""]]);
  });
  it("recusa arquivo vazio e aspas sem fechar", () => {
    expect(() => lerCsv("")).toThrow(ErroCsv);
    expect(() => lerCsv("   \n\n")).toThrow(ErroCsv);
    expect(() => lerCsv('a;b\n"aberta;2')).toThrow(/Aspas não fechadas/);
  });
});

describe("gerarCsv", () => {
  it("gera BOM, separador ';' e CRLF", () => {
    const t = gerarCsv(["a", "b"], [["1", "2"]]);
    expect(t.startsWith("\uFEFF")).toBe(true);
    expect(t).toBe("\uFEFFa;b\r\n1;2\r\n");
  });
  it("cita campos com separador, aspas e quebras de linha, e ler devolve o mesmo valor", () => {
    const linhas = [["x;y", 'ele disse "oi"', "linha1\nlinha2", " espaço "]];
    const lido = lerCsv(gerarCsv(["a", "b", "c", "d"], linhas));
    expect(lido.linhas).toEqual(linhas);
  });
  it("preserva acentos e caracteres especiais", () => {
    const linhas = [["Ação & Reação", "Çà é ü ñ", "日本語", "Beyoncé — Lemonade"]];
    expect(lerCsv(gerarCsv(["a", "b", "c", "d"], linhas)).linhas).toEqual(linhas);
  });
});

describe("proteção contra fórmulas", () => {
  it("coloca apóstrofo em textos que a planilha executaria e o remove ao ler", () => {
    for (const t of ["=SOMA(A1)", "+1", "-2", "@cmd", "\tcalc"]) {
      expect(escaparCelula(t)).toBe(`'${t}`);
      expect(restaurarCelula(escaparCelula(t))).toBe(t);
    }
  });
  it("não mexe em textos normais nem em apóstrofos legítimos", () => {
    expect(escaparCelula("Abbey Road")).toBe("Abbey Road");
    expect(restaurarCelula("'Til Tuesday")).toBe("'Til Tuesday");
    expect(restaurarCelula("'=fórmula")).toBe("=fórmula");
  });
});

describe("normalizarCabecalho", () => {
  it("ignora acentos, maiúsculas e símbolos", () => {
    expect(normalizarCabecalho("Data de inclusão")).toBe("data_de_inclusao");
    expect(normalizarCabecalho(" Horário ")).toBe("horario");
    expect(normalizarCabecalho("Release ID")).toBe("release_id");
  });
});

const momento = (iso: string) => ({ toMillis: () => Date.parse(iso), toDate: () => new Date(iso) });

describe("exportação do diário de audições", () => {
  const aud = (id: string, releaseId: string, date: string, time: string): AudicaoDoc => ({ id, releaseId, date, time, listenedAt: momento("2026-01-01T00:00:00") });

  it("tem exatamente as colunas discogs_id, date e time, nessa ordem", () => {
    expect([...CABECALHO_AUDICOES]).toEqual(["discogs_id", "date", "time"]);
    expect(lerCsv(gerarCsvAudicoes([])).cabecalho).toEqual(["discogs_id", "date", "time"]);
    expect(gerarCsvAudicoes([]).replace("\uFEFF", "")).toBe("discogs_id;date;time\r\n");
  });
  it("traz uma linha por audição, com o código do release, a data e o horário, em ordem cronológica", () => {
    const lido = lerCsv(gerarCsvAudicoes([aud("a", "249504", "2026-11-05", "09:30"), aud("b", "555", "2026-11-01", "20:00"), aud("c", "555", "2026-11-05", "08:00")]));
    expect(lido.linhas).toEqual([["555", "2026-11-01", "20:00"], ["555", "2026-11-05", "08:00"], ["249504", "2026-11-05", "09:30"]]);
  });
  it("o mesmo álbum ouvido mais de uma vez gera uma linha para cada audição", () => {
    const lido = lerCsv(gerarCsvAudicoes([aud("a", "1", "2026-11-01", "08:00"), aud("b", "1", "2026-11-01", "21:00"), aud("c", "1", "2026-11-02", "08:00")]));
    expect(lido.linhas).toHaveLength(3);
  });
  it("não leva nenhum dado da coleção nem identificadores internos", () => {
    const t = gerarCsvAudicoes([{ ...aud("segredo123", "249504", "2026-11-05", "09:30"), snapshot: { artistName: "Rick", title: "X", thumb: null, mediaType: "Vinyl" } }]);
    expect(t).not.toContain("segredo123");
    expect(t).not.toContain("Rick");
  });
  it("usa UTF-8 com BOM e separador ponto e vírgula, para abrir direto no LibreOffice Calc", () => {
    const t = gerarCsvAudicoes([aud("a", "1", "2026-11-05", "09:30")]);
    expect(t.charCodeAt(0)).toBe(0xfeff);
    expect(t).toContain("1;2026-11-05;09:30\r\n");
  });
  it("nome de arquivo com a data", () => {
    expect(nomeDoArquivo("audicoes", "csv", "2026-11-16")).toBe("logdisco-audicoes-2026-11-16.csv");
  });
});
