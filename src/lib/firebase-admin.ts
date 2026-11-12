import { cert, getApps, initializeApp, type App } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";

export class ErroConfiguracao extends Error {}

function adminApp(): App {
  const existente = getApps()[0];
  if (existente) return existente;

  const projectId = process.env.FIREBASE_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  const bruta = process.env.FIREBASE_PRIVATE_KEY;
  const faltando = [
    !projectId && "FIREBASE_PROJECT_ID",
    !clientEmail && "FIREBASE_CLIENT_EMAIL",
    !bruta && "FIREBASE_PRIVATE_KEY",
  ].filter(Boolean);
  if (faltando.length) {
    throw new ErroConfiguracao(`Variáveis de ambiente ausentes: ${faltando.join(", ")}`);
  }

  // Aceita a chave com "\n" literais e com ou sem aspas nas pontas.
  const privateKey = bruta!.replace(/^"|"$/g, "").replace(/\\n/g, "\n");
  try {
    return initializeApp({ credential: cert({ projectId, clientEmail, privateKey }) });
  } catch {
    throw new ErroConfiguracao(
      "As credenciais do Firebase Admin são inválidas. Confira FIREBASE_PRIVATE_KEY e FIREBASE_CLIENT_EMAIL.",
    );
  }
}

export const getAdminAuth = () => getAuth(adminApp());
export const getAdminDb = () => getFirestore(adminApp());
