"use client";

import { useCallback, useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { chamarApi } from "@/lib/api-cliente";
import { useAuth } from "@/lib/auth-context";
import type { AlbumDoc, DetalheMudanca } from "@/lib/tipos";
import { Modal } from "./Modal";

type Estado =
  | { fase: "consultando" }
  | { fase: "atualizado" }
  | { fase: "previa"; mudancas: DetalheMudanca[] }
  | { fase: "aplicando" }
  | { fase: "concluido"; mudancas: DetalheMudanca[] }
  | { fase: "erro"; texto: string };

type RespostaRefresh = { mudancas: DetalheMudanca[]; aplicado: boolean };

/**
 * Recarrega os dados do Discogs em duas etapas: primeiro mostra as diferenças,
 * e só grava depois da confirmação. Audições e a categoria de mídia nunca são alteradas.
 */
export function RecarregarAlbum({ album, aberto, aoFechar }: { album: AlbumDoc; aberto: boolean; aoFechar: () => void }) {
  const { user } = useAuth();
  const [estado, setEstado] = useState<Estado>({ fase: "consultando" });

  const chamar = useCallback(
    (aplicar: boolean) =>
      chamarApi<RespostaRefresh>(user!, `/api/albums/${album.id}/refresh`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ aplicar }),
      }),
    [user, album.id],
  );

  useEffect(() => {
    if (!aberto || !user) return;
    let cancelado = false;
    setEstado({ fase: "consultando" });
    chamar(false)
      .then((r) => {
        if (cancelado) return;
        if (!r.ok || !r.dados) return setEstado({ fase: "erro", texto: r.dados?.erro ?? `O servidor respondeu com erro (HTTP ${r.status}).` });
        setEstado(r.dados.mudancas.length === 0 ? { fase: "atualizado" } : { fase: "previa", mudancas: r.dados.mudancas });
      })
      .catch(() => !cancelado && setEstado({ fase: "erro", texto: "Não foi possível falar com o servidor." }));
    return () => {
      cancelado = true;
    };
  }, [aberto, user, chamar]);

  async function aplicar() {
    setEstado({ fase: "aplicando" });
    try {
      const r = await chamar(true);
      if (!r.ok || !r.dados) return setEstado({ fase: "erro", texto: r.dados?.erro ?? `O servidor respondeu com erro (HTTP ${r.status}).` });
      setEstado({ fase: "concluido", mudancas: r.dados.mudancas });
    } catch {
      setEstado({ fase: "erro", texto: "Não foi possível falar com o servidor." });
    }
  }

  return (
    <Modal aberto={aberto} aoFechar={aoFechar} titulo="Recarregar do Discogs">
      {estado.fase === "consultando" && (
        <p className="flex items-center gap-2 text-verde-800"><Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> Consultando o Discogs…</p>
      )}
      {estado.fase === "aplicando" && (
        <p className="flex items-center gap-2 text-verde-800"><Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> Aplicando alterações…</p>
      )}
      {estado.fase === "atualizado" && <p className="aviso-ok">Nenhuma alteração encontrada: as informações já estão atualizadas.</p>}
      {estado.fase === "erro" && <p role="alert" className="aviso-erro">{estado.texto}</p>}
      {(estado.fase === "previa" || estado.fase === "concluido") && (
        <>
          <p className="text-sm">{estado.fase === "previa" ? "O Discogs tem estas diferenças em relação ao seu cadastro:" : "Alterações aplicadas:"}</p>
          <ul className="mt-3 space-y-2">
            {estado.mudancas.map((m) => (
              <li key={m.campo} className="rounded-md border border-verde-200 p-3 text-sm">
                <p className="font-semibold text-verde-950">{m.rotulo}</p>
                <p className="break-words text-verde-800">{m.de} <span aria-hidden="true">→</span><span className="sr-only">para</span> {m.para}</p>
              </li>
            ))}
          </ul>
          <p className="mt-3 text-xs text-verde-700">Suas audições, o tipo de mídia, o título personalizado e o nome do artista não são alterados.</p>
        </>
      )}
      <div className="mt-4 flex flex-wrap justify-end gap-2">
        {estado.fase === "previa" ? (
          <>
            <button className="btn-contorno" onClick={aoFechar}>Cancelar</button>
            <button className="btn-primario" onClick={aplicar}>Aplicar alterações</button>
          </>
        ) : (
          <button className="btn-contorno" onClick={aoFechar} disabled={estado.fase === "aplicando"}>Fechar</button>
        )}
      </div>
    </Modal>
  );
}
