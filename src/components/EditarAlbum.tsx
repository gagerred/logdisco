"use client";

import { useEffect, useState } from "react";
import { collection, deleteField, doc, serverTimestamp, writeBatch } from "firebase/firestore";
import { Loader2 } from "lucide-react";
import { compararEdicao } from "@/lib/colecao/atualizacao";
import { tituloExibido } from "@/lib/colecao/filtros";
import { useAuth } from "@/lib/auth-context";
import { getDb } from "@/lib/firebase-client";
import { CATEGORIAS_MIDIA, type CategoriaMidia } from "@/lib/discogs/formato";
import type { AlbumDoc } from "@/lib/tipos";
import { Modal } from "./Modal";

/**
 * Edição de título e categoria de mídia. O artista não é editável e o formato
 * original do Discogs é só informativo. Mexe apenas no documento do álbum
 * (e no histórico de alterações): as audições não são tocadas.
 */
export function EditarAlbum({ album, aberto, aoFechar }: { album: AlbumDoc; aberto: boolean; aoFechar: () => void }) {
  const { user } = useAuth();
  const [titulo, setTitulo] = useState("");
  const [midia, setMidia] = useState<CategoriaMidia>(album.mediaType);
  const [erro, setErro] = useState<string | null>(null);
  const [salvando, setSalvando] = useState(false);

  useEffect(() => {
    if (!aberto) return;
    setTitulo(tituloExibido(album));
    setMidia(album.mediaType);
    setErro(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [aberto]);

  async function salvar(e: React.FormEvent) {
    e.preventDefault();
    if (!user) return;
    const r = compararEdicao(album, { titulo, mediaType: midia });
    if (!r.detalhes.length) return aoFechar();

    setSalvando(true);
    setErro(null);
    try {
      const db = getDb();
      const lote = writeBatch(db);
      lote.update(doc(db, "users", user.uid, "releases", album.id), {
        ...(r.mudouTitulo ? { titleCustom: r.novoCustom ?? deleteField() } : {}),
        ...(r.mudouFormato ? { mediaType: midia } : {}),
        updatedAt: serverTimestamp(),
      });
      lote.set(doc(collection(db, "users", user.uid, "changeLog")), {
        tipo: "edicao",
        at: serverTimestamp(),
        releaseId: Number(album.id),
        resumo: `Editou ${album.artistName} — ${tituloExibido(album)} (${r.detalhes.map((d) => d.rotulo.toLowerCase()).join(", ")})`,
        detalhes: r.detalhes,
      });
      await lote.commit();
      aoFechar();
    } catch {
      setErro("Não foi possível salvar as alterações. Verifique a conexão e tente de novo.");
    } finally {
      setSalvando(false);
    }
  }

  return (
    <Modal aberto={aberto} aoFechar={aoFechar} titulo="Editar álbum">
      <form onSubmit={salvar} className="space-y-4" noValidate>
        <div>
          <label htmlFor="ed-titulo" className="campo-rotulo">Título do álbum</label>
          <input id="ed-titulo" className="campo" maxLength={300} value={titulo} onChange={(e) => setTitulo(e.target.value)} />
          <p className="mt-1 text-xs text-verde-700">Título no Discogs: {album.title}. Deixe em branco para voltar a ele.</p>
        </div>
        <div className="max-w-xs">
          <label htmlFor="ed-midia" className="campo-rotulo">Tipo de mídia</label>
          <select id="ed-midia" className="campo" value={midia} onChange={(e) => setMidia(e.target.value as CategoriaMidia)}>
            {CATEGORIAS_MIDIA.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
          <p className="mt-1 text-xs text-verde-700">Formato original no Discogs: {album.formatOriginal || "—"}</p>
        </div>
        <div>
          <p className="campo-rotulo">Artista</p>
          <p className="text-sm">{album.artistName} <span className="text-verde-700">(definido pelo Discogs, não editável)</span></p>
        </div>
        <p className="text-xs text-verde-700">Suas audições registradas não são alteradas por esta edição.</p>
        {erro && <p role="alert" className="aviso-erro">{erro}</p>}
        <div className="flex flex-wrap justify-end gap-2">
          <button type="button" className="btn-contorno" onClick={aoFechar}>Cancelar</button>
          <button type="submit" disabled={salvando} className="btn-primario">
            {salvando && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />} Salvar
          </button>
        </div>
      </form>
    </Modal>
  );
}
