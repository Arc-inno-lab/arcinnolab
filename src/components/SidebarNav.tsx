"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export type NavItem = { href: string; label: string };

export function SidebarNav({ items }: { items: NavItem[] }) {
  const pathname = usePathname();

  return (
    <nav
      aria-label="Navigation principale"
      className="flex gap-1 overflow-x-auto px-2 py-2 md:flex-col md:overflow-visible md:px-3 md:py-4"
    >
      {items.map((item) => {
        const active = item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={active ? "page" : undefined}
            className="whitespace-nowrap rounded-md px-3 py-2 text-sm font-medium"
            style={
              active
                ? { background: "var(--color-primary)", color: "#fff" }
                : { color: "var(--color-text)" }
            }
          >
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
