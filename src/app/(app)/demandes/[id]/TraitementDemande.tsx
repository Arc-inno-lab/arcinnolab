"use client";

import { useActionState } from "react";
import { prendreEnCharge } from "@/app/actions";
import { FieldError } from "@/components/FieldError";

export function BoutonPriseEnCharge({ demandeId }: { demandeId: string }) {
  const [state, action, pending] = useActionState(prendreEnCharge, {});
  return (
    <form action={action}>
      <input type="hidden" name="demande_id" value={demandeId} />
      <button type="submit" disabled={pending} className="btn btn-primary">
        {pending ? "…" : "Je prends en charge"}
      </button>
      <FieldError message={state.error} />
    </form>
  );
}
