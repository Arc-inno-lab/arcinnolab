"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export type NavItem = {
  href: string;
  label: string;
  badge?: number;
  /** Un badge « fort » compte des actions attendues, pas des nouveautés. */
  badgeFort?: boolean;
  /** Actif seulement sur l'adresse exacte (sinon : sur toutes ses sous-pages). */
  exact?: boolean;
};

export function SidebarNav({ items, grand = false }: { items: NavItem[]; grand?: boolean }) {
  const pathname = usePathname();

  return (
    <nav
      aria-label="Navigation principale"
      className="flex gap-1 overflow-x-auto px-2 py-2 md:flex-col md:overflow-visible md:px-3 md:py-4"
    >
      {items.map((item) => {
        const active =
          item.href === "/" || item.exact ? pathname === item.href : pathname.startsWith(item.href);
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={active ? "page" : undefined}
            className={`flex items-center justify-between gap-2 whitespace-nowrap rounded-md px-3 py-2 font-medium ${grand ? "text-base" : "text-sm"}`}
            style={
              active
                ? { background: "var(--color-primary)", color: "#fff" }
                : { color: "var(--color-text)" }
            }
          >
            {item.label}
            {!!item.badge && (
              <span
                className="rounded-full px-2 py-0.5 text-[11px] font-bold"
                style={
                  active
                    ? { background: "#fff", color: "var(--color-primary)" }
                    : item.badgeFort
                      ? { background: "var(--color-primary)", color: "#fff" }
                      : { background: "#e9edf4", color: "#3b4452" }
                }
              >
                {item.badge}
              </span>
            )}
          </Link>
        );
      })}
    </nav>
  );
}
