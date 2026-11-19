"use client";

import Link from "next/link";
import { useRef, useState } from "react";
import { addDoc, collection, getDocs, serverTimestamp } from "firebase/firestore";
import { Download, Loader2, Upload } from "lucide-react";
import { chamarApi } from "@/lib/api-cliente";
import { useAuth } from "@/lib/auth-context";
import {
  COLECOES_BACKUP, dividirEmLotes, montarBackup, ROTULO_COLECAO, validarBackup, type ColecaoBackup, type ItemBackup, type ResultadoBackup,
} from "@/lib/backup/esquema";
import { baixarArquivo, lerArquivoTexto } from "@/lib/download";
import { nomeDoArquivo } from "@/lib/csv/formatos";
import { getDb } from "@/lib/firebase-client";

type Soma = Record<ColecaoBackup, { adicionados: number; ignorados: number; erros: number }>;
const somaVazia = (): Soma => Object.fromEntries(COLECOES_BACKUP.map((c) => [c, { adicionados: 0, ignorados: 0, erros: 0 }])) as Soma;
const JSON_POST = { method: "POST", headers: { "Content-Type": "application/json" } } as const;

type Validado = Extract<ResultadoBackup, { ok: true }>;

/** Painel da conferência da restauração: o que há no arquivo e o que será restaurado. */
export function ConferenciaBackup({ v, nome, aoConfirmar, aoCancelar, ocupado }: { v: Validado; nome: string; aoConfirmar: () => void; aoCancelar: () => void; ocupado: boolean }) {
  const validos = COLECOES_BACKUP.reduce((s, c) => s + v.contagens[c].validos, 0);
  return (
    <div className="space-y-4">
      <p className="text-sm text-verde-800">
        Arquivo <strong className="break-all">{nome}</strong>{v.criadoEm && <> · criado em {new Date(v.criadoEm).toLocaleString("pt-BR")}</>}
      </p>
      <ul className="divide-y divide-verde-100 rounded-md border border-verde-200 bg-white">
        {COLECOES_BACKUP.map((c) => (
          <li key={c} className="flex flex-wrap items-baseline justify-between gap-2 px-3 py-2">
            <span className="font-medium text-verde-950">{ROTULO_COLECAO[c]}</span>
            <span className="text-sm tabular-nums text-verde-800">
              {v.contagens[c].validos} no arquivo{v.contagens[c].invalidos > 0 && <span className="text-verm-700"> · {v.contagens[c].invalidos} inválido(s)</span>}
            </span>
          </li>
        ))}
      </ul>
      <p className="aviso-ok text-sm">A restauração <strong>só adiciona</strong>: o que já existe na sua conta não é alterado nem apagado.</p>
      {v.avisos.map((a) => <p key={a} className="aviso-erro text-sm">{a}</p>)}
      {v.invalidos.length > 0 && (
        <details className="rounded-md border border-verm-100 bg-white">
          <summary className="min-h-11 cursor-pointer px-3 py-2.5 text-sm font-semibold text-verm-700">Itens inválidos (não serão restaurados)</summary>
          <ul className="max-h-60 space-y-1 overflow-y-auto px-3 pb-2 text-sm">
            {v.invalidos.slice(0, 50).map((i, k) => <li key={k} className="break-words">{ROTULO_COLECAO[i.colecao]} · {i.id}: {i.erro}</li>)}
            {v.invalidos.length > 50 && <li>… e mais {v.invalidos.length - 50}.</li>}
          </ul>
        </details>
      )}
      <div className="flex flex-wrap gap-2">
        <button className="btn-primario" onClick={aoConfirmar} disabled={ocupado || validos === 0}>
          {ocupado && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />} Restaurar {validos} {validos === 1 ? "item" : "itens"}
        </button>
        <button className="btn-contorno" onClick={aoCancelar} disabled={ocupado}>Cancelar</button>
      </div>
    </div>
  );
}

export function CopiaDeSeguranca() {
  const { user } = useAuth();
  const [criando, setCriando] = useState(false);
  const [msgCriar, setMsgCriar] = useState<{ ok: boolean; texto: string } | null>(null);

  const [fase, setFase] = useState<"escolher" | "conferencia" | "restaurando" | "concluida">("escolher");
  const [arquivo, setArquivo] = useState("");
  const [validado, setValidado] = useState<Validado | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [progresso, setProgresso] = useState("");
  const [soma, setSoma] = useState<Soma>(somaVazia());
  const [chave, setChave] = useState(0);
  const vivo = useRef(true);

  async function criar() {
    if (!user) return;
    setCriando(true);
    setMsgCriar(null);
    try {
      const db = getDb();
      const dados = Object.fromEntries(COLECOES_BACKUP.map((c) => [c, [] as ItemBackup[]])) as Record<ColecaoBackup, ItemBackup[]>;
      for (const c of COLECOES_BACKUP) {
        const snap = await getDocs(collection(db, "users", user.uid, c));
        dados[c] = snap.docs.map((d) => ({ id: d.id, dados: d.data() }));
      }
      const backup = montarBackup(dados);
      baixarArquivo(nomeDoArquivo("backup", "json"), JSON.stringify(backup), "application/json");
      const total = COLECOES_BACKUP.reduce((s, c) => s + dados[c].length, 0);
      setMsgCriar({ ok: true, texto: `Cópia criada com ${total} itens. Guarde o arquivo em um local seguro, fora deste computador (nuvem, pen drive ou HD externo).` });
    } catch {
      setMsgCriar({ ok: false, texto: "Não foi possível criar a cópia de segurança. Verifique a conexão e tente de novo." });
    } finally {
      setCriando(false);
    }
  }

  function reiniciar() {
    setFase("escolher");
    setValidado(null);
    setErro(null);
    setSoma(somaVazia());
    setChave((c) => c + 1);
  }

  async function escolher(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    setErro(null);
    setArquivo(f.name);
    try {
      const { texto } = await lerArquivoTexto(f);
      let json: unknown;
      try {
        json = JSON.parse(texto);
      } catch {
        return setErro("O arquivo não é um JSON válido. Use a cópia de segurança gerada pelo LogDisco.");
      }
      const r = validarBackup(json);
      if (!r.ok) return setErro(r.erros.join(" "));
      setValidado(r);
      setFase("conferencia");
    } catch {
      setErro("Não foi possível ler o arquivo.");
    }
  }

  async function restaurar() {
    if (!user || !validado) return;
    setErro(null);
    setFase("restaurando");
    const acumulado = somaVazia();
    try {
      for (const c of COLECOES_BACKUP) {
        const lotes = dividirEmLotes(validado.docs[c]);
        for (let i = 0; i < lotes.length && vivo.current; i++) {
          setProgresso(`${ROTULO_COLECAO[c]}: parte ${i + 1} de ${lotes.length}`);
          const r = await chamarApi<{ adicionados: number; ignorados: number; erros: unknown[] }>(user, "/api/backup/restaurar", { ...JSON_POST, body: JSON.stringify({ colecao: c, itens: lotes[i] }) });
          if (!r.ok || !r.dados) throw new Error(r.dados?.erro ?? `O servidor respondeu com erro (HTTP ${r.status}).`);
          acumulado[c].adicionados += r.dados.adicionados;
          acumulado[c].ignorados += r.dados.ignorados;
          acumulado[c].erros += r.dados.erros.length;
        }
      }
      setSoma(acumulado);
      const adicionados = COLECOES_BACKUP.reduce((s, c) => s + acumulado[c].adicionados, 0);
      await addDoc(collection(getDb(), "users", user.uid, "changeLog"), {
        tipo: "restauracao",
        at: serverTimestamp(),
        resumo: `Restauração de cópia de segurança: ${adicionados} item(ns) adicionado(s)`,
        detalhes: COLECOES_BACKUP.map((c) => ({ campo: c, rotulo: ROTULO_COLECAO[c], de: "", para: String(acumulado[c].adicionados) })),
      }).catch(() => undefined);
      setFase("concluida");
    } catch (e) {
      setSoma(acumulado);
      setErro(e instanceof Error ? e.message : "Não foi possível restaurar.");
      setFase("conferencia");
    }
  }

  const adicionadosTotal = COLECOES_BACKUP.reduce((s, c) => s + soma[c].adicionados, 0);
  const ignoradosTotal = COLECOES_BACKUP.reduce((s, c) => s + soma[c].ignorados, 0);
  const errosTotal = COLECOES_BACKUP.reduce((s, c) => s + soma[c].erros, 0);

  return (
    <div className="space-y-8">
      <div className="space-y-3">
        <h3 className="text-lg font-bold text-verde-950">Criar cópia de segurança</h3>
        <p className="text-sm text-verde-800">Baixa um arquivo com a coleção, os dados dos álbuns, os artistas, o diário de audições, a lista de desejos e o Quero Conhecer. As credenciais do Discogs não entram na cópia.</p>
        <button className="btn-primario" onClick={criar} disabled={criando}>
          {criando ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <Download className="h-4 w-4" aria-hidden="true" />} Criar e baixar cópia de segurança
        </button>
        {msgCriar && <p role={msgCriar.ok ? "status" : "alert"} className={msgCriar.ok ? "aviso-ok" : "aviso-erro"}>{msgCriar.texto}</p>}
      </div>

      <div className="space-y-3 border-t border-verde-200 pt-6">
        <h3 className="text-lg font-bold text-verde-950">Restaurar cópia de segurança</h3>
        <p className="text-sm text-verde-800">Recupera os dados de um arquivo de cópia em caso de perda ou problema na conta. Só adiciona o que estiver faltando; nada do que já existe é alterado.</p>
        {erro && <p role="alert" className="aviso-erro">{erro}</p>}

        {fase === "escolher" && (
          <div>
            <label htmlFor="arquivo-backup" className="campo-rotulo">Arquivo da cópia (.json)</label>
            <input key={chave} id="arquivo-backup" type="file" accept=".json,application/json" onChange={escolher} className="campo !py-2 file:mr-3 file:rounded file:border-0 file:bg-verde-100 file:px-3 file:py-1.5 file:font-semibold file:text-verde-900" />
          </div>
        )}
        {(fase === "conferencia" || fase === "restaurando") && validado && (
          <>
            <ConferenciaBackup v={validado} nome={arquivo} aoConfirmar={restaurar} aoCancelar={reiniciar} ocupado={fase === "restaurando"} />
            {fase === "restaurando" && <p role="status" className="flex items-center gap-2 text-sm text-verde-800"><Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> Restaurando… {progresso}</p>}
          </>
        )}
        {fase === "concluida" && (
          <div className="space-y-3" role="status">
            <p className="aviso-ok flex items-center gap-2"><Upload className="h-4 w-4" aria-hidden="true" /> Restauração concluída: <strong>{adicionadosTotal}</strong> {adicionadosTotal === 1 ? "item adicionado" : "itens adicionados"}.</p>
            <ul className="list-disc pl-5 text-sm text-verde-800">
              <li>{ignoradosTotal} já existiam na conta e foram mantidos como estavam.</li>
              {errosTotal > 0 && <li>{errosTotal} não puderam ser restaurados (por exemplo, audições de álbuns que não existem na conta).</li>}
            </ul>
            <div className="flex flex-wrap gap-2">
              <Link href="/colecao" className="btn-primario">Ver a coleção</Link>
              <Link href="/historico" className="btn-contorno">Histórico de alterações</Link>
              <button className="btn-contorno" onClick={reiniciar}>Restaurar outro arquivo</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
