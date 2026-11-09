"use client";

import { useState, useTransition } from "react";
import QRCode from "qrcode";
import { importerDemandesAcces, refuserDemandesAcces, validerDemandesAcces } from "@/app/actions-acces";
import { useEnvoi } from "@/lib/useEnvoi";

export type DemandeAcces = {
  id: string;
  prenom: string;
  nom: string;
  email: string;
  organisation: string | null;
  fonction: string | null;
  role_souhaite: "partenaire" | "porteur";
  message: string | null;
  source: "formulaire" | "import";
  statut: "en_attente" | "validee" | "refusee";
  role_attribue: string | null;
  created_at: string;
  traite_le: string | null;
};

function jour(iso: string) {
  return new Date(iso).toLocaleDateString("fr-FR", { timeZone: "Europe/Paris", day: "numeric", month: "short" });
}

/**
 * Les demandes d'accès à valider. L'administrateur coche, choisit le rôle de
 * chacun, valide : seules ces validations créent des invitations (envoyées par
 * e-mail). Rien ne se crée tout seul.
 */
export function DemandesAcces({
  enAttente,
  traitees,
  lienFormulaire,
}: {
  enAttente: DemandeAcces[];
  traitees: DemandeAcces[];
  lienFormulaire: string;
}) {
  const [coches, setCoches] = useState<Set<string>>(new Set());
  const [roles, setRoles] = useState<Record<string, string>>(Object.fromEntries(enAttente.map((d) => [d.id, d.role_souhaite])));
  const [retour, setRetour] = useState<{ ok: boolean; texte: string }>();
  const [pending, startTransition] = useTransition();
  const [copie, setCopie] = useState(false);
  const imp = useEnvoi(importerDemandesAcces);

  const tout = enAttente.length > 0 && coches.size === enAttente.length;
  const basculer = (id: string) =>
    setCoches((c) => {
      const n = new Set(c);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });

  function agir(geste: "valider" | "refuser") {
    const ids = enAttente.filter((d) => coches.has(d.id)).map((d) => d.id);
    startTransition(async () => {
      const r =
        geste === "valider" ? await validerDemandesAcces(ids, ids.map((id) => roles[id] ?? "partenaire")) : await refuserDemandesAcces(ids);
      setRetour(r.error ? { ok: false, texte: r.error } : { ok: true, texte: r.message ?? "Fait." });
      if (!r.error) setCoches(new Set());
    });
  }

  async function copier() {
    try {
      await navigator.clipboard.writeText(lienFormulaire);
      setCopie(true);
      setTimeout(() => setCopie(false), 2500);
    } catch {
      setCopie(false);
    }
  }

  async function qr() {
    const url = await QRCode.toDataURL(lienFormulaire, { width: 1024, margin: 2, color: { dark: "#183d7a", light: "#ffffff" } });
    const a = document.createElement("a");
    a.href = url;
    a.download = "qr-rejoindre-arcinnolab.png";
    a.click();
  }

  return (
    <section id="acces" aria-labelledby="acces-heading" className="mb-10 scroll-mt-6">
      <h2 id="acces-heading" className="mb-1 text-lg font-medium">
        Demandes d&apos;accès {enAttente.length > 0 && `(${enAttente.length} en attente)`}
      </h2>
      <p className="mb-3 text-sm" style={{ color: "var(--color-muted)" }}>
        Envoyez le lien du formulaire aux partenaires, ou importez une liste. Rien n&apos;est créé tant que vous n&apos;avez pas
        validé : à la validation, chaque personne reçoit par e-mail son lien pour créer son accès.
      </p>

      <div className="card mb-4 flex flex-wrap items-center gap-3 px-4 py-3">
        <div className="min-w-0 flex-1">
          <p className="text-xs font-semibold" style={{ color: "var(--color-muted)" }}>
            Formulaire « Rejoindre ArcInnoLab » à envoyer
          </p>
          <p className="truncate text-sm font-medium">{lienFormulaire.replace(/^https?:\/\//, "")}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={copier} className="btn btn-primary text-xs" style={{ minHeight: 36 }}>
            {copie ? "Lien copié" : "Copier"}
          </button>
          <button type="button" onClick={qr} className="btn btn-outline text-xs" style={{ minHeight: 36 }}>
            QR code
          </button>
          <a href="/modele-comptes-arcinnolab.csv" download className="btn btn-outline text-xs" style={{ minHeight: 36 }}>
            Modèle CSV
          </a>
        </div>
      </div>

      {enAttente.length === 0 ? (
        <p className="card px-4 py-3 text-sm" style={{ color: "var(--color-muted)" }}>
          Aucune demande d&apos;accès en attente.
        </p>
      ) : (
        <>
          <div className="overflow-x-auto rounded-lg border" style={{ borderColor: "var(--color-border)" }}>
            <table className="w-full text-sm">
              <caption className="sr-only">Demandes d&apos;accès en attente</caption>
              <thead>
                <tr className="border-b text-left" style={{ borderColor: "var(--color-border)", background: "var(--color-bg)" }}>
                  <th scope="col" className="px-3 py-2">
                    <input
                      type="checkbox"
                      aria-label="Tout cocher"
                      checked={tout}
                      onChange={() => setCoches(tout ? new Set() : new Set(enAttente.map((d) => d.id)))}
                      style={{ width: 18, height: 18, minHeight: 0 }}
                    />
                  </th>
                  <th scope="col" className="px-3 py-2 font-medium">Personne</th>
                  <th scope="col" className="px-3 py-2 font-medium">Structure</th>
                  <th scope="col" className="px-3 py-2 font-medium">Rôle à attribuer</th>
                  <th scope="col" className="px-3 py-2 font-medium">Reçue</th>
                </tr>
              </thead>
              <tbody>
                {enAttente.map((d) => (
                  <tr key={d.id} className="border-b align-top last:border-0" style={{ borderColor: "var(--color-border)" }}>
                    <td className="px-3 py-2">
                      <input
                        type="checkbox"
                        aria-label={`Sélectionner ${d.prenom} ${d.nom}`}
                        checked={coches.has(d.id)}
                        onChange={() => basculer(d.id)}
                        style={{ width: 18, height: 18, minHeight: 0 }}
                      />
                    </td>
                    <td className="px-3 py-2">
                      <p className="font-semibold">
                        {d.prenom} {d.nom}
                      </p>
                      <p style={{ color: "var(--color-muted)" }}>{d.email}</p>
                      {d.message && <p className="mt-1 whitespace-pre-wrap text-xs">« {d.message} »</p>}
                    </td>
                    <td className="px-3 py-2">
                      {d.organisation ?? "—"}
                      {d.fonction && <p className="text-xs" style={{ color: "var(--color-muted)" }}>{d.fonction}</p>}
                    </td>
                    <td className="px-3 py-2">
                      <label className="sr-only" htmlFor={`role-${d.id}`}>
                        Rôle de {d.prenom} {d.nom}
                      </label>
                      <select
                        id={`role-${d.id}`}
                        value={roles[d.id] ?? d.role_souhaite}
                        onChange={(e) => setRoles((r) => ({ ...r, [d.id]: e.target.value }))}
                        className="rounded-md border px-2 py-1"
                        style={{ borderColor: "var(--color-border)" }}
                      >
                        <option value="partenaire">Partenaire</option>
                        <option value="porteur">Porteur de projet</option>
                      </select>
                      {roles[d.id] !== d.role_souhaite && (
                        <p className="text-xs" style={{ color: "var(--color-muted)" }}>
                          demandé : {d.role_souhaite}
                        </p>
                      )}
                    </td>
                    <td className="px-3 py-2 text-xs" style={{ color: "var(--color-muted)" }}>
                      {jour(d.created_at)}
                      <br />
                      {d.source === "import" ? "import" : "formulaire"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <button type="button" disabled={pending || coches.size === 0} onClick={() => agir("valider")} className="btn btn-primary">
              {pending ? "…" : `Valider et envoyer les invitations (${coches.size})`}
            </button>
            <button type="button" disabled={pending || coches.size === 0} onClick={() => agir("refuser")} className="btn btn-outline">
              Refuser
            </button>
            <p className="text-xs" style={{ color: "var(--color-muted)" }}>
              Le rôle administrateur ne s&apos;attribue pas ici : passez par la gestion des comptes.
            </p>
          </div>
        </>
      )}
      {retour && (
        <p role="status" className="mt-2 text-sm font-semibold" style={{ color: retour.ok ? "var(--color-success)" : "var(--color-danger)" }}>
          {retour.texte}
        </p>
      )}

      <details className="card mt-4 p-4">
        <summary className="cursor-pointer text-sm font-semibold">Importer une liste (Excel ou CSV)</summary>
        <p className="mt-2 text-sm" style={{ color: "var(--color-muted)" }}>
          Remplissez le modèle (prénom ; nom ; e-mail ; structure ; fonction ; rôle), puis copiez les lignes depuis Excel et
          collez-les ici. Chaque ligne devient une demande à valider ci-dessus, pas un compte.
        </p>
        <form onSubmit={imp.onSubmit} className="mt-3 flex flex-col gap-2">
          <label htmlFor="liste-import" className="sr-only">
            Liste à importer
          </label>
          <textarea
            id="liste-import"
            name="liste"
            rows={6}
            placeholder={"Marie;Exemple;marie@structure.ch;Haute École Arc;Chargée d'innovation;partenaire"}
            className="w-full rounded-md border px-3 py-2 font-mono text-xs"
            style={{ borderColor: "var(--color-border)" }}
          />
          {imp.erreur && (
            <p role="alert" className="text-sm font-semibold" style={{ color: "var(--color-danger)" }}>
              {imp.erreur}
            </p>
          )}
          {imp.succes && (
            <p role="status" className="text-sm font-semibold" style={{ color: "var(--color-success)" }}>
              Import terminé : la liste est à valider ci-dessus.
            </p>
          )}
          <div>
            <button type="submit" disabled={imp.pending} className="btn btn-outline">
              {imp.pending ? "Import…" : "Importer pour validation"}
            </button>
          </div>
        </form>
      </details>

      {traitees.length > 0 && (
        <details className="mt-3">
          <summary className="cursor-pointer text-sm" style={{ color: "var(--color-muted)" }}>
            Dernières demandes traitées ({traitees.length})
          </summary>
          <ul className="mt-2 flex flex-col gap-1 text-sm">
            {traitees.map((d) => (
              <li key={d.id}>
                {d.prenom} {d.nom} · {d.email} ·{" "}
                <strong style={{ color: d.statut === "validee" ? "var(--color-success)" : "var(--color-muted)" }}>
                  {d.statut === "validee" ? `invitée (${d.role_attribue})` : "refusée"}
                </strong>
                {d.traite_le ? ` · ${jour(d.traite_le)}` : ""}
              </li>
            ))}
          </ul>
        </details>
      )}
    </section>
  );
}
