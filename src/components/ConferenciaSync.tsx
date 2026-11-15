"use client";

import { useMemo, useState } from "react";
import { AlertTriangle, Loader2 } from "lucide-react";
import { compararNomes } from "@/lib/colecao/artistas";
import { CATEGORIAS_MIDIA, type CategoriaMidia } from "@/lib/discogs/formato";
import { removalEmMassa } from "@/lib/sync/plano";
import type { SyncItemDoc, SyncRunDoc } from "@/lib/sync/tipos";
import type { AlbumDoc } from "@/lib/tipos";
import { CapaAlbum } from "./CapaAlbum";

export type SelecaoSync = {
  adicionar: { id: number; mediaType?: CategoriaMidia }[];
  remover: number[];
  confirmouRemocaoEmMassa: boolean;
};

type Props = {
  run: SyncRunDoc;
  itens: SyncItemDoc[];
  ativos: AlbumDoc[];
  ocupado: boolean;
  erro: string | null;
  aoAprovar: (s: SelecaoSync) => void;
  aoCancelar: () => void;
};

const ordenar = (a: SyncItemDoc, b: SyncItemDoc) => compararNomes(a.artista, b.artista) || compararNomes(a.titulo, b.titulo);

function Linha({ item, marcado, aoAlternar, children }: { item: SyncItemDoc; marcado: boolean; aoAlternar: () => void; children?: React.ReactNode }) {
  return (
    <li className={`flex items-center gap-3 rounded-md border p-2 ${marcado ? "border-verde-200 bg-white" : "border-verde-100 bg-verde-50 opacity-70"}`}>
      <label className="flex min-h-11 min-w-11 cursor-pointer items-center justify-center">
        <input type="checkbox" checked={marcado} onChange={aoAlternar} className="h-5 w-5 accent-verde-800" aria-label={`Incluir na sincronização: ${item.titulo}`} />
      </label>
      <CapaAlbum album={{ cover: null, thumb: item.capa }} className="h-12 w-12 shrink-0 rounded" />
      <div className="min-w-0 flex-1">
        <p className="break-words font-semibold leading-snug text-verde-950">{item.titulo}</p>
        <p className="break-words text-sm text-verde-800">{item.artista}</p>
        {children}
      </div>
    </li>
  );
}

function Secao({ titulo, total, descricao, acoes, children }: { titulo: string; total: number; descricao?: string; acoes?: React.ReactNode; children: React.ReactNode }) {
  return (
    <section className="space-y-2">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-xl font-bold text-verde-950">{titulo} <span className="text-base font-normal text-verde-700">({total})</span></h2>
        {acoes}
      </div>
      {descricao && <p className="text-sm text-verde-800">{descricao}</p>}
      {children}
    </section>
  );
}

/** Tela de conferência: mostra tudo o que a sincronização faria e só avança com a aprovação do usuário. */
export function ConferenciaSync({ run, itens, ativos, ocupado, erro, aoAprovar, aoCancelar }: Props) {
  const entradas = useMemo(() => itens.filter((i) => i.grupo === "entrada").sort(ordenar), [itens]);
  const saidas = useMemo(() => itens.filter((i) => i.grupo === "saida").sort(ordenar), [itens]);
  const [fora, setFora] = useState<Set<number>>(new Set()); // desmarcados pelo usuário
  const [escolhas, setEscolhas] = useState<Record<number, CategoriaMidia | "">>({});
  const [confirmou, setConfirmou] = useState(false);

  const alternar = (id: number) =>
    setFora((atual) => {
      const novo = new Set(atual);
      if (!novo.delete(id)) novo.add(id);
      return novo;
    });
  const marcarTodos = (lista: SyncItemDoc[], marcar: boolean) =>
    setFora((atual) => {
      const novo = new Set(atual);
      for (const i of lista) marcar ? novo.delete(i.releaseId) : novo.add(i.releaseId);
      return novo;
    });

  const entradasMarcadas = entradas.filter((i) => !fora.has(i.releaseId));
  const saidasMarcadas = saidas.filter((i) => !fora.has(i.releaseId));
  const semCategoria = entradasMarcadas.filter((i) => i.categoria === null && !escolhas[i.releaseId]);
  const totalAtivos = run.contagens?.totalAtivos ?? 0;
  const emMassa = removalEmMassa(saidasMarcadas.length, totalAtivos);
  const manter = useMemo(() => {
    const ids = new Set((run.manterIds ?? []).map(String));
    return ativos.filter((a) => ids.has(a.id));
  }, [run.manterIds, ativos]);

  const bloqueado = ocupado || semCategoria.length > 0 || (emMassa && !confirmou);
  const nada = entradas.length === 0 && saidas.length === 0;

  function aprovar() {
    aoAprovar({
      adicionar: entradasMarcadas.map((i) => ({ id: i.releaseId, ...(escolhas[i.releaseId] ? { mediaType: escolhas[i.releaseId] as CategoriaMidia } : {}) })),
      remover: saidasMarcadas.map((i) => i.releaseId),
      confirmouRemocaoEmMassa: emMassa && confirmou,
    });
  }

  return (
    <div className="space-y-8">
      <p className="text-verde-800">
        O Discogs tem <strong>{run.contagens?.totalDiscogs ?? 0}</strong> lançamentos na sua coleção e o LogDisco tem <strong>{totalAtivos}</strong> ativos.
        Nada foi alterado ainda: confira abaixo e aprove para sincronizar. Seus registros de audição nunca são alterados.
      </p>

      {nada && <p className="aviso-ok">As duas coleções estão iguais: não há nada para adicionar ou remover.</p>}

      {entradas.length > 0 && (
        <Secao
          titulo="Álbuns que serão adicionados"
          total={entradas.length}
          acoes={
            <div className="flex gap-2">
              <button type="button" className="btn-contorno !min-h-9 !px-3" onClick={() => marcarTodos(entradas, true)}>Marcar todos</button>
              <button type="button" className="btn-contorno !min-h-9 !px-3" onClick={() => marcarTodos(entradas, false)}>Desmarcar todos</button>
            </div>
          }
        >
          <ul className="grid gap-2 lg:grid-cols-2">
            {entradas.map((i) => (
              <Linha key={i.id} item={i} marcado={!fora.has(i.releaseId)} aoAlternar={() => alternar(i.releaseId)}>
                <p className="text-xs text-verde-700">
                  {i.formatoOriginal || "sem formato"}{i.acao === "reativar" && <span className="font-semibold text-verde-900"> · já esteve na coleção e voltará com o histórico</span>}
                </p>
                {i.categoria === null && !fora.has(i.releaseId) && (
                  <div className="mt-1">
                    <label className="sr-only" htmlFor={`cat-${i.releaseId}`}>Tipo de mídia de {i.titulo}</label>
                    <select
                      id={`cat-${i.releaseId}`}
                      className="campo !min-h-9 !w-auto !py-1 text-sm"
                      value={escolhas[i.releaseId] ?? ""}
                      onChange={(e) => setEscolhas((c) => ({ ...c, [i.releaseId]: e.target.value as CategoriaMidia | "" }))}
                    >
                      <option value="">Escolha o tipo de mídia…</option>
                      {CATEGORIAS_MIDIA.map((c) => <option key={c} value={c}>{c}</option>)}
                    </select>
                  </div>
                )}
              </Linha>
            ))}
          </ul>
        </Secao>
      )}

      <Secao titulo="Álbuns que já existem e não precisam de alteração" total={run.contagens?.manter ?? manter.length}>
        {manter.length > 0 ? (
          <details className="rounded-md border border-verde-200 bg-white">
            <summary className="min-h-11 cursor-pointer px-3 py-2.5 text-sm font-semibold text-verde-900">Mostrar a lista</summary>
            <ul className="max-h-72 divide-y divide-verde-100 overflow-y-auto px-3 pb-2 text-sm">
              {manter.slice(0, 500).map((a) => <li key={a.id} className="break-words py-1.5">{a.artistName} — {a.titleCustom || a.title}</li>)}
              {manter.length > 500 && <li className="py-1.5 text-verde-700">… e mais {manter.length - 500}</li>}
            </ul>
          </details>
        ) : (
          <p className="text-sm text-verde-800">Nenhum.</p>
        )}
      </Secao>

      {saidas.length > 0 && (
        <Secao
          titulo="Álbuns que serão removidos da coleção ativa"
          total={saidas.length}
          descricao="Estão no LogDisco, mas não aparecem na coleção do Discogs. A remoção é lógica: o álbum sai da coleção ativa, mas o histórico de audições é mantido."
          acoes={
            <div className="flex gap-2">
              <button type="button" className="btn-contorno !min-h-9 !px-3" onClick={() => marcarTodos(saidas, true)}>Marcar todos</button>
              <button type="button" className="btn-contorno !min-h-9 !px-3" onClick={() => marcarTodos(saidas, false)}>Desmarcar todos</button>
            </div>
          }
        >
          <ul className="grid gap-2 lg:grid-cols-2">
            {saidas.map((i) => (
              <Linha key={i.id} item={i} marcado={!fora.has(i.releaseId)} aoAlternar={() => alternar(i.releaseId)}>
                {i.categoria && <p className="text-xs text-verde-700">{i.categoria}</p>}
              </Linha>
            ))}
          </ul>
          {emMassa && (
            <div role="alert" className="aviso-erro flex gap-3">
              <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0" aria-hidden="true" />
              <div>
                <p className="font-semibold">Atenção: isso remove {saidasMarcadas.length} de {totalAtivos} álbuns da coleção ativa.</p>
                <p className="mt-1">Se a sua coleção no Discogs ainda não foi preenchida, desmarque os álbuns acima. Os álbuns removidos podem voltar numa próxima sincronização.</p>
                <label className="mt-2 flex min-h-11 cursor-pointer items-center gap-2">
                  <input type="checkbox" checked={confirmou} onChange={(e) => setConfirmou(e.target.checked)} className="h-5 w-5 accent-verm-600" />
                  <span>Confirmo que quero remover esses álbuns da coleção ativa.</span>
                </label>
              </div>
            </div>
          )}
        </Secao>
      )}

      {erro && <p role="alert" className="aviso-erro">{erro}</p>}

      <div className="sticky bottom-[calc(4.5rem+env(safe-area-inset-bottom))] z-10 flex flex-wrap items-center justify-between gap-3 rounded-md border border-verde-200 bg-white p-3 md:bottom-3">
        <p className="text-sm text-verde-800">
          {entradasMarcadas.length} a adicionar · {saidasMarcadas.length} a remover
          {semCategoria.length > 0 && <span className="block text-verm-700">Escolha o tipo de mídia de {semCategoria.length} álbum(ns).</span>}
        </p>
        <div className="flex gap-2">
          <button className="btn-contorno" onClick={aoCancelar} disabled={ocupado}>Cancelar</button>
          <button className="btn-primario" onClick={aprovar} disabled={bloqueado}>
            {ocupado && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />} Aprovar e sincronizar
          </button>
        </div>
      </div>
    </div>
  );
}
