"use client";

import { useEffect, useState } from "react";
import { collection, doc, serverTimestamp, setDoc, Timestamp } from "firebase/firestore";
import { Loader2 } from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { tituloExibido } from "@/lib/colecao/filtros";
import { dataLocal, horaLocal, validarDataHora } from "@/lib/diario/datas";
import { getDb } from "@/lib/firebase-client";
import type { AlbumDoc } from "@/lib/tipos";
import { Modal } from "./Modal";

type Props = { album: AlbumDoc; aberto: boolean; aoFechar: () => void; aoRegistrar?: () => void };

/** Registra uma audição: data (calendário), horário e o botão "Hoje". Grava só em users/{uid}/listens. */
export function RegistrarAudicao({ album, aberto, aoFechar, aoRegistrar }: Props) {
  const { user } = useAuth();
  const [data, setData] = useState("");
  const [hora, setHora] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const [salvando, setSalvando] = useState(false);

  useEffect(() => {
    if (!aberto) return;
    setData(dataLocal());
    setHora(horaLocal());
    setErro(null);
  }, [aberto]);

  async function confirmar(e: React.FormEvent) {
    e.preventDefault();
    if (!user) return;
    const v = validarDataHora(data, hora);
    if (!v.ok) return setErro(v.erro);

    setSalvando(true);
    setErro(null);
    try {
      const db = getDb();
      await setDoc(doc(collection(db, "users", user.uid, "listens")), {
        releaseId: album.id,
        date: data,
        time: hora,
        listenedAt: Timestamp.fromDate(v.listenedAt),
        // Identificação guardada junto da audição: o histórico continua legível mesmo se o álbum sair da coleção.
        snapshot: {
          artistName: album.artistName,
          title: tituloExibido(album),
          thumb: album.thumb ?? album.cover ?? null,
          mediaType: album.mediaType,
        },
        createdAt: serverTimestamp(),
      });
      aoRegistrar?.();
      aoFechar();
    } catch {
      setErro("Não foi possível registrar a audição. Verifique a conexão e tente de novo.");
    } finally {
      setSalvando(false);
    }
  }

  return (
    <Modal aberto={aberto} aoFechar={aoFechar} titulo="Registrar audição">
      <form onSubmit={confirmar} className="space-y-4" noValidate>
        <p className="break-words text-sm">
          <strong>{tituloExibido(album)}</strong> — {album.artistName}
        </p>
        <div>
          <label htmlFor="aud-data" className="campo-rotulo">Data da audição</label>
          <div className="flex gap-2">
            <input id="aud-data" type="date" className="campo" value={data} max={dataLocal()} onChange={(e) => setData(e.target.value)} />
            <button type="button" className="btn-contorno shrink-0" onClick={() => setData(dataLocal())}>Hoje</button>
          </div>
        </div>
        <div className="max-w-40">
          <label htmlFor="aud-hora" className="campo-rotulo">Horário</label>
          <input id="aud-hora" type="time" className="campo" value={hora} onChange={(e) => setHora(e.target.value)} />
        </div>
        {erro && <p role="alert" className="aviso-erro">{erro}</p>}
        <div className="flex flex-wrap justify-end gap-2">
          <button type="button" className="btn-contorno" onClick={aoFechar}>Cancelar</button>
          <button type="submit" disabled={salvando} className="btn-primario">
            {salvando && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />} Registrar
          </button>
        </div>
      </form>
    </Modal>
  );
}
