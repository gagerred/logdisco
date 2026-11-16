"use client";

import { useMemo, useState } from "react";
import { GraficoMensal, Indicador } from "@/components/Graficos";
import { RankingAlbuns, RankingArtistas } from "@/components/Rankings";
import { useColecao } from "@/lib/colecao-context";
import { dataLocal } from "@/lib/diario/datas";
import { anosDisponiveis, estatisticasDoAno, indexarAlbuns } from "@/lib/relatorios/calculos";

export default function RelatorioAnual() {
  const { todos, audicoes, carregando, erro } = useColecao();
  const anoAtual = Number(dataLocal().slice(0, 4));
  const anos = useMemo(() => anosDisponiveis(audicoes, anoAtual), [audicoes, anoAtual]);
  const [escolhido, setEscolhido] = useState<number | null>(null);

  // Padrão: o ano atual se já tem audições; senão o ano mais recente que tem.
  const padrao = useMemo(() => {
    const comAudicoes = anos.filter((a) => audicoes.some((x) => x.date.startsWith(`${a}-`)));
    return comAudicoes.includes(anoAtual) ? anoAtual : (comAudicoes[0] ?? anoAtual);
  }, [anos, audicoes, anoAtual]);
  const ano = escolhido ?? padrao;

  const e = useMemo(() => estatisticasDoAno(audicoes, indexarAlbuns(todos), ano, 50), [audicoes, todos, ano]);

  if (erro) return <p role="alert" className="aviso-erro">{erro}</p>;
  if (carregando) return <p className="text-verde-800">Carregando…</p>;

  return (
    <div className="space-y-8">
      <div className="max-w-xs">
        <label htmlFor="ano" className="campo-rotulo">Ano</label>
        <select id="ano" className="campo" value={ano} onChange={(ev) => setEscolhido(Number(ev.target.value))}>
          {anos.map((a) => <option key={a} value={a}>{a}</option>)}
        </select>
      </div>

      <section aria-labelledby="totais" className="space-y-3">
        <h2 id="totais" className="text-xl font-bold text-verde-950">Resumo de {ano}</h2>
        <div className="grid gap-3 sm:grid-cols-2">
          <Indicador rotulo="Total de discos ouvidos" valor={e.totalDiscosOuvidos} detalhe="Álbuns diferentes com pelo menos uma audição no ano" />
          <Indicador rotulo="Total de audições" valor={e.totalAudicoes} detalhe="Quantidade de registros de audição no ano" />
        </div>
      </section>

      <section aria-labelledby="meses" className="space-y-3">
        <h2 id="meses" className="text-xl font-bold text-verde-950">Audições por mês</h2>
        <div className="painel !p-4"><GraficoMensal valores={e.porMes} /></div>
      </section>

      <section aria-labelledby="artistas-ano" className="space-y-3">
        <h2 id="artistas-ano" className="text-xl font-bold text-verde-950">Artistas mais ouvidos em {ano}</h2>
        <RankingArtistas itens={e.artistas} />
      </section>

      <section aria-labelledby="discos-ano" className="space-y-3">
        <h2 id="discos-ano" className="text-xl font-bold text-verde-950">Discos mais ouvidos em {ano}</h2>
        <RankingAlbuns itens={e.albuns} />
      </section>
    </div>
  );
}
