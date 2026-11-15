import { ExternalLink, Headphones, Trash2 } from "lucide-react";
import { urlYouTubeMusic } from "@/lib/links";
import type { QueroConhecerDoc } from "@/lib/wantlist/tipos";

/** As três opções de um álbum da lista Quero Conhecer: abrir no Discogs, ouvir no YouTube Music e excluir. */
export function OpcoesQueroConhecer({ item, aoExcluir }: { item: QueroConhecerDoc; aoExcluir: () => void }) {
  return (
    <div className="grid gap-2">
      <a href={item.discogsUrl} target="_blank" rel="noopener noreferrer" className="btn-contorno justify-start">
        <ExternalLink className="h-4 w-4" aria-hidden="true" /> Abrir no Discogs
      </a>
      <button className="btn-contorno justify-start !text-verm-700" onClick={aoExcluir}>
        <Trash2 className="h-4 w-4" aria-hidden="true" /> Excluir
      </button>
      <a href={urlYouTubeMusic(item.artista, item.titulo)} target="_blank" rel="noopener noreferrer" className="btn-primario justify-start">
        <Headphones className="h-4 w-4" aria-hidden="true" /> Ouvir no YouTube Music
      </a>
    </div>
  );
}
