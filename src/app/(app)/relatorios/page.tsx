"use client";

import { useMemo } from "react";
import { BarrasHorizontais, Indicador } from "@/components/Graficos";
import { ListaNuncaOuvidos, RankingAlbuns, RankingArtistas } from "@/components/Rankings";
import { useColecao } from "@/lib/colecao-context";
import { CATEGORIAS_MIDIA } from "@/lib/discogs/formato";
import { dataLocal } from "@/lib/diario/datas";
import {
  albunsMaisOuvidos, albunsNuncaOuvidos, albunsPorFormato, artistasMaisOuvidos, contagemPorJanela, indexarAlbuns, totalAlbunsAtivos,
} from "@/lib/relatorios/calculos";

function Secao({ id, titulo, descricao, children }: { id: string; titulo: string; descricao?: string; children: React.ReactNode }) {
  return (
    <section aria-labelledby={id} className="space-y-3">
      <div>
        <h2 id={id} className="text-xl font-bold text-verde-950">{titulo}</h2>
        {descricao && <p className="text-sm text-verde-800">{descricao}</p>}
      </div>
      {children}
    </section>
  );
}

export default function RelatorioGeral() {
  const { todos, audicoes, carregando, erro } = useColecao();
  const hoje = dataLocal();

  const dados = useMemo(() => {
    const mapa = indexarAlbuns(todos);
    return {
      totalAtivos: totalAlbunsAtivos(todos),
      porFormato: albunsPorFormato(todos),
      janelas: contagemPorJanela(audicoes, hoje),
      artistas: artistasMaisOuvidos(audicoes, mapa, 50),
      albuns: albunsMaisOuvidos(audicoes, mapa, 50),
      nunca: albunsNuncaOuvidos(todos, audicoes),
    };
  }, [todos, audicoes, hoje]);

  if (erro) return <p role="alert" className="aviso-erro">{erro}</p>;
  if (carregando) return <p className="text-verde-800">Carregando…</p>;

  return (
    <div className="space-y-10">
      <Secao id="visao" titulo="Visão geral" descricao="As audições são contadas pela data em que o disco foi ouvido, e não pela data do registro.">
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
          <Indicador rotulo="Álbuns na coleção ativa" valor={dados.totalAtivos} />
          <Indicador rotulo="Álbuns nunca ouvidos" valor={dados.nunca.length} alerta={dados.nunca.length > 0} detalhe="Só considera a coleção ativa" />
          <Indicador rotulo="Audições registradas" valor={audicoes.length} detalhe="Todo o histórico" />
          {dados.janelas.map((j) => (
            <Indicador key={j.dias} rotulo={`Últimos ${j.dias} dias`} valor={j.total} detalhe={j.total === 1 ? "audição" : "audições"} />
          ))}
        </div>
      </Secao>

      <Secao id="formatos" titulo="Álbuns por formato de mídia" descricao="Coleção ativa.">
        <div className="painel !p-2">
          <BarrasHorizontais itens={CATEGORIAS_MIDIA.map((c) => ({ id: c, rotulo: c, valor: dados.porFormato[c] }))} unidade="álbuns" />
        </div>
      </Secao>

      <Secao id="artistas" titulo="Artistas mais ouvidos" descricao="Coletâneas “Various” não entram neste ranking. Álbuns com mais de um artista contam para todos eles.">
        <RankingArtistas itens={dados.artistas} />
      </Secao>

      <Secao id="albuns" titulo="Álbuns mais ouvidos" descricao="Inclui as audições de álbuns que saíram da coleção ativa, pois o histórico é preservado.">
        <RankingAlbuns itens={dados.albuns} />
      </Secao>

      <Secao id="nunca" titulo="Álbuns nunca ouvidos" descricao="Álbuns da coleção ativa sem nenhuma audição registrada.">
        <ListaNuncaOuvidos albuns={dados.nunca} />
      </Secao>
    </div>
  );
}
