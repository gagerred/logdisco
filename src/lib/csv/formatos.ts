import { dataLocal } from "@/lib/diario/datas";
import type { AudicaoDoc } from "@/lib/tipos";
import { gerarCsv } from "./csv";

/** O CSV do LogDisco guarda apenas as audições: o código do lançamento no Discogs, a data e o horário. */
export const CABECALHO_AUDICOES = ["discogs_id", "date", "time"] as const;

export const nomeDoArquivo = (prefixo: string, extensao: string, hoje: string = dataLocal()) => `logdisco-${prefixo}-${hoje}.${extensao}`;

/**
 * CSV do diário: uma linha por audição, em ordem cronológica, com o código do Release no Discogs (só o número),
 * a data efetiva (AAAA-MM-DD) e o horário (HH:mm). Abre direto no LibreOffice Calc (UTF-8 com BOM, separador ";").
 */
export function gerarCsvAudicoes(audicoes: AudicaoDoc[]): string {
  const ordenadas = [...audicoes].sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time) || a.releaseId.localeCompare(b.releaseId) || a.id.localeCompare(b.id));
  return gerarCsv(CABECALHO_AUDICOES, ordenadas.map((a) => [a.releaseId, a.date, a.time]));
}
