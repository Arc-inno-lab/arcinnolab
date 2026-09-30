"use client";

import { useActionState, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { deposerDemande } from "@/app/actions";
import { FieldError } from "@/components/FieldError";

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

const ETAPES_FORM = ["Vous", "Votre projet", "Envoi"];

/**
 * Le dépôt en trois écrans courts plutôt qu'un long formulaire : on ne
 * demande qu'une chose à la fois, et l'on voit où l'on en est. Tous les champs
 * restent dans la page (les écrans inactifs sont seulement masqués), si bien
 * qu'un retour en arrière ne perd rien.
 */
export function DemandeForm() {
  const [state, formAction, pending] = useActionState(deposerDemande, {});
  const [, startTransition] = useTransition();
  const [etape, setEtape] = useState(0);
  const [recap, setRecap] = useState<Record<string, string>>({});
  const formRef = useRef<HTMLFormElement>(null);
  const ecransRef = useRef<(HTMLFieldSetElement | null)[]>([]);

  if (state.success) {
    return <Confirmation suiviUrl={state.suiviUrl} />;
  }

  /** Vérifie les champs de l'écran courant ; le navigateur signale le premier manquant. */
  function ecranValide(i: number) {
    const ecran = ecransRef.current[i];
    if (!ecran) return true;
    const champs = Array.from(ecran.querySelectorAll<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>("input, select, textarea"));
    return champs.every((c) => c.reportValidity());
  }

  function suivant() {
    if (!ecranValide(etape)) return;
    if (etape === 1 && formRef.current) {
      const fd = new FormData(formRef.current);
      setRecap(Object.fromEntries(Array.from(fd.entries()).map(([k, v]) => [k, String(v)])));
    }
    setEtape((e) => Math.min(e + 1, 2));
    document.getElementById("deposer")?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  function envoyer(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (etape < 2) return suivant();
    const fd = new FormData(e.currentTarget);
    // Appel manuel plutôt que <form action> : React viderait sinon le
    // formulaire après l'envoi, même en cas d'erreur, et tout serait à
    // ressaisir.
    startTransition(() => formAction(fd));
  }

  return (
    <form ref={formRef} onSubmit={envoyer} noValidate className="card p-5 text-[17px] md:p-6">
      <ol className="mb-5 grid grid-cols-3 gap-2" aria-label="Étapes du dépôt">
        {ETAPES_FORM.map((libelle, i) => (
          <li key={libelle} aria-current={i === etape ? "step" : undefined}>
            <span
              className="mb-1.5 block h-1.5 rounded-full"
              style={{ background: i < etape ? "var(--color-success)" : i === etape ? "var(--color-primary)" : "#dfe4ec" }}
            />
            <span className="text-[14px]" style={{ color: i === etape ? "var(--color-primary)" : "var(--color-muted)", fontWeight: i === etape ? 700 : 500 }}>
              {i + 1}. {libelle}
            </span>
          </li>
        ))}
      </ol>

      <fieldset ref={(el) => { ecransRef.current[0] = el; }} hidden={etape !== 0} className="border-0 p-0">
        <legend className="mb-4 text-[20px] font-bold">Qui êtes-vous ?</legend>

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label htmlFor="prenom" className="mb-1 block font-semibold">
              Prénom
            </label>
            <input id="prenom" name="prenom" required autoComplete="given-name" className="champ-grand" />
          </div>
          <div>
            <label htmlFor="nom" className="mb-1 block font-semibold">
              Nom
            </label>
            <input id="nom" name="nom" required autoComplete="family-name" className="champ-grand" />
          </div>
          <div>
            <label htmlFor="email" className="mb-1 block font-semibold">
              Adresse e-mail
            </label>
            <input id="email" name="email" type="email" autoComplete="email" required className="champ-grand" />
          </div>
          <div>
            <label htmlFor="telephone" className="mb-1 block font-semibold">
              Téléphone <span className="font-normal" style={{ color: "var(--color-muted)" }}>(facultatif)</span>
            </label>
            <input id="telephone" name="telephone" type="tel" autoComplete="tel" className="champ-grand" />
          </div>
          <div>
            <label htmlFor="organisation" className="mb-1 block font-semibold">
              Structure <span className="font-normal" style={{ color: "var(--color-muted)" }}>(facultatif)</span>
            </label>
            <input id="organisation" name="organisation" placeholder="Entreprise, association, école…" className="champ-grand" />
          </div>
          <div>
            <label htmlFor="pays" className="mb-1 block font-semibold">
              Où se situe votre projet ?
            </label>
            <select id="pays" name="pays" required defaultValue="" className="champ-grand">
              <option value="" disabled>
                Choisissez…
              </option>
              <option value="france">France</option>
              <option value="suisse">Suisse</option>
            </select>
          </div>
        </div>
      </fieldset>

      <fieldset ref={(el) => { ecransRef.current[1] = el; }} hidden={etape !== 1} className="border-0 p-0">
        <legend className="mb-4 text-[20px] font-bold">Votre projet</legend>

        <label htmlFor="titre_projet" className="mb-1 block font-semibold">
          En une phrase
        </label>
        <input
          id="titre_projet"
          name="titre_projet"
          required
          placeholder="Ex. : réemployer les composants électroniques des machines-outils"
          className="champ-grand"
        />

        <label htmlFor="description" className="mb-1 mt-4 block font-semibold">
          Racontez-nous
        </label>
        <textarea
          id="description"
          name="description"
          required
          rows={6}
          aria-describedby="description-aide"
          placeholder="Où en êtes-vous, ce que vous cherchez, ce qui vous bloque…"
          className="champ-grand"
        />
        <p id="description-aide" className="mt-1 text-[15px]" style={{ color: "var(--color-muted)" }}>
          Quelques phrases suffisent. Ce n&apos;est pas un dossier : ce texte sert à vous orienter vers la bonne personne.
        </p>
      </fieldset>

      <fieldset ref={(el) => { ecransRef.current[2] = el; }} hidden={etape !== 2} className="border-0 p-0">
        <legend className="mb-4 text-[20px] font-bold">Tout est bon ?</legend>
        <dl className="flex flex-col gap-3 rounded-xl p-4" style={{ background: "var(--color-surface-alt)" }}>
          <div>
            <dt className="text-[14px]" style={{ color: "var(--color-muted)" }}>Vous</dt>
            <dd>
              {recap.prenom} {recap.nom} · {recap.email}
              {recap.organisation ? ` · ${recap.organisation}` : ""}
            </dd>
          </div>
          <div>
            <dt className="text-[14px]" style={{ color: "var(--color-muted)" }}>Votre projet</dt>
            <dd className="font-semibold">{recap.titre_projet}</dd>
            <dd className="mt-1 line-clamp-4 whitespace-pre-wrap text-[15px]">{recap.description}</dd>
          </div>
        </dl>
        <p className="mt-4 text-[15px]" style={{ color: "var(--color-muted)" }}>
          Vos coordonnées servent uniquement à vous recontacter au sujet de ce projet. Elles ne sont transmises à personne
          sans votre accord.
        </p>
      </fieldset>

      <FieldError message={state.error} />

      <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-between">
        {etape > 0 ? (
          <button type="button" onClick={() => setEtape((e) => e - 1)} className="btn btn-outline btn-grand">
            Retour
          </button>
        ) : (
          <span />
        )}
        {etape < 2 ? (
          <button type="button" onClick={suivant} className="btn btn-primary btn-grand sm:min-w-[12rem]">
            Continuer
          </button>
        ) : (
          <button type="submit" disabled={pending} className="btn btn-primary btn-grand sm:min-w-[12rem]">
            {pending ? "Envoi en cours…" : "Envoyer ma demande"}
          </button>
        )}
      </div>
    </form>
  );
}
