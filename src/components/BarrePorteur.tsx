"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

/**
 * La barre d'onglets du porteur sur téléphone : trois gros boutons en bas de
 * l'écran, là où le pouce va sans réfléchir. Pas de menu à déplier — ceux
 * qui ne vivent pas dans les applications ne le trouvent pas.
 */
export function BarrePorteur() {
  const pathname = usePathname();
  const onglets = [
    {
      href: "/mon-projet",
      label: "Mon projet",
      actif: pathname === "/mon-projet",
      icone: (
        <>
          <path d="M3 11 12 4l9 7" />
          <path d="M5 10v10h14V10" />
        </>
      ),
    },
    {
      href: "/mon-projet/messages",
      label: "Messages",
      actif: pathname.startsWith("/mon-projet/messages"),
      icone: <path d="M21 12a8 8 0 0 1-11.6 7.1L4 20l1-4.6A8 8 0 1 1 21 12Z" />,
    },
    {
      href: "/profil",
      label: "Mon compte",
      actif: pathname.startsWith("/profil"),
      icone: (
        <>
          <circle cx="12" cy="8" r="4" />
          <path d="M4 21a8 8 0 0 1 16 0" />
        </>
      ),
    },
  ];

  return (
    <nav
      aria-label="Navigation"
      className="fixed inset-x-0 bottom-0 z-40 flex border-t px-2 pt-2 md:hidden"
      style={{
        background: "var(--color-surface)",
        borderColor: "var(--color-border)",
        paddingBottom: "calc(env(safe-area-inset-bottom, 0px) + 10px)",
      }}
    >
      {onglets.map((o) => (
        <Link
          key={o.href}
          href={o.href}
          aria-current={o.actif ? "page" : undefined}
          className="flex flex-1 flex-col items-center gap-1 py-1 text-[13px]"
          style={{ color: o.actif ? "var(--color-primary)" : "#3b4452", fontWeight: o.actif ? 700 : 500 }}
        >
          <svg
            width="24"
            height="24"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            {o.icone}
          </svg>
          {o.label}
        </Link>
      ))}
    </nav>
  );
}
