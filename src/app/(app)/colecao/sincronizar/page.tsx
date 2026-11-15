"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { ChevronLeft, Loader2, RefreshCw } from "lucide-react";
import { ConferenciaSync, type SelecaoSync } from "@/components/ConferenciaSync";
import { chamarApi } from "@/lib/api-cliente";
import { useAuth } from "@/lib/auth-context";
import { useColecao } from "@/lib/colecao-context";
import { formatarMomento, useItensSync, useRun, useSyncEmAndamento, useUltimaSincronizacao } from "@/lib/sync/use-sync";
import { ROTULO_STATUS, type ResultadoSync, type SyncRunDoc } from "@/lib/sync/tipos";

type Fase = "ocioso" | "coletando" | "aplicando";
type Progresso = { texto: string; pct: number | null };
const JSON_POST = { method: "POST", headers: { "Content-Type": "application/json" } } as const;

function Resultado({ run }: { run: SyncRunDoc }) {
  const itens = useItensSync(run.id);
  const r: ResultadoSync | undefined = run.resultado;
  const erros = (itens ?? []).filter((i) => i.estado === "erro");
  const celulas: [string, number | undefined][] = [
    ["Adicionados", r ? r.adicionados + r.reativados : undefined],
    ["Removidos da coleção ativa", r?.removidos],
    ["Inalterados", r?.inalterados],
    ["Com erro", r?.erros],
  ];
  return (
    <section className="space-y-4" aria-live="polite">
      <p role="status" className={run.status === "concluida" ? "aviso-ok" : "aviso-erro"}>
        {run.status === "concluida" ? "Sincronização concluída." : "Sincronização concluída, mas alguns álbuns não puderam ser incluídos."}
      </p>
      <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {celulas.map(([rotulo, valor]) => (
          <div key={rotulo} className="painel !p-3">
            <dt className="text-sm text-verde-800">{rotulo}</dt>
            <dd className="text-2xl font-extrabold tabular-nums text-verde-950">{valor ?? "—"}</dd>
          </div>
        ))}
      </dl>
      {erros.length > 0 && (
        <div>
          <h2 className="mb-2 text-lg font-bold text-verde-950">Álbuns com erro</h2>
          <ul className="space-y-2">
            {erros.map((i) => (
              <li key={i.id} className="rounded-md border border-verm-100 bg-verm-50 p-3 text-sm">
                <p className="break-words font-semibold">{i.artista} — {i.titulo}</p>
                <p className="text-verm-700">{i.observacao}</p>
              </li>
            ))}
          </ul>
          <p className="mt-2 text-sm text-verde-800">Você pode sincronizar de novo mais tarde: só o que ainda faltar será proposto.</p>
        </div>
      )}
      <div className="flex flex-wrap gap-2">
        <Link href="/colecao" className="btn-primario">Ver a coleção</Link>
        <Link href="/colecao/sincronizacoes" className="btn-contorno">Histórico de sincronizações</Link>
      </div>
    </section>
  );
}

export default function Sincronizar() {
  const { user } = useAuth();
  const { ativos } = useColecao();
  const emAndamento = useSyncEmAndamento();
  const ultima = useUltimaSincronizacao();
  const [runLocal, setRunLocal] = useState<string | null>(null);
  const runId = runLocal ?? emAndamento?.id ?? null;
  const run = useRun(runId);
  const itens = useItensSync(run && ["conferencia", "aplicando"].includes(run.status) ? run.id : null);

  const [fase, setFase] = useState<Fase>("ocioso");
  const [progresso, setProgresso] = useState<Progresso | null>(null);
  const [erro, setErro] = useState<{ texto: string; semVinculo?: boolean } | null>(null);
  const vivo = useRef(true);
  useEffect(() => {
    vivo.current = true;
    return () => {
      vivo.current = false;
    };
  }, []);

  function mostrarErro(r: { status: number; dados: { erro?: string; codigo?: string } | null }) {
    setErro({ texto: r.dados?.erro ?? `O servidor respondeu com erro (HTTP ${r.status}).`, semVinculo: r.dados?.codigo === "sem_vinculo" });
  }

  /** Consulta o Discogs em várias chamadas, até o plano de alterações ficar pronto. */
  async function coletar(idInicial: string | null) {
    if (!user) return;
    setErro(null);
    setFase("coletando");
    setProgresso({ texto: "Consultando o Discogs…", pct: null });
    let id = idInicial;
    try {
      while (vivo.current) {
        const r = await chamarApi<{ fase: string; runId: string; pagina?: number; totalPaginas?: number | null }>(user, "/api/sync/coletar", { ...JSON_POST, body: JSON.stringify({ runId: id }) });
        if (!r.ok || !r.dados) {
          if (r.dados?.codigo === "sync_em_andamento" && typeof (r.dados as { runId?: string }).runId === "string") setRunLocal((r.dados as { runId?: string }).runId!);
          mostrarErro(r);
          break;
        }
        id = r.dados.runId;
        setRunLocal(id);
        if (r.dados.fase === "pronto") break;
        const { pagina = 0, totalPaginas = null } = r.dados;
        setProgresso({ texto: `Consultando o Discogs: página ${pagina}${totalPaginas ? ` de ${totalPaginas}` : ""}`, pct: totalPaginas ? pagina / totalPaginas : null });
      }
    } catch {
      setErro({ texto: "Não foi possível falar com o servidor." });
    } finally {
      if (vivo.current) {
        setFase("ocioso");
        setProgresso(null);
      }
    }
  }

  /** Aplica as alterações aprovadas, em várias chamadas, até concluir. */
  async function aplicar(id: string) {
    if (!user) return;
    setErro(null);
    setFase("aplicando");
    setProgresso({ texto: "Aplicando alterações…", pct: null });
    try {
      while (vivo.current) {
        const r = await chamarApi<{ fase: string; feitos: number; total: number }>(user, `/api/sync/${id}/aplicar`, { method: "POST" });
        if (!r.ok || !r.dados) {
          mostrarErro(r);
          break;
        }
        const { feitos, total } = r.dados;
        setProgresso({ texto: `Aplicando alterações: ${feitos} de ${total}`, pct: total ? feitos / total : 1 });
        if (r.dados.fase === "concluida") break;
      }
    } catch {
      setErro({ texto: "Não foi possível falar com o servidor." });
    } finally {
      if (vivo.current) {
        setFase("ocioso");
        setProgresso(null);
      }
    }
  }

  async function aprovar(sel: SelecaoSync) {
    if (!user || !run) return;
    setErro(null);
    setFase("aplicando");
    setProgresso({ texto: "Registrando a aprovação…", pct: null });
    const r = await chamarApi(user, `/api/sync/${run.id}/aprovar`, { ...JSON_POST, body: JSON.stringify(sel) }).catch(() => null);
    if (!r) {
      setFase("ocioso");
      return setErro({ texto: "Não foi possível falar com o servidor." });
    }
    if (!r.ok) {
      setFase("ocioso");
      return mostrarErro(r);
    }
    await aplicar(run.id);
  }

  async function cancelar() {
    if (!user || !run) return;
    const r = await chamarApi(user, `/api/sync/${run.id}/cancelar`, { method: "POST" }).catch(() => null);
    if (r && !r.ok) return mostrarErro(r);
    setRunLocal(null);
  }

  const ocupado = fase !== "ocioso";
  const status = run?.status;
  const carregando = emAndamento === undefined || (runId !== null && run === undefined);
  const mostrarInicio = !ocupado && (!run || status === "cancelada" || status === "falhou");

  return (
    <div className="max-w-4xl space-y-6">
      <Link href="/colecao" className="inline-flex min-h-11 items-center gap-1 text-sm font-medium text-verde-800 hover:underline">
        <ChevronLeft className="h-4 w-4" aria-hidden="true" /> Coleção
      </Link>
      <h1 className="text-2xl font-extrabold tracking-tight text-verde-950 md:text-3xl">Sincronizar com o Discogs</h1>

      {erro && (
        <p role="alert" className="aviso-erro">
          {erro.texto} {erro.semVinculo && <Link href="/configuracoes" className="font-semibold underline">Ir para Configurações</Link>}
        </p>
      )}

      {ocupado && progresso && (
        <div className="painel" role="status" aria-live="polite">
          <p className="flex items-center gap-2 font-semibold text-verde-950"><Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> {progresso.texto}</p>
          {progresso.pct !== null && (
            <div className="mt-3 h-2 overflow-hidden rounded bg-verde-100" aria-hidden="true">
              <div className="h-full bg-verm-600 transition-all" style={{ width: `${Math.round(progresso.pct * 100)}%` }} />
            </div>
          )}
          <p className="mt-2 text-xs text-verde-700">Pode levar alguns minutos em coleções grandes. Mantenha esta página aberta.</p>
        </div>
      )}

      {carregando ? (
        <p className="text-verde-800">Carregando…</p>
      ) : mostrarInicio ? (
        <div className="painel space-y-4">
          <p>A sincronização compara a sua coleção do Discogs com a do LogDisco e mostra o que seria adicionado ou removido. Só depois da sua aprovação alguma coisa é alterada.</p>
          <ul className="list-disc space-y-1 pl-5 text-sm text-verde-800">
            <li>Álbuns do Discogs que ainda não estão no LogDisco são adicionados.</li>
            <li>Álbuns que saíram do Discogs saem da coleção ativa, mas o histórico de audições é mantido.</li>
            <li>Seus registros de audição nunca são alterados.</li>
          </ul>
          <p className="text-sm text-verde-700">
            Última sincronização: {ultima ? `${formatarMomento(ultima.concluidaEm)} · ${ROTULO_STATUS[ultima.status]}` : "nenhuma realizada ainda"}.
          </p>
          {status === "falhou" && run?.erro && <p className="aviso-erro">A verificação anterior falhou: {run.erro}</p>}
          <div className="flex flex-wrap gap-2">
            <button className="btn-primario" onClick={() => { setRunLocal(null); void coletar(null); }}>
              <RefreshCw className="h-4 w-4" aria-hidden="true" /> Verificar diferenças
            </button>
            <Link href="/colecao/sincronizacoes" className="btn-contorno">Histórico de sincronizações</Link>
          </div>
        </div>
      ) : !ocupado && status === "coletando" ? (
        <div className="painel space-y-3">
          <p>Uma verificação ficou incompleta{run?.totalPaginas ? ` (parou na página ${(run.proximaPagina ?? 1) - 1} de ${run.totalPaginas})` : ""}.</p>
          {run?.ultimoErro && <p className="aviso-erro">{run.ultimoErro}</p>}
          <div className="flex flex-wrap gap-2">
            <button className="btn-primario" onClick={() => void coletar(run!.id)}>Retomar verificação</button>
            <button className="btn-contorno" onClick={cancelar}>Descartar</button>
          </div>
        </div>
      ) : !ocupado && status === "aplicando" ? (
        <div className="painel space-y-3">
          <p>Há uma sincronização aprovada que ainda não terminou ({run?.totalSelecionados ?? 0} álbuns aprovados).</p>
          {run?.ultimoErro && <p className="aviso-erro">{run.ultimoErro}</p>}
          <button className="btn-primario" onClick={() => void aplicar(run!.id)}>Continuar sincronização</button>
        </div>
      ) : status === "conferencia" && run && itens ? (
        <ConferenciaSync run={run} itens={itens} ativos={ativos} ocupado={ocupado} erro={null} aoAprovar={aprovar} aoCancelar={cancelar} />
      ) : (status === "concluida" || status === "concluida_com_erros") && run && !ocupado ? (
        <Resultado run={run} />
      ) : null}
    </div>
  );
}
