"use client";

import { useEnvoi } from "@/lib/useEnvoi";
import { repondreAuPorteur } from "@/app/actions";
import { FieldError } from "@/components/FieldError";
import type { MessageDemande } from "@/lib/types";

/**
 * Le fil d'échange entre l'équipe et le porteur, vu du côté équipe.
 *
 * Tant que la plateforme n'envoie pas d'e-mails, un porteur ne sait pas qu'on
 * lui a répondu. D'où la case « prévenir par e-mail » : elle ouvre la
 * messagerie de l'équipier avec un message déjà rédigé, qui contient le lien
 * de la page de suivi. Aucun réglage, aucun compte à brancher — un clic sur
 * « Envoyer » dans sa propre messagerie.
 */
export function Echange({
  demandeId,
  messages,
  prenomPorteur,
  emailPorteur,
  lienSuivi,
  monPrenom,
}: {
  demandeId: string;
  messages: MessageDemande[];
  prenomPorteur: string;
  emailPorteur: string;
  lienSuivi: string;
  monPrenom: string;
}) {
  // La messagerie de l'équipier ne s'ouvre qu'une fois le message enregistré :
  // inutile de prévenir le porteur d'une réponse qui n'existe pas.
  const envoi = useEnvoi(repondreAuPorteur, {
    onSucces: (_form, fd) => {
      const texte = String(fd.get("contenu") || "").trim();
      if (!fd.get("prevenir") || !texte) return;
      const sujet = "Réponse à votre demande ArcInnoLab";
      const corps =
        `Bonjour ${prenomPorteur},\n\n${texte}\n\n` +
        `Vous pouvez me répondre et suivre votre demande sur cette page :\n${lienSuivi}\n\n` +
        `${monPrenom}\nArcInnoLab`;
      window.location.href = `mailto:${encodeURIComponent(emailPorteur)}?subject=${encodeURIComponent(sujet)}&body=${encodeURIComponent(corps)}`;
    },
  });

  return (
    <section className="card p-5">
      <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-lg font-medium">Échanges avec {prenomPorteur}</h2>
        <span className="text-xs" style={{ color: "var(--color-muted)" }}>
          Il lit et répond depuis sa page de suivi, sans compte
        </span>
      </div>

      {messages.length > 0 ? (
        <ul className="mb-4 flex flex-col gap-3">
          {messages.map((m) => {
            const equipe = m.auteur === "equipe";
            return (
              <li key={m.id} className={`flex flex-col gap-1 ${equipe ? "items-end" : "items-start"}`}>
                <span className="text-xs" style={{ color: "var(--color-muted)" }}>
                  {equipe ? (m.profil ? `${m.profil.prenom} ${m.profil.nom}` : "Équipe") : prenomPorteur}
                  {" · "}
                  {new Date(m.created_at).toLocaleString("fr-FR", {
                    timeZone: "Europe/Paris",
                    day: "numeric",
                    month: "short",
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </span>
                <p
                  className="max-w-[85%] whitespace-pre-wrap rounded-2xl px-4 py-2.5 text-sm"
                  style={
                    equipe
                      ? { background: "var(--color-primary)", color: "#fff" }
                      : { background: "var(--color-bg)", border: "1px solid var(--color-border)" }
                  }
                >
                  {m.contenu}
                </p>
              </li>
            );
          })}
        </ul>
      ) : (
        <p className="mb-4 text-sm" style={{ color: "var(--color-muted)" }}>
          Aucun échange pour l&apos;instant.
        </p>
      )}

      <form onSubmit={envoi.onSubmit}>
        <input type="hidden" name="demande_id" value={demandeId} />
        <label htmlFor="contenu" className="mb-1 block text-sm font-medium">
          Écrire à {prenomPorteur}
        </label>
        <textarea
          id="contenu"
          name="contenu"
          rows={3}
          required
          placeholder="Proposer un rendez-vous, demander une précision, donner des nouvelles…"
          className="w-full rounded-md border px-3 py-2 text-sm"
          style={{ borderColor: "var(--color-border)" }}
        />
        <FieldError message={envoi.erreur} />
        <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
          <label className="flex items-center gap-2 text-sm" style={{ color: "#3b4452" }}>
            <input type="checkbox" name="prevenir" defaultChecked style={{ width: 18, height: 18, minHeight: 0 }} />
            Prévenir {prenomPorteur} par e-mail depuis ma messagerie
          </label>
          <button type="submit" disabled={envoi.pending} className="btn btn-primary">
            {envoi.pending ? "Envoi…" : "Envoyer"}
          </button>
        </div>
      </form>
    </section>
  );
}
