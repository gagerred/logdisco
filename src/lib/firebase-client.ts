import { getApp, getApps, initializeApp, type FirebaseApp } from "firebase/app";
import { getAuth, type Auth } from "firebase/auth";
import {
  clearIndexedDbPersistence,
  getFirestore,
  initializeFirestore,
  persistentLocalCache,
  persistentMultipleTabManager,
  terminate,
  type Firestore,
} from "firebase/firestore";

let _app: FirebaseApp | null = null;
let _auth: Auth | null = null;
let _db: Firestore | null = null;

export function getFirebaseApp(): FirebaseApp {
  if (_app) return _app;
  _app = getApps().length
    ? getApp()
    : initializeApp({
        apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
        authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
        projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
        appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
      });
  return _app;
}

export function getFirebaseAuth(): Auth {
  if (!_auth) _auth = getAuth(getFirebaseApp());
  return _auth;
}

/** Firestore com cache offline no navegador (usado na busca de músicas e nos relatórios). */
export function getDb(): Firestore {
  if (_db) return _db;
  const app = getFirebaseApp();
  try {
    _db = initializeFirestore(app, {
      localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() }),
    });
  } catch {
    _db = getFirestore(app);
  }
  return _db;
}

/**
 * Sai da conta e apaga o cache local do Firestore, para que os dados de um
 * usuário nunca fiquem acessíveis a outro no mesmo navegador.
 */
export async function sairELimparCache(): Promise<void> {
  await getFirebaseAuth().signOut();
  try {
    const db = getDb();
    await terminate(db);
    await clearIndexedDbPersistence(db);
  } catch {
    // Se a limpeza falhar, a saída da conta já foi feita.
  }
  window.location.assign("/login");
}
