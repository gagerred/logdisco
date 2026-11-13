import Link from "next/link";
import type { GrupoArtista } from "@/lib/colecao/artistas";

export function ListaArtistas({ artistas }: { artistas: GrupoArtista[] }) {
  return (
    <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
      {artistas.map((g) => (
        <li key={g.key}>
          <Link href={`/artista/${g.key}`} className="flex min-h-12 items-center justify-between gap-3 rounded-md border border-verde-200 bg-white px-3 py-2 hover:bg-verde-50">
            <span className="min-w-0 break-words font-semibold text-verde-950">{g.name}</span>
            <span className="shrink-0 text-sm text-verde-700">{g.albuns.length} {g.albuns.length === 1 ? "álbum" : "álbuns"}</span>
          </Link>
        </li>
      ))}
    </ul>
  );
}
