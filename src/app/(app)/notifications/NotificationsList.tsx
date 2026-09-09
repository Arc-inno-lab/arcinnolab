"use client";

import Link from "next/link";
import { useTransition } from "react";
import { markAllNotificationsRead, markNotificationRead } from "@/app/actions";
import type { AppNotification } from "@/lib/types";

export function NotificationsList({ notifications }: { notifications: AppNotification[] }) {
  const [pending, startTransition] = useTransition();
  const nonLues = notifications.filter((n) => !n.lu).length;

  return (
    <div>
      {!!nonLues && (
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm" style={{ color: "var(--color-muted)" }}>
            {nonLues} notification{nonLues > 1 ? "s" : ""} non lue{nonLues > 1 ? "s" : ""}
          </p>
          <button
            type="button"
            disabled={pending}
            onClick={() => startTransition(() => markAllNotificationsRead())}
            className="btn btn-outline"
          >
            Tout marquer comme lu
          </button>
        </div>
      )}

      {!notifications.length ? (
        <p className="text-sm" style={{ color: "var(--color-muted)" }}>
          Aucune notification pour le moment.
        </p>
      ) : (
        <ul className="flex flex-col gap-2">
          {notifications.map((n) => (
            <li
              key={n.id}
              className="rounded-lg border p-3 text-sm"
              style={{
                background: n.lu ? "var(--color-surface)" : "var(--color-bg)",
                borderColor: n.lu ? "var(--color-border)" : "var(--color-primary)",
              }}
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="font-medium">{n.titre}</span>
                {!n.lu && (
                  <button
                    type="button"
                    disabled={pending}
                    onClick={() => startTransition(() => markNotificationRead(n.id))}
                    className="btn btn-outline"
                  >
                    Marquer comme lu
                  </button>
                )}
              </div>
              <div
                className="mt-1 flex flex-wrap items-center gap-2 text-xs"
                style={{ color: "var(--color-muted)" }}
              >
                <span>{new Date(n.created_at).toLocaleString("fr-FR")}</span>
                {n.lien && (
                  <Link href={n.lien} className="underline">
                    Voir le projet
                  </Link>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
