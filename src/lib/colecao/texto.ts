/** Minúsculas e sem acentos, para buscas que ignoram maiúsculas e acentuação. */
export function normalizarTexto(texto: string): string {
  return texto
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}
