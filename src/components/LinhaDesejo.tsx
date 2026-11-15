import Link from "next/link";
import { rotuloFormato } from "@/lib/wantlist/logica";
import type { DesejoDoc } from "@/lib/wantlist/tipos";
import { CapaAlbum } from "./CapaAlbum";

/** Item da lista de desejos: capa e título levam ao disco; cada artista leva à lista de desejos dele. */
export function LinhaDesejo({ d }: { d: DesejoDoc }) {
  return (
    <div className="flex min-h-[4.5rem] items-center gap-3 rounded-md border border-verde-200 bg-white p-2">
      <Link href={`/desejos/${d.id}`} className="shrink-0" aria-label={`Abrir ${d.titulo}`}>
        <CapaAlbum album={{ cover: null, thumb: d.capa }} className="h-14 w-14 rounded" />
      </Link>
      <div className="min-w-0 flex-1">
        <p className="break-words leading-snug">
          <Link href={`/desejos/${d.id}`} className="font-semibold text-verde-950 hover:underline">{d.titulo}</Link>{" "}
          <span className="inline-block whitespace-nowrap rounded border border-verde-200 bg-verde-50 px-1.5 py-0.5 align-middle text-xs font-semibold text-verde-900">{rotuloFormato(d)}</span>
        </p>
        <p className="break-words text-sm text-verde-800">
          {d.artists.map((a, i) => (
            <span key={a.key}>
              {i > 0 && " · "}
              <Link href={`/desejos/artista/${a.key}`} className="underline decoration-verm-600 underline-offset-2 hover:text-verm-700">{a.name}</Link>
            </span>
          ))}
        </p>
      </div>
    </div>
  );
}
