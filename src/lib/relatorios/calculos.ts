import { chaveDoArtista, compararNomes } from "@/lib/colecao/artistas";
import { ehCategoriaValida } from "@/lib/colecao/atualizacao";
import { tituloExibido } from "@/lib/colecao/filtros";
import { CATEGORIAS_MIDIA, type CategoriaMidia } from "@/lib/discogs/formato";
import type { AlbumDoc, AudicaoDoc } from "@/lib/tipos";

/**
 * Cálculos dos relatórios. Regras do requisito 11:
 *  - todas as contagens usam a data efetiva da audição (`date`), nunca a data de cadastro;
 *  - audições de álbuns removidos da coleção ativa continuam contando (o histórico é preservado);
 *  - o formato de mídia considerado é o formato ATUAL do álbum;
 *  - só a coleção ativa entra em "nunca ouvidos", no total de álbuns e na contagem por formato.
 */

export const JANELAS_DIAS = [30, 60, 90, 180] as const;

export type AlbumPorId = Map<string, AlbumDoc>;
export const indexarAlbuns = (albuns: AlbumDoc[]): AlbumPorId => new Map(albuns.map((a) => [a.id, a]));

export type AudicaoIdentificada = {
  releaseId: string;
  titulo: string;
  artista: string;
  artistas: { key: string; nome: string }[];
  isVarious: boolean;
  mediaType: CategoriaMidia | null;
  thumb: string | null;
  /** O álbum está na coleção ativa (false se foi removido ou não existe mais). */
  ativo: boolean;
};

/** Identifica o álbum de uma audição pelo registro atual do álbum ou, na falta dele, pelo snapshot da audição. */
export function identificar(a: AudicaoDoc, albuns: AlbumPorId): AudicaoIdentificada {
  const album = albuns.get(a.releaseId);
  if (album) {
    return {
      releaseId: a.releaseId,
      titulo: tituloExibido(album),
      artista: album.artistName,
      artistas: album.artists.map((x) => ({ key: x.key, nome: x.name })),
      isVarious: album.isVarious,
      mediaType: album.mediaType,
      thumb: album.thumb ?? album.cover,
      ativo: album.status !== "removed",
    };
  }
  const s = a.snapshot;
  const nome = s?.artistName ?? "";
  return {
    releaseId: a.releaseId,
    titulo: s?.title ?? "Álbum desconhecido",
    artista: nome,
    artistas: nome ? [{ key: chaveDoArtista(null, nome), nome }] : [],
    isVarious: nome.trim().toLowerCase() === "various",
    mediaType: ehCategoriaValida(s?.mediaType) ? s!.mediaType as CategoriaMidia : null,
    thumb: s?.thumb ?? null,
    ativo: false,
  };
}

// ───────────────────────── datas ─────────────────────────

/** "2026-11-15" menos N dias, em AAAA-MM-DD (sem depender do fuso horário). */
export function subtrairDias(date: string, dias: number): string {
  const [a, m, d] = date.split("-").map(Number);
  return new Date(Date.UTC(a, m - 1, d - dias)).toISOString().slice(0, 10);
}

/**
 * Audições dos últimos N dias: a janela tem N dias corridos e termina hoje (inclusive).
 * Ex.: nos últimos 30 dias entram de hoje até 29 dias atrás. Conta pela data da audição.
 */
export function audicoesNosUltimosDias(audicoes: AudicaoDoc[], dias: number, hoje: string): number {
  const inicio = subtrairDias(hoje, dias - 1);
  return audicoes.filter((a) => a.date >= inicio && a.date <= hoje).length;
}

export function contagemPorJanela(audicoes: AudicaoDoc[], hoje: string) {
  return JANELAS_DIAS.map((dias) => ({ dias, total: audicoesNosUltimosDias(audicoes, dias, hoje) }));
}

// ───────────────────────── rankings ─────────────────────────

export type AlbumRanking = {
  releaseId: string;
  titulo: string;
  artista: string;
  thumb: string | null;
  audicoes: number;
  ativo: boolean;
  /** Data (AAAA-MM-DD) da audição mais recente. */
  ultima: string;
};
export type ArtistaRanking = { key: string; nome: string; audicoes: number; albuns: number };

export function albunsMaisOuvidos(audicoes: AudicaoDoc[], albuns: AlbumPorId, limite = 10): AlbumRanking[] {
  const acc = new Map<string, AlbumRanking>();
  for (const a of audicoes) {
    const i = identificar(a, albuns);
    const atual = acc.get(i.releaseId) ?? { releaseId: i.releaseId, titulo: i.titulo, artista: i.artista, thumb: i.thumb, audicoes: 0, ativo: i.ativo, ultima: "" };
    atual.audicoes += 1;
    if (a.date > atual.ultima) atual.ultima = a.date;
    acc.set(i.releaseId, atual);
  }
  return [...acc.values()]
    .sort((x, y) => y.audicoes - x.audicoes || compararNomes(x.artista, y.artista) || compararNomes(x.titulo, y.titulo))
    .slice(0, limite);
}

/**
 * Artistas mais ouvidos: cada audição conta para todos os artistas creditados no álbum.
 * Coletâneas "Various" não entram, pois "Various" não é um artista.
 */
export function artistasMaisOuvidos(audicoes: AudicaoDoc[], albuns: AlbumPorId, limite = 10): ArtistaRanking[] {
  const acc = new Map<string, { key: string; nome: string; audicoes: number; albuns: Set<string> }>();
  for (const a of audicoes) {
    const i = identificar(a, albuns);
    if (i.isVarious) continue;
    for (const art of i.artistas) {
      const atual = acc.get(art.key) ?? { key: art.key, nome: art.nome, audicoes: 0, albuns: new Set<string>() };
      atual.audicoes += 1;
      atual.albuns.add(i.releaseId);
      acc.set(art.key, atual);
    }
  }
  return [...acc.values()]
    .map((x) => ({ key: x.key, nome: x.nome, audicoes: x.audicoes, albuns: x.albuns.size }))
    .sort((x, y) => y.audicoes - x.audicoes || compararNomes(x.nome, y.nome))
    .slice(0, limite);
}

/** Álbuns da coleção ATIVA sem nenhuma audição. Álbuns removidos da coleção não entram. */
export function albunsNuncaOuvidos(albuns: AlbumDoc[], audicoes: AudicaoDoc[]): AlbumDoc[] {
  const ouvidos = new Set(audicoes.map((a) => a.releaseId));
  return albuns
    .filter((a) => a.status !== "removed" && !ouvidos.has(a.id))
    .sort((x, y) => compararNomes(x.artistName, y.artistName) || compararNomes(tituloExibido(x), tituloExibido(y)));
}

// ───────────────────────── coleção e formatos ─────────────────────────

const zeradoPorFormato = (): Record<CategoriaMidia, number> => ({ CD: 0, Vinyl: 0, DVD: 0, "CD/DVD": 0 });

export const totalAlbunsAtivos = (albuns: AlbumDoc[]) => albuns.filter((a) => a.status !== "removed").length;

/** Quantidade de álbuns da coleção ativa por tipo de mídia (todas as quatro categorias, mesmo com zero). */
export function albunsPorFormato(albuns: AlbumDoc[]): Record<CategoriaMidia, number> {
  const r = zeradoPorFormato();
  for (const a of albuns) if (a.status !== "removed") r[a.mediaType] += 1;
  return r;
}

/** Audições por tipo de mídia, pelo formato atual cadastrado no álbum. */
export function audicoesPorFormato(audicoes: AudicaoDoc[], albuns: AlbumPorId): Record<CategoriaMidia, number> {
  const r = zeradoPorFormato();
  for (const a of audicoes) {
    const f = identificar(a, albuns).mediaType;
    if (f) r[f] += 1;
  }
  return r;
}

export type RegistroAudicao = { id: string; releaseId: string; artista: string; titulo: string; date: string; time: string; ativo: boolean };

/** Todos os registros de audição de álbuns de um formato, dos mais recentes aos mais antigos. */
export function audicoesDoFormato(audicoes: AudicaoDoc[], albuns: AlbumPorId, formato: CategoriaMidia): RegistroAudicao[] {
  return audicoes
    .map((a) => ({ a, i: identificar(a, albuns) }))
    .filter(({ i }) => i.mediaType === formato)
    .map(({ a, i }) => ({ id: a.id, releaseId: a.releaseId, artista: i.artista, titulo: i.titulo, date: a.date, time: a.time, ativo: i.ativo }))
    .sort((x, y) => (y.date + y.time).localeCompare(x.date + x.time) || y.id.localeCompare(x.id));
}

export const SLUG_FORMATO: Record<CategoriaMidia, string> = { CD: "cd", Vinyl: "vinyl", DVD: "dvd", "CD/DVD": "cd-dvd" };
export const formatoDoSlug = (slug: string): CategoriaMidia | null => CATEGORIAS_MIDIA.find((c) => SLUG_FORMATO[c] === slug) ?? null;

// ───────────────────────── estatísticas anuais ─────────────────────────

export type EstatisticasAno = {
  ano: number;
  /** Quantidade de registros de audição no ano. */
  totalAudicoes: number;
  /** Quantidade de álbuns DISTINTOS com pelo menos uma audição no ano. */
  totalDiscosOuvidos: number;
  artistas: ArtistaRanking[];
  albuns: AlbumRanking[];
  /** Audições por mês (janeiro = índice 0). */
  porMes: number[];
};

export function estatisticasDoAno(audicoes: AudicaoDoc[], albuns: AlbumPorId, ano: number, limite = 10): EstatisticasAno {
  const doAno = audicoes.filter((a) => a.date.startsWith(`${ano}-`));
  const porMes = Array<number>(12).fill(0);
  for (const a of doAno) porMes[Number(a.date.slice(5, 7)) - 1] += 1;
  return {
    ano,
    totalAudicoes: doAno.length,
    totalDiscosOuvidos: new Set(doAno.map((a) => a.releaseId)).size,
    artistas: artistasMaisOuvidos(doAno, albuns, limite),
    albuns: albunsMaisOuvidos(doAno, albuns, limite),
    porMes,
  };
}

/** Anos com audições, mais o ano atual, do mais recente ao mais antigo. */
export function anosDisponiveis(audicoes: AudicaoDoc[], anoAtual: number): number[] {
  const anos = new Set(audicoes.map((a) => Number(a.date.slice(0, 4))).filter(Number.isFinite));
  anos.add(anoAtual);
  return [...anos].sort((x, y) => y - x);
}
