/**
 * Leitura e geração de CSV (RFC 4180) em UTF-8, compatível com LibreOffice Calc e Excel.
 * Arquivos gerados: separador ";", terminador CRLF e BOM no início, para os acentos abrirem certos.
 */

export type Delimitador = ";" | "," | "\t";
export class ErroCsv extends Error {}

export type CsvLido = {
  delimitador: Delimitador;
  cabecalho: string[];
  linhas: string[][];
  /** Número da linha física de cada linha de dados no arquivo (o cabeçalho é a linha 1). */
  numerosDeLinha: number[];
};

/** Escolhe o separador mais frequente na primeira linha, ignorando o que está entre aspas. */
export function detectarDelimitador(primeiraLinha: string): Delimitador {
  const contagem: Record<Delimitador, number> = { ";": 0, ",": 0, "\t": 0 };
  let dentro = false;
  for (const c of primeiraLinha) {
    if (c === '"') dentro = !dentro;
    else if (!dentro && c in contagem) contagem[c as Delimitador] += 1;
  }
  const [melhor] = (Object.entries(contagem) as [Delimitador, number][]).sort((a, b) => b[1] - a[1] || (a[0] === ";" ? -1 : 1));
  return melhor[1] > 0 ? melhor[0] : ";";
}

export function lerCsv(texto: string): CsvLido {
  const t = texto.charCodeAt(0) === 0xfeff ? texto.slice(1) : texto;
  const fimPrimeira = t.search(/\r?\n/);
  const delimitador = detectarDelimitador(fimPrimeira === -1 ? t : t.slice(0, fimPrimeira));

  const registros: { campos: string[]; linha: number }[] = [];
  let campos: string[] = [];
  let atual = "";
  let entreAspas = false;
  let linha = 1;
  let linhaDoRegistro = 1;
  let temConteudo = false;

  const fecharCampo = () => {
    campos.push(atual);
    atual = "";
  };
  const fecharRegistro = () => {
    fecharCampo();
    if (temConteudo || campos.some((c) => c.trim() !== "")) registros.push({ campos, linha: linhaDoRegistro });
    campos = [];
    temConteudo = false;
  };

  for (let i = 0; i < t.length; i++) {
    const c = t[i];
    if (entreAspas) {
      if (c === '"') {
        if (t[i + 1] === '"') {
          atual += '"';
          i++;
        } else entreAspas = false;
      } else {
        if (c === "\n") linha++;
        atual += c;
      }
      continue;
    }
    if (c === '"' && atual === "") {
      entreAspas = true;
      temConteudo = true;
    } else if (c === delimitador) {
      fecharCampo();
      temConteudo = true;
    } else if (c === "\n" || c === "\r") {
      if (c === "\r" && t[i + 1] === "\n") i++;
      fecharRegistro();
      linha++;
      linhaDoRegistro = linha;
    } else {
      atual += c;
      if (c.trim() !== "") temConteudo = true; // linhas só com espaços contam como vazias
    }
  }
  if (entreAspas) throw new ErroCsv(`Aspas não fechadas na linha ${linhaDoRegistro}.`);
  if (atual !== "" || campos.length > 0 || temConteudo) fecharRegistro();

  if (registros.length === 0) throw new ErroCsv("O arquivo está vazio.");
  const [cab, ...dados] = registros;
  return {
    delimitador,
    cabecalho: cab.campos.map((c) => c.trim()),
    linhas: dados.map((r) => r.campos),
    numerosDeLinha: dados.map((r) => r.linha),
  };
}

// ───────────────────────── geração ─────────────────────────

/** Planilhas executam células que começam com = + - @ como fórmulas; um apóstrofo as neutraliza. */
export const escaparCelula = (v: string) => (/^[=+\-@\t\r]/.test(v) ? `'${v}` : v);
/** Desfaz o apóstrofo colocado por `escaparCelula` (só quando ele protegeu uma fórmula). */
export const restaurarCelula = (v: string) => (/^'[=+\-@\t\r]/.test(v) ? v.slice(1) : v);

function citar(v: string, delimitador: string): string {
  return v.includes(delimitador) || /["\r\n]/.test(v) || v !== v.trim() ? `"${v.replace(/"/g, '""')}"` : v;
}

/** Gera o texto do CSV com BOM, separador ";" e quebras CRLF. As células de texto devem vir já protegidas. */
export function gerarCsv(cabecalho: readonly string[], linhas: string[][], delimitador: Delimitador = ";"): string {
  const corpo = [cabecalho as string[], ...linhas].map((l) => l.map((c) => citar(c, delimitador)).join(delimitador)).join("\r\n");
  return `\uFEFF${corpo}\r\n`;
}

/** Nome do cabeçalho sem acentos, em minúsculas e com "_": "Data de inclusão" → "data_de_inclusao". */
export const normalizarCabecalho = (s: string) =>
  s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "");
