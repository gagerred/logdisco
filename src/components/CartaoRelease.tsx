"use client";

import { useState } from "react";
import { ExternalLink } from "lucide-react";
import type { ReleaseDoc } from "@/lib/discogs/release";

/** Resumo de um lançamento lido do Discogs (usado no cadastro e no teste de consulta). */
export function CartaoRelease({ r }: { r: ReleaseDoc }) {
  const [capaFalhou, setCapaFalhou] = useState(false);
  const capa = r.thumb ?? r.cover;
  return (
    <div className="mt-4 flex gap-4 rounded-md border border-verde-200 p-3">
      {capa && !capaFalhou ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={capa} alt="" referrerPolicy="no-referrer" onError={() => setCapaFalhou(true)} className="h-24 w-24 shrink-0 rounded object-cover" />
      ) : (
        <div className="grid h-24 w-24 shrink-0 place-items-center rounded bg-verde-50 px-1 text-center text-xs text-verde-700">
          {capaFalhou ? "A capa não carregou" : "Sem capa"}
        </div>
      )}
      <div className="min-w-0 text-sm">
        <p className="font-bold text-verde-950">{r.artistName}</p>
        <p className="break-words">{r.title}{r.year ? ` (${r.year})` : ""}</p>
        <p className="mt-2 text-verde-800">Formato no Discogs: {r.formatOriginal || "—"}</p>
        <p className="text-verde-800">
          Categoria no LogDisco: {r.mediaType ?? "não reconhecida (será escolhida no cadastro)"}
        </p>
        <p className="text-verde-800">Faixas: {r.tracks.length}{r.isVarious ? " · álbum Various" : ""}</p>
        {r.isVarious && r.tracks.slice(0, 3).map((t) => (
          <p key={t.position + t.title} className="break-words text-verde-800">
            {t.position} {t.title}{t.artist ? ` — ${t.artist}` : ""}
          </p>
        ))}
        <a href={r.discogsUrl} target="_blank" rel="noopener noreferrer" className="mt-2 inline-flex items-center gap-1 font-medium text-verde-800 underline underline-offset-2">
          Abrir no Discogs <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
        </a>
      </div>
    </div>
  );
}
