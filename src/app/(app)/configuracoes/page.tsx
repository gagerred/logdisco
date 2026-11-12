"use client";

import { useState } from "react";
import {
  EmailAuthProvider,
  GoogleAuthProvider,
  linkWithCredential,
  reauthenticateWithCredential,
  reauthenticateWithPopup,
  updatePassword,
  type User,
} from "firebase/auth";
import { Loader2 } from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { mensagemDeErro } from "@/lib/auth-errors";

function SecaoConta({ user }: { user: User }) {
  const metodos = [
    user.providerData.some((p) => p.providerId === "google.com") && "Google",
    user.providerData.some((p) => p.providerId === "password") && "E-mail e senha",
  ].filter(Boolean);
  return (
    <section className="painel">
      <h2 className="text-lg font-bold text-verde-950">Conta</h2>
      <dl className="mt-3 grid gap-3 text-sm sm:grid-cols-[8rem_1fr]">
        <dt className="font-medium text-verde-800">Nome</dt>
        <dd>{user.displayName || "—"}</dd>
        <dt className="font-medium text-verde-800">E-mail</dt>
        <dd>{user.email}</dd>
        <dt className="font-medium text-verde-800">Formas de entrada</dt>
        <dd>{metodos.join(" e ") || "—"}</dd>
      </dl>
    </section>
  );
}

function SecaoSenha({ user }: { user: User }) {
  const { atualizar } = useAuth();
  const temSenha = user.providerData.some((p) => p.providerId === "password");
  const [atual, setAtual] = useState("");
  const [nova, setNova] = useState("");
  const [confirma, setConfirma] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState(false);

  async function vincularSenha(novaSenha: string) {
    if (!user.email) throw new Error("Conta sem e-mail.");
    const cred = EmailAuthProvider.credential(user.email, novaSenha);
    try {
      await linkWithCredential(user, cred);
    } catch (e) {
      if ((e as { code?: string }).code !== "auth/requires-recent-login") throw e;
      await reauthenticateWithPopup(user, new GoogleAuthProvider());
      await linkWithCredential(user, cred);
    }
  }

  async function enviar(e: React.FormEvent) {
    e.preventDefault();
    setErro(null);
    setOk(null);
    if (nova.length < 8) return setErro("A nova senha precisa ter pelo menos 8 caracteres.");
    if (nova !== confirma) return setErro("A confirmação não é igual à nova senha.");
    if (temSenha && !atual) return setErro("Informe a senha atual.");

    setOcupado(true);
    try {
      if (temSenha) {
        await reauthenticateWithCredential(user, EmailAuthProvider.credential(user.email!, atual));
        await updatePassword(user, nova);
        setOk("Senha alterada.");
      } else {
        await vincularSenha(nova);
        await atualizar();
        setOk("Senha definida. Você pode entrar com e-mail e senha ou continuar usando o Google.");
      }
      setAtual("");
      setNova("");
      setConfirma("");
    } catch (err) {
      const m = mensagemDeErro(err);
      if (m) setErro(m);
    } finally {
      setOcupado(false);
    }
  }

  return (
    <section className="painel">
      <h2 className="text-lg font-bold text-verde-950">{temSenha ? "Alterar senha" : "Definir uma senha"}</h2>
      {!temSenha && (
        <p className="mt-1 text-sm text-verde-800">
          Sua conta entra pelo Google. Ao definir uma senha, o login com Google continua funcionando.
        </p>
      )}
      <form onSubmit={enviar} className="mt-4 max-w-sm space-y-4" noValidate>
        {temSenha && (
          <div>
            <label htmlFor="atual" className="campo-rotulo">Senha atual</label>
            <input id="atual" type="password" autoComplete="current-password" className="campo" value={atual} onChange={(e) => setAtual(e.target.value)} />
          </div>
        )}
        <div>
          <label htmlFor="nova" className="campo-rotulo">Nova senha</label>
          <input id="nova" type="password" autoComplete="new-password" className="campo" value={nova} onChange={(e) => setNova(e.target.value)} />
          <p className="mt-1 text-xs text-verde-700">Mínimo de 8 caracteres.</p>
        </div>
        <div>
          <label htmlFor="confirma" className="campo-rotulo">Confirmar nova senha</label>
          <input id="confirma" type="password" autoComplete="new-password" className="campo" value={confirma} onChange={(e) => setConfirma(e.target.value)} />
        </div>
        {erro && <p role="alert" className="aviso-erro">{erro}</p>}
        {ok && <p role="status" className="aviso-ok">{ok}</p>}
        <button type="submit" disabled={ocupado} className="btn-primario">
          {ocupado && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
          {temSenha ? "Alterar senha" : "Definir senha"}
        </button>
      </form>
    </section>
  );
}

function SecaoDiagnostico({ user }: { user: User }) {
  const [ocupado, setOcupado] = useState(false);
  const [resultado, setResultado] = useState<{ ok: boolean; texto: string } | null>(null);

  async function testar() {
    setOcupado(true);
    setResultado(null);
    try {
      const token = await user.getIdToken();
      const r = await fetch("/api/me", { headers: { Authorization: `Bearer ${token}` } });
      const j = await r.json();
      setResultado(
        r.ok && j.ok
          ? { ok: true, texto: "O servidor validou seu login e consegue acessar o Firestore." }
          : { ok: false, texto: j.erro ?? "O servidor respondeu com erro." },
      );
    } catch {
      setResultado({ ok: false, texto: "Não foi possível falar com o servidor." });
    } finally {
      setOcupado(false);
    }
  }

  return (
    <section className="painel">
      <h2 className="text-lg font-bold text-verde-950">Conexão com o servidor</h2>
      <p className="mt-1 text-sm text-verde-800">Confere se as variáveis de ambiente do servidor (Firebase Admin) estão corretas.</p>
      <button onClick={testar} disabled={ocupado} className="btn-contorno mt-4">
        {ocupado && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
        Testar conexão
      </button>
      {resultado && (
        <p role="status" className={`mt-3 ${resultado.ok ? "aviso-ok" : "aviso-erro"}`}>{resultado.texto}</p>
      )}
    </section>
  );
}

export default function Configuracoes() {
  const { user } = useAuth();
  if (!user) return null;
  return (
    <div className="max-w-2xl space-y-5">
      <h1 className="text-2xl font-extrabold tracking-tight text-verde-950 md:text-3xl">Configurações</h1>
      <SecaoConta user={user} />
      <SecaoSenha user={user} />
      <SecaoDiagnostico user={user} />
    </div>
  );
}
