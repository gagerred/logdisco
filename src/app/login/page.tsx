"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  createUserWithEmailAndPassword,
  GoogleAuthProvider,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signInWithPopup,
  updateProfile,
} from "firebase/auth";
import { doc, serverTimestamp, setDoc } from "firebase/firestore";
import { Loader2 } from "lucide-react";
import { Disco } from "@/components/Disco";
import { fusoDoNavegador, useAuth } from "@/lib/auth-context";
import { mensagemDeErro } from "@/lib/auth-errors";
import { getDb, getFirebaseAuth } from "@/lib/firebase-client";

type Modo = "entrar" | "criar" | "recuperar";

const TITULOS: Record<Modo, string> = {
  entrar: "Entrar",
  criar: "Criar conta",
  recuperar: "Recuperar senha",
};

function IconeGoogle() {
  return (
    <svg viewBox="0 0 48 48" className="h-5 w-5" aria-hidden="true">
      <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z" />
      <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z" />
      <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z" />
      <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z" />
    </svg>
  );
}

export default function PaginaLogin() {
  const router = useRouter();
  const { user, carregando, atualizar } = useAuth();
  const [modo, setModo] = useState<Modo>("entrar");
  const [nome, setNome] = useState("");
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState(false);

  useEffect(() => {
    if (!carregando && user) router.replace("/");
  }, [carregando, user, router]);

  function trocarModo(novo: Modo) {
    setModo(novo);
    setErro(null);
    setInfo(null);
  }

  async function entrarComGoogle() {
    setErro(null);
    setInfo(null);
    setOcupado(true);
    try {
      await signInWithPopup(getFirebaseAuth(), new GoogleAuthProvider());
    } catch (e) {
      const m = mensagemDeErro(e);
      if (m) setErro(m);
    } finally {
      setOcupado(false);
    }
  }

  async function enviar(e: React.FormEvent) {
    e.preventDefault();
    setErro(null);
    setInfo(null);
    const auth = getFirebaseAuth();
    const emailLimpo = email.trim();

    if (modo === "criar") {
      if (!nome.trim()) return setErro("Informe seu nome.");
      if (senha.length < 8) return setErro("A senha precisa ter pelo menos 8 caracteres.");
    }

    setOcupado(true);
    try {
      if (modo === "entrar") {
        await signInWithEmailAndPassword(auth, emailLimpo, senha);
      } else if (modo === "criar") {
        const cred = await createUserWithEmailAndPassword(auth, emailLimpo, senha);
        await updateProfile(cred.user, { displayName: nome.trim() });
        await setDoc(
          doc(getDb(), "users", cred.user.uid),
          { name: nome.trim(), email: cred.user.email ?? emailLimpo, timezone: fusoDoNavegador(), createdAt: serverTimestamp() },
          { merge: true },
        );
        await atualizar();
      } else {
        await sendPasswordResetEmail(auth, emailLimpo);
        setInfo("Se esse e-mail tiver uma conta, enviamos um link para criar uma nova senha. Verifique também a caixa de spam.");
      }
    } catch (err) {
      const m = mensagemDeErro(err);
      if (m) setErro(m);
    } finally {
      setOcupado(false);
    }
  }

  return (
    <div className="min-h-dvh md:grid md:grid-cols-[1fr_1.1fr]">
      <aside className="flex items-center gap-5 bg-verde-950 px-6 pb-6 pt-[calc(1.5rem+env(safe-area-inset-top))] text-white md:flex-col md:justify-center md:gap-8 md:p-12">
        <Disco className="giro-inicial h-20 w-20 shrink-0 md:h-80 md:w-80" aneis={8} />
        <div className="md:text-center">
          <p className="text-3xl font-extrabold tracking-tight md:text-5xl">LogDisco</p>
          <p className="mt-1 max-w-sm text-sm text-verde-100 md:mt-3 md:text-lg">
            Sua coleção de discos e o diário de tudo o que você ouviu.
          </p>
        </div>
      </aside>

      <main className="flex items-start justify-center px-5 py-8 md:items-center md:p-12">
        <div className="w-full max-w-sm">
          <h1 className="text-2xl font-extrabold tracking-tight text-verde-950">{TITULOS[modo]}</h1>

          {modo !== "recuperar" && (
            <>
              <button type="button" onClick={entrarComGoogle} disabled={ocupado} className="btn-contorno mt-5 w-full">
                <IconeGoogle /> Continuar com Google
              </button>
              <p className="my-4 text-center text-sm text-verde-700">ou use seu e-mail</p>
            </>
          )}
          {modo === "recuperar" && (
            <p className="mt-2 text-sm text-verde-800">Informe o e-mail da sua conta e enviaremos um link para criar uma nova senha.</p>
          )}

          <form onSubmit={enviar} className="mt-4 space-y-4" noValidate>
            {modo === "criar" && (
              <div>
                <label htmlFor="nome" className="campo-rotulo">Nome</label>
                <input id="nome" className="campo" autoComplete="name" value={nome} onChange={(e) => setNome(e.target.value)} />
              </div>
            )}
            <div>
              <label htmlFor="email" className="campo-rotulo">E-mail</label>
              <input id="email" type="email" className="campo" autoComplete="email" inputMode="email" value={email} onChange={(e) => setEmail(e.target.value)} />
            </div>
            {modo !== "recuperar" && (
              <div>
                <label htmlFor="senha" className="campo-rotulo">Senha</label>
                <input
                  id="senha"
                  type="password"
                  className="campo"
                  autoComplete={modo === "criar" ? "new-password" : "current-password"}
                  value={senha}
                  onChange={(e) => setSenha(e.target.value)}
                />
                {modo === "entrar" && (
                  <button type="button" onClick={() => trocarModo("recuperar")} className="mt-2 min-h-11 text-sm font-medium text-verm-700 underline underline-offset-2">
                    Esqueci minha senha
                  </button>
                )}
                {modo === "criar" && <p className="mt-1 text-xs text-verde-700">Mínimo de 8 caracteres.</p>}
              </div>
            )}

            {erro && <p role="alert" className="aviso-erro">{erro}</p>}
            {info && <p role="status" className="aviso-ok">{info}</p>}

            <button type="submit" disabled={ocupado} className="btn-primario w-full">
              {ocupado && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
              {modo === "entrar" ? "Entrar" : modo === "criar" ? "Criar conta" : "Enviar link"}
            </button>
          </form>

          <p className="mt-6 text-center text-sm">
            {modo === "entrar" ? (
              <>Ainda não tem conta?{" "}
                <button type="button" onClick={() => trocarModo("criar")} className="min-h-11 font-semibold text-verde-800 underline underline-offset-2">Criar conta</button></>
            ) : (
              <button type="button" onClick={() => trocarModo("entrar")} className="min-h-11 font-semibold text-verde-800 underline underline-offset-2">Voltar para entrar</button>
            )}
          </p>
        </div>
      </main>
    </div>
  );
}
