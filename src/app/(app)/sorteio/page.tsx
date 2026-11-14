"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { ChevronLeft, Dices } from "lucide-react";
import { CapaAlbum } from "@/components/CapaAlbum";
import { SeloMidia } from "@/components/LinhaAlbum";
import { RegistrarAudicao } from "@/components/RegistrarAudicao";
import { tituloExibido } from "@/lib/colecao/filtros";
import { useColecao } from "@/lib/colecao-context";
import { candidatosDoSorteio, sortear, type FiltrosSorteio, type GrupoHistorico, type GrupoMidia } from "@/lib/diario/sorteio";
import type { AlbumDoc } from "@/lib/tipos";

function Opcao({ ativa, aoAlternar, children }: { ativa: boolean; aoAlternar: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      aria-pressed={ativa}
      onClick={aoAlternar}
      className={`min-h-11 rounded-md border px-4 text-sm font-semibold transition-colors ${
        ativa ? "border-verde-900 bg-verde-800 text-white" : "border-verde-200 bg-white text-verde-900 hover:bg-verde-50"
      }`}
    >
      {children}
    </button>
  );
}

export default function SortearDisco() {
  const { ativos, idsOuvidos, carregando } = useColecao();
  const [filtros, setFiltros] = useState<FiltrosSorteio>({ historico: null, midia: null });
  const [sorteado, setSorteado] = useState<AlbumDoc | null>(null);
  const [semDiscos, setSemDiscos] = useState(false);
  const [registrando, setRegistrando] = useState(false);
  const [registrou, setRegistrou] = useState(false);

  const disponiveis = useMemo(() => candidatosDoSorteio(ativos, idsOuvidos, filtros).length, [ativos, idsOuvidos, filtros]);

  // Clicar de novo em uma opção selecionada a desmarca; cada grupo é independente.
  const alternarHistorico = (v: GrupoHistorico) => setFiltros((f) => ({ ...f, historico: f.historico === v ? null : v }));
  const alternarMidia = (v: GrupoMidia) => setFiltros((f) => ({ ...f, midia: f.midia === v ? null : v }));

  function fazerSorteio() {
    const r = sortear(ativos, idsOuvidos, filtros, { excluirId: sorteado?.id });
    setSemDiscos(!r.album);
    setSorteado(r.album);
    setRegistrou(false);
  }

  // Mantém o álbum exibido atualizado se ele for editado enquanto a página está aberta
  const exibido = sorteado ? (ativos.find((a) => a.id === sorteado.id) ?? sorteado) : null;

  return (
    <div className="max-w-2xl space-y-5">
      <Link href="/" className="inline-flex min-h-11 items-center gap-1 text-sm font-medium text-verde-800 hover:underline">
        <ChevronLeft className="h-4 w-4" aria-hidden="true" /> Início
      </Link>
      <h1 className="text-2xl font-extrabold tracking-tight text-verde-950 md:text-3xl">Sortear disco</h1>
      <p className="text-verde-800">Sugere um álbum da coleção para a próxima audição. Os filtros são opcionais; sem nenhum, vale a coleção inteira.</p>

      <div className="painel space-y-5">
        <div role="group" aria-labelledby="grupo-a">
          <p id="grupo-a" className="campo-rotulo">Histórico de audições</p>
          <div className="flex flex-wrap gap-2">
            <Opcao ativa={filtros.historico === "todos"} aoAlternar={() => alternarHistorico("todos")}>Todos os discos</Opcao>
            <Opcao ativa={filtros.historico === "nunca"} aoAlternar={() => alternarHistorico("nunca")}>Somente nunca ouvidos</Opcao>
          </div>
        </div>
        <div role="group" aria-labelledby="grupo-b">
          <p id="grupo-b" className="campo-rotulo">Tipo de mídia</p>
          <div className="flex flex-wrap gap-2">
            <Opcao ativa={filtros.midia === "CD"} aoAlternar={() => alternarMidia("CD")}>Somente CD</Opcao>
            <Opcao ativa={filtros.midia === "Vinyl"} aoAlternar={() => alternarMidia("Vinyl")}>Somente Vinyl</Opcao>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <button onClick={fazerSorteio} disabled={carregando} className="btn-primario">
            <Dices className="h-4 w-4" aria-hidden="true" /> {exibido ? "Sortear novamente" : "Sortear disco"}
          </button>
          {!carregando && (
            <span className="text-sm text-verde-800">{disponiveis} {disponiveis === 1 ? "disco atende" : "discos atendem"} aos filtros</span>
          )}
        </div>
      </div>

      <div aria-live="polite">
        {semDiscos && (
          <p role="status" className="aviso-erro">Não existem discos disponíveis para o sorteio com os filtros selecionados.</p>
        )}
        {exibido && (
          <section className="painel flex flex-col gap-4 sm:flex-row" aria-label="Disco sorteado">
            <CapaAlbum album={exibido} grande className="aspect-square w-full max-w-60 rounded-md sm:w-48 sm:shrink-0" />
            <div className="min-w-0">
              <h2 className="break-words text-2xl font-extrabold leading-tight text-verde-950">{tituloExibido(exibido)}</h2>
              <p className="mt-1 break-words text-lg text-verde-900">{exibido.artistName}</p>
              <p className="mt-2"><SeloMidia tipo={exibido.mediaType} /> {exibido.year && <span className="text-sm text-verde-700">{exibido.year}</span>}</p>
              <div className="mt-4 flex flex-wrap gap-2">
                <button className="btn-primario" onClick={() => setRegistrando(true)}>Registrar audição</button>
                <Link href={`/album/${exibido.id}`} className="btn-contorno">Abrir álbum</Link>
              </div>
              {registrou && <p role="status" className="aviso-ok mt-3">Audição registrada.</p>}
            </div>
          </section>
        )}
      </div>

      {exibido && (
        <RegistrarAudicao album={exibido} aberto={registrando} aoFechar={() => setRegistrando(false)} aoRegistrar={() => setRegistrou(true)} />
      )}
    </div>
  );
}
