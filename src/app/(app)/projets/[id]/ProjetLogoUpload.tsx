"use client";

import { useRef, useTransition } from "react";
import { updateProjetLogo } from "@/app/actions";
import { TAILLE_MAX_DOCUMENT } from "@/lib/useEnvoi";

/**
 * Le logo du projet, qui sert lui-même de bouton : on clique dessus pour le
 * changer. Un champ « Choisir un fichier » à côté du titre encombrait l'en-tête
 * pour un geste que l'on fait une fois.
 */
export function ProjetLogoUpload({
  projetId,
  logoUrl,
  titre,
  modifiable,
  taille = 64,
}: {
  projetId: string;
  logoUrl: string | null;
  titre: string;
  modifiable: boolean;
  taille?: number;
}) {
  const [pending, startTransition] = useTransition();
  const formRef = useRef<HTMLFormElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const vignette = (
    <span
      className="relative flex shrink-0 items-center justify-center overflow-hidden rounded-2xl border"
      style={{
        width: taille,
        height: taille,
        borderColor: "var(--color-border)",
        borderStyle: logoUrl ? "solid" : "dashed",
        background: "var(--color-primary-soft)",
        opacity: pending ? 0.5 : 1,
      }}
    >
      {logoUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={logoUrl} alt="" className="h-full w-full object-cover" />
      ) : (
        <span className="text-2xl font-bold" style={{ color: "var(--color-primary)" }} aria-hidden="true">
          {titre.charAt(0).toUpperCase()}
        </span>
      )}
    </span>
  );

  if (!modifiable) return vignette;

  return (
    <form ref={formRef} action={(fd) => startTransition(() => updateProjetLogo(projetId, fd))} className="relative shrink-0">
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        disabled={pending}
        aria-label={logoUrl ? "Changer le logo du projet" : "Ajouter un logo au projet"}
        title={logoUrl ? "Changer le logo" : "Ajouter un logo"}
        className="relative block rounded-2xl"
        style={{ minHeight: 0, padding: 0 }}
      >
        {vignette}
        <span
          className="absolute -bottom-1 -right-1 flex h-6 w-6 items-center justify-center rounded-full border"
          style={{ background: "var(--color-surface)", borderColor: "var(--color-border)", color: "var(--color-primary)" }}
          aria-hidden="true"
        >
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M4 20h4L19 9l-4-4L4 16v4Z" />
          </svg>
        </span>
      </button>
      <input
        ref={inputRef}
        name="logo"
        type="file"
        accept="image/*"
        className="sr-only"
        tabIndex={-1}
        aria-hidden="true"
        onChange={(e) => {
          const f = e.currentTarget.files?.[0];
          if (f && f.size > TAILLE_MAX_DOCUMENT) {
            e.currentTarget.value = "";
            window.alert?.("Cette image dépasse 4 Mo : choisissez une version plus légère.");
            return;
          }
          formRef.current?.requestSubmit();
        }}
      />
    </form>
  );
}
