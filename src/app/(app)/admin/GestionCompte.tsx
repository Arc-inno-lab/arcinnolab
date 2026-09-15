"use client";

import { useActionState, useState } from "react";
import { changerRole, creerLienReinitialisation } from "@/app/actions";
import type { Profile } from "@/lib/types";

/**
 * Les deux seules opérations dont un administrateur a réellement besoin sur un
 * compte : corriger un rôle, et débloquer quelqu'un qui ne peut plus se
 * connecter.
 *
 * Le lien de réinitialisation est affiché ici plutôt qu'envoyé par e-mail :
 * tant que la plateforme n'a pas de service d'envoi, un mot de passe oublié
 * serait sans issue. L'administrateur le transmet par le moyen de son choix ;
 * il ne voit jamais le mot de passe choisi.
 */
export function GestionCompte({ profil, estMoi }: { profil: Profile; estMoi: boolean }) {
  const [etatRole, actionRole, roleEnCours] = useActionState(changerRole, {});
  const [etatLien, actionLien, lienEnCours] = useActionState(creerLienReinitialisation, {});
  const [copie, setCopie] = useState(false);

  async function copier(lien: string) {
    try {
      await navigator.clipboard.writeText(lien);
      setCopie(true);
      setTimeout(() => setCopie(false), 3000);
    } catch {
      setCopie(false);
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center gap-2">
        <form action={actionRole} className="flex items-center gap-2">
          <input type="hidden" name="user_id" value={profil.id} />
          <label htmlFor={`role-${profil.id}`} className="sr-only">
            Rôle de {profil.prenom} {profil.nom}
          </label>
          <select
            id={`role-${profil.id}`}
            name="role"
            defaultValue={profil.role}
            disabled={estMoi}
            className="rounded-md border px-2 py-1 text-sm"
            style={{ borderColor: "var(--color-border)" }}
          >
            <option value="admin">Administrateur</option>
            <option value="partenaire">Partenaire</option>
            <option value="porteur">Porteur</option>
          </select>
          <button
            type="submit"
            disabled={roleEnCours || estMoi}
            className="btn btn-outline text-xs"
          >
            {roleEnCours ? "…" : "Appliquer"}
          </button>
        </form>

        <form action={actionLien}>
          <input type="hidden" name="user_id" value={profil.id} />
          <button type="submit" disabled={lienEnCours} className="btn btn-outline text-xs">
            {lienEnCours ? "…" : "Lien de connexion"}
          </button>
        </form>
      </div>

      {estMoi && (
        <p className="text-xs" style={{ color: "var(--color-muted)" }}>
          Vous ne pouvez pas modifier votre propre rôle : c&apos;est ce qui
          empêche de se retirer les droits par mégarde et de laisser la
          plateforme sans administrateur.
        </p>
      )}

      {etatRole.error && (
        <p className="text-xs" style={{ color: "var(--color-danger)" }}>
          {etatRole.error}
        </p>
      )}
      {etatRole.success && (
        <p className="text-xs" style={{ color: "var(--color-success)" }} role="status">
          Rôle modifié.
        </p>
      )}
      {etatLien.error && (
        <p className="text-xs" style={{ color: "var(--color-danger)" }}>
          {etatLien.error}
        </p>
      )}

      {etatLien.inviteUrl && (
        <div className="rounded-md p-2" style={{ background: "var(--color-surface-alt)" }}>
          <p className="mb-1 text-xs" style={{ color: "var(--color-muted)" }}>
            À transmettre à {profil.prenom}. Valable une seule fois.
          </p>
          <p className="mb-1 overflow-x-auto text-xs">
            <code>{etatLien.inviteUrl}</code>
          </p>
          <button
            type="button"
            onClick={() => copier(etatLien.inviteUrl!)}
            className="btn btn-outline text-xs"
          >
            {copie ? "Copié" : "Copier"}
          </button>
        </div>
      )}
    </div>
  );
}
