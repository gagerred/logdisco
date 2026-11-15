import { getAdminDb } from "@/lib/firebase-admin";
import type { DiscogsClient } from "@/lib/discogs/cliente";
import { atualizacaoPendente, FUSO_PADRAO, fusoValido } from "@/lib/wantlist/agenda";
import { atualizarWantlist } from "./wantlist";

export type ResultadoUsuarioCron = {
  uid: string;
  resultado: "executada" | "pulada" | "incompleta" | "adiada" | "erro";
  detalhe?: string;
};

export type DepsCron = {
  uids: string[];
  contaDiscogs: (uid: string) => Promise<{ cliente: DiscogsClient; username: string }>;
  agora?: () => number;
  orcamentoMs?: number;
};

/** Tempo reservado ao cron em uma execução (o limite das funções do Vercel é de 60 s). */
export const ORCAMENTO_CRON_MS = 50_000;
const MINIMO_POR_USUARIO_MS = 3_000;

/**
 * Tarefa diária: para cada usuário com Discogs vinculado, atualiza a lista de desejos se a atualização
 * da semana (domingo às 11h, no fuso do usuário) ainda estiver pendente. Falha de um usuário não afeta os demais.
 */
export async function executarCronWantlist(deps: DepsCron): Promise<ResultadoUsuarioCron[]> {
  const agora = deps.agora ?? Date.now;
  const inicio = agora();
  const orcamento = deps.orcamentoMs ?? ORCAMENTO_CRON_MS;
  const db = getAdminDb();
  const saida: ResultadoUsuarioCron[] = [];

  for (const uid of deps.uids) {
    const restante = orcamento - (agora() - inicio);
    if (restante < MINIMO_POR_USUARIO_MS) {
      saida.push({ uid, resultado: "adiada", detalhe: "Sem tempo nesta execução; fica para a próxima." });
      continue;
    }
    try {
      const perfil = (await db.doc(`users/${uid}`).get()).data() as { timezone?: unknown } | undefined;
      const fuso = fusoValido(perfil?.timezone) ? perfil.timezone : FUSO_PADRAO;

      const ultima = await db.collection(`users/${uid}/wantlistRuns`).orderBy("concluidaEmMs", "desc").limit(1).get();
      const ultimaMs = (ultima.docs[0]?.data() as { concluidaEmMs?: number } | undefined)?.concluidaEmMs ?? null;
      const vinculo = (await db.doc(`users/${uid}/integrations/discogs`).get()).data() as { linkedAt?: { toMillis(): number } } | undefined;
      const referencia = ultimaMs ?? vinculo?.linkedAt?.toMillis() ?? null;

      if (!atualizacaoPendente(agora(), fuso, referencia)) {
        saida.push({ uid, resultado: "pulada" });
        continue;
      }
      const { cliente, username } = await deps.contaDiscogs(uid);
      const r = await atualizarWantlist(uid, cliente, username, { origem: "automatica", orcamentoMs: restante, agora });
      saida.push({ uid, resultado: r.fase === "concluida" ? "executada" : "incompleta" });
    } catch (e) {
      saida.push({ uid, resultado: "erro", detalhe: e instanceof Error ? e.message : "Erro inesperado." });
    }
  }
  return saida;
}
