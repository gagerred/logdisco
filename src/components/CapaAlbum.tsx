"use client";

import { useState } from "react";
import { Disco } from "./Disco";
import type { AlbumDoc } from "@/lib/tipos";

type Props = { album: Pick<AlbumDoc, "cover" | "thumb">; grande?: boolean; className?: string };

/** Capa do álbum; se não houver imagem ou ela falhar, mostra um disco no lugar. */
export function CapaAlbum({ album, grande, className = "" }: Props) {
  const [falhou, setFalhou] = useState(false);
  const url = grande ? (album.cover ?? album.thumb) : (album.thumb ?? album.cover);
  if (!url || falhou) {
    return (
      <div className={`grid place-items-center bg-verde-950 ${className}`} aria-hidden="true">
        <Disco className="h-3/4 w-3/4" aneis={4} />
      </div>
    );
  }
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={url} alt="" loading="lazy" referrerPolicy="no-referrer" onError={() => setFalhou(true)} className={`bg-verde-50 object-cover ${className}`} />
  );
}
