export type ResultadoCodigo = { ok: true; id: number } | { ok: false; erro: string };

const PADRAO = /^(?:\[\s*[rR]?(\d{1,10})\s*\]|[rR]?(\d{1,10}))$/;
const PADRAO_MASTER = /^\[?\s*[mM]\d+\s*\]?$/;

/**
 * Normaliza o código de um lançamento (Release) do Discogs.
 * Aceita "R123456", "123456" e "[R123456]" e devolve o identificador numérico.
 */
export function normalizarCodigoRelease(entrada: string): ResultadoCodigo {
  const texto = entrada.trim();
  if (!texto) return { ok: false, erro: "Informe o código do lançamento no Discogs." };
  if (PADRAO_MASTER.test(texto)) {
    return {
      ok: false,
      erro: "Esse é o código de um Master (obra). Use o código de um lançamento (Release), que começa com R.",
    };
  }
  const m = PADRAO.exec(texto);
  const id = m ? Number(m[1] ?? m[2]) : NaN;
  if (!m || !Number.isSafeInteger(id) || id <= 0) {
    return { ok: false, erro: "Código inválido. Use formatos como R123456, 123456 ou [R123456]." };
  }
  return { ok: true, id };
}
