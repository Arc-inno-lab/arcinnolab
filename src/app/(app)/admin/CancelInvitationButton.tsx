"use client";

import { useTransition } from "react";
import { cancelInvitation } from "@/app/actions";

export function CancelInvitationButton({ id }: { id: string }) {
  const [pending, startTransition] = useTransition();
  return (
    <button
      type="button"
      disabled={pending}
      onClick={() => startTransition(() => cancelInvitation(id))}
      className="rounded-md border px-2 py-1 text-xs font-medium disabled:opacity-60"
      style={{ borderColor: "var(--color-danger)", color: "var(--color-danger)" }}
    >
      Annuler
    </button>
  );
}
