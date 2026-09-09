"use client";

import { useState, useTransition } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Logo } from "@/components/Logo";
import { FieldError } from "@/components/FieldError";

export function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string>();
  const [pending, startTransition] = useTransition();

  const bootstrapMsg = params.get("bootstrap") === "ok";
  const inviteMsg = params.get("invite") === "ok";

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(undefined);
    startTransition(async () => {
      const supabase = createClient();
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) {
        setError("Identifiant ou mot de passe incorrect.");
        return;
      }
      router.push("/");
      router.refresh();
    });
  }

  return (
    <div className="w-full max-w-sm">
      <div className="mb-6 flex justify-center">
        <Logo />
      </div>
      <div
        className="rounded-lg border p-6"
        style={{ background: "var(--color-surface)", borderColor: "var(--color-border)" }}
      >
        <h1 className="mb-1 text-xl font-semibold">Connexion</h1>
        <p className="mb-5 text-sm" style={{ color: "var(--color-muted)" }}>
          Espace réservé aux membres invités d&apos;ArcInnoLab.
        </p>

        {bootstrapMsg && (
          <p className="mb-4 rounded-md bg-green-50 p-3 text-sm text-green-800">
            Compte administrateur créé. Connectez-vous ci-dessous.
          </p>
        )}
        {inviteMsg && (
          <p className="mb-4 rounded-md bg-green-50 p-3 text-sm text-green-800">
            Compte créé avec succès. Connectez-vous ci-dessous.
          </p>
        )}

        <form onSubmit={handleSubmit} noValidate>
          <label htmlFor="email" className="mb-1 block text-sm font-medium">
            Adresse email
          </label>
          <input
            id="email"
            name="email"
            type="email"
            autoComplete="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="mb-4 w-full rounded-md border px-3 py-2"
            style={{ borderColor: "var(--color-border)" }}
          />

          <label htmlFor="password" className="mb-1 block text-sm font-medium">
            Mot de passe
          </label>
          <input
            id="password"
            name="password"
            type="password"
            autoComplete="current-password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="mb-2 w-full rounded-md border px-3 py-2"
            style={{ borderColor: "var(--color-border)" }}
          />

          <FieldError message={error} />

          <button type="submit" disabled={pending} className="btn btn-primary mt-4 w-full">
            {pending ? "Connexion..." : "Se connecter"}
          </button>
        </form>
      </div>
      <p className="mt-4 text-center text-xs" style={{ color: "var(--color-muted)" }}>
        Plateforme fermée — l&apos;accès se fait uniquement par invitation nominative.
      </p>
    </div>
  );
}
