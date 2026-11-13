"use client";

import { useEffect, useId, useRef } from "react";
import { X } from "lucide-react";

type Props = { aberto: boolean; aoFechar: () => void; titulo: string; children: React.ReactNode; semTitulo?: boolean };

/** Janela sobre a página: fecha com Esc ou clicando fora, e trava a rolagem do fundo. */
export function Modal({ aberto, aoFechar, titulo, children, semTitulo }: Props) {
  const idTitulo = useId();
  const painel = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!aberto) return;
    const fechar = (e: KeyboardEvent) => e.key === "Escape" && aoFechar();
    window.addEventListener("keydown", fechar);
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const foco = painel.current?.querySelector<HTMLElement>("input, select, textarea, button:not([data-fechar])");
    foco?.focus();
    return () => {
      window.removeEventListener("keydown", fechar);
      document.body.style.overflow = overflow;
    };
  }, [aberto, aoFechar]);

  if (!aberto) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center md:items-start md:pt-[10vh]">
      <button aria-label="Fechar" onClick={aoFechar} className="absolute inset-0 bg-black/50" tabIndex={-1} />
      <div
        ref={painel}
        role="dialog"
        aria-modal="true"
        aria-labelledby={idTitulo}
        className="relative flex max-h-[88dvh] w-full flex-col overflow-hidden rounded-t-xl bg-white md:max-w-xl md:rounded-xl"
      >
        <div className="flex items-center justify-between gap-3 border-b border-verde-200 px-4 py-3">
          <h2 id={idTitulo} className={semTitulo ? "sr-only" : "text-lg font-bold text-verde-950"}>{titulo}</h2>
          <button data-fechar onClick={aoFechar} aria-label="Fechar" className="ml-auto grid h-11 w-11 place-items-center rounded-md text-verde-800 hover:bg-verde-50">
            <X className="h-5 w-5" aria-hidden="true" />
          </button>
        </div>
        <div className="overflow-y-auto p-4 pb-[calc(1rem+env(safe-area-inset-bottom))]">{children}</div>
      </div>
    </div>
  );
}
