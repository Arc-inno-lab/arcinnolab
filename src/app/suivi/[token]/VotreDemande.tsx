"use client";

import { useRef, useState, useTransition } from "react";
import { createClient } from "@/lib/supabase/client";
import { enregistrerDocumentSuivi, modifierDemandeSuivi, retirerDocumentSuivi } from "@/app/actions-suivi";
import { useEnvoi } from "@/lib/useEnvoi";

export type DemandePorteur = {
  titre_projet: string;
  description: string;
  organisation: string | null;
  telephone: string | null;
  modifiable: boolean;
  documents_permis: boolean;
};

export type DocumentPorteur = {
  id: string;
  nom: string;
  taille: number;
  quand: string;
};

const TAILLE_MAX = 10 * 1024 * 1024;

/** Le type de fichier, d'après son extension quand le navigateur ne le dit pas. */
const TYPES: Record<string, string> = {
  pdf: "application/pdf",
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  webp: "image/webp",
  txt: "text/plain",
  doc: "application/msword",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  xls: "application/vnd.ms-excel",
  xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  ppt: "application/vnd.ms-powerpoint",
  pptx: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  odt: "application/vnd.oasis.opendocument.text",
  ods: "application/vnd.oasis.opendocument.spreadsheet",
  odp: "application/vnd.oasis.opendocument.presentation",
};

function tailleLisible(octets: number) {
  return octets >= 1024 * 1024 ? `${(octets / 1024 / 1024).toFixed(1).replace(".", ",")} Mo` : `${Math.max(1, Math.round(octets / 1024))} Ko`;
}

/**
 * Ce que le porteur a envoyé, relu et complété par lui-même : il corrige sa
 * description tant que sa demande n'est pas à l'étude, et joint ses documents
 * (présentation, plan d'affaires, photos du prototype…).
 */
export function VotreDemande({
  token,
  demande,
  documents,
  interlocuteur,
}: {
  token: string;
  demande: DemandePorteur;
  documents: DocumentPorteur[];
  interlocuteur: string | null;
}) {
  const [edition, setEdition] = useState(false);
  const envoi = useEnvoi(modifierDemandeSuivi, { vider: false, onSucces: () => setEdition(false) });

  return (
    <section id="ma-demande" className="card mb-6 scroll-mt-6 p-5" aria-labelledby="ma-demande-titre">
      <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
        <h2 id="ma-demande-titre" className="text-[20px] font-bold">
          Votre demande
        </h2>
        {envoi.succes && !edition && (
          <p role="status" className="text-[15px] font-semibold" style={{ color: "var(--color-success)" }}>
            Modifications enregistrées
          </p>
        )}
      </div>

      {edition ? (
        <form onSubmit={envoi.onSubmit} className="flex flex-col gap-4">
          <input type="hidden" name="token" value={token} />
          <div>
            <label htmlFor="md-titre" className="mb-1 block font-semibold">
              Le nom de votre projet
            </label>
            <input id="md-titre" name="titre_projet" required minLength={3} maxLength={200} defaultValue={demande.titre_projet} className="champ-grand" />
          </div>
          <div>
            <label htmlFor="md-description" className="mb-1 block font-semibold">
              Votre projet, vos besoins
            </label>
            <textarea
              id="md-description"
              name="description"
              required
              minLength={40}
              maxLength={8000}
              rows={8}
              defaultValue={demande.description}
              className="champ-grand"
            />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="md-organisation" className="mb-1 block font-semibold">
                Votre structure <span className="font-normal" style={{ color: "var(--color-muted)" }}>(facultatif)</span>
              </label>
              <input id="md-organisation" name="organisation" maxLength={200} defaultValue={demande.organisation ?? ""} className="champ-grand" />
            </div>
            <div>
              <label htmlFor="md-telephone" className="mb-1 block font-semibold">
                Votre téléphone <span className="font-normal" style={{ color: "var(--color-muted)" }}>(facultatif)</span>
              </label>
              <input id="md-telephone" name="telephone" type="tel" maxLength={40} defaultValue={demande.telephone ?? ""} className="champ-grand" />
            </div>
          </div>
          {envoi.erreur && (
            <p role="alert" className="text-[15px] font-semibold" style={{ color: "var(--color-danger)" }}>
              {envoi.erreur}
            </p>
          )}
          <p className="text-[15px]" style={{ color: "var(--color-muted)" }}>
            {interlocuteur ?? "L'équipe"} sera prévenu{interlocuteur ? "" : "e"} de vos modifications.
          </p>
          <div className="flex flex-col gap-2 sm:flex-row">
            <button type="submit" disabled={envoi.pending} className="btn btn-primary btn-grand sm:flex-1">
              {envoi.pending ? "Enregistrement…" : "Enregistrer"}
            </button>
            <button
              type="button"
              onClick={() => {
                envoi.effacer();
                setEdition(false);
              }}
              className="btn btn-outline btn-grand sm:flex-1"
            >
              Annuler
            </button>
          </div>
        </form>
      ) : (
        <>
          <p className="text-[18px] font-bold">{demande.titre_projet}</p>
          <p className="mt-2 whitespace-pre-wrap">{demande.description}</p>
          {(demande.organisation || demande.telephone) && (
            <p className="mt-3 text-[15px]" style={{ color: "#3b4452" }}>
              {[demande.organisation, demande.telephone].filter(Boolean).join(" · ")}
            </p>
          )}
          {demande.modifiable ? (
            <button
              type="button"
              onClick={() => {
                envoi.effacer();
                setEdition(true);
              }}
              className="btn btn-outline btn-grand mt-4 w-full"
            >
              Modifier ma demande
            </button>
          ) : (
            <p className="mt-4 rounded-xl p-3 text-[15px]" style={{ background: "var(--color-surface-alt)", color: "#3b4452" }}>
              {demande.documents_permis ? (
                <>
                  Votre demande est à l&apos;étude : son texte ne change plus. Pour ajouter une précision, écrivez à{" "}
                  {interlocuteur ?? "l'équipe"} dans vos échanges ou joignez un document.
                </>
              ) : (
                "Ce dossier est traité : il est conservé tel que vous l'avez envoyé."
              )}
            </p>
          )}
        </>
      )}

      <Documents token={token} documents={documents} permis={demande.documents_permis} />
    </section>
  );
}

function Documents({ token, documents, permis }: { token: string; documents: DocumentPorteur[]; permis: boolean }) {
  const [pending, startTransition] = useTransition();
  const [erreur, setErreur] = useState<string>();
  const [ajoute, setAjoute] = useState<string>();
  const champ = useRef<HTMLInputElement>(null);

  function envoyer(fichier: File) {
    setErreur(undefined);
    setAjoute(undefined);
    const ext = (fichier.name.split(".").pop() ?? "").toLowerCase();
    const type = fichier.type || TYPES[ext] || "";
    if (!Object.values(TYPES).includes(type)) {
      setErreur("Ce type de fichier n'est pas accepté. Envoyez un PDF, une image, ou un document Word, Excel ou PowerPoint.");
      return;
    }
    if (fichier.size > TAILLE_MAX) {
      setErreur("Ce document dépasse 10 Mo : envoyez une version plus légère.");
      return;
    }
    startTransition(async () => {
      const chemin = `${token.toLowerCase()}/${crypto.randomUUID()}.${ext || "bin"}`;
      const { error } = await createClient()
        .storage.from("demandes-documents")
        .upload(chemin, fichier, { contentType: type, upsert: false });
      if (error) {
        setErreur("Le document n'a pas pu être envoyé. Réessayez dans un instant.");
        return;
      }
      const r = await enregistrerDocumentSuivi(token, chemin, fichier.name, fichier.size, type);
      if (r.error) {
        setErreur(r.error);
        return;
      }
      setAjoute(fichier.name);
      if (champ.current) champ.current.value = "";
    });
  }

  return (
    <div id="mes-documents" className="mt-6 border-t pt-4" style={{ borderColor: "var(--color-border)" }}>
      <h3 className="mb-1 text-[18px] font-bold">Vos documents</h3>
      <p className="mb-3 text-[15px]" style={{ color: "var(--color-muted)" }}>
        Présentation, plan d&apos;affaires, photos… Seule l&apos;équipe ArcInnoLab peut les ouvrir. Gardez vos originaux.
      </p>

      {documents.length > 0 && (
        <ul className="mb-4 flex flex-col gap-2">
          {documents.map((d) => (
            <LigneDocument key={d.id} token={token} document={d} retirable={permis} />
          ))}
        </ul>
      )}

      {permis ? (
        <>
          <input
            ref={champ}
            id="ajout-document"
            type="file"
            className="sr-only"
            accept={Object.keys(TYPES)
              .map((e) => `.${e}`)
              .join(",")}
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) envoyer(f);
            }}
            disabled={pending}
          />
          <label
            htmlFor="ajout-document"
            className="btn btn-outline btn-grand w-full cursor-pointer"
            aria-disabled={pending}
            style={pending ? { opacity: 0.6, pointerEvents: "none" } : undefined}
          >
            {pending ? "Envoi en cours…" : "Ajouter un document"}
          </label>
          <p className="mt-2 text-sm" style={{ color: "var(--color-muted)" }}>
            PDF, image, Word, Excel ou PowerPoint · 10 Mo au plus
          </p>
        </>
      ) : (
        !documents.length && (
          <p className="text-[15px]" style={{ color: "var(--color-muted)" }}>
            Aucun document joint.
          </p>
        )
      )}
      {erreur && (
        <p role="alert" className="mt-2 text-[15px] font-semibold" style={{ color: "var(--color-danger)" }}>
          {erreur}
        </p>
      )}
      {ajoute && (
        <p role="status" className="mt-2 text-[15px] font-semibold" style={{ color: "var(--color-success)" }}>
          « {ajoute} » est bien arrivé. L&apos;équipe est prévenue.
        </p>
      )}
    </div>
  );
}

function LigneDocument({ token, document: d, retirable }: { token: string; document: DocumentPorteur; retirable: boolean }) {
  const retrait = useEnvoi(retirerDocumentSuivi, { vider: false });
  return (
    <li className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-xl border px-3 py-2" style={{ borderColor: "var(--color-border)" }}>
      <div className="min-w-0 flex-1">
        <span className="font-semibold">{d.nom}</span>
        <p className="text-sm" style={{ color: "var(--color-muted)" }}>
          {tailleLisible(d.taille)} · ajouté le {d.quand}
        </p>
      </div>
      {retirable && (
        <form onSubmit={retrait.onSubmit}>
          <input type="hidden" name="token" value={token} />
          <input type="hidden" name="document_id" value={d.id} />
          <button type="submit" disabled={retrait.pending} className="btn btn-outline text-sm" style={{ minHeight: 40 }}>
            {retrait.pending ? "…" : "Retirer"}
          </button>
        </form>
      )}
      {retrait.erreur && (
        <p role="alert" className="w-full text-sm font-semibold" style={{ color: "var(--color-danger)" }}>
          {retrait.erreur}
        </p>
      )}
    </li>
  );
}
