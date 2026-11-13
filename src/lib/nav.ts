import { BarChart3, CalendarDays, Disc3, Headphones, Heart, House, Settings, type LucideIcon } from "lucide-react";

export type ItemNav = { href: string; rotulo: string; icone: LucideIcon };

/** Aparecem na barra inferior (celular) e na barra superior (computador). */
export const NAV_PRINCIPAL: ItemNav[] = [
  { href: "/", rotulo: "Início", icone: House },
  { href: "/colecao", rotulo: "Coleção", icone: Disc3 },
  { href: "/diario", rotulo: "Diário", icone: CalendarDays },
  { href: "/desejos", rotulo: "Desejos", icone: Heart },
];

/** No celular ficam no menu “Mais”; no computador, na barra superior. */
export const NAV_SECUNDARIA: ItemNav[] = [
  { href: "/quero-conhecer", rotulo: "Quero Conhecer", icone: Headphones },
  { href: "/relatorios", rotulo: "Relatórios", icone: BarChart3 },
  { href: "/configuracoes", rotulo: "Configurações", icone: Settings },
];

export function ativo(pathname: string, href: string): boolean {
  // Páginas de álbum e de artista fazem parte da seção Coleção.
  if (href === "/colecao" && (pathname.startsWith("/album/") || pathname.startsWith("/artista/"))) return true;
  return href === "/" ? pathname === "/" : pathname === href || pathname.startsWith(href + "/");
}
