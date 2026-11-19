import { getAdminDb } from "@/lib/firebase-admin";
import { COLECOES_BACKUP, converterDatas, sanitizarDoc, type ColecaoBackup } from "@/lib/backup/esquema";
import { ErroNegocio } from "./erros-negocio";
import { gravarEmLotes } from "./lotes";

export const MAX_ITENS_POR_LOTE = 300;

export type ResultadoRestauracao = {
  colecao: ColecaoBackup;
  adicionados: number;
  ignorados: number;
  erros: { id: string; erro: string }[];
};

/**
 * Restaura uma parte da cópia de segurança. A restauração só ADICIONA: o que já existe na conta é mantido
 * como está (nunca sobrescrito). Cada item é conferido pelo esquema, e campos desconhecidos são descartados.
 * Audições só entram se o álbum correspondente existir na conta (restaure os álbuns antes).
 */
export async function restaurarLote(uid: string, colecao: unknown, itens: unknown): Promise<ResultadoRestauracao> {
  if (!COLECOES_BACKUP.includes(colecao as ColecaoBackup)) throw new ErroNegocio("colecao_invalida", "Seção desconhecida na cópia de segurança.", 400);
  if (!Array.isArray(itens)) throw new ErroNegocio("corpo_invalido", "Itens inválidos.", 400);
  if (itens.length > MAX_ITENS_POR_LOTE) throw new ErroNegocio("lote_grande", `Envie no máximo ${MAX_ITENS_POR_LOTE} itens por vez.`, 413);
  const c = colecao as ColecaoBackup;
  const db = getAdminDb();
  const pasta = `users/${uid}/${c}`;

  const erros: { id: string; erro: string }[] = [];
  const validos: { id: string; dados: Record<string, unknown> }[] = [];
  const idsVistos = new Set<string>();
  for (const item of itens) {
    const entrada = (item && typeof item === "object" ? item : {}) as { id?: unknown; dados?: unknown };
    const r = sanitizarDoc(c, entrada.id, entrada.dados);
    const id = typeof entrada.id === "string" ? entrada.id : "?";
    if (!r.ok) erros.push({ id, erro: r.erro });
    else if (idsVistos.has(id)) erros.push({ id, erro: "Identificador repetido no lote." });
    else {
      idsVistos.add(id);
      validos.push({ id, dados: converterDatas(c, r.dados) });
    }
  }

  // Audições dependem do álbum: confere que ele existe na conta.
  let albunsExistentes = new Set<string>();
  if (c === "listens") {
    const releases = [...new Set(validos.map((v) => String(v.dados.releaseId)))];
    const snaps = await Promise.all(releases.map((r) => db.doc(`users/${uid}/releases/${r}`).get()));
    albunsExistentes = new Set(releases.filter((_, i) => snaps[i].exists));
  }
  const candidatos = validos.filter((v) => {
    if (c === "listens" && !albunsExistentes.has(String(v.dados.releaseId))) {
      erros.push({ id: v.id, erro: `O álbum R${v.dados.releaseId} não existe na conta; restaure os álbuns antes.` });
      return false;
    }
    return true;
  });

  const existentes = await Promise.all(candidatos.map((v) => db.doc(`${pasta}/${v.id}`).get()));
  const novos = candidatos.filter((_, i) => !existentes[i].exists);
  await gravarEmLotes(novos, (lote, v) => lote.set(db.doc(`${pasta}/${v.id}`), v.dados));

  return { colecao: c, adicionados: novos.length, ignorados: candidatos.length - novos.length, erros: erros.slice(0, 50) };
}
