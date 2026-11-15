import { FieldValue } from "firebase-admin/firestore";
import { getAdminDb } from "@/lib/firebase-admin";
import { artistaDe } from "@/lib/colecao/artistas";
import type { ReleaseDoc } from "@/lib/discogs/release";
import { ErroNegocio } from "./erros-negocio";

/**
 * Adiciona um álbum à seção "Quero Conhecer". É uma lista independente:
 * nada é adicionado à coleção nem à lista de desejos.
 */
export async function adicionarQueroConhecer(uid: string, release: ReleaseDoc) {
  const db = getAdminDb();
  const ref = db.doc(`users/${uid}/discover/${release.releaseId}`);
  const artists = release.artists.map((a) => artistaDe(a.id, a.name));
  await db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    if (snap.exists) {
      throw new ErroNegocio("duplicado", "Este álbum já está na lista Quero Conhecer.", 409, { releaseId: String(release.releaseId) });
    }
    tx.set(ref, {
      releaseId: release.releaseId,
      titulo: release.title,
      artista: release.artistName,
      artists,
      artistKeys: artists.map((a) => a.key),
      formatoOriginal: release.formatOriginal,
      capa: release.cover ?? release.thumb,
      discogsUrl: release.discogsUrl,
      adicionadoEm: FieldValue.serverTimestamp(),
    });
  });
  return { releaseId: String(release.releaseId) };
}
