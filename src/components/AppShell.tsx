"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { Ellipsis, LogOut, Search } from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { ativo, NAV_PRINCIPAL, NAV_SECUNDARIA } from "@/lib/nav";
import { BuscaNavbar } from "./BuscaNavbar";
import { Logo } from "./Logo";

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { user, sair } = useAuth();
  const [maisAberto, setMaisAberto] = useState(false);
  const [buscaAberta, setBuscaAberta] = useState(false);

  useEffect(() => {
    setMaisAberto(false);
    setBuscaAberta(false);
  }, [pathname]);
  useEffect(() => {
    if (!maisAberto) return;
    const fechar = (e: KeyboardEvent) => e.key === "Escape" && setMaisAberto(false);
    window.addEventListener("keydown", fechar);
    return () => window.removeEventListener("keydown", fechar);
  }, [maisAberto]);

  const primeiroNome = (user?.displayName ?? user?.email ?? "").split(/[ @]/)[0];
  const secundariaAtiva = NAV_SECUNDARIA.some((i) => ativo(pathname, i.href));

  return (
    <div className="min-h-dvh">
      {/* Barra superior — computador */}
      <header className="sticky top-0 z-20 hidden bg-verde-950 text-white md:block">
        <div className="mx-auto flex max-w-6xl items-center gap-6 px-4">
          <Link href="/" className="py-3 text-lg"><Logo /></Link>
          <nav aria-label="Principal" className="flex flex-1 items-stretch gap-1">
            {[...NAV_PRINCIPAL, ...NAV_SECUNDARIA].map(({ href, rotulo }) => {
              const a = ativo(pathname, href);
              return (
                <Link
                  key={href}
                  href={href}
                  aria-current={a ? "page" : undefined}
                  className={`flex items-center border-b-4 px-3 text-sm font-medium transition-colors ${
                    a ? "border-verm-600 bg-verde-900 text-white" : "border-transparent text-verde-100 hover:bg-verde-900"
                  }`}
                >
                  {rotulo}
                </Link>
              );
            })}
          </nav>
          <div className="flex items-center gap-3 text-sm">
            <button onClick={() => setBuscaAberta(true)} className="inline-flex min-h-11 items-center gap-2 rounded-md px-3 text-verde-100 hover:bg-verde-900">
              <Search className="h-4 w-4" aria-hidden="true" /> Buscar
            </button>
            <span className="max-w-40 truncate text-verde-100">{primeiroNome}</span>
            <button onClick={sair} className="inline-flex min-h-11 items-center gap-2 rounded-md px-3 text-verde-100 hover:bg-verde-900">
              <LogOut className="h-4 w-4" aria-hidden="true" /> Sair
            </button>
          </div>
        </div>
      </header>

      {/* Barra superior — celular */}
      <header className="sticky top-0 z-20 bg-verde-950 px-4 pb-3 pt-[calc(0.75rem+env(safe-area-inset-top))] text-white md:hidden">
        <div className="flex items-center justify-between">
          <Logo className="text-lg" />
          <button onClick={() => setBuscaAberta(true)} aria-label="Pesquisar na coleção" className="-my-2 grid h-11 w-11 place-items-center rounded-md hover:bg-verde-900">
            <Search className="h-5 w-5" aria-hidden="true" />
          </button>
        </div>
      </header>

      <main className="mx-auto w-full max-w-6xl min-w-0 px-4 py-6 pb-32 md:pb-10">{children}</main>

      {/* Menu “Mais” — celular */}
      {maisAberto && (
        <>
          <button aria-label="Fechar menu" className="fixed inset-0 z-30 bg-black/40 md:hidden" onClick={() => setMaisAberto(false)} />
          <div
            role="menu"
            className="fixed inset-x-0 bottom-[calc(4.25rem+env(safe-area-inset-bottom))] z-40 border-t border-verde-200 bg-white p-2 md:hidden"
          >
            {NAV_SECUNDARIA.map(({ href, rotulo, icone: Icone }) => (
              <Link key={href} href={href} role="menuitem" className="flex min-h-12 items-center gap-3 rounded-md px-3 text-base text-verde-950 hover:bg-verde-50">
                <Icone className="h-5 w-5 text-verde-700" aria-hidden="true" /> {rotulo}
              </Link>
            ))}
            <button role="menuitem" onClick={sair} className="flex min-h-12 w-full items-center gap-3 rounded-md px-3 text-base text-verm-700 hover:bg-verm-50">
              <LogOut className="h-5 w-5" aria-hidden="true" /> Sair
            </button>
          </div>
        </>
      )}

      {/* Barra inferior fixa — celular */}
      <nav
        aria-label="Principal"
        className="fixed inset-x-0 bottom-0 z-40 grid grid-cols-5 border-t border-verde-200 bg-white pb-[env(safe-area-inset-bottom)] md:hidden"
      >
        {NAV_PRINCIPAL.map(({ href, rotulo, icone: Icone }) => {
          const a = ativo(pathname, href);
          return (
            <Link
              key={href}
              href={href}
              aria-current={a ? "page" : undefined}
              className={`flex min-h-[4.25rem] flex-col items-center justify-center gap-1 border-t-4 text-[11px] ${
                a ? "border-verm-600 font-bold text-verde-950" : "border-transparent font-medium text-verde-700"
              }`}
            >
              <Icone className="h-6 w-6" aria-hidden="true" />
              {rotulo}
            </Link>
          );
        })}
        <button
          onClick={() => setMaisAberto((v) => !v)}
          aria-expanded={maisAberto}
          className={`flex min-h-[4.25rem] flex-col items-center justify-center gap-1 border-t-4 text-[11px] ${
            secundariaAtiva || maisAberto ? "border-verm-600 font-bold text-verde-950" : "border-transparent font-medium text-verde-700"
          }`}
        >
          <Ellipsis className="h-6 w-6" aria-hidden="true" />
          Mais
        </button>
      </nav>
      <BuscaNavbar aberto={buscaAberta} aoFechar={() => setBuscaAberta(false)} />
    </div>
  );
}
