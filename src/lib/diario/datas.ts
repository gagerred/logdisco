import type { AlbumDoc, AudicaoDoc } from "@/lib/tipos";
import { tituloExibido } from "@/lib/colecao/filtros";

export const MESES = [
  "janeiro", "fevereiro", "março", "abril", "maio", "junho",
  "julho", "agosto", "setembro", "outubro", "novembro", "dezembro",
];
export const DIAS_SEMANA = ["dom", "seg", "ter", "qua", "qui", "sex", "sáb"];

const dois = (n: number) => String(n).padStart(2, "0");

/** Data local no formato AAAA-MM-DD. */
export const dataLocal = (d: Date = new Date()) => `${d.getFullYear()}-${dois(d.getMonth() + 1)}-${dois(d.getDate())}`;
/** Hora local no formato HH:mm. */
export const horaLocal = (d: Date = new Date()) => `${dois(d.getHours())}:${dois(d.getMinutes())}`;

/** "2026-11-13" → "13/11/2026" (sem passar por Date, para não sofrer com fuso horário). */
export function formatarData(date: string): string {
  const [a, m, d] = date.split("-");
  return `${d}/${m}/${a}`;
}

/** "2026-11-13" → "13 de novembro de 2026". */
export function formatarDataExtensa(date: string): string {
  const [a, m, d] = date.split("-").map(Number);
  return `${d} de ${MESES[m - 1]} de ${a}`;
}

export type ResultadoDataHora = { ok: true; listenedAt: Date } | { ok: false; erro: string };

/** Valida a data e o hora informados: formato, data real do calendário e não ser no futuro. */
export function validarDataHora(date: string, time: string, agora: Date = new Date()): ResultadoDataHora {
  const d = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date);
  const h = /^(\d{2}):(\d{2})$/.exec(time);
  if (!d) return { ok: false, erro: "Informe a data da audição." };
  if (!h) return { ok: false, erro: "Informe o horário da audição." };
  const [ano, mes, dia, hh, mm] = [d[1], d[2], d[3], h[1], h[2]].map(Number);
  if (ano < 1900 || hh > 23 || mm > 59) return { ok: false, erro: "Data ou horário inválido." };
  const quando = new Date(ano, mes - 1, dia, hh, mm);
  if (quando.getFullYear() !== ano || quando.getMonth() !== mes - 1 || quando.getDate() !== dia) {
    return { ok: false, erro: "Essa data não existe no calendário." };
  }
  if (quando.getTime() > agora.getTime()) {
    return { ok: false, erro: "A audição não pode estar no futuro. Confira a data e o horário." };
  }
  return { ok: true, listenedAt: quando };
}

/** Mais recentes primeiro, pela data e hora da audição — e não pela ordem em que foram cadastradas. */
export function ordenarAudicoes(audicoes: AudicaoDoc[]): AudicaoDoc[] {
  return [...audicoes].sort(
    (a, b) => (b.date + b.time).localeCompare(a.date + a.time) || b.id.localeCompare(a.id),
  );
}

export const ultimasAudicoes = (audicoes: AudicaoDoc[], n: number) => ordenarAudicoes(audicoes).slice(0, n);

/** Audições de um dia, na ordem em que aconteceram. */
export function audicoesDoDia(audicoes: AudicaoDoc[], date: string): AudicaoDoc[] {
  return audicoes.filter((a) => a.date === date).sort((a, b) => a.time.localeCompare(b.time) || a.id.localeCompare(b.id));
}

/** Quantidade de audições por data (AAAA-MM-DD). */
export function contarPorDia(audicoes: AudicaoDoc[]): Map<string, number> {
  const mapa = new Map<string, number>();
  for (const a of audicoes) mapa.set(a.date, (mapa.get(a.date) ?? 0) + 1);
  return mapa;
}

/** Semanas do mês (domingo a sábado); células vazias são null. mes vai de 1 a 12. */
export function gradeDoMes(ano: number, mes: number): (string | null)[][] {
  const primeiro = new Date(Date.UTC(ano, mes - 1, 1)).getUTCDay();
  const dias = new Date(Date.UTC(ano, mes, 0)).getUTCDate();
  const celulas: (string | null)[] = Array(primeiro).fill(null);
  for (let d = 1; d <= dias; d++) celulas.push(`${ano}-${dois(mes)}-${dois(d)}`);
  while (celulas.length % 7) celulas.push(null);
  const semanas: (string | null)[][] = [];
  for (let i = 0; i < celulas.length; i += 7) semanas.push(celulas.slice(i, i + 7));
  return semanas;
}

export type AudicaoIdentificada = {
  album: AlbumDoc | null;
  titulo: string;
  artista: string;
  thumb: string | null;
  /** O álbum saiu da coleção ativa (exclusão lógica); a audição continua no histórico. */
  removido: boolean;
};

/** Identifica o álbum de uma audição, usando o registro do álbum ou, na falta dele, o snapshot guardado. */
export function identificarAudicao(a: AudicaoDoc, albuns: Map<string, AlbumDoc>): AudicaoIdentificada {
  const album = albuns.get(a.releaseId) ?? null;
  if (album) {
    return { album, titulo: tituloExibido(album), artista: album.artistName, thumb: album.thumb ?? album.cover, removido: album.status === "removed" };
  }
  return {
    album: null,
    titulo: a.snapshot?.title ?? "Álbum desconhecido",
    artista: a.snapshot?.artistName ?? "",
    thumb: a.snapshot?.thumb ?? null,
    removido: true,
  };
}
