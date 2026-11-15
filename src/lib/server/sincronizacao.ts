import { FieldValue } from "firebase-admin/firestore";
import { getAdminDb } from "@/lib/firebase-admin";
import { ehCategoriaValida } from "@/lib/colecao/atualizacao";
import type { DiscogsClient } from "@/lib/discogs/cliente";
import { DiscogsErro } from "@/lib/discogs/erros";
import { converterRelease } from "@/lib/discogs/release";
import { compararColecao, converterItemBasico, removalEmMassa, type AlbumParaComparar, type ItemDiscogs } from "@/lib/sync/plano";
import type { ResultadoSync, SyncItemDoc, SyncRunDoc } from "@/lib/sync/tipos";
import { adicionarAlbum, registrar } from "./colecao";
import { gravarEmLotes } from "./lotes";
import { ErroNegocio } from "./erros-negocio";
import { adquirirTrava, liberarTrava } from "./trava";

type Opcoes = { orcamentoMs?: number; agora?: () => number };

/** Tempo máximo gasto em uma chamada, para caber no limite das funções do Vercel. */
export const ORCAMENTO_PADRAO_MS = 25_000;
const nuvem = () => getAdminDb();
const pastaRuns = (uid: string) => `users/${uid}/syncRuns`;
const itensDe = (uid: string, runId: string) => `${pastaRuns(uid)}/${runId}/items`;
const paginasDe = (uid: string, runId: string) => `${pastaRuns(uid)}/${runId}/paginas`;

async function carregarRun(uid: string, runId: string) {
  const ref = nuvem().doc(`${pastaRuns(uid)}/${runId}`);
  const snap = await ref.get();
  if (!snap.exists) throw new ErroNegocio("nao_encontrado", "Sincronização não encontrada.", 404);
  return { ref, run: { ...(snap.data() as Omit<SyncRunDoc, "id">), id: runId } as SyncRunDoc };
}

/** Guarda no histórico o motivo de uma interrupção. Erros de limite podem ser retomados; os demais encerram a verificação. */
async function registrarErro(uid: string, runId: string, e: unknown, encerra: boolean) {
  const mensagem = e instanceof Error ? e.message : "Erro inesperado.";
  const campos = encerra ? { status: "falhou", erro: mensagem } : { ultimoErro: mensagem };
  try {
    await nuvem().doc(`${pastaRuns(uid)}/${runId}`).update(campos);
  } catch (falha) {
    console.error("Não foi possível registrar o erro da sincronização", falha);
  }
}

async function limparPaginas(uid: string, runId: string) {
  const snap = await nuvem().collection(paginasDe(uid, runId)).get();
  await gravarEmLotes(snap.docs, (lote, d) => lote.delete(d.ref));
}

// ───────────────────────── 1. Coleta e plano ─────────────────────────

/**
 * Consulta a coleção do Discogs, página por página, dentro de um orçamento de tempo.
 * Se não terminar, devolve fase "coletando" e o cliente chama de novo para continuar.
 * Ao terminar, monta o plano de alterações (nada é alterado na coleção nesta etapa).
 */
export async function coletarColecao(uid: string, cliente: DiscogsClient, username: string, runId: string | null, op: Opcoes = {}) {
  const agora = op.agora ?? Date.now;
  const inicio = agora();
  const orcamento = op.orcamentoMs ?? ORCAMENTO_PADRAO_MS;
  const db = nuvem();

  let id = runId;
  if (!id) {
    const abertas = await db.collection(pastaRuns(uid)).where("status", "in", ["coletando", "conferencia", "aplicando"]).get();
    const emAplicacao = abertas.docs.find((d) => d.data().status === "aplicando");
    if (emAplicacao) {
      throw new ErroNegocio("sync_em_andamento", "Já existe uma sincronização aprovada em andamento. Conclua essa antes de iniciar outra.", 409, { runId: emAplicacao.id });
    }
    // Uma verificação anterior que ninguém aprovou é descartada.
    for (const d of abertas.docs) {
      await limparPaginas(uid, d.id);
      await d.ref.update({ status: "cancelada", canceladaEm: FieldValue.serverTimestamp() });
    }
    const ref = db.collection(pastaRuns(uid)).doc();
    await ref.set({
      status: "coletando",
      criadaEm: FieldValue.serverTimestamp(),
      discogsUsername: username,
      proximaPagina: 1,
      totalPaginas: null,
      itensColetados: 0,
    });
    id = ref.id;
  }

  const { ref: runRef, run } = await carregarRun(uid, id);
  if (run.status !== "coletando") throw new ErroNegocio("estado_invalido", "Esta verificação não está mais em andamento.", 409, { runId: id });

  let pagina = run.proximaPagina ?? 1;
  let total = run.totalPaginas ?? null;
  let coletados = run.itensColetados ?? 0;

  try {
    while ((total === null || pagina <= total) && agora() - inicio < orcamento) {
      const resposta = await cliente.listarColecao(username, pagina);
      total = Math.max(1, resposta.pagination?.pages ?? 1);
      const itens = (resposta.releases ?? []).map(converterItemBasico).filter((i): i is ItemDiscogs => i !== null);
      coletados += itens.length;
      pagina += 1;
      const lote = db.batch();
      lote.set(db.doc(`${paginasDe(uid, id)}/${pagina - 1}`), { itens });
      lote.update(runRef, { proximaPagina: pagina, totalPaginas: total, itensColetados: coletados, ultimoErro: FieldValue.delete() });
      await lote.commit();
    }
  } catch (e) {
    // Limite de requisições: dá para retomar. Qualquer outra falha encerra esta verificação.
    const retomavel = e instanceof DiscogsErro && e.tipo === "limite";
    await registrarErro(uid, id, e, !retomavel);
    if (!retomavel) await limparPaginas(uid, id);
    throw e;
  }

  if (total !== null && pagina > total) {
    const contagens = await montarPlano(uid, id);
    return { fase: "pronto" as const, runId: id, contagens };
  }
  return { fase: "coletando" as const, runId: id, pagina: pagina - 1, totalPaginas: total, itensColetados: coletados };
}

/** Compara a coleção coletada com a do LogDisco e grava o plano para conferência do usuário. */
export async function montarPlano(uid: string, runId: string) {
  const db = nuvem();
  const paginas = await db.collection(paginasDe(uid, runId)).get();
  const doDiscogs = paginas.docs.flatMap((d) => (d.data().itens as ItemDiscogs[] | undefined) ?? []);

  const snapAlbuns = await db
    .collection(`users/${uid}/releases`)
    .select("status", "title", "titleCustom", "artistName", "mediaType", "thumb", "cover")
    .get();
  const albuns = snapAlbuns.docs.map((d) => ({ ...d.data(), id: d.id })) as AlbumParaComparar[];

  const plano = compararColecao(doDiscogs, albuns);
  const totalAtivos = albuns.filter((a) => a.status !== "removed").length;
  const pasta = itensDe(uid, runId);

  const base = { selecionado: true, estado: "pendente" as const };
  const itens: { id: string; dados: Omit<SyncItemDoc, "id"> }[] = [
    ...plano.adicionar.map((i) => ({ id: String(i.id), dados: { releaseId: i.id, acao: "adicionar" as const, grupo: "entrada" as const, titulo: i.titulo, artista: i.artista, formatoOriginal: i.formatoOriginal, categoria: i.categoria, mediaTypeEscolhida: null, capa: i.capa, ...base } })),
    ...plano.reativar.map((i) => ({ id: String(i.id), dados: { releaseId: i.id, acao: "reativar" as const, grupo: "entrada" as const, titulo: i.titulo, artista: i.artista, formatoOriginal: i.formatoOriginal, categoria: i.categoria, mediaTypeEscolhida: null, capa: i.capa, ...base } })),
    ...plano.remover.map((i) => ({ id: String(i.id), dados: { releaseId: i.id, acao: "remover" as const, grupo: "saida" as const, titulo: i.titulo, artista: i.artista, categoria: i.categoria, capa: i.capa, ...base } })),
  ];
  await gravarEmLotes(itens, (lote, item) => lote.set(db.doc(`${pasta}/${item.id}`), item.dados));

  const contagens = {
    totalDiscogs: new Set(doDiscogs.map((i) => i.id)).size,
    totalAtivos,
    adicionar: plano.adicionar.length,
    reativar: plano.reativar.length,
    manter: plano.manter.length,
    remover: plano.remover.length,
  };
  await db.doc(`${pastaRuns(uid)}/${runId}`).update({
    status: "conferencia",
    contagens,
    manterIds: plano.manter,
    planoEm: FieldValue.serverTimestamp(),
  });
  await limparPaginas(uid, runId);
  return contagens;
}

// ───────────────────────── 2. Aprovação ─────────────────────────

export type Selecao = {
  adicionar: { id: number; mediaType?: unknown }[];
  remover: number[];
  confirmouRemocaoEmMassa?: boolean;
};

/** Registra o que o usuário aprovou. Só depois disso é possível aplicar alterações. */
export async function aprovarPlano(uid: string, runId: string, sel: Selecao) {
  const { ref: runRef, run } = await carregarRun(uid, runId);
  if (run.status !== "conferencia") throw new ErroNegocio("estado_invalido", "Esta sincronização não está aguardando conferência.", 409);

  const snap = await nuvem().collection(itensDe(uid, runId)).get();
  const itens = new Map(snap.docs.map((d) => [Number(d.id), { ref: d.ref, dados: d.data() as SyncItemDoc }]));

  const escolhaPorId = new Map<number, unknown>();
  for (const s of sel.adicionar) {
    if (itens.get(s.id)?.dados.grupo !== "entrada") throw new ErroNegocio("selecao_invalida", "A seleção contém um álbum que não faz parte do plano.", 400);
    escolhaPorId.set(s.id, s.mediaType);
  }
  for (const id of sel.remover) {
    if (itens.get(id)?.dados.grupo !== "saida") throw new ErroNegocio("selecao_invalida", "A seleção contém um álbum que não faz parte do plano.", 400);
  }

  // Álbuns cujo formato o Discogs não permite classificar precisam de categoria escolhida.
  const faltando: number[] = [];
  for (const [id, mediaType] of escolhaPorId) {
    if (mediaType !== undefined && mediaType !== null && !ehCategoriaValida(mediaType)) {
      throw new ErroNegocio("categoria_invalida", "Categoria de mídia inválida. Use CD, Vinyl, DVD ou CD/DVD.", 400);
    }
    if (itens.get(id)!.dados.categoria === null && !ehCategoriaValida(mediaType)) faltando.push(id);
  }
  if (faltando.length) {
    throw new ErroNegocio("categoria_obrigatoria", `Escolha o tipo de mídia de ${faltando.length} álbum(ns) cujo formato o Discogs não permite identificar.`, 400, { ids: faltando });
  }

  const totalAtivos = run.contagens?.totalAtivos ?? 0;
  if (removalEmMassa(sel.remover.length, totalAtivos) && sel.confirmouRemocaoEmMassa !== true) {
    throw new ErroNegocio("confirmacao_necessaria", "Esta sincronização removeria metade ou mais da sua coleção. Confirme que isso está correto.", 409);
  }

  const aprovadosEntrada = new Set(sel.adicionar.map((s) => s.id));
  const aprovadosSaida = new Set(sel.remover);
  const alteracoes = [...itens.entries()].flatMap(([id, { ref, dados }]) => {
    const aprovado = dados.grupo === "entrada" ? aprovadosEntrada.has(id) : aprovadosSaida.has(id);
    const escolha = escolhaPorId.get(id);
    const mediaTypeEscolhida = ehCategoriaValida(escolha) ? escolha : null;
    if (aprovado === dados.selecionado && mediaTypeEscolhida === (dados.mediaTypeEscolhida ?? null)) return [];
    return [{ ref, campos: { selecionado: aprovado, mediaTypeEscolhida } }];
  });
  await gravarEmLotes(alteracoes, (lote, a) => lote.update(a.ref, a.campos));

  const totalSelecionados = aprovadosEntrada.size + aprovadosSaida.size;
  await runRef.update({ status: "aplicando", aprovadaEm: FieldValue.serverTimestamp(), totalSelecionados });
  return { totalSelecionados };
}

/** Descarta uma verificação que ainda não foi aprovada. */
export async function cancelarSync(uid: string, runId: string) {
  const { ref, run } = await carregarRun(uid, runId);
  if (run.status !== "coletando" && run.status !== "conferencia") {
    throw new ErroNegocio("estado_invalido", "Só é possível cancelar uma verificação que ainda não foi aprovada.", 409);
  }
  await limparPaginas(uid, runId);
  await ref.update({ status: "cancelada", canceladaEm: FieldValue.serverTimestamp() });
}

// ───────────────────────── 3. Aplicação ─────────────────────────

async function contarPendentes(uid: string, runId: string): Promise<number> {
  const r = await nuvem()
    .collection(itensDe(uid, runId))
    .where("selecionado", "==", true)
    .where("estado", "==", "pendente")
    .count()
    .get();
  return r.data().count;
}

/**
 * Aplica as alterações aprovadas, em partes. Nunca lê nem grava audições:
 * álbuns removidos apenas mudam para status "removed" (exclusão lógica).
 */
export async function aplicarLote(uid: string, runId: string, cliente: DiscogsClient, op: Opcoes = {}) {
  const agora = op.agora ?? Date.now;
  const inicio = agora();
  const orcamento = op.orcamentoMs ?? ORCAMENTO_PADRAO_MS;
  const db = nuvem();

  const { run } = await carregarRun(uid, runId);
  const total = run.totalSelecionados ?? 0;
  if (run.status === "concluida" || run.status === "concluida_com_erros") {
    return { fase: "concluida" as const, feitos: total, total, resultado: run.resultado };
  }
  if (run.status !== "aplicando") throw new ErroNegocio("estado_invalido", "Esta sincronização não foi aprovada.", 409);

  if (!(await adquirirTrava(uid, "sync", 120_000, agora))) {
    throw new ErroNegocio("trava", "Outra operação de sincronização está em andamento. Aguarde alguns instantes.", 409);
  }
  try {
    // 3.1 Saídas: exclusão lógica, sem tocar no histórico de audições
    const saidas = await db
      .collection(itensDe(uid, runId))
      .where("grupo", "==", "saida")
      .where("selecionado", "==", true)
      .where("estado", "==", "pendente")
      .get();
    for (let i = 0; i < saidas.docs.length; i += 120) {
      const parte = saidas.docs.slice(i, i + 120);
      const albuns = await Promise.all(parte.map((d) => db.doc(`users/${uid}/releases/${d.id}`).get()));
      const lote = db.batch();
      parte.forEach((d, k) => {
        const item = d.data() as SyncItemDoc;
        const album = albuns[k];
        if (album.exists && album.data()?.status !== "removed") {
          lote.update(db.doc(`users/${uid}/releases/${d.id}`), {
            status: "removed",
            removedAt: FieldValue.serverTimestamp(),
            updatedAt: FieldValue.serverTimestamp(),
          });
          const log = registrar(uid, {
            tipo: "remocao",
            releaseId: item.releaseId,
            resumo: `Removeu ${item.artista} — ${item.titulo} da coleção ativa (não está mais na coleção do Discogs)`,
            origem: "sincronizacao",
            syncRunId: runId,
          });
          lote.set(log.ref, log.dados);
          lote.update(d.ref, { estado: "feito" });
        } else {
          lote.update(d.ref, { estado: "feito", semMudanca: true, observacao: "O álbum já não estava na coleção ativa." });
        }
      });
      await lote.commit();
    }

    // 3.2 Entradas: cada álbum é consultado no Discogs, respeitando o orçamento de tempo
    while (agora() - inicio < orcamento) {
      const fila = await db
        .collection(itensDe(uid, runId))
        .where("grupo", "==", "entrada")
        .where("selecionado", "==", true)
        .where("estado", "==", "pendente")
        .limit(10)
        .get();
      if (fila.empty) break;
      for (const d of fila.docs) {
        if (agora() - inicio >= orcamento) break;
        const item = d.data() as SyncItemDoc;
        try {
          const release = converterRelease(await cliente.buscarRelease(item.releaseId));
          await adicionarAlbum(uid, release, item.mediaTypeEscolhida ?? item.categoria ?? undefined, { syncRunId: runId });
          await d.ref.update({ estado: "feito" });
        } catch (e) {
          if (e instanceof ErroNegocio && e.codigo === "duplicado") {
            await d.ref.update({ estado: "feito", semMudanca: true, observacao: "O álbum já estava na coleção." });
          } else if (e instanceof DiscogsErro && e.tipo === "nao_encontrado") {
            await d.ref.update({ estado: "erro", observacao: "Lançamento não encontrado no Discogs." });
          } else if (e instanceof DiscogsErro) {
            throw e; // limite de requisições, vínculo inválido ou Discogs fora do ar: para e deixa continuar depois
          } else if (e instanceof ErroNegocio) {
            await d.ref.update({ estado: "erro", observacao: e.message });
          } else {
            console.error("Falha ao incluir álbum na sincronização", item.releaseId, e);
            await d.ref.update({ estado: "erro", observacao: "Erro inesperado ao incluir este álbum." });
          }
        }
      }
    }

    const pendentes = await contarPendentes(uid, runId);
    if (pendentes > 0) return { fase: "aplicando" as const, feitos: total - pendentes, total };
    const resultado = await finalizar(uid, runId, run);
    return { fase: "concluida" as const, feitos: total, total, resultado };
  } catch (e) {
    if (e instanceof DiscogsErro) await registrarErro(uid, runId, e, false);
    throw e;
  } finally {
    await liberarTrava(uid, "sync");
  }
}

async function finalizar(uid: string, runId: string, run: SyncRunDoc): Promise<ResultadoSync> {
  const db = nuvem();
  const snap = await db.collection(itensDe(uid, runId)).get();
  const itens = snap.docs.map((d) => d.data() as SyncItemDoc);
  const selecionados = itens.filter((i) => i.selecionado);
  const feitosReais = (acao: string) => selecionados.filter((i) => i.acao === acao && i.estado === "feito" && !i.semMudanca).length;

  const resultado: ResultadoSync = {
    adicionados: feitosReais("adicionar"),
    reativados: feitosReais("reativar"),
    removidos: feitosReais("remover"),
    inalterados: (run.manterIds?.length ?? 0) + selecionados.filter((i) => i.semMudanca).length,
    naoSelecionados: itens.length - selecionados.length,
    erros: selecionados.filter((i) => i.estado === "erro").length,
  };
  const status = resultado.erros > 0 ? "concluida_com_erros" : "concluida";
  const log = registrar(uid, {
    tipo: "sincronizacao",
    resumo: `Sincronização com o Discogs: ${resultado.adicionados + resultado.reativados} incluído(s), ${resultado.removidos} removido(s), ${resultado.inalterados} inalterado(s)${resultado.erros ? `, ${resultado.erros} com erro` : ""}`,
    detalhes: [
      { campo: "adicionados", rotulo: "Adicionados", de: "", para: String(resultado.adicionados + resultado.reativados) },
      { campo: "removidos", rotulo: "Removidos", de: "", para: String(resultado.removidos) },
      { campo: "inalterados", rotulo: "Inalterados", de: "", para: String(resultado.inalterados) },
      { campo: "erros", rotulo: "Erros", de: "", para: String(resultado.erros) },
    ],
    origem: "sincronizacao",
    syncRunId: runId,
  });
  const lote = db.batch();
  lote.update(db.doc(`${pastaRuns(uid)}/${runId}`), { status, concluidaEm: FieldValue.serverTimestamp(), resultado });
  lote.set(log.ref, log.dados);
  await lote.commit();
  return resultado;
}
