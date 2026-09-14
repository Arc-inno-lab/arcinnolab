"use client";

import { useActionState, useState } from "react";
import Link from "next/link";
import { deposerDemande } from "@/app/actions";
import { FieldError } from "@/components/FieldError";

const champ = "w-full rounded-md border px-3 py-2";
const bordure = { borderColor: "var(--color-border)" };

/**
 * Écran de confirmation.
 *
 * Il ne se contente pas de dire « c'est enregistré » : il remet au porteur son
 * lien de suivi. C'est ce qui ferme la boucle — sans lui, la personne repart
 * sans aucun moyen de savoir où en est sa demande, ce qui contredit la promesse
 * du manifeste.
 *
 * Le lien est affiché en clair et copiable, pas seulement cliquable : il n'y a
 * pas d'e-mail de confirmation à ce stade, donc ce lien est la seule trace que
 * le porteur emporte. Il doit pouvoir le coller quelque part.
 */
function Confirmation({ suiviUrl }: { suiviUrl?: string }) {
  const [copie, setCopie] = useState(false);

  async function copier() {
    if (!suiviUrl) return;
    try {
      await navigator.clipboard.writeText(suiviUrl);
      setCopie(true);
      setTimeout(() => setCopie(false), 3000);
    } catch {
      // Le presse-papiers peut être refusé (navigateur, permissions) : le lien
      // reste visible et sélectionnable à la main juste au-dessus.
      setCopie(false);
    }
  }

  return (
    <div className="card p-6" role="status">
      <h2 className="mb-2 text-lg font-medium">Votre demande est enregistrée</h2>
      <p className="text-sm">
        Un membre de l&apos;équipe ArcInnoLab la lit et revient vers vous. Nous
        nous engageons à vous répondre, même si votre projet ne relève pas de
        notre périmètre : dans ce cas, nous vous indiquons vers qui vous tourner.
      </p>

      {suiviUrl && (
        <div className="mt-5 rounded-md p-4" style={{ background: "var(--color-surface-alt)" }}>
          <p className="mb-1 text-sm font-medium">Conservez ce lien</p>
          <p className="mb-3 text-sm" style={{ color: "var(--color-muted)" }}>
            Il vous permet de suivre l&apos;avancement de votre demande à tout
            moment, sans créer de compte. C&apos;est le seul moyen d&apos;y
            accéder : notez-le quelque part.
          </p>

          <p
            className="mb-3 overflow-x-auto rounded border p-2 text-xs"
            style={{ borderColor: "var(--color-border)", background: "var(--color-surface)" }}
          >
            <code>{suiviUrl}</code>
          </p>

          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={copier} className="btn btn-outline">
              {copie ? "Lien copié" : "Copier le lien"}
            </button>
            <a href={suiviUrl} className="btn btn-outline">
              Ouvrir le suivi
            </a>
          </div>
        </div>
      )}

      <p className="mt-4 text-sm" style={{ color: "var(--color-muted)" }}>
        Vous n&apos;avez rien d&apos;autre à faire. Inutile de déposer une
        seconde demande.
      </p>

      <Link href="/a-propos" className="btn btn-outline mt-5">
        En savoir plus sur le projet
      </Link>
    </div>
  );
}

export function DemandeForm() {
  const [state, formAction, pending] = useActionState(deposerDemande, {});

  if (state.success) {
    return <Confirmation suiviUrl={state.suiviUrl} />;
  }

  return (
    <form action={formAction} noValidate className="card p-6">
      <fieldset className="border-0 p-0">
        <legend className="mb-3 text-sm font-medium">Vous</legend>

        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <label htmlFor="prenom" className="mb-1 block text-sm font-medium">
              Prénom <span aria-hidden="true">*</span>
            </label>
            <input id="prenom" name="prenom" required className={champ} style={bordure} />
          </div>
          <div>
            <label htmlFor="nom" className="mb-1 block text-sm font-medium">
              Nom <span aria-hidden="true">*</span>
            </label>
            <input id="nom" name="nom" required className={champ} style={bordure} />
          </div>
        </div>

        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <div>
            <label htmlFor="email" className="mb-1 block text-sm font-medium">
              Adresse email <span aria-hidden="true">*</span>
            </label>
            <input
              id="email"
              name="email"
              type="email"
              autoComplete="email"
              required
              className={champ}
              style={bordure}
            />
          </div>
          <div>
            <label htmlFor="telephone" className="mb-1 block text-sm font-medium">
              Téléphone
            </label>
            <input
              id="telephone"
              name="telephone"
              type="tel"
              autoComplete="tel"
              className={champ}
              style={bordure}
            />
          </div>
        </div>

        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <div>
            <label htmlFor="organisation" className="mb-1 block text-sm font-medium">
              Structure
            </label>
            <input
              id="organisation"
              name="organisation"
              placeholder="Entreprise, association, école…"
              className={champ}
              style={bordure}
            />
          </div>
          <div>
            <label htmlFor="pays" className="mb-1 block text-sm font-medium">
              Où se situe votre projet ? <span aria-hidden="true">*</span>
            </label>
            <select id="pays" name="pays" required defaultValue="" className={champ} style={bordure}>
              <option value="" disabled>
                Choisissez…
              </option>
              <option value="france">France</option>
              <option value="suisse">Suisse</option>
            </select>
          </div>
        </div>
      </fieldset>

      <fieldset className="mt-6 border-0 p-0">
        <legend className="mb-3 text-sm font-medium">Votre projet</legend>

        <label htmlFor="titre_projet" className="mb-1 block text-sm font-medium">
          En une phrase <span aria-hidden="true">*</span>
        </label>
        <input
          id="titre_projet"
          name="titre_projet"
          required
          placeholder="Ex. : réemployer les composants électroniques des machines-outils"
          className={champ}
          style={bordure}
        />

        <label htmlFor="description" className="mb-1 mt-4 block text-sm font-medium">
          Racontez-nous <span aria-hidden="true">*</span>
        </label>
        <textarea
          id="description"
          name="description"
          required
          rows={6}
          aria-describedby="description-aide"
          placeholder="Où en êtes-vous, ce que vous cherchez, ce qui vous bloque…"
          className={champ}
          style={bordure}
        />
        <p id="description-aide" className="mt-1 text-xs" style={{ color: "var(--color-muted)" }}>
          Quelques phrases suffisent. Ne cherchez pas à faire un dossier : ce
          texte sert seulement à vous diriger vers la bonne personne.
        </p>
      </fieldset>

      <FieldError message={state.error} />

      <button type="submit" disabled={pending} className="btn btn-primary mt-6 w-full">
        {pending ? "Envoi en cours…" : "Envoyer ma demande"}
      </button>

      <p className="mt-3 text-xs" style={{ color: "var(--color-muted)" }}>
        Les champs marqués d&apos;une astérisque sont obligatoires. Vos
        coordonnées servent uniquement à vous recontacter au sujet de ce projet
        et ne sont transmises à aucun tiers sans votre accord.
      </p>
    </form>
  );
}
