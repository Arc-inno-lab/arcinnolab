"use client";

import { demanderAcces } from "@/app/actions-acces";
import { useEnvoi } from "@/lib/useEnvoi";

export function FormulaireRejoindre({ structures }: { structures: string[] }) {
  const envoi = useEnvoi(demanderAcces, { vider: false });

  if (envoi.succes) {
    return (
      <div role="status">
        <p className="text-[20px] font-bold" style={{ color: "var(--color-success)" }}>
          Demande envoyée, merci !
        </p>
        <p className="mt-2">
          L&apos;équipe ArcInnoLab la vérifie. Vous recevrez un e-mail avec votre lien d&apos;accès dès qu&apos;elle sera
          validée. Pensez à regarder dans vos courriers indésirables.
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={envoi.onSubmit} className="flex flex-col gap-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="rj-prenom" className="mb-1 block font-semibold">
            Prénom
          </label>
          <input id="rj-prenom" name="prenom" required maxLength={80} autoComplete="given-name" className="champ-grand" />
        </div>
        <div>
          <label htmlFor="rj-nom" className="mb-1 block font-semibold">
            Nom
          </label>
          <input id="rj-nom" name="nom" required maxLength={80} autoComplete="family-name" className="champ-grand" />
        </div>
      </div>
      <div>
        <label htmlFor="rj-email" className="mb-1 block font-semibold">
          E-mail professionnel
        </label>
        <input id="rj-email" name="email" type="email" required maxLength={200} autoComplete="email" className="champ-grand" />
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="rj-orga" className="mb-1 block font-semibold">
            Structure
          </label>
          <input id="rj-orga" name="organisation" list="rj-structures" maxLength={160} autoComplete="organization" className="champ-grand" />
          <datalist id="rj-structures">
            {structures.map((s) => (
              <option key={s} value={s} />
            ))}
          </datalist>
        </div>
        <div>
          <label htmlFor="rj-fonction" className="mb-1 block font-semibold">
            Fonction <span className="font-normal" style={{ color: "var(--color-muted)" }}>(facultatif)</span>
          </label>
          <input id="rj-fonction" name="fonction" maxLength={160} autoComplete="organization-title" className="champ-grand" />
        </div>
      </div>
      <fieldset>
        <legend className="mb-2 font-semibold">Vous êtes…</legend>
        <label className="mb-2 flex items-start gap-3">
          <input type="radio" name="role" value="partenaire" defaultChecked className="shrink-0" style={{ width: 20, height: 20, minHeight: 0, marginTop: 3 }} />
          <span>Membre d&apos;une structure partenaire (accueil des demandes, accompagnement, votes)</span>
        </label>
        <label className="flex items-start gap-3">
          <input type="radio" name="role" value="porteur" className="shrink-0" style={{ width: 20, height: 20, minHeight: 0, marginTop: 3 }} />
          <span>Porteur d&apos;un projet déjà accompagné par ArcInnoLab</span>
        </label>
      </fieldset>
      <div>
        <label htmlFor="rj-message" className="mb-1 block font-semibold">
          Un mot pour l&apos;équipe <span className="font-normal" style={{ color: "var(--color-muted)" }}>(facultatif)</span>
        </label>
        <textarea id="rj-message" name="message" rows={3} maxLength={1000} className="champ-grand" />
      </div>
      <label className="flex items-start gap-3 text-[15px]">
        <input type="checkbox" name="consentement" required className="shrink-0" style={{ width: 20, height: 20, minHeight: 0, marginTop: 2 }} />
        <span>
          J&apos;accepte que ces informations servent uniquement à traiter ma demande d&apos;accès à la plateforme ArcInnoLab.
        </span>
      </label>
      {envoi.erreur && (
        <p role="alert" className="font-semibold" style={{ color: "var(--color-danger)" }}>
          {envoi.erreur}
        </p>
      )}
      <button type="submit" disabled={envoi.pending} className="btn btn-primary btn-grand">
        {envoi.pending ? "Envoi…" : "Envoyer ma demande d'accès"}
      </button>
    </form>
  );
}
