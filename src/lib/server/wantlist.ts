import { FieldValue } from "firebase-admin/firestore";
import { getAdminDb } from "@/lib/firebase-admin";
import type { DiscogsClient } from "@/lib/discogs/cliente";
import { DiscogsErro } from "@/lib/discogs/erros";
import { converterItemBasico, type ItemDiscogs } from "@/lib/sync/plano";
import { compararWantlist } from "@/lib/wantlist/logica";
import type { DesejoDoc, ResultadoWantlist, WantlistRunDoc } from "@/lib/wantlist/tipos";
import { registrar } from "./colecao";
import { ErroNegocio } from "./erros-negocio";
import { gravarEmLotes } from "./lotes";
import { adquirirTrava, liberarTrava } from "./trava";

type Opcoes = {
  runId?: string | null;
  origem: "manual" | "automatica";
  orcamentoMs?: number;
  agora?: () => number;
};

export const ORCAMENTO_PADRAO_MS = 25_000;
/** Uma execução incompleta com mais de 1 dia é descartada em vez de retomada, pois os dados ficaram velhos. */
const VALIDADE_EXECUCAO_MS = 24 * 3_600_000;
const NOTIFICACAO_ERRO = "wantlist-erro";

const nuvem = () => getAdminDb();
const pastaRuns = (uid: string) => `users/${uid}/wantlistRuns`;
const paginasDe = (uid: string, runId: string) => `${pastaRuns(uid)}/${runId}/paginas`;

async function limparPaginas(uid: string, runId: string) {
  const snap = await nuvem().collection(paginasDe(uid, runId)).get();
  await gravarEmLotes(snap.docs, (lote, d) => lote.delete(d.ref));
}

/** Aviso exibido no app quando uma atualização falha; um único aviso por vez, sobrescrito a cada falha. */
async function notificarErro(uid: string, mensagem: string, origem: string) {
  try {
    await nuvem().doc(`users/${uid}/notifications/${NOTIFICACAO_ERRO}`).set({
      tipo: "wantlist_erro",
      mensagem: `Não foi possível atualizar a lista de desejos: ${mensagem}`,
      origem,
      lida: false,
      em: FieldValue.serverTimestamp(),
    });
  } catch (e) {
    console.error("Não foi possível registrar a notificação de erro", e);
  }
}

async function registrarFalha(uid: string, runId: string, e: unknown, origem: string) {
  const mensagem = e instanceof Error ? e.message : "Erro inesperado.";
  const retomavel = e instanceof DiscogsErro && e.tipo === "limite";
  try {
    await nuvem().doc(`${pastaRuns(uid)}/${runId}`).update(retomavel ? { ultimoErro: mensagem } : { status: "falhou", erro: mensagem });
    if (!retomavel) await limparPaginas(uid, runId);
  } catch (falha) {
    console.error("Não foi possível registrar o erro da atualização", falha);
  }
  await notificarErro(uid, mensagem, origem);
}

/** Retoma a execução incompleta recente ou cria uma nova. */
async function prepararExecucao(uid: string, op: Opcoes, agora: () => number, username: string): Promise<string> {
  const db = nuvem();
  if (op.runId) {
    const snap = await db.doc(`${pastaRuns(uid)}/${op.runId}`).get();
    if (!snap.exists) throw new ErroNegocio("nao_encontrado", "Atualização não encontrada.", 404);
    if ((snap.data() as WantlistRunDoc).status !== "coletando") throw new ErroNegocio("estado_invalido", "Esta atualização não está mais em andamento.", 409);
    return op.runId;
  }
  const abertas = await db.collection(pastaRuns(uid)).where("status", "==", "coletando").get();
  let retomar: string | null = null;
  for (const d of abertas.docs) {
    const criada = (d.data() as { criadaEmMs?: number }).criadaEmMs ?? 0;
    if (!retomar && agora() - criada <= VALIDADE_EXECUCAO_MS) {
      retomar = d.id;
      continue;
    }
    await limparPaginas(uid, d.id);
    await d.ref.update({ status: "falhou", erro: "Execução anterior descartada por ter ficado incompleta." });
  }
  if (retomar) return retomar;

  const ref = db.collection(pastaRuns(uid)).doc();
  await ref.set({
    origem: op.origem,
    status: "coletando",
    criadaEm: FieldValue.serverTimestamp(),
    criadaEmMs: agora(),
    discogsUsername: username,
    proximaPagina: 1,
    totalPaginas: null,
  });
  return ref.id;
}

/**
 * Atualiza a lista de desejos a partir da wantlist do Discogs: deixa a lista do LogDisco igual à do Discogs.
 * Roda em partes (orçamento de tempo) e pode ser retomada. Nunca lê nem grava coleção ou audições.
 * Usa uma trava para impedir duas atualizações ao mesmo tempo (botão manual e tarefa automática, por exemplo).
 */
export async function atualizarWantlist(uid: string, cliente: DiscogsClient, username: string, op: Opcoes) {
  const agora = op.agora ?? Date.now;
  const inicio = agora();
  const orcamento = op.orcamentoMs ?? ORCAMENTO_PADRAO_MS;
  const db = nuvem();

  if (!(await adquirirTrava(uid, "wantlist", 120_000, agora))) {
    throw new ErroNegocio("trava", "Já existe uma atualização da lista de desejos em andamento.", 409);
  }
  let runId: string | null = null;
  try {
    runId = await prepararExecucao(uid, op, agora, username);
    const runRef = db.doc(`${pastaRuns(uid)}/${runId}`);
    const run = (await runRef.get()).data() as WantlistRunDoc;
    let pagina = run.proximaPagina ?? 1;
    let total = run.totalPaginas ?? null;

    while ((total === null || pagina <= total) && agora() - inicio < orcamento) {
      const resposta = await cliente.listarWantlist(username, pagina);
      total = Math.max(1, resposta.pagination?.pages ?? 1);
      const itens = (resposta.wants ?? []).map(converterItemBasico).filter((i): i is ItemDiscogs => i !== null);
      pagina += 1;
      const lote = db.batch();
      lote.set(db.doc(`${paginasDe(uid, runId)}/${pagina - 1}`), { itens });
      lote.update(runRef, { proximaPagina: pagina, totalPaginas: total, ultimoErro: FieldValue.delete() });
      await lote.commit();
    }

    if (total === null || pagina <= total) return { fase: "coletando" as const, runId, pagina: pagina - 1, totalPaginas: total };
    const resultado = await aplicar(uid, runId, agora, op.origem);
    return { fase: "concluida" as const, runId, resultado };
  } catch (e) {
    if (runId) await registrarFalha(uid, runId, e, op.origem);
    throw e;
  } finally {
    await liberarTrava(uid, "wantlist");
  }
}

/** Grava a diferença (adicionados, atualizados, removidos) só depois de coletar a wantlist inteira. */
async function aplicar(uid: string, runId: string, agora: () => number, origem: "manual" | "automatica"): Promise<ResultadoWantlist> {
  const db = nuvem();
  const paginas = await db.collection(paginasDe(uid, runId)).get();
  const doDiscogs = paginas.docs.flatMap((d) => (d.data().itens as ItemDiscogs[] | undefined) ?? []);
  const existentes = await db.collection(`users/${uid}/wantlist`).get();
  const atuais = existentes.docs.map((d) => ({ ...(d.data() as Omit<DesejoDoc, "id">), id: d.id }));

  const diff = compararWantlist(atuais, doDiscogs);
  const base = `users/${uid}/wantlist`;
  type Operacao = { tipo: "novo" | "patch" | "apagar"; id: string; dados?: Record<string, unknown> };
  const ops: Operacao[] = [
    ...diff.adicionar.map((d) => ({ tipo: "novo" as const, id: String(d.releaseId), dados: d })),
    ...diff.atualizar.map((a) => ({ tipo: "patch" as const, id: a.id, dados: a.patch })),
    ...diff.remover.map((id) => ({ tipo: "apagar" as const, id })),
  ];
  await gravarEmLotes(ops, (lote, op) => {
    const ref = db.doc(`${base}/${op.id}`);
    if (op.tipo === "apagar") lote.delete(ref);
    else if (op.tipo === "novo") lote.set(ref, { ...op.dados, atualizadoEm: FieldValue.serverTimestamp() });
    else lote.update(ref, { ...op.dados, atualizadoEm: FieldValue.serverTimestamp() });
  });

  const resultado: ResultadoWantlist = {
    total: new Set(doDiscogs.map((i) => i.id)).size,
    adicionados: diff.adicionar.length,
    removidos: diff.remover.length,
    atualizados: diff.atualizar.filter((a) => a.visivel).length,
  };
  const fim = db.batch();
  fim.update(db.doc(`${pastaRuns(uid)}/${runId}`), {
    status: "concluida",
    concluidaEm: FieldValue.serverTimestamp(),
    concluidaEmMs: agora(),
    resultado,
  });
  fim.delete(db.doc(`users/${uid}/notifications/${NOTIFICACAO_ERRO}`)); // a falha anterior foi superada
  // Só entra no histórico de alterações quando a lista realmente mudou (evita uma linha por semana sem novidade).
  if (resultado.adicionados + resultado.removidos + resultado.atualizados > 0) {
    const log = registrar(uid, {
      tipo: "atualizacao_desejos",
      origem: origem,
      resumo: `Lista de desejos atualizada (${origem === "automatica" ? "automática" : "manual"}): ${resultado.adicionados} adicionado(s), ${resultado.removidos} removido(s), ${resultado.atualizados} atualizado(s)`,
      detalhes: [
        { campo: "adicionados", rotulo: "Adicionados", de: "", para: String(resultado.adicionados) },
        { campo: "removidos", rotulo: "Removidos", de: "", para: String(resultado.removidos) },
        { campo: "atualizados", rotulo: "Atualizados", de: "", para: String(resultado.atualizados) },
      ],
    });
    fim.set(log.ref, log.dados);
  }
  await fim.commit();
  await limparPaginas(uid, runId);
  return resultado;
}
