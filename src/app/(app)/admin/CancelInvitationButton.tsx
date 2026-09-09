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
      className="btn btn-danger"
    >
      Annuler
    </button>
  );
}
