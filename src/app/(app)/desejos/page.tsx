"use client";

import { useMemo, useRef, useEffect, useState } from "react";
import Link from "next/link";
import { Loader2, RefreshCw, Search } from "lucide-react";
import { AvisosDoSistema } from "@/components/AvisosDoSistema";
import { LinhaDesejo } from "@/components/LinhaDesejo";
import { chamarApi, type RespostaApi } from "@/lib/api-cliente";
import { useAuth } from "@/lib/auth-context";
import { useColecao } from "@/lib/colecao-context";
import { formatarMomento } from "@/lib/sync/use-sync";
import { buscarDesejos, desejosVisiveis, ordenarDesejos, type OrdemDesejos } from "@/lib/wantlist/logica";
import { ROTULO_STATUS_WANTLIST } from "@/lib/wantlist/tipos";
import { useDesejos, useRunsWantlist } from "@/lib/wantlist/use-wantlist";

export default function ListaDeDesejos() {
  const { user } = useAuth();
  const { ativos } = useColecao();
  const desejos = useDesejos();
  const runs = useRunsWantlist();
  const [texto, setTexto] = useState("");
  const [ordem, setOrdem] = useState<OrdemDesejos>("artista");
  const [atualizando, setAtualizando] = useState(false);
  const [progresso, setProgresso] = useState<string | null>(null);
  const [erro, setErro] = useState<{ texto: string; semVinculo?: boolean } | null>(null);
  const vivo = useRef(true);
  useEffect(() => {
    vivo.current = true;
    return () => {
      vivo.current = false;
    };
  }, []);

  const { visiveis, ocultos } = useMemo(() => desejosVisiveis(desejos ?? [], ativos), [desejos, ativos]);
  const lista = useMemo(() => ordenarDesejos(buscarDesejos(visiveis, texto), ordem), [visiveis, texto, ordem]);

  /** Atualização manual: consulta o Discogs em várias chamadas, até concluir. */
  async function atualizar() {
    if (!user) return;
    setErro(null);
    setAtualizando(true);
    setProgresso("Consultando o Discogs…");
    let runId: string | null = null;
    try {
      while (vivo.current) {
        const r: RespostaApi<{ fase: string; runId: string; pagina?: number; totalPaginas?: number | null }> = await chamarApi(user, "/api/wantlist/atualizar", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ runId }),
        });
        if (!r.ok || !r.dados) {
          setErro({ texto: r.dados?.erro ?? `O servidor respondeu com erro (HTTP ${r.status}).`, semVinculo: r.dados?.codigo === "sem_vinculo" });
          break;
        }
        runId = r.dados.runId;
        if (r.dados.fase === "concluida") break;
        setProgresso(`Consultando o Discogs: página ${r.dados.pagina ?? 0}${r.dados.totalPaginas ? ` de ${r.dados.totalPaginas}` : ""}`);
      }
    } catch {
      setErro({ texto: "Não foi possível falar com o servidor." });
    } finally {
      if (vivo.current) {
        setAtualizando(false);
        setProgresso(null);
      }
    }
  }

  const ultima = runs?.ultima;
  const concluida = runs?.concluida;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight text-verde-950 md:text-3xl">Lista de desejos</h1>
          {desejos && <p className="text-sm text-verde-800">{visiveis.length} {visiveis.length === 1 ? "disco" : "discos"}</p>}
        </div>
        <button onClick={atualizar} disabled={atualizando} className="btn-primario">
          {atualizando ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <RefreshCw className="h-4 w-4" aria-hidden="true" />}
          Atualizar lista de desejos
        </button>
      </div>

      <AvisosDoSistema />

      <div className="space-y-1 text-sm text-verde-800" aria-live="polite">
        <p>
          Última atualização:{" "}
          <strong>
            {runs === undefined ? "…" : concluida ? `${formatarMomento(concluida.concluidaEm)} (${concluida.origem === "automatica" ? "automática" : "manual"})` : "nenhuma ainda"}
          </strong>
          {ultima && <> · Resultado da última tentativa: <strong className={ultima.status === "falhou" ? "text-verm-700" : ""}>{ROTULO_STATUS_WANTLIST[ultima.status]}</strong></>}
          {concluida?.resultado && ` · +${concluida.resultado.adicionados} −${concluida.resultado.removidos}`}
        </p>
        <p className="text-xs text-verde-700">A lista vem da wantlist do seu perfil no Discogs e também é atualizada automaticamente aos domingos, às 11h.</p>
        {ultima?.status === "falhou" && ultima.erro && <p role="alert" className="aviso-erro">{ultima.erro}</p>}
        {ultima?.status === "coletando" && ultima.ultimoErro && <p className="aviso-erro">A atualização foi interrompida: {ultima.ultimoErro} Ela continua na próxima tentativa.</p>}
      </div>

      {atualizando && progresso && (
        <p role="status" className="painel flex items-center gap-2 font-semibold text-verde-950">
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> {progresso}
        </p>
      )}
      {erro && (
        <p role="alert" className="aviso-erro">
          {erro.texto} {erro.semVinculo && <Link href="/configuracoes" className="font-semibold underline">Ir para Configurações</Link>}
        </p>
      )}

      <div className="grid gap-3 sm:grid-cols-[1fr_auto]">
        <div className="relative">
          <label htmlFor="busca-desejos" className="sr-only">Buscar na lista de desejos</label>
          <Search className="pointer-events-none absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-verde-700" aria-hidden="true" />
          <input id="busca-desejos" type="search" className="campo pl-10" placeholder="Buscar artista ou álbum" value={texto} onChange={(e) => setTexto(e.target.value)} autoComplete="off" />
        </div>
        <div>
          <label htmlFor="ordem-desejos" className="sr-only">Ordenar</label>
          <select id="ordem-desejos" className="campo" value={ordem} onChange={(e) => setOrdem(e.target.value as OrdemDesejos)}>
            <option value="artista">Por artista (A–Z)</option>
            <option value="album">Por álbum (A–Z)</option>
          </select>
        </div>
      </div>

      {desejos === null ? (
        <p className="text-verde-800">Carregando…</p>
      ) : visiveis.length === 0 ? (
        <div className="painel max-w-xl">
          <p>{ocultos > 0 ? "Todos os discos da sua wantlist já estão na sua coleção." : "Sua lista de desejos está vazia."}</p>
          {ocultos === 0 && <p className="mt-1 text-sm text-verde-800">Clique em “Atualizar lista de desejos” para buscar a wantlist do seu perfil no Discogs.</p>}
        </div>
      ) : lista.length === 0 ? (
        <p className="text-verde-800">Nenhum disco encontrado para essa busca.</p>
      ) : (
        <ul className="grid gap-2 lg:grid-cols-2" aria-live="polite">
          {lista.map((d) => <li key={d.id}><LinhaDesejo d={d} /></li>)}
        </ul>
      )}

      {ocultos > 0 && visiveis.length > 0 && (
        <p className="text-xs text-verde-700">
          {ocultos} {ocultos === 1 ? "disco da wantlist já está" : "discos da wantlist já estão"} na sua coleção e não {ocultos === 1 ? "aparece" : "aparecem"} aqui.
        </p>
      )}
    </div>
  );
}
