"use client";

import { useActionState } from "react";
import { updateProfilePhoto } from "@/app/actions";
import { FieldError } from "@/components/FieldError";
import { Avatar } from "@/components/Avatar";

export function ProfilPhotoForm({
  nom,
  prenom,
  photoUrl,
}: {
  nom: string;
  prenom: string;
  photoUrl: string | null;
}) {
  const [state, formAction, pending] = useActionState(updateProfilePhoto, {});

  return (
    <form action={formAction} className="flex flex-wrap items-center gap-4" noValidate>
      <Avatar nom={nom} prenom={prenom} photoUrl={photoUrl} size="lg" />
      <div>
        <label htmlFor="photo" className="mb-1 block text-sm font-medium">
          Photo de profil
        </label>
        <input
          id="photo"
          name="photo"
          type="file"
          accept="image/*"
          required
          className="block text-sm"
        />
        <FieldError message={state.error} />
        <button type="submit" disabled={pending} className="btn btn-primary mt-3">
          {pending ? "Envoi..." : "Mettre à jour"}
        </button>
        {state.success && (
          <p className="mt-2 text-sm font-medium" style={{ color: "var(--color-success)" }}>
            Photo mise à jour.
          </p>
        )}
      </div>
    </form>
  );
}
