"use client";

import { useEffect, useState } from "react";
import { doc, serverTimestamp, Timestamp, updateDoc } from "firebase/firestore";
import { Loader2 } from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { dataLocal, validarDataHora } from "@/lib/diario/datas";
import { getDb } from "@/lib/firebase-client";
import type { AudicaoDoc } from "@/lib/tipos";
import { Modal } from "./Modal";

/** Altera a data e o horário de uma audição. O álbum a que ela pertence não muda. */
export function EditarAudicao({ audicao, titulo, aberto, aoFechar }: { audicao: AudicaoDoc; titulo: string; aberto: boolean; aoFechar: () => void }) {
  const { user } = useAuth();
  const [data, setData] = useState(audicao.date);
  const [hora, setHora] = useState(audicao.time);
  const [erro, setErro] = useState<string | null>(null);
  const [salvando, setSalvando] = useState(false);

  useEffect(() => {
    if (!aberto) return;
    setData(audicao.date);
    setHora(audicao.time);
    setErro(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [aberto]);

  async function salvar(e: React.FormEvent) {
    e.preventDefault();
    if (!user) return;
    const v = validarDataHora(data, hora);
    if (!v.ok) return setErro(v.erro);
    if (data === audicao.date && hora === audicao.time) return aoFechar();

    setSalvando(true);
    setErro(null);
    try {
      await updateDoc(doc(getDb(), "users", user.uid, "listens", audicao.id), {
        date: data,
        time: hora,
        listenedAt: Timestamp.fromDate(v.listenedAt),
        updatedAt: serverTimestamp(),
      });
      aoFechar();
    } catch {
      setErro("Não foi possível salvar. Verifique a conexão e tente de novo.");
    } finally {
      setSalvando(false);
    }
  }

  return (
    <Modal aberto={aberto} aoFechar={aoFechar} titulo="Editar audição">
      <form onSubmit={salvar} className="space-y-4" noValidate>
        <p className="break-words text-sm"><strong>{titulo}</strong></p>
        <div>
          <label htmlFor="ed-aud-data" className="campo-rotulo">Data da audição</label>
          <div className="flex gap-2">
            <input id="ed-aud-data" type="date" className="campo" value={data} max={dataLocal()} onChange={(e) => setData(e.target.value)} />
            <button type="button" className="btn-contorno shrink-0" onClick={() => setData(dataLocal())}>Hoje</button>
          </div>
        </div>
        <div className="max-w-40">
          <label htmlFor="ed-aud-hora" className="campo-rotulo">Horário</label>
          <input id="ed-aud-hora" type="time" className="campo" value={hora} onChange={(e) => setHora(e.target.value)} />
        </div>
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
