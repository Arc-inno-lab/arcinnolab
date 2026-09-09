import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { Profile, Projet, MembreProjet } from "@/lib/types";
import { ETAT_LABELS } from "@/lib/types";
import { InvitationForm } from "../../invitations/new/InvitationForm";
import { EtatSelect } from "./EtatSelect";

type ProjetAvecReferent = Projet & {
  referent: Pick<Profile, "nom" | "prenom" | "email"> | null;
};

export default async function ProjetPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  const { data: profile } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user!.id)
    .single<Profile>();

  const { data: projet } = await supabase
    .from("projets")
    .select("*, referent:profiles!projets_id_partenaire_createur_fkey(nom,prenom,email)")
    .eq("id", id)
    .maybeSingle<ProjetAvecReferent>();

  if (!projet) notFound();

  const { data: membres } = await supabase
    .from("membres_projet")
    .select("*, profile:profiles(nom,prenom,email,organisation)")
    .eq("projet_id", id)
    .returns<MembreProjet[]>();

  const isReferent = profile?.id === projet.id_partenaire_createur;
  const isAdmin = profile?.role === "admin";
  const peutGerer = isReferent || isAdmin;

  if (!profile) redirect("/login");

  return (
    <div>
      <div className="mb-1 flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold">{projet.titre}</h1>
        {peutGerer ? (
          <EtatSelect projetId={projet.id} etat={projet.etat} />
        ) : (
          <span
            className="rounded-full px-2 py-0.5 text-xs font-medium"
            style={{ background: "var(--color-bg)", color: "var(--color-muted)" }}
          >
            {ETAT_LABELS[projet.etat]}
          </span>
        )}
      </div>
      <p className="mb-6 text-sm" style={{ color: "var(--color-muted)" }}>
        Référent : {projet.referent ? `${projet.referent.prenom} ${projet.referent.nom}` : "—"}
      </p>

      {projet.description && (
        <div
          className="mb-6 rounded-lg border p-5"
          style={{ background: "var(--color-surface)", borderColor: "var(--color-border)" }}
        >
          <h2 className="mb-2 text-lg font-medium">Description</h2>
          <p className="text-sm whitespace-pre-wrap">{projet.description}</p>
        </div>
      )}

      <section aria-labelledby="equipe-heading" className="mb-6">
        <h2 id="equipe-heading" className="mb-3 text-lg font-medium">
          Porteurs de projet ({membres?.length ?? 0})
        </h2>
        {!membres?.length ? (
          <p className="text-sm" style={{ color: "var(--color-muted)" }}>
            Aucun porteur rattaché pour le moment.
          </p>
        ) : (
          <ul className="flex flex-col gap-2">
            {membres.map((m) => (
              <li
                key={m.id}
                className="rounded-lg border p-3 text-sm"
                style={{ background: "var(--color-surface)", borderColor: "var(--color-border)" }}
              >
                <span className="font-medium">
                  {m.profile?.prenom} {m.profile?.nom}
                </span>
                {" · "}
                <span style={{ color: "var(--color-muted)" }}>{m.profile?.email}</span>
                {m.profile?.organisation && (
                  <span style={{ color: "var(--color-muted)" }}> · {m.profile.organisation}</span>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>

      {peutGerer && (
        <section aria-labelledby="inviter-heading">
          <h2 id="inviter-heading" className="mb-3 text-lg font-medium">
            Inviter un porteur sur ce projet
          </h2>
          <div className="max-w-md">
            <InvitationForm canInvitePartenaire={false} projetId={projet.id} />
          </div>
        </section>
      )}
    </div>
  );
}
