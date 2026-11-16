"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const ABAS = [
  { href: "/relatorios", rotulo: "Geral" },
  { href: "/relatorios/anual", rotulo: "Por ano" },
  { href: "/relatorios/midia", rotulo: "Por mídia" },
];

export default function LayoutRelatorios({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  return (
    <div className="space-y-5">
      <h1 className="text-2xl font-extrabold tracking-tight text-verde-950 md:text-3xl">Relatórios</h1>
      <nav aria-label="Tipos de relatório" className="flex gap-1 border-b border-verde-200">
        {ABAS.map(({ href, rotulo }) => {
          const ativa = href === "/relatorios" ? pathname === href : pathname.startsWith(href);
          return (
            <Link
              key={href}
              href={href}
              aria-current={ativa ? "page" : undefined}
              className={`-mb-px flex min-h-11 items-center border-b-4 px-4 text-sm font-semibold ${ativa ? "border-verm-600 text-verde-950" : "border-transparent text-verde-700 hover:text-verde-950"}`}
            >
              {rotulo}
            </Link>
          );
        })}
      </nav>
      {children}
    </div>
  );
}
