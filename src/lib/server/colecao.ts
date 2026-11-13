import { FieldValue } from "firebase-admin/firestore";
import { getAdminDb } from "@/lib/firebase-admin";
import { compararRelease, ehCategoriaValida, montarAlbumNovo } from "@/lib/colecao/atualizacao";
import type { ReleaseDoc } from "@/lib/discogs/release";
import { urlDoArtistaNoDiscogs } from "@/lib/links";
import type { AlbumDoc, DetalheMudanca } from "@/lib/tipos";
import { ErroNegocio } from "./erros-negocio";

type EntradaLog = {
  tipo: "inclusao" | "atualizacao";
  releaseId: number;
  resumo: string;
  detalhes?: DetalheMudanca[];
};

/** Registra uma operação no histórico de alterações (users/{uid}/changeLog). */
function registrar(uid: string, entrada: EntradaLog) {
  const ref = getAdminDb().collection(`users/${uid}/changeLog`).doc();
  return { ref, dados: { ...entrada, at: FieldValue.serverTimestamp() } };
}

/**
 * Adiciona um lançamento à coleção. Não cria duplicados: se já está ativo, recusa;
 * se foi removido antes (exclusão lógica), reativa sem tocar nas audições.
 */
export async function adicionarAlbum(uid: string, release: ReleaseDoc, categoriaEscolhida: unknown) {
  if (categoriaEscolhida !== undefined && categoriaEscolhida !== null && !ehCategoriaValida(categoriaEscolhida)) {
    throw new ErroNegocio("categoria_invalida", "Categoria de mídia inválida. Use CD, Vinyl, DVD ou CD/DVD.", 400);
  }
  const categoria = categoriaEscolhida ?? release.mediaType;
  if (!categoria) {
    throw new ErroNegocio(
      "categoria_obrigatoria",
      "Não foi possível identificar o tipo de mídia pelo Discogs. Escolha CD, Vinyl, DVD ou CD/DVD.",
      400,
    );
  }

  const db = getAdminDb();
  const ref = db.doc(`users/${uid}/releases/${release.releaseId}`);
  const novo = montarAlbumNovo(release, categoria);
  const nomeDoAlbum = `${release.artistName} — ${release.title}`;
  let reativado = false;

  await db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    if (snap.exists) {
      const atual = snap.data() as AlbumDoc;
      if (atual.status !== "removed") {
        throw new ErroNegocio("duplicado", "Este lançamento já está na sua coleção.", 409, { releaseId: String(release.releaseId) });
      }
      // Reativação: mantém categoria e título personalizado; renova só os dados cadastrais.
      const { patch } = compararRelease(atual, release);
      tx.update(ref, {
        ...patch,
        status: "active",
        addedAt: FieldValue.serverTimestamp(),
        removedAt: FieldValue.delete(),
        updatedAt: FieldValue.serverTimestamp(),
        lastRefreshedAt: FieldValue.serverTimestamp(),
      });
      reativado = true;
    } else {
      tx.set(ref, {
        ...novo,
        addedAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
        lastRefreshedAt: FieldValue.serverTimestamp(),
      });
    }

    // Cadastro centralizado de artistas: vários álbuns apontam para o mesmo artista.
    for (const a of novo.artists) {
      tx.set(
        db.doc(`users/${uid}/artists/${a.key}`),
        { name: a.name, discogsId: a.id, discogsUrl: urlDoArtistaNoDiscogs(a.id), updatedAt: FieldValue.serverTimestamp() },
        { merge: true },
      );
    }
    const log = registrar(uid, {
      tipo: "inclusao",
      releaseId: release.releaseId,
      resumo: `${reativado ? "Reincluiu" : "Incluiu"} ${nomeDoAlbum} (${categoria})`,
    });
    tx.set(log.ref, log.dados);
  });

  return { releaseId: String(release.releaseId), reativado };
}

/**
 * Compara o álbum com o Discogs. Em modo prévia (aplicar = false) devolve as diferenças
 * sem alterar nada visível; em modo aplicar grava os dados cadastrais.
 * Esta função nunca lê nem escreve em users/{uid}/listens.
 */
export async function atualizarAlbum(uid: string, releaseId: string, novo: ReleaseDoc, aplicar: boolean) {
  const db = getAdminDb();
  const ref = db.doc(`users/${uid}/releases/${releaseId}`);
  const snap = await ref.get();
  if (!snap.exists) throw new ErroNegocio("nao_encontrado", "Álbum não encontrado na sua coleção.", 404);
  const atual = snap.data() as AlbumDoc;
  if (atual.status === "removed") {
    throw new ErroNegocio("removido", "Este álbum não está mais na coleção ativa.", 409);
  }

  const { mudancas, patch } = compararRelease(atual, novo);
  // Sem diferenças visíveis: só renova endereços de imagem, o que não precisa de confirmação.
  const gravar = aplicar || mudancas.length === 0;
  if (!gravar) return { mudancas, aplicado: false };

  const lote = db.batch();
  lote.update(ref, { ...patch, lastRefreshedAt: FieldValue.serverTimestamp(), updatedAt: FieldValue.serverTimestamp() });
  if (mudancas.length) {
    const log = registrar(uid, {
      tipo: "atualizacao",
      releaseId: novo.releaseId,
      resumo: `Atualizou ${atual.artistName} — ${atual.title} pelo Discogs (${mudancas.map((m) => m.rotulo.toLowerCase()).join(", ")})`,
      detalhes: mudancas,
    });
    lote.set(log.ref, log.dados);
  }
  await lote.commit();
  return { mudancas, aplicado: true };
}
