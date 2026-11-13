"use client";

import { useEffect, useState } from "react";
import type { User } from "firebase/auth";
import { doc, onSnapshot, type Timestamp } from "firebase/firestore";
import { Loader2 } from "lucide-react";
import { chamarApi } from "@/lib/api-cliente";
import { getDb } from "@/lib/firebase-client";
import { normalizarCodigoRelease } from "@/lib/discogs/codigo";
import type { ReleaseDoc } from "@/lib/discogs/release";
import { CartaoRelease } from "./CartaoRelease";

type Vinculo = { username: string; linkedAt: Timestamp | null };

const MENSAGENS_RETORNO: Record<string, { ok: boolean; texto: string }> = {
  ok: { ok: true, texto: "Conta do Discogs vinculada." },
  negado: { ok: false, texto: "Você não autorizou o acesso no Discogs." },
  expirado: { ok: false, texto: "O pedido de vínculo expirou. Tente de novo." },
  erro: { ok: false, texto: "Não foi possível concluir o vínculo com o Discogs. Tente de novo." },
};

export function SecaoDiscogs({ user }: { user: User }) {
  const [vinculo, setVinculo] = useState<Vinculo | null | undefined>(undefined);
  const [aviso, setAviso] = useState<{ ok: boolean; texto: string } | null>(null);
  const [ocupado, setOcupado] = useState(false);
  const [codigo, setCodigo] = useState("");
  const [consultando, setConsultando] = useState(false);
  const [erroConsulta, setErroConsulta] = useState<string | null>(null);
  const [release, setRelease] = useState<ReleaseDoc | null>(null);

  useEffect(
    () =>
      onSnapshot(
        doc(getDb(), "users", user.uid, "integrations", "discogs"),
        (snap) => setVinculo(snap.exists() ? (snap.data() as Vinculo) : null),
        () => setVinculo(null),
      ),
    [user.uid],
  );

  // Mensagem de retorno do fluxo OAuth (?discogs=ok|negado|expirado|erro)
  useEffect(() => {
    const estado = new URLSearchParams(window.location.search).get("discogs");
    if (!estado) return;
    setAviso(MENSAGENS_RETORNO[estado] ?? MENSAGENS_RETORNO.erro);
    window.history.replaceState(null, "", window.location.pathname);
  }, []);

  async function vincular() {
    setAviso(null);
    setOcupado(true);
    try {
      const r = await chamarApi<{ url: string }>(user, "/api/discogs/oauth/start", { method: "POST" });
      if (r.ok && r.dados?.url) {
        window.location.assign(r.dados.url);
        return;
      }
      setAviso({ ok: false, texto: r.dados?.erro ?? "Não foi possível iniciar o vínculo com o Discogs." });
    } catch {
      setAviso({ ok: false, texto: "Não foi possível falar com o servidor." });
    }
    setOcupado(false);
  }

  async function desvincular() {
    if (!window.confirm("Desvincular a conta do Discogs? Sua coleção e suas audições no LogDisco não serão alteradas.")) return;
    setAviso(null);
    setOcupado(true);
    try {
      const r = await chamarApi(user, "/api/discogs/unlink", { method: "POST" });
      setAviso(r.ok ? { ok: true, texto: "Conta do Discogs desvinculada." } : { ok: false, texto: r.dados?.erro ?? "Não foi possível desvincular." });
      if (r.ok) setRelease(null);
    } catch {
      setAviso({ ok: false, texto: "Não foi possível falar com o servidor." });
    } finally {
      setOcupado(false);
    }
  }

  async function consultar(e: React.FormEvent) {
    e.preventDefault();
    setErroConsulta(null);
    setRelease(null);
    const norm = normalizarCodigoRelease(codigo);
    if (!norm.ok) return setErroConsulta(norm.erro);
    setConsultando(true);
    try {
      const r = await chamarApi<{ release: ReleaseDoc }>(user, `/api/discogs/release?codigo=${norm.id}`);
      if (r.ok && r.dados?.release) setRelease(r.dados.release);
      else setErroConsulta(r.dados?.erro ?? `O servidor respondeu com erro (HTTP ${r.status}).`);
    } catch {
      setErroConsulta("Não foi possível falar com o servidor.");
    } finally {
      setConsultando(false);
    }
  }

  const data = vinculo?.linkedAt?.toDate?.().toLocaleDateString("pt-BR");

  return (
    <section className="painel">
      <h2 className="text-lg font-bold text-verde-950">Discogs</h2>

      {vinculo === undefined ? (
        <p className="mt-2 text-sm text-verde-800">Carregando…</p>
      ) : vinculo ? (
        <>
          <p className="mt-2 text-sm">
            Conta vinculada: <strong>{vinculo.username}</strong>{data ? ` · desde ${data}` : ""}
          </p>
          <p className="mt-1 text-xs text-verde-700">
            Para revogar totalmente o acesso, remova o LogDisco também nos aplicativos autorizados da sua conta no Discogs.
          </p>
          <button onClick={desvincular} disabled={ocupado} className="btn-contorno mt-3">
            {ocupado && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
            Desvincular
          </button>
        </>
      ) : (
        <>
          <p className="mt-2 text-sm text-verde-800">
            Vincule sua conta para importar discos, sincronizar a coleção e acompanhar a lista de desejos.
          </p>
          <button onClick={vincular} disabled={ocupado} className="btn-primario mt-3">
            {ocupado && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
            Vincular conta do Discogs
          </button>
        </>
      )}

      {aviso && <p role="status" className={`mt-3 ${aviso.ok ? "aviso-ok" : "aviso-erro"}`}>{aviso.texto}</p>}

      {vinculo && (
        <form onSubmit={consultar} className="mt-6 border-t border-verde-200 pt-4" noValidate>
          <h3 className="text-sm font-bold text-verde-950">Testar consulta de lançamento</h3>
          <p className="mt-1 text-xs text-verde-700">Confere a leitura dos dados do Discogs. Nada é gravado.</p>
          <label htmlFor="codigo-release" className="campo-rotulo mt-3">Código (R123456, 123456 ou [R123456])</label>
          <div className="flex max-w-sm gap-2">
            <input id="codigo-release" className="campo" value={codigo} onChange={(e) => setCodigo(e.target.value)} autoComplete="off" />
            <button type="submit" disabled={consultando} className="btn-contorno shrink-0">
              {consultando && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
              Consultar
            </button>
          </div>
          {erroConsulta && <p role="alert" className="aviso-erro mt-3">{erroConsulta}</p>}
          {release && <CartaoRelease r={release} />}
        </form>
      )}
    </section>
  );
}
