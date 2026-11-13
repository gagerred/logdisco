export const CATEGORIAS_MIDIA = ["CD", "Vinyl", "DVD", "CD/DVD"] as const;
export type CategoriaMidia = (typeof CATEGORIAS_MIDIA)[number];

export type FormatoBruto = { name?: string; qty?: string | number; descriptions?: string[] };

/** Nomes que descrevem a embalagem e não o tipo de mídia. */
const IGNORADOS = new Set(["box set", "all media", "book"]);

/** Descreve o formato como o Discogs informa, ex.: "2 × Vinyl, LP, Album + DVD". */
export function descreverFormatoOriginal(formatos: FormatoBruto[] | undefined): string {
  if (!formatos?.length) return "";
  return formatos
    .filter((f) => f.name)
    .map((f) => {
      const qtd = Number(f.qty);
      const prefixo = Number.isFinite(qtd) && qtd > 1 ? `${qtd} × ` : "";
      return prefixo + [f.name, ...(f.descriptions ?? [])].join(", ");
    })
    .join(" + ");
}

/**
 * Converte o formato do Discogs em uma das 4 categorias do LogDisco.
 * Retorna null quando não há correspondência segura (ex.: Cassette, Blu-ray,
 * Vinyl misturado com CD); nesse caso o usuário escolhe a categoria.
 */
export function mapearCategoria(formatos: FormatoBruto[] | undefined): CategoriaMidia | null {
  const nomes = (formatos ?? [])
    .map((f) => (f.name ?? "").trim().toLowerCase())
    .filter((n) => n && !IGNORADOS.has(n));
  if (!nomes.length) return null;

  const vinil = nomes.includes("vinyl");
  const cd = nomes.some((n) => n === "cd" || n === "cdr");
  const dvd = nomes.some((n) => n === "dvd" || n === "dvdr");
  const outro = nomes.some(
    (n) => !["vinyl", "cd", "cdr", "dvd", "dvdr"].includes(n),
  );
  if (outro) return null;

  if (vinil && !cd && !dvd) return "Vinyl";
  if (cd && dvd && !vinil) return "CD/DVD";
  if (cd && !dvd && !vinil) return "CD";
  if (dvd && !cd && !vinil) return "DVD";
  return null;
}
