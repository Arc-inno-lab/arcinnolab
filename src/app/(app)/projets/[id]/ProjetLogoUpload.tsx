"use client";

import { useRef, useTransition } from "react";
import { updateProjetLogo } from "@/app/actions";

export function ProjetLogoUpload({ projetId, logoUrl, titre }: { projetId: string; logoUrl: string | null; titre: string }) {
  const [pending, startTransition] = useTransition();
  const formRef = useRef<HTMLFormElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  return (
    <form
      ref={formRef}
      action={(formData) => startTransition(() => updateProjetLogo(projetId, formData))}
      className="flex items-center gap-3"
    >
      <span
        className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-xl border"
        style={{ borderColor: "var(--color-border)", background: "var(--color-surface-alt)" }}
      >
        {logoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={logoUrl} alt="" className="h-full w-full object-cover" />
        ) : (
          <span className="text-lg font-bold" style={{ color: "var(--color-muted)" }} aria-hidden="true">
            {titre.charAt(0).toUpperCase()}
          </span>
        )}
      </span>
      <div>
        <label htmlFor="logo" className="mb-1 block text-xs font-medium" style={{ color: "var(--color-muted)" }}>
          Logo du projet
        </label>
        <input
          id="logo"
          ref={inputRef}
          name="logo"
          type="file"
          accept="image/*"
          disabled={pending}
          onChange={() => formRef.current?.requestSubmit()}
          className="block text-xs"
        />
      </div>
    </form>
  );
}
