import { FieldValue, Timestamp } from "firebase-admin/firestore";
import { getAdminDb } from "@/lib/firebase-admin";
import { tituloExibido } from "@/lib/colecao/filtros";
import { analisarAudicoes, chaveDaAudicao, montarPrevisao, type EstadoAudicoes, type LinhaAudicao } from "@/lib/csv/importacao";
import { FUSO_PADRAO, fusoValido, instanteLocal } from "@/lib/wantlist/agenda";
import type { AlbumDoc } from "@/lib/tipos";
import { registrar } from "./colecao";
import { ErroNegocio } from "./erros-negocio";
import { adquirirTrava, liberarTrava } from "./trava";

type Opcoes = { orcamentoMs?: number; agora?: () => number };

/** Tempo máximo gasto em uma chamada, para caber no limite das funções do Vercel. */
export const ORCAMENTO_PADRAO_MS = 25_000;
export const TAMANHO_MAXIMO_CSV = 3_000_000;
const TAMANHO_LOTE = 400;

type SnapshotAlbum = { artistName: string; title: string; thumb: string | null; mediaType: string };

async function carregarEstado(uid: string) {
  const db = getAdminDb();
  const [albuns, audicoes] = await Promise.all([
    db.collection(`users/${uid}/releases`).select("status", "title", "titleCustom", "artistName", "mediaType", "thumb", "cover").get(),
    db.collection(`users/${uid}/listens`).select("releaseId", "date", "time").get(),
  ]);
  const estado: EstadoAudicoes = { albuns: new Map(), chaves: new Set() };
  const snapshots = new Map<string, SnapshotAlbum>();
  for (const d of albuns.docs) {
    const a = d.data() as Pick<AlbumDoc, "status" | "title" | "titleCustom" | "artistName" | "mediaType" | "thumb" | "cover">;
    const titulo = tituloExibido(a);
    estado.albuns.set(d.id, { artista: a.artistName, titulo, ativo: a.status !== "removed" });
    snapshots.set(d.id, { artistName: a.artistName, title: titulo, thumb: a.thumb ?? a.cover ?? null, mediaType: a.mediaType });
  }
  for (const d of audicoes.docs) {
    const a = d.data() as { releaseId: string; date: string; time: string };
    estado.chaves.add(chaveDaAudicao(a.releaseId, a.date, a.time));
  }
  return { estado, snapshots };
}

function validarCsv(csv: unknown): string {
  if (typeof csv !== "string" || !csv.trim()) throw new ErroNegocio("arquivo_vazio", "O arquivo está vazio.", 400);
  if (csv.length > TAMANHO_MAXIMO_CSV) throw new ErroNegocio("arquivo_grande", "O arquivo é grande demais. Divida-o em partes menores.", 413);
  return csv;
}

/** Prévia da importação: não grava nada. */
export async function verificarAudicoes(uid: string, csv: unknown, op: Opcoes = {}) {
  const texto = validarCsv(csv);
  const { estado } = await carregarEstado(uid);
  return montarPrevisao(analisarAudicoes(texto, estado, new Date((op.agora ?? Date.now)())));
}

/**
 * Grava as audições novas do arquivo. Refaz a análise a cada chamada: o que já foi gravado vira "já registrada"
 * e é ignorado, então a importação pode ser retomada sem duplicar nada. Só escreve em users/{uid}/listens
 * (e no histórico); coleção, álbuns e demais dados não são tocados.
 */
export async function aplicarAudicoes(uid: string, csv: unknown, op: Opcoes = {}) {
  const texto = validarCsv(csv);
  const agora = op.agora ?? Date.now;
  const inicio = agora();
  const orcamento = op.orcamentoMs ?? ORCAMENTO_PADRAO_MS;
  const db = getAdminDb();

  if (!(await adquirirTrava(uid, "importacao", 120_000, agora))) {
    throw new ErroNegocio("trava", "Já existe uma importação em andamento. Aguarde alguns instantes.", 409);
  }
  try {
    const { estado, snapshots } = await carregarEstado(uid);
    const plano = analisarAudicoes(texto, estado, new Date(agora()));
    if (!plano.estruturaOk) throw new ErroNegocio("arquivo_invalido", plano.erroEstrutura ?? "Arquivo inválido.", 400);

    const perfil = (await db.doc(`users/${uid}`).get()).data() as { timezone?: unknown } | undefined;
    const fuso = fusoValido(perfil?.timezone) ? perfil.timezone : FUSO_PADRAO;

    const novas = plano.linhas.filter((l): l is LinhaAudicao & { releaseId: number; data: string; horario: string } => l.status === "nova");
    let importadas = 0;
    for (let i = 0; i < novas.length && agora() - inicio < orcamento; i += TAMANHO_LOTE) {
      const parte = novas.slice(i, i + TAMANHO_LOTE);
      const lote = db.batch();
      for (const l of parte) {
        const [ano, mes, dia] = l.data.split("-").map(Number);
        const [hora, min] = l.horario.split(":").map(Number);
        lote.set(db.collection(`users/${uid}/listens`).doc(), {
          releaseId: String(l.releaseId),
          date: l.data,
          time: l.horario,
          listenedAt: Timestamp.fromMillis(instanteLocal(fuso, ano, mes, dia, hora, min)),
          // Identificação guardada junto da audição, como nas audições registradas pelo app.
          snapshot: snapshots.get(String(l.releaseId)),
          createdAt: FieldValue.serverTimestamp(),
        });
      }
      await lote.commit();
      importadas += parte.length;
    }

    if (importadas > 0) {
      const c = plano.contagens;
      const log = registrar(uid, {
        tipo: "importacao",
        origem: "importacao",
        resumo: `Importação de CSV (audições): ${importadas} importada(s), ${c.duplicadas} já registrada(s) e ignorada(s), ${c.semAlbum} de releases fora da coleção, ${c.erros} com erro`,
        detalhes: [
          { campo: "importadas", rotulo: "Importadas", de: "", para: String(importadas) },
          { campo: "ignoradas", rotulo: "Já registradas (ignoradas)", de: "", para: String(c.duplicadas) },
          { campo: "sem_album", rotulo: "De releases fora da coleção (não importadas)", de: "", para: String(c.semAlbum) },
          { campo: "erros", rotulo: "Linhas com erro", de: "", para: String(c.erros) },
        ],
      });
      const lote = db.batch();
      lote.set(log.ref, log.dados);
      await lote.commit();
    }
    return { importadas, pendentes: novas.length - importadas, contagens: plano.contagens };
  } finally {
    await liberarTrava(uid, "importacao");
  }
}
