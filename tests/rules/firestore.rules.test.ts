import { readFileSync } from "node:fs";
import { afterAll, beforeAll, beforeEach, describe, it } from "vitest";
import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
  type RulesTestEnvironment,
} from "@firebase/rules-unit-testing";
import { deleteField, doc, getDoc, setDoc, updateDoc, deleteDoc, Timestamp } from "firebase/firestore";

let env: RulesTestEnvironment;

beforeAll(async () => {
  env = await initializeTestEnvironment({
    projectId: "demo-logdisco",
    firestore: { rules: readFileSync("firestore.rules", "utf8") },
  });
});
afterAll(() => env.cleanup());

beforeEach(async () => {
  await env.clearFirestore();
  await env.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore();
    await setDoc(doc(db, "users/alice"), { email: "a@x.com" });
    await setDoc(doc(db, "users/alice/releases/1"), { artistName: "Artista", title: "Título", mediaType: "Vinyl" });
    await setDoc(doc(db, "users/alice/listens/l1"), { releaseId: "1", date: "2026-11-01", time: "20:00", listenedAt: Timestamp.now() });
    await setDoc(doc(db, "users/alice/wantlist/9"), { title: "Desejado" });
    await setDoc(doc(db, "users/alice/private/discogs"), { token: "segredo" });
    await setDoc(doc(db, "users/alice/changeLog/c1"), { tipo: "inclusao" });
  });
});

const alice = () => env.authenticatedContext("alice").firestore();
const bob = () => env.authenticatedContext("bob").firestore();
const anonimo = () => env.unauthenticatedContext().firestore();

describe("isolamento entre usuários", () => {
  it("visitante sem login não lê nada", async () => {
    await assertFails(getDoc(doc(anonimo(), "users/alice")));
    await assertFails(getDoc(doc(anonimo(), "users/alice/releases/1")));
  });
  it("outro usuário não lê nem escreve nos dados de alice", async () => {
    await assertFails(getDoc(doc(bob(), "users/alice")));
    await assertFails(getDoc(doc(bob(), "users/alice/releases/1")));
    await assertFails(getDoc(doc(bob(), "users/alice/listens/l1")));
    await assertFails(setDoc(doc(bob(), "users/alice/listens/x"), { releaseId: "1", date: "2026-11-02", time: "10:00", listenedAt: Timestamp.now() }));
  });
  it("alice lê e grava o próprio perfil", async () => {
    await assertSucceeds(getDoc(doc(alice(), "users/alice")));
    await assertSucceeds(setDoc(doc(alice(), "users/alice"), { email: "a@x.com", timezone: "America/Sao_Paulo" }, { merge: true }));
  });
});

describe("audições", () => {
  const valida = () => ({ releaseId: "1", date: "2026-11-02", time: "10:00", listenedAt: Timestamp.now() });
  it("aceita criar, editar e excluir uma audição válida", async () => {
    await assertSucceeds(setDoc(doc(alice(), "users/alice/listens/l2"), valida()));
    await assertSucceeds(updateDoc(doc(alice(), "users/alice/listens/l1"), { date: "2026-10-31", time: "21:30" }));
    await assertSucceeds(deleteDoc(doc(alice(), "users/alice/listens/l1")));
  });
  it("rejeita audição de um álbum que não existe na coleção", async () => {
    await assertFails(setDoc(doc(alice(), "users/alice/listens/l5"), { ...valida(), releaseId: "999" }));
  });
  it("rejeita data e horário fora do formato AAAA-MM-DD e HH:mm", async () => {
    await assertFails(setDoc(doc(alice(), "users/alice/listens/l6"), { ...valida(), date: "13/11/2026" }));
    await assertFails(setDoc(doc(alice(), "users/alice/listens/l7"), { ...valida(), time: "9h" }));
  });
  it("não permite mover uma audição para outro álbum", async () => {
    await env.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore(), "users/alice/releases/2"), { artistName: "B", title: "T", mediaType: "CD" });
    });
    await assertFails(updateDoc(doc(alice(), "users/alice/listens/l1"), { releaseId: "2" }));
  });
  it("rejeita audição sem data ou com tipos errados", async () => {
    await assertFails(setDoc(doc(alice(), "users/alice/listens/l3"), { releaseId: "1", time: "10:00", listenedAt: Timestamp.now() }));
    await assertFails(setDoc(doc(alice(), "users/alice/listens/l4"), { ...valida(), listenedAt: "ontem" }));
  });
});

describe("álbuns", () => {
  it("permite editar apenas título personalizado e categoria de mídia", async () => {
    const ref = doc(alice(), "users/alice/releases/1");
    await assertSucceeds(updateDoc(ref, { titleCustom: "Meu título", mediaType: "CD" }));
    await assertSucceeds(updateDoc(ref, { mediaType: "CD/DVD" }));
  });
  it("permite voltar ao título original (remover o título personalizado)", async () => {
    await env.withSecurityRulesDisabled(async (ctx) => {
      await updateDoc(doc(ctx.firestore(), "users/alice/releases/1"), { titleCustom: "Meu título" });
    });
    await assertSucceeds(updateDoc(doc(alice(), "users/alice/releases/1"), { titleCustom: deleteField() }));
  });
  it("bloqueia alterar status, data de inclusão, proteção do artista e dados do Discogs", async () => {
    const ref = doc(alice(), "users/alice/releases/1");
    await assertFails(updateDoc(ref, { status: "removed" }));
    await assertFails(updateDoc(ref, { addedAt: Timestamp.now() }));
    await assertFails(updateDoc(ref, { artistNameLocked: false }));
    await assertFails(updateDoc(ref, { tracks: [] }));
    await assertFails(updateDoc(ref, { formatOriginal: "CD" }));
  });
  it("bloqueia alterar artista, categoria fora das 4 permitidas, criar e excluir", async () => {
    const ref = doc(alice(), "users/alice/releases/1");
    await assertFails(updateDoc(ref, { artistName: "Outro" }));
    await assertFails(updateDoc(ref, { mediaType: "Cassette" }));
    await assertFails(setDoc(doc(alice(), "users/alice/releases/2"), { title: "Novo", mediaType: "CD" }));
    await assertFails(deleteDoc(ref));
  });
});

describe("dados gravados só pelo servidor", () => {
  it("wantlist: o usuário lê, mas não grava", async () => {
    await assertSucceeds(getDoc(doc(alice(), "users/alice/wantlist/9")));
    await assertFails(setDoc(doc(alice(), "users/alice/wantlist/10"), { title: "X" }));
  });
  it("tokens do Discogs ficam inacessíveis no navegador", async () => {
    await assertFails(getDoc(doc(alice(), "users/alice/private/discogs")));
    await assertFails(setDoc(doc(alice(), "users/alice/private/discogs"), { token: "x" }));
  });
  it("estado da integração com o Discogs: o usuário lê, mas não grava", async () => {
    await env.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore(), "users/alice/integrations/discogs"), { username: "alice_discogs" });
    });
    await assertSucceeds(getDoc(doc(alice(), "users/alice/integrations/discogs")));
    await assertFails(setDoc(doc(alice(), "users/alice/integrations/discogs"), { username: "outro" }));
    await assertFails(getDoc(doc(bob(), "users/alice/integrations/discogs")));
  });
  it("coleção de pedidos pendentes de OAuth é inacessível no navegador", async () => {
    await assertFails(getDoc(doc(alice(), "discogsOAuthPending/qualquer")));
    await assertFails(setDoc(doc(alice(), "discogsOAuthPending/qualquer"), { uid: "alice" }));
  });
  it("histórico de alterações só aceita novas entradas", async () => {
    await assertSucceeds(setDoc(doc(alice(), "users/alice/changeLog/c2"), { tipo: "edicao" }));
    await assertFails(updateDoc(doc(alice(), "users/alice/changeLog/c1"), { tipo: "x" }));
    await assertFails(deleteDoc(doc(alice(), "users/alice/changeLog/c1")));
  });
});
