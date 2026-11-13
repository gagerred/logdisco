"use client";

import { useMemo, useState } from "react";
import { Search } from "lucide-react";
import { buscarAlbuns, ordenarAlbuns } from "@/lib/colecao/filtros";
import { useColecao } from "@/lib/colecao-context";
import { Modal } from "./Modal";
import { LinhaAlbum } from "./LinhaAlbum";

const LIMITE = 40;

/** Pesquisa da navbar: por nome do artista ou título do álbum, dentro da coleção ativa. */
export function BuscaNavbar({ aberto, aoFechar }: { aberto: boolean; aoFechar: () => void }) {
  const { ativos } = useColecao();
  const [texto, setTexto] = useState("");
  const resultados = useMemo(() => ordenarAlbuns(buscarAlbuns(ativos, texto), "artista"), [ativos, texto]);

  function fechar() {
    setTexto("");
    aoFechar();
  }

  return (
    <Modal aberto={aberto} aoFechar={fechar} titulo="Pesquisar na coleção">
      <label htmlFor="busca-navbar" className="sr-only">Artista ou título do álbum</label>
      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-verde-700" aria-hidden="true" />
        <input
          id="busca-navbar"
          type="search"
          value={texto}
          onChange={(e) => setTexto(e.target.value)}
          placeholder="Artista ou título do álbum"
          autoComplete="off"
          className="campo pl-10"
        />
      </div>
      <div className="mt-3" aria-live="polite">
        {!texto.trim() ? (
          <p className="text-sm text-verde-700">Digite o nome de um artista ou o título de um álbum.</p>
        ) : resultados.length === 0 ? (
          <p className="text-sm text-verde-800">Nenhum álbum encontrado na coleção.</p>
        ) : (
          <>
            <p className="mb-2 text-sm text-verde-700">
              {resultados.length} {resultados.length === 1 ? "resultado" : "resultados"}
              {resultados.length > LIMITE ? ` (mostrando ${LIMITE})` : ""}
            </p>
            <ul className="space-y-2">
              {resultados.slice(0, LIMITE).map((a) => (
                <li key={a.id}><LinhaAlbum album={a} aoClicar={fechar} /></li>
              ))}
            </ul>
          </>
        )}
      </div>
    </Modal>
  );
}
