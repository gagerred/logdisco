import { normalizarCodigoRelease } from "@/lib/discogs/codigo";
import { validarDataHora } from "@/lib/diario/datas";
import { ErroCsv, lerCsv, normalizarCabecalho } from "./csv";

/**
 * Análise do CSV de audições (colunas discogs_id, date e time). Função pura: recebe o texto do arquivo e o
 * estado atual (álbuns cadastrados e audições existentes) e diz, linha por linha, o que seria importado,
 * o que já está registrado (ignorado), o que é de um álbum que não consta na coleção e o que tem erro.
 */

export const LIMITE_LINHAS = 20_000;

const ALIASES = {
  releaseId: ["discogs_id", "release_id", "id", "codigo", "id_discogs", "release"],
  data: ["date", "data", "data_audicao", "data_da_audicao"],
  horario: ["time", "horario", "hora", "horario_audicao"],
};

// ───────────────────────── interpretação de campos ─────────────────────────

/** Aceita AAAA-MM-DD (com ou sem hora depois) e DD/MM/AAAA, que é como as planilhas costumam reformatar datas. */
export function interpretarData(v: string): string | null {
  const t = v.trim();
  const iso = /^(\d{4})-(\d{1,2})-(\d{1,2})(?:[ T].*)?$/.exec(t);
  const br = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(t);
  const [a, m, d] = iso ? [+iso[1], +iso[2], +iso[3]] : br ? [+br[3], +br[2], +br[1]] : [0, 0, 0];
  if (!a) return null;
  const dt = new Date(Date.UTC(a, m - 1, d));
  if (a < 1900 || dt.getUTCFullYear() !== a || dt.getUTCMonth() !== m - 1 || dt.getUTCDate() !== d) return null;
  return `${a}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}

/** Aceita HH:mm, H:mm, HH:mm:ss e 20h30. */
export function interpretarHorario(v: string): string | null {
  const m = /^(\d{1,2}):(\d{2})(?::\d{2})?$/.exec(v.trim()) ?? /^(\d{1,2})h(\d{2})$/i.exec(v.trim());
  if (!m || +m[1] > 23 || +m[2] > 59) return null;
  return `${m[1].padStart(2, "0")}:${m[2]}`;
}

// ───────────────────────── diário de audições ─────────────────────────

export type AlbumConhecido = { artista: string; titulo: string; ativo: boolean };

export type EstadoAudicoes = {
  /** Álbuns cadastrados no LogDisco (ativos ou removidos da coleção), por release_id. */
  albuns: Map<string, AlbumConhecido>;
  /** "releaseId|AAAA-MM-DD|HH:mm" das audições que já estão registradas. */
  chaves: Set<string>;
};

export const chaveDaAudicao = (releaseId: string | number, data: string, horario: string) => `${releaseId}|${data}|${horario}`;

export type LinhaAudicao = {
  linha: number;
  releaseId: number | null;
  data: string | null;
  horario: string | null;
  /** nova = será importada · duplicada = já registrada, ignorada · sem_album = o release não está na coleção · erro = linha inválida */
  status: "nova" | "duplicada" | "sem_album" | "erro";
  artista?: string;
  titulo?: string;
  /** O álbum existe, mas foi removido da coleção ativa (a audição é importada, pois o histórico é preservado). */
  foraDaColecaoAtiva?: boolean;
  detalhe?: string;
};

export type GrupoSemAlbum = { releaseId: number; audicoes: number; linhas: number[] };
export type GrupoForaDaColecao = { releaseId: number; titulo: string; artista: string; audicoes: number };

export type PlanoAudicoes = {
  estruturaOk: boolean;
  erroEstrutura?: string;
  linhas: LinhaAudicao[];
  erros: { linha: number; mensagem: string }[];
  /** Releases do arquivo que não constam na coleção, com a quantidade de audições de cada um. */
  semAlbum: GrupoSemAlbum[];
  /** Álbuns que existem mas estão fora da coleção ativa, cujas audições serão importadas. */
  foraDaColecao: GrupoForaDaColecao[];
  contagens: { total: number; novas: number; duplicadas: number; semAlbum: number; erros: number; foraDaColecaoAtiva: number };
};

const planoInvalido = (mensagem: string): PlanoAudicoes => ({
  estruturaOk: false, erroEstrutura: mensagem, linhas: [], erros: [], semAlbum: [], foraDaColecao: [],
  contagens: { total: 0, novas: 0, duplicadas: 0, semAlbum: 0, erros: 0, foraDaColecaoAtiva: 0 },
});

export function analisarAudicoes(texto: string, estado: EstadoAudicoes, agora: Date = new Date()): PlanoAudicoes {
  let csv;
  try {
    csv = lerCsv(texto);
  } catch (e) {
    return planoInvalido(e instanceof ErroCsv ? e.message : "Não foi possível ler o arquivo como CSV.");
  }
  const normalizado = csv.cabecalho.map(normalizarCabecalho);
  const coluna = (campo: keyof typeof ALIASES) => normalizado.findIndex((c) => ALIASES[campo].includes(c));
  const [iId, iData, iHora] = [coluna("releaseId"), coluna("data"), coluna("horario")];

  const faltando = [iId < 0 && "discogs_id", iData < 0 && "date", iHora < 0 && "time"].filter(Boolean);
  if (faltando.length) {
    return planoInvalido(`Coluna(s) obrigatória(s) ausente(s): ${faltando.join(", ")}. O arquivo precisa ter as colunas discogs_id, date e time. Colunas encontradas: ${csv.cabecalho.filter(Boolean).join(", ") || "nenhuma"}.`);
  }
  if (csv.linhas.length === 0) return planoInvalido("O arquivo não tem nenhuma linha de dados.");
  if (csv.linhas.length > LIMITE_LINHAS) return planoInvalido(`O arquivo tem ${csv.linhas.length} linhas; o limite é ${LIMITE_LINHAS} por importação. Divida o arquivo em partes.`);

  const vistas = new Set<string>();
  const linhas: LinhaAudicao[] = csv.linhas.map((cel, i) => {
    const n = csv.numerosDeLinha[i];
    const bruto = (k: number) => (cel[k] ?? "").trim();
    const base: LinhaAudicao = { linha: n, releaseId: null, data: null, horario: null, status: "erro" };
    const erro = (mensagem: string): LinhaAudicao => ({ ...base, status: "erro", detalhe: mensagem });

    const codigo = normalizarCodigoRelease(bruto(iId));
    if (!codigo.ok) return erro(codigo.erro);
    base.releaseId = codigo.id;

    const data = interpretarData(bruto(iData));
    if (!data) return erro(`Data inválida “${bruto(iData)}”: use AAAA-MM-DD ou DD/MM/AAAA.`);
    const horario = interpretarHorario(bruto(iHora));
    if (!horario) return erro(`Horário inválido “${bruto(iHora)}”: use HH:mm.`);
    const valida = validarDataHora(data, horario, agora);
    if (!valida.ok) return erro(valida.erro);
    base.data = data;
    base.horario = horario;

    const album = estado.albuns.get(String(codigo.id));
    if (!album) return { ...base, status: "sem_album", detalhe: `O release R${codigo.id} não consta na sua coleção.` };
    base.artista = album.artista;
    base.titulo = album.titulo;

    const chave = chaveDaAudicao(codigo.id, data, horario);
    if (estado.chaves.has(chave) || vistas.has(chave)) {
      return { ...base, status: "duplicada", detalhe: vistas.has(chave) ? "Repetida no arquivo." : "Já está registrada." };
    }
    vistas.add(chave);
    return { ...base, status: "nova", ...(album.ativo ? {} : { foraDaColecaoAtiva: true }) };
  });

  const semAlbum = new Map<number, GrupoSemAlbum>();
  const fora = new Map<number, GrupoForaDaColecao>();
  for (const l of linhas) {
    if (l.status === "sem_album") {
      const g = semAlbum.get(l.releaseId!) ?? { releaseId: l.releaseId!, audicoes: 0, linhas: [] };
      g.audicoes += 1;
      g.linhas.push(l.linha);
      semAlbum.set(l.releaseId!, g);
    } else if (l.status === "nova" && l.foraDaColecaoAtiva) {
      const g = fora.get(l.releaseId!) ?? { releaseId: l.releaseId!, titulo: l.titulo ?? "", artista: l.artista ?? "", audicoes: 0 };
      g.audicoes += 1;
      fora.set(l.releaseId!, g);
    }
  }
  const conta = (s: LinhaAudicao["status"]) => linhas.filter((l) => l.status === s).length;
  return {
    estruturaOk: true,
    linhas,
    erros: linhas.filter((l) => l.status === "erro").map((l) => ({ linha: l.linha, mensagem: l.detalhe ?? "Erro." })),
    semAlbum: [...semAlbum.values()].sort((a, b) => a.releaseId - b.releaseId),
    foraDaColecao: [...fora.values()].sort((a, b) => a.releaseId - b.releaseId),
    contagens: {
      total: linhas.length,
      novas: conta("nova"),
      duplicadas: conta("duplicada"),
      semAlbum: conta("sem_album"),
      erros: conta("erro"),
      foraDaColecaoAtiva: linhas.filter((l) => l.status === "nova" && l.foraDaColecaoAtiva).length,
    },
  };
}

// ───────────────────────── resumo para a tela de conferência ─────────────────────────

export type PrevisaoImportacao = {
  estruturaOk: boolean;
  erroEstrutura?: string;
  contagens: PlanoAudicoes["contagens"];
  /** Releases do arquivo que não constam na coleção (até 200) e o total de grupos. */
  semAlbum: GrupoSemAlbum[];
  semAlbumGrupos: number;
  foraDaColecao: GrupoForaDaColecao[];
  erros: { linha: number; mensagem: string }[];
  /** As primeiras audições que serão importadas e as primeiras já registradas (ignoradas). */
  amostra: LinhaAudicao[];
  ignoradas: LinhaAudicao[];
};

/** Reduz o plano completo ao que cabe na tela de conferência. */
export function montarPrevisao(p: PlanoAudicoes): PrevisaoImportacao {
  return {
    estruturaOk: p.estruturaOk,
    erroEstrutura: p.erroEstrutura,
    contagens: p.contagens,
    semAlbum: p.semAlbum.slice(0, 200),
    semAlbumGrupos: p.semAlbum.length,
    foraDaColecao: p.foraDaColecao.slice(0, 200),
    erros: p.erros.slice(0, 100),
    amostra: p.linhas.filter((l) => l.status === "nova").slice(0, 100),
    ignoradas: p.linhas.filter((l) => l.status === "duplicada").slice(0, 50),
  };
}
