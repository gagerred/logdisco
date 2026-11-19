import { CATEGORIAS_MIDIA } from "@/lib/discogs/formato";

/**
 * Cópia de segurança: um arquivo JSON com coleção, dados dos álbuns, artistas, diário de audições,
 * lista de desejos e Quero Conhecer. Tokens do Discogs, travas e avisos nunca entram.
 * Datas viajam como texto ISO; ao restaurar, voltam a ser datas do Firestore.
 */

export const VERSAO_BACKUP = 1;
export const COLECOES_BACKUP = ["artists", "releases", "listens", "wantlist", "discover"] as const;
export type ColecaoBackup = (typeof COLECOES_BACKUP)[number];

/** A ordem importa na restauração: artistas e álbuns antes das audições, que dependem dos álbuns. */
export const ROTULO_COLECAO: Record<ColecaoBackup, string> = {
  artists: "Artistas",
  releases: "Álbuns da coleção",
  listens: "Audições",
  wantlist: "Lista de desejos",
  discover: "Quero Conhecer",
};

export type ItemBackup = { id: string; dados: Record<string, unknown> };
export type BackupV1 = {
  app: "LogDisco";
  versao: typeof VERSAO_BACKUP;
  criadoEm: string;
  dados: Record<ColecaoBackup, ItemBackup[]>;
};

type Tipo = "string" | "number" | "boolean" | "array" | "objeto" | "data" | "categoria" | "status" | "dataTexto" | "horaTexto";
type Regra = { tipo: Tipo; nulo?: boolean; opcional?: boolean; itens?: (x: unknown) => boolean };

const ehObjeto = (x: unknown): x is Record<string, unknown> => !!x && typeof x === "object" && !Array.isArray(x);
const temTexto = (campos: string[]) => (x: unknown) => ehObjeto(x) && campos.every((c) => typeof x[c] === "string");
const ehTexto = (x: unknown) => typeof x === "string";

const R = {
  s: { tipo: "string" } as Regra,
  sN: { tipo: "string", nulo: true } as Regra,
  n: { tipo: "number" } as Regra,
  nN: { tipo: "number", nulo: true } as Regra,
  b: { tipo: "boolean" } as Regra,
  dataOpc: { tipo: "data", opcional: true, nulo: true } as Regra,
  dataObr: { tipo: "data" } as Regra,
  artistas: { tipo: "array", itens: temTexto(["name", "key"]) } as Regra,
  chaves: { tipo: "array", itens: ehTexto } as Regra,
};

const ESQUEMAS: Record<ColecaoBackup, Record<string, Regra>> = {
  artists: {
    name: R.s, discogsId: { ...R.nN, opcional: true }, discogsUrl: { ...R.sN, opcional: true }, updatedAt: R.dataOpc,
  },
  releases: {
    releaseId: R.n, masterId: { ...R.nN, opcional: true }, title: R.s, year: { ...R.nN, opcional: true },
    artistId: { ...R.nN, opcional: true }, artistName: R.s, artists: R.artistas, artistKeys: R.chaves,
    isVarious: R.b, formatOriginal: R.s, mediaType: { tipo: "categoria" }, cover: { ...R.sN, opcional: true },
    thumb: { ...R.sN, opcional: true }, discogsUrl: R.s, tracks: { tipo: "array", itens: temTexto(["title"]) },
    artistNameLocked: R.b, status: { tipo: "status" }, titleCustom: { tipo: "string", opcional: true },
    addedAt: R.dataOpc, removedAt: R.dataOpc, lastRefreshedAt: R.dataOpc, updatedAt: R.dataOpc,
  },
  listens: {
    releaseId: R.s, date: { tipo: "dataTexto" }, time: { tipo: "horaTexto" }, listenedAt: R.dataObr,
    snapshot: { tipo: "objeto", opcional: true }, createdAt: R.dataOpc, updatedAt: R.dataOpc,
  },
  wantlist: {
    releaseId: R.n, titulo: R.s, artista: R.s, artists: R.artistas, artistKeys: R.chaves,
    formatos: R.chaves, formatoOriginal: R.s, categoria: { tipo: "categoria", nulo: true }, capa: R.sN,
    discogsUrl: R.s, atualizadoEm: R.dataOpc,
  },
  discover: {
    releaseId: R.n, titulo: R.s, artista: R.s, artists: R.artistas, artistKeys: R.chaves,
    formatoOriginal: R.s, capa: R.sN, discogsUrl: R.s, adicionadoEm: R.dataOpc,
  },
};

/** Campos que viram data do Firestore ao restaurar. */
export const CAMPOS_DE_DATA: Record<ColecaoBackup, string[]> = Object.fromEntries(
  COLECOES_BACKUP.map((c) => [c, Object.entries(ESQUEMAS[c]).filter(([, r]) => r.tipo === "data").map(([k]) => k)]),
) as Record<ColecaoBackup, string[]>;

const ID_NUMERICO = /^\d{1,10}$/;
const ID_TEXTO = /^[A-Za-z0-9_-]{1,100}$/;
const MAX_ITENS_ARRAY = 2000;

function conferir(valor: unknown, r: Regra): boolean {
  if (valor === null) return !!r.nulo;
  switch (r.tipo) {
    case "string": return typeof valor === "string" && valor.length <= 5000;
    case "number": return typeof valor === "number" && Number.isFinite(valor);
    case "boolean": return typeof valor === "boolean";
    case "array": return Array.isArray(valor) && valor.length <= MAX_ITENS_ARRAY && (!r.itens || valor.every(r.itens));
    case "objeto": return ehObjeto(valor);
    case "data": return typeof valor === "string" && !Number.isNaN(Date.parse(valor));
    case "categoria": return (CATEGORIAS_MIDIA as readonly string[]).includes(valor as string);
    case "status": return valor === "active" || valor === "removed";
    case "dataTexto": return typeof valor === "string" && /^\d{4}-\d{2}-\d{2}$/.test(valor);
    case "horaTexto": return typeof valor === "string" && /^\d{2}:\d{2}$/.test(valor);
  }
}

export type ResultadoSanitizar = { ok: true; dados: Record<string, unknown> } | { ok: false; erro: string };

/**
 * Confere um item do backup e devolve só os campos conhecidos (qualquer outro é descartado).
 * Também confere o identificador do documento e a coerência entre ele e o release.
 */
export function sanitizarDoc(colecao: ColecaoBackup, id: unknown, dados: unknown): ResultadoSanitizar {
  if (typeof id !== "string") return { ok: false, erro: "Item sem identificador." };
  const idValido = colecao === "releases" || colecao === "wantlist" || colecao === "discover" ? ID_NUMERICO.test(id) : ID_TEXTO.test(id);
  if (!idValido) return { ok: false, erro: `Identificador inválido “${id.slice(0, 40)}”.` };
  if (!ehObjeto(dados)) return { ok: false, erro: "Dados do item ausentes." };

  const saida: Record<string, unknown> = {};
  for (const [campo, regra] of Object.entries(ESQUEMAS[colecao])) {
    const valor = dados[campo];
    if (valor === undefined) {
      if (regra.opcional) continue;
      return { ok: false, erro: `Campo obrigatório ausente: ${campo}.` };
    }
    if (!conferir(valor, regra)) return { ok: false, erro: `Valor inválido no campo ${campo}.` };
    saida[campo] = valor;
  }
  if (colecao !== "artists" && colecao !== "listens" && saida.releaseId !== Number(id)) {
    return { ok: false, erro: "O código do lançamento não confere com o identificador do item." };
  }
  if (colecao === "listens" && !ID_NUMERICO.test(String(saida.releaseId))) return { ok: false, erro: "Código de álbum inválido na audição." };
  return { ok: true, dados: saida };
}

/** Troca os campos de data (texto ISO) por objetos Date, prontos para virarem Timestamp. */
export function converterDatas(colecao: ColecaoBackup, dados: Record<string, unknown>): Record<string, unknown> {
  const copia = { ...dados };
  for (const campo of CAMPOS_DE_DATA[colecao]) {
    if (typeof copia[campo] === "string") copia[campo] = new Date(copia[campo] as string);
  }
  return copia;
}

// ───────────────────────── criação ─────────────────────────

/** Converte datas do Firestore (objetos com toDate) em texto ISO, recursivamente. */
export function serializar(valor: unknown): unknown {
  if (valor && typeof valor === "object") {
    const v = valor as { toDate?: () => Date };
    if (typeof v.toDate === "function") return v.toDate().toISOString();
    if (Array.isArray(valor)) return valor.map(serializar);
    return Object.fromEntries(Object.entries(valor).map(([k, x]) => [k, serializar(x)]));
  }
  return valor;
}

export function montarBackup(dados: Record<ColecaoBackup, ItemBackup[]>, agora: Date = new Date()): BackupV1 {
  return {
    app: "LogDisco",
    versao: VERSAO_BACKUP,
    criadoEm: agora.toISOString(),
    dados: Object.fromEntries(COLECOES_BACKUP.map((c) => [c, dados[c].map((i) => ({ id: i.id, dados: serializar(i.dados) as Record<string, unknown> }))])) as BackupV1["dados"],
  };
}

// ───────────────────────── validação do arquivo ─────────────────────────

export type ResultadoBackup =
  | { ok: false; erros: string[] }
  | {
      ok: true;
      criadoEm: string;
      docs: Record<ColecaoBackup, ItemBackup[]>;
      invalidos: { colecao: ColecaoBackup; id: string; erro: string }[];
      contagens: Record<ColecaoBackup, { noArquivo: number; validos: number; invalidos: number }>;
      avisos: string[];
    };

export const LIMITE_TOTAL_BACKUP = 200_000;

export function validarBackup(bruto: unknown): ResultadoBackup {
  if (!ehObjeto(bruto)) return { ok: false, erros: ["O arquivo não é uma cópia de segurança do LogDisco."] };
  if (bruto.app !== "LogDisco") return { ok: false, erros: ["O arquivo não é uma cópia de segurança do LogDisco (campo “app” ausente ou diferente)."] };
  if (typeof bruto.versao !== "number" || bruto.versao > VERSAO_BACKUP) {
    return { ok: false, erros: [`Versão da cópia de segurança não suportada (${String(bruto.versao)}). Atualize o aplicativo e tente de novo.`] };
  }
  if (!ehObjeto(bruto.dados)) return { ok: false, erros: ["A cópia de segurança não contém dados."] };

  const erros: string[] = [];
  let total = 0;
  for (const c of COLECOES_BACKUP) {
    const lista = (bruto.dados as Record<string, unknown>)[c];
    if (!Array.isArray(lista)) erros.push(`Seção ausente ou inválida: ${ROTULO_COLECAO[c]}.`);
    else total += lista.length;
  }
  if (total > LIMITE_TOTAL_BACKUP) erros.push(`A cópia tem ${total} itens; o limite é ${LIMITE_TOTAL_BACKUP}.`);
  if (erros.length) return { ok: false, erros };

  const docs = Object.fromEntries(COLECOES_BACKUP.map((c) => [c, [] as ItemBackup[]])) as Record<ColecaoBackup, ItemBackup[]>;
  const invalidos: { colecao: ColecaoBackup; id: string; erro: string }[] = [];
  const contagens = Object.fromEntries(COLECOES_BACKUP.map((c) => [c, { noArquivo: 0, validos: 0, invalidos: 0 }])) as Record<ColecaoBackup, { noArquivo: number; validos: number; invalidos: number }>;

  for (const c of COLECOES_BACKUP) {
    for (const item of (bruto.dados as Record<string, unknown[]>)[c]) {
      contagens[c].noArquivo += 1;
      const entrada = ehObjeto(item) ? item : {};
      const r = sanitizarDoc(c, entrada.id, entrada.dados);
      if (r.ok) {
        docs[c].push({ id: entrada.id as string, dados: r.dados });
        contagens[c].validos += 1;
      } else {
        contagens[c].invalidos += 1;
        invalidos.push({ colecao: c, id: typeof entrada.id === "string" ? entrada.id : "?", erro: r.erro });
      }
    }
  }

  const avisos: string[] = [];
  const albunsNoArquivo = new Set(docs.releases.map((i) => i.id));
  const orfas = docs.listens.filter((i) => !albunsNoArquivo.has(String(i.dados.releaseId))).length;
  if (orfas > 0) avisos.push(`${orfas} audição(ões) são de álbuns que não estão no arquivo; só serão restauradas se o álbum já existir na conta.`);

  return { ok: true, criadoEm: typeof bruto.criadoEm === "string" ? bruto.criadoEm : "", docs, invalidos, contagens, avisos };
}

// ───────────────────────── envio em partes ─────────────────────────

/** Divide os itens em lotes com no máximo `maxItens` itens e `maxBytes` de JSON, para caber em cada requisição. */
export function dividirEmLotes(itens: ItemBackup[], maxItens = 200, maxBytes = 1_500_000): ItemBackup[][] {
  const lotes: ItemBackup[][] = [];
  let atual: ItemBackup[] = [];
  let bytes = 0;
  for (const item of itens) {
    const tamanho = JSON.stringify(item).length;
    if (atual.length > 0 && (atual.length >= maxItens || bytes + tamanho > maxBytes)) {
      lotes.push(atual);
      atual = [];
      bytes = 0;
    }
    atual.push(item);
    bytes += tamanho;
  }
  if (atual.length) lotes.push(atual);
  return lotes;
}
