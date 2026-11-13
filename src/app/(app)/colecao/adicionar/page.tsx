"use client";

import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { ChevronLeft, Loader2 } from "lucide-react";
import { CartaoRelease } from "@/components/CartaoRelease";
import { chamarApi } from "@/lib/api-cliente";
import { useAuth } from "@/lib/auth-context";
import { useColecao } from "@/lib/colecao-context";
import { normalizarCodigoRelease } from "@/lib/discogs/codigo";
import { CATEGORIAS_MIDIA } from "@/lib/discogs/formato";
import type { ReleaseDoc } from "@/lib/discogs/release";

export default function AdicionarDisco() {
  const { user } = useAuth();
  const { ativos } = useColecao();
  const router = useRouter();
  const [codigo, setCodigo] = useState("");
  const [consultando, setConsultando] = useState(false);
  const [adicionando, setAdicionando] = useState(false);
  const [release, setRelease] = useState<ReleaseDoc | null>(null);
  const [categoria, setCategoria] = useState("");
  const [erro, setErro] = useState<{ texto: string; semVinculo?: boolean } | null>(null);

  const existente = release ? ativos.find((a) => a.id === String(release.releaseId)) : undefined;

  async function buscar(e: React.FormEvent) {
    e.preventDefault();
    if (!user) return;
    setErro(null);
    setRelease(null);
    const norm = normalizarCodigoRelease(codigo);
    if (!norm.ok) return setErro({ texto: norm.erro });
    setConsultando(true);
    try {
      const r = await chamarApi<{ release: ReleaseDoc }>(user, `/api/discogs/release?codigo=${norm.id}`);
      if (r.ok && r.dados?.release) {
        setRelease(r.dados.release);
        setCategoria(r.dados.release.mediaType ?? "");
      } else {
        setErro({ texto: r.dados?.erro ?? `O servidor respondeu com erro (HTTP ${r.status}).`, semVinculo: r.dados?.codigo === "sem_vinculo" });
      }
    } catch {
      setErro({ texto: "Não foi possível falar com o servidor." });
    } finally {
      setConsultando(false);
    }
  }

  async function adicionar() {
    if (!user || !release) return;
    if (!categoria) return setErro({ texto: "Escolha o tipo de mídia antes de adicionar." });
    setErro(null);
    setAdicionando(true);
    try {
      const r = await chamarApi<{ releaseId: string }>(user, "/api/albums", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ codigo: String(release.releaseId), mediaType: categoria }),
      });
      if (r.ok && r.dados?.releaseId) {
        router.push(`/album/${r.dados.releaseId}`);
        return;
      }
      setErro({ texto: r.dados?.erro ?? `O servidor respondeu com erro (HTTP ${r.status}).` });
    } catch {
      setErro({ texto: "Não foi possível falar com o servidor." });
    }
    setAdicionando(false);
  }

  return (
    <div className="max-w-2xl space-y-5">
      <Link href="/colecao" className="inline-flex min-h-11 items-center gap-1 text-sm font-medium text-verde-800 hover:underline">
        <ChevronLeft className="h-4 w-4" aria-hidden="true" /> Coleção
      </Link>
      <h1 className="text-2xl font-extrabold tracking-tight text-verde-950 md:text-3xl">Adicionar disco</h1>

      <form onSubmit={buscar} className="painel" noValidate>
        <label htmlFor="codigo" className="campo-rotulo">Código do lançamento no Discogs</label>
        <div className="flex gap-2">
          <input id="codigo" className="campo" placeholder="R123456, 123456 ou [R123456]" value={codigo} onChange={(e) => setCodigo(e.target.value)} autoComplete="off" inputMode="text" />
          <button type="submit" disabled={consultando} className="btn-primario shrink-0">
            {consultando && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />} Buscar
          </button>
        </div>
        <p className="mt-2 text-xs text-verde-700">
          Use o código do lançamento (Release), que identifica a edição exata: ano, prensagem e formato.
        </p>
      </form>

      {erro && (
        <p role="alert" className="aviso-erro">
          {erro.texto}{" "}
          {erro.semVinculo && <Link href="/configuracoes" className="font-semibold underline">Ir para Configurações</Link>}
        </p>
      )}

      {release && (
        <section className="painel" aria-label="Lançamento encontrado">
          <h2 className="text-lg font-bold text-verde-950">Lançamento encontrado</h2>
          <CartaoRelease r={release} />

          {existente ? (
            <div className="aviso-ok mt-4">
              Este lançamento já está na sua coleção.{" "}
              <Link href={`/album/${existente.id}`} className="font-semibold underline">Abrir álbum</Link>
            </div>
          ) : (
            <div className="mt-4 space-y-4">
              <div className="max-w-xs">
                <label htmlFor="categoria" className="campo-rotulo">Tipo de mídia</label>
                <select id="categoria" className="campo" value={categoria} onChange={(e) => setCategoria(e.target.value)}>
                  {!release.mediaType && <option value="">Escolha…</option>}
                  {CATEGORIAS_MIDIA.map((c) => <option key={c} value={c}>{c}</option>)}
                </select>
                {!release.mediaType && (
                  <p className="mt-1 text-xs text-verm-700">O Discogs informa “{release.formatOriginal || "sem formato"}”, que não corresponde a nenhuma das opções. Escolha a mais próxima.</p>
                )}
              </div>
              <button onClick={adicionar} disabled={adicionando} className="btn-primario">
                {adicionando && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />} Adicionar à coleção
              </button>
            </div>
          )}
        </section>
      )}
    </div>
  );
}
