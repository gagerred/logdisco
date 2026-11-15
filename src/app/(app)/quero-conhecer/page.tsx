"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { deleteDoc, doc } from "firebase/firestore";
import { Loader2 } from "lucide-react";
import { CapaAlbum } from "@/components/CapaAlbum";
import { Modal } from "@/components/Modal";
import { OpcoesQueroConhecer } from "@/components/OpcoesQueroConhecer";
import { chamarApi } from "@/lib/api-cliente";
import { useAuth } from "@/lib/auth-context";
import { normalizarCodigoRelease } from "@/lib/discogs/codigo";
import { getDb } from "@/lib/firebase-client";
import type { QueroConhecerDoc } from "@/lib/wantlist/tipos";
import { useQueroConhecer } from "@/lib/wantlist/use-wantlist";

export default function QueroConhecer() {
  const { user } = useAuth();
  const itens = useQueroConhecer();
  const [codigo, setCodigo] = useState("");
  const [adicionando, setAdicionando] = useState(false);
  const [aviso, setAviso] = useState<{ ok: boolean; texto: string; semVinculo?: boolean } | null>(null);
  const [aberto, setAberto] = useState<QueroConhecerDoc | null>(null);
  const [confirmando, setConfirmando] = useState(false);
  const [excluindo, setExcluindo] = useState(false);
  const [erroExcluir, setErroExcluir] = useState<string | null>(null);

  const lista = useMemo(
    () => [...(itens ?? [])].sort((a, b) => (b.adicionadoEm?.toMillis() ?? Infinity) - (a.adicionadoEm?.toMillis() ?? Infinity)),
    [itens],
  );

  async function adicionar(e: React.FormEvent) {
    e.preventDefault();
    if (!user) return;
    setAviso(null);
    const norm = normalizarCodigoRelease(codigo);
    if (!norm.ok) return setAviso({ ok: false, texto: norm.erro });
    setAdicionando(true);
    try {
      const r = await chamarApi(user, "/api/discover", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ codigo: String(norm.id) }),
      });
      if (r.ok) {
        setCodigo("");
        setAviso({ ok: true, texto: "Álbum adicionado à lista Quero Conhecer." });
      } else {
        setAviso({ ok: false, texto: r.dados?.erro ?? `O servidor respondeu com erro (HTTP ${r.status}).`, semVinculo: r.dados?.codigo === "sem_vinculo" });
      }
    } catch {
      setAviso({ ok: false, texto: "Não foi possível falar com o servidor." });
    } finally {
      setAdicionando(false);
    }
  }

  function fechar() {
    setAberto(null);
    setConfirmando(false);
    setErroExcluir(null);
  }

  async function excluir() {
    if (!user || !aberto) return;
    setExcluindo(true);
    setErroExcluir(null);
    try {
      await deleteDoc(doc(getDb(), "users", user.uid, "discover", aberto.id));
      fechar();
    } catch {
      setErroExcluir("Não foi possível excluir. Verifique a conexão e tente de novo.");
    } finally {
      setExcluindo(false);
    }
  }

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-extrabold tracking-tight text-verde-950 md:text-3xl">Quero Conhecer</h1>
        <p className="mt-1 text-sm text-verde-800">Álbuns que você quer ouvir no futuro. Esta lista é independente da coleção e da lista de desejos.</p>
      </div>

      <form onSubmit={adicionar} className="painel max-w-xl" noValidate>
        <label htmlFor="qc-codigo" className="campo-rotulo">Código do álbum no Discogs</label>
        <div className="flex gap-2">
          <input id="qc-codigo" className="campo" placeholder="R123456, 123456 ou [R123456]" value={codigo} onChange={(e) => setCodigo(e.target.value)} autoComplete="off" />
          <button type="submit" disabled={adicionando} className="btn-primario shrink-0">
            {adicionando && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />} Adicionar
          </button>
        </div>
        {aviso && (
          <p role={aviso.ok ? "status" : "alert"} className={`mt-3 ${aviso.ok ? "aviso-ok" : "aviso-erro"}`}>
            {aviso.texto} {aviso.semVinculo && <Link href="/configuracoes" className="font-semibold underline">Ir para Configurações</Link>}
          </p>
        )}
      </form>

      {itens === null ? (
        <p className="text-verde-800">Carregando…</p>
      ) : lista.length === 0 ? (
        <p className="text-verde-800">Nenhum álbum na lista ainda.</p>
      ) : (
        <ul className="grid gap-2 lg:grid-cols-2">
          {lista.map((i) => (
            <li key={i.id}>
              <button onClick={() => setAberto(i)} className="flex min-h-[4.5rem] w-full items-center gap-3 rounded-md border border-verde-200 bg-white p-2 text-left hover:bg-verde-50">
                <CapaAlbum album={{ cover: null, thumb: i.capa }} className="h-14 w-14 shrink-0 rounded" />
                <div className="min-w-0 flex-1">
                  <p className="break-words font-semibold leading-snug text-verde-950">{i.titulo}</p>
                  <p className="break-words text-sm text-verde-800">{i.artista}</p>
                </div>
              </button>
            </li>
          ))}
        </ul>
      )}

      <Modal aberto={!!aberto} aoFechar={fechar} titulo={aberto?.titulo ?? "Álbum"}>
        {aberto && (
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <CapaAlbum album={{ cover: aberto.capa, thumb: aberto.capa }} className="h-16 w-16 shrink-0 rounded" />
              <p className="min-w-0 break-words text-sm text-verde-800">{aberto.artista}</p>
            </div>
            {!confirmando ? (
              <OpcoesQueroConhecer item={aberto} aoExcluir={() => setConfirmando(true)} />
            ) : (
              <div className="space-y-3">
                <p>Remover <strong>{aberto.titulo}</strong> da lista Quero Conhecer?</p>
                {erroExcluir && <p role="alert" className="aviso-erro">{erroExcluir}</p>}
                <div className="flex flex-wrap justify-end gap-2">
                  <button className="btn-contorno" onClick={() => setConfirmando(false)}>Cancelar</button>
                  <button className="btn-perigo" onClick={excluir} disabled={excluindo}>
                    {excluindo && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />} Excluir
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </Modal>
    </div>
  );
}
