"use client";

import Link from "next/link";
import { ChevronLeft, Download } from "lucide-react";
import { CopiaDeSeguranca } from "@/components/CopiaDeSeguranca";
import { ImportadorAudicoes } from "@/components/ImportadorAudicoes";
import { useColecao } from "@/lib/colecao-context";
import { CABECALHO_AUDICOES, gerarCsvAudicoes, nomeDoArquivo } from "@/lib/csv/formatos";
import { baixarArquivo } from "@/lib/download";

export default function DadosEBackup() {
  const { audicoes, carregando } = useColecao();

  return (
    <div className="max-w-3xl space-y-6">
      <Link href="/configuracoes" className="inline-flex min-h-11 items-center gap-1 text-sm font-medium text-verde-800 hover:underline">
        <ChevronLeft className="h-4 w-4" aria-hidden="true" /> Configurações
      </Link>
      <h1 className="text-2xl font-extrabold tracking-tight text-verde-950 md:text-3xl">Importação, exportação e cópia de segurança</h1>

      <section className="painel space-y-3" aria-labelledby="exportar">
        <h2 id="exportar" className="text-lg font-bold text-verde-950">Exportar audições (CSV)</h2>
        <p className="text-sm text-verde-800">
          Gera uma planilha com todas as suas audições, uma por linha, nas colunas <code className="rounded bg-verde-50 px-1">{CABECALHO_AUDICOES.join("  ")}</code>:
          o código do lançamento no Discogs, a data e o horário. O arquivo abre direto no LibreOffice Calc, com os acentos preservados. A coleção não é exportada neste arquivo.
        </p>
        <button className="btn-primario" disabled={carregando || audicoes.length === 0} onClick={() => baixarArquivo(nomeDoArquivo("audicoes", "csv"), gerarCsvAudicoes(audicoes), "text/csv")}>
          <Download className="h-4 w-4" aria-hidden="true" /> Exportar {audicoes.length} {audicoes.length === 1 ? "audição" : "audições"}
        </button>
        {!carregando && audicoes.length === 0 && <p className="text-sm text-verde-700">Você ainda não tem audições registradas.</p>}
      </section>

      <section className="painel space-y-3" aria-labelledby="importar">
        <h2 id="importar" className="text-lg font-bold text-verde-950">Importar audições (CSV)</h2>
        <div className="space-y-1 text-sm text-verde-800">
          <p>O arquivo precisa ter as colunas <strong>discogs_id</strong>, <strong>date</strong> e <strong>time</strong>, nessa ordem:</p>
          <ul className="list-disc pl-5">
            <li><strong>discogs_id</strong>: o código do lançamento, com ou sem o R no início (R123456 ou 123456).</li>
            <li><strong>date</strong>: a data da audição, como AAAA-MM-DD ou DD/MM/AAAA.</li>
            <li><strong>time</strong>: o horário da audição, como HH:mm.</li>
          </ul>
          <p>Você vê uma conferência antes de importar. Audições já registradas são ignoradas, e as de releases que não constam na sua coleção são indicadas e não importadas.</p>
        </div>
        <ImportadorAudicoes />
      </section>

      <section className="painel" aria-labelledby="backup">
        <h2 id="backup" className="mb-3 text-lg font-bold text-verde-950">Cópia de segurança</h2>
        <CopiaDeSeguranca />
      </section>
    </div>
  );
}
