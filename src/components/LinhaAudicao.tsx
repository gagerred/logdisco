"use client";

import Link from "next/link";
import { useState } from "react";
import { deleteDoc, doc } from "firebase/firestore";
import { Loader2, Pencil, Trash2 } from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { formatarData, type AudicaoIdentificada } from "@/lib/diario/datas";
import { getDb } from "@/lib/firebase-client";
import type { AudicaoDoc } from "@/lib/tipos";
import { CapaAlbum } from "./CapaAlbum";
import { EditarAudicao } from "./EditarAudicao";
import { Modal } from "./Modal";

type Props = { audicao: AudicaoDoc; ident: AudicaoIdentificada; mostrarAlbum?: boolean; acoes?: boolean };

/** Uma audição: álbum (opcional), data e horário, e ações de editar e excluir. */
export function LinhaAudicao({ audicao, ident, mostrarAlbum = true, acoes = false }: Props) {
  const { user } = useAuth();
  const [editando, setEditando] = useState(false);
  const [excluindo, setExcluindo] = useState(false);
  const [apagando, setApagando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  async function excluir() {
    if (!user) return;
    setApagando(true);
    setErro(null);
    try {
      await deleteDoc(doc(getDb(), "users", user.uid, "listens", audicao.id));
      setExcluindo(false);
    } catch {
      setErro("Não foi possível excluir. Verifique a conexão e tente de novo.");
    } finally {
      setApagando(false);
    }
  }

  const quando = `${formatarData(audicao.date)} às ${audicao.time}`;
  const titulo = ident.album ? (
    <Link href={`/album/${ident.album.id}`} className="font-semibold text-verde-950 underline-offset-2 hover:underline">{ident.titulo}</Link>
  ) : (
    <span className="font-semibold text-verde-950">{ident.titulo}</span>
  );

  return (
    <div className="flex items-center gap-3 rounded-md border border-verde-200 bg-white p-2">
      {mostrarAlbum && <CapaAlbum album={{ cover: null, thumb: ident.thumb }} className="h-14 w-14 shrink-0 rounded" />}
      <div className="min-w-0 flex-1">
        {mostrarAlbum ? (
          <>
            <p className="break-words leading-snug">{titulo}</p>
            <p className="break-words text-sm text-verde-800">
              {ident.artista}{ident.removido && <span className="text-verm-700"> · fora da coleção ativa</span>}
            </p>
            <p className="text-sm tabular-nums text-verde-700">{quando}</p>
          </>
        ) : (
          <p className="tabular-nums">{quando}</p>
        )}
      </div>
      {acoes && (
        <div className="flex shrink-0">
          <button onClick={() => setEditando(true)} aria-label={`Editar audição de ${quando}`} className="grid h-11 w-11 place-items-center rounded-md text-verde-800 hover:bg-verde-50">
            <Pencil className="h-5 w-5" aria-hidden="true" />
          </button>
          <button onClick={() => setExcluindo(true)} aria-label={`Excluir audição de ${quando}`} className="grid h-11 w-11 place-items-center rounded-md text-verm-700 hover:bg-verm-50">
            <Trash2 className="h-5 w-5" aria-hidden="true" />
          </button>
        </div>
      )}

      {acoes && (
        <>
          <EditarAudicao audicao={audicao} titulo={`${ident.titulo} — ${ident.artista}`} aberto={editando} aoFechar={() => setEditando(false)} />
          <Modal aberto={excluindo} aoFechar={() => setExcluindo(false)} titulo="Excluir audição">
            <p>Excluir a audição de <strong>{ident.titulo}</strong> em {quando}?</p>
            <p className="mt-1 text-sm text-verde-800">Ela deixará de contar no calendário e nos relatórios. O álbum não é afetado.</p>
            {erro && <p role="alert" className="aviso-erro mt-3">{erro}</p>}
            <div className="mt-4 flex flex-wrap justify-end gap-2">
              <button className="btn-contorno" onClick={() => setExcluindo(false)}>Cancelar</button>
              <button className="btn-perigo" onClick={excluir} disabled={apagando}>
                {apagando && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />} Excluir
              </button>
            </div>
          </Modal>
        </>
      )}
    </div>
  );
}
