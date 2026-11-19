"use client";

import Link from "next/link";
import { useRef, useState } from "react";
import { AlertTriangle, FileUp, Loader2 } from "lucide-react";
import { chamarApi } from "@/lib/api-cliente";
import { useAuth } from "@/lib/auth-context";
import type { PrevisaoImportacao } from "@/lib/csv/importacao";
import { formatarData } from "@/lib/diario/datas";
import { lerArquivoTexto } from "@/lib/download";

type Fase = "escolher" | "verificando" | "conferencia" | "importando" | "concluido";
const JSON_POST = { method: "POST", headers: { "Content-Type": "application/json" } } as const;

function Numero({ rotulo, valor, alerta }: { rotulo: string; valor: number; alerta?: boolean }) {
  return (
    <div className={`rounded-md border p-3 ${alerta ? "border-verm-100 bg-verm-50" : "border-verde-200 bg-white"}`}>
      <dt className="text-sm text-verde-800">{rotulo}</dt>
      <dd className={`text-2xl font-extrabold tabular-nums ${alerta ? "text-verm-700" : "text-verde-950"}`}>{valor}</dd>
    </div>
  );
}

/** Conferência da importação: mostra tudo antes de gravar e só importa depois da confirmação do usuário. */
export function ConferenciaImportacao({ previa, aoConfirmar, aoCancelar, ocupado }: { previa: PrevisaoImportacao; aoConfirmar: () => void; aoCancelar: () => void; ocupado: boolean }) {
  const c = previa.contagens;
  return (
    <div className="space-y-5">
      <dl className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Numero rotulo="Serão importadas" valor={c.novas} />
        <Numero rotulo="Já registradas (ignoradas)" valor={c.duplicadas} />
        <Numero rotulo="De releases fora da coleção" valor={c.semAlbum} alerta={c.semAlbum > 0} />
        <Numero rotulo="Linhas com erro" valor={c.erros} alerta={c.erros > 0} />
      </dl>

      {previa.semAlbum.length > 0 && (
        <div role="alert" className="aviso-erro space-y-2">
          <p className="flex items-center gap-2 font-semibold"><AlertTriangle className="h-5 w-5 shrink-0" aria-hidden="true" /> Há audições de releases que não constam na sua coleção</p>
          <p>Estas audições <strong>não serão importadas</strong>. Para importá-las, adicione o disco à coleção e envie o arquivo de novo.</p>
          <ul className="max-h-60 space-y-1 overflow-y-auto text-sm">
            {previa.semAlbum.map((g) => (
              <li key={g.releaseId} className="break-words">
                <a href={`https://www.discogs.com/release/${g.releaseId}`} target="_blank" rel="noopener noreferrer" className="font-semibold underline underline-offset-2">R{g.releaseId}</a>
                {" — "}{g.audicoes} {g.audicoes === 1 ? "audição" : "audições"} (linha{g.linhas.length > 1 ? "s" : ""} {g.linhas.slice(0, 10).join(", ")}{g.linhas.length > 10 ? "…" : ""})
              </li>
            ))}
            {previa.semAlbumGrupos > previa.semAlbum.length && <li>… e mais {previa.semAlbumGrupos - previa.semAlbum.length} releases.</li>}
          </ul>
          <Link href="/colecao/adicionar" className="btn-contorno">Adicionar disco à coleção</Link>
        </div>
      )}

      {previa.foraDaColecao.length > 0 && (
        <div className="aviso-ok space-y-1">
          <p className="font-semibold">Álbuns fora da coleção ativa</p>
          <p className="text-sm">Estas audições serão importadas, pois o histórico de álbuns removidos é preservado:</p>
          <ul className="text-sm">
            {previa.foraDaColecao.map((g) => <li key={g.releaseId} className="break-words">{g.artista} — {g.titulo} (R{g.releaseId}): {g.audicoes} {g.audicoes === 1 ? "audição" : "audições"}</li>)}
          </ul>
        </div>
      )}

      {previa.erros.length > 0 && (
        <div className="space-y-2">
          <h3 className="font-bold text-verde-950">Linhas com erro (não serão importadas)</h3>
          <ul className="max-h-60 space-y-1 overflow-y-auto rounded-md border border-verm-100 bg-white p-3 text-sm">
            {previa.erros.map((e) => <li key={e.linha} className="break-words"><strong>Linha {e.linha}:</strong> {e.mensagem}</li>)}
            {c.erros > previa.erros.length && <li>… e mais {c.erros - previa.erros.length} linhas com erro.</li>}
          </ul>
        </div>
      )}

      {previa.amostra.length > 0 && (
        <div className="space-y-2">
          <h3 className="font-bold text-verde-950">Prévia do que será importado {c.novas > previa.amostra.length && <span className="text-sm font-normal text-verde-700">(primeiras {previa.amostra.length} de {c.novas})</span>}</h3>
          <ul className="max-h-80 space-y-1 overflow-y-auto">
            {previa.amostra.map((l) => (
              <li key={l.linha} className="rounded-md border border-verde-200 bg-white p-2 text-sm">
                <p className="break-words font-semibold text-verde-950">{l.titulo}</p>
                <p className="break-words text-verde-800">{l.artista} · R{l.releaseId}</p>
                <p className="tabular-nums text-verde-700">{l.data && formatarData(l.data)} às {l.horario}{l.foraDaColecaoAtiva && <span className="text-verm-700"> · álbum fora da coleção ativa</span>}</p>
              </li>
            ))}
          </ul>
        </div>
      )}

      {previa.ignoradas.length > 0 && (
        <details className="rounded-md border border-verde-200 bg-white">
          <summary className="min-h-11 cursor-pointer px-3 py-2.5 text-sm font-semibold text-verde-900">Ver audições já registradas (serão ignoradas)</summary>
          <ul className="max-h-60 divide-y divide-verde-100 overflow-y-auto px-3 pb-2 text-sm">
            {previa.ignoradas.map((l) => <li key={l.linha} className="break-words py-1.5">{l.artista} — {l.titulo}: {l.data && formatarData(l.data)} às {l.horario}</li>)}
          </ul>
        </details>
      )}

      {c.novas === 0 && <p className="aviso-ok">Não há nenhuma audição nova para importar.</p>}

      <div className="flex flex-wrap gap-2">
        <button className="btn-primario" onClick={aoConfirmar} disabled={ocupado || c.novas === 0}>
          {ocupado && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />} Importar {c.novas} {c.novas === 1 ? "audição" : "audições"}
        </button>
        <button className="btn-contorno" onClick={aoCancelar} disabled={ocupado}>Cancelar</button>
      </div>
    </div>
  );
}

export function ImportadorAudicoes() {
  const { user } = useAuth();
  const [fase, setFase] = useState<Fase>("escolher");
  const [arquivo, setArquivo] = useState<{ nome: string; texto: string } | null>(null);
  const [previa, setPrevia] = useState<PrevisaoImportacao | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  const [importadas, setImportadas] = useState(0);
  const [chave, setChave] = useState(0);
  const vivo = useRef(true);

  function reiniciar() {
    setFase("escolher");
    setArquivo(null);
    setPrevia(null);
    setErro(null);
    setAviso(null);
    setImportadas(0);
    setChave((c) => c + 1);
  }

  async function escolher(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f || !user) return;
    setErro(null);
    setAviso(null);
    setPrevia(null);
    setFase("verificando");
    try {
      const { texto, codificacaoSuspeita } = await lerArquivoTexto(f);
      if (codificacaoSuspeita) setAviso("O arquivo não parece estar em UTF-8; os acentos podem sair errados. No LibreOffice Calc, salve como “CSV (separado por vírgulas)” com conjunto de caracteres “Unicode (UTF-8)”.");
      setArquivo({ nome: f.name, texto });
      const r = await chamarApi<{ previa: PrevisaoImportacao }>(user, "/api/importar/verificar", { ...JSON_POST, body: JSON.stringify({ csv: texto }) });
      if (!r.ok || !r.dados?.previa) {
        setErro(r.dados?.erro ?? `O servidor respondeu com erro (HTTP ${r.status}).`);
        setFase("escolher");
        return;
      }
      if (!r.dados.previa.estruturaOk) {
        setErro(r.dados.previa.erroEstrutura ?? "Arquivo inválido.");
        setFase("escolher");
        return;
      }
      setPrevia(r.dados.previa);
      setFase("conferencia");
    } catch {
      setErro("Não foi possível ler o arquivo ou falar com o servidor.");
      setFase("escolher");
    }
  }

  async function importar() {
    if (!user || !arquivo) return;
    setErro(null);
    setFase("importando");
    let total = 0;
    try {
      while (vivo.current) {
        const r = await chamarApi<{ importadas: number; pendentes: number }>(user, "/api/importar/aplicar", { ...JSON_POST, body: JSON.stringify({ csv: arquivo.texto }) });
        if (!r.ok || !r.dados) {
          setErro(r.dados?.erro ?? `O servidor respondeu com erro (HTTP ${r.status}).`);
          setImportadas(total);
          setFase(total > 0 ? "concluido" : "conferencia");
          return;
        }
        total += r.dados.importadas;
        setImportadas(total);
        if (r.dados.pendentes === 0) break;
      }
      setFase("concluido");
    } catch {
      setErro("Não foi possível falar com o servidor.");
      setFase(total > 0 ? "concluido" : "conferencia");
    }
  }

  return (
    <div className="space-y-4">
      {erro && <p role="alert" className="aviso-erro">{erro}</p>}
      {aviso && <p role="status" className="aviso-erro">{aviso}</p>}

      {(fase === "escolher" || fase === "verificando") && (
        <div>
          <label htmlFor="arquivo-csv" className="campo-rotulo">Arquivo CSV de audições</label>
          <input key={chave} id="arquivo-csv" type="file" accept=".csv,text/csv,text/plain" onChange={escolher} disabled={fase === "verificando"} className="campo !py-2 file:mr-3 file:rounded file:border-0 file:bg-verde-100 file:px-3 file:py-1.5 file:font-semibold file:text-verde-900" />
          {fase === "verificando" && <p role="status" className="mt-2 flex items-center gap-2 text-sm text-verde-800"><Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> Conferindo o arquivo…</p>}
        </div>
      )}

      {(fase === "conferencia" || fase === "importando") && previa && (
        <>
          <p className="flex items-center gap-2 text-sm text-verde-800"><FileUp className="h-4 w-4" aria-hidden="true" /> <strong className="break-all">{arquivo?.nome}</strong></p>
          <ConferenciaImportacao previa={previa} aoConfirmar={importar} aoCancelar={reiniciar} ocupado={fase === "importando"} />
          {fase === "importando" && <p role="status" className="flex items-center gap-2 text-sm text-verde-800"><Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> Importando… {importadas} gravadas</p>}
        </>
      )}

      {fase === "concluido" && previa && (
        <div className="space-y-3" role="status">
          <p className="aviso-ok"><strong>{importadas}</strong> {importadas === 1 ? "audição importada" : "audições importadas"}.</p>
          <ul className="list-disc pl-5 text-sm text-verde-800">
            <li>{previa.contagens.duplicadas} já estavam registradas e foram ignoradas.</li>
            {previa.contagens.semAlbum > 0 && <li>{previa.contagens.semAlbum} são de releases que não constam na coleção e não foram importadas.</li>}
            {previa.contagens.erros > 0 && <li>{previa.contagens.erros} linhas com erro não foram importadas.</li>}
          </ul>
          <div className="flex flex-wrap gap-2">
            <Link href="/diario" className="btn-primario">Ver o diário</Link>
            <Link href="/historico" className="btn-contorno">Histórico de alterações</Link>
            <button className="btn-contorno" onClick={reiniciar}>Importar outro arquivo</button>
          </div>
        </div>
      )}
    </div>
  );
}
