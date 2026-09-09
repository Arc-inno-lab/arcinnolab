import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { Profile, Projet, MembreProjet, EtapeProjet, MessageProjet, Invitation } from "@/lib/types";
import { ETAT_LABELS } from "@/lib/types";
import { InvitationForm } from "../../invitations/new/InvitationForm";
import { CancelInvitationButton } from "../../admin/CancelInvitationButton";
import { EtatSelect } from "./EtatSelect";
import { KanbanEtapes } from "./KanbanEtapes";
import { MessagesProjetSection } from "./MessagesProjetSection";
import { ProjetLogoUpload } from "./ProjetLogoUpload";
import { Avatar } from "@/components/Avatar";

type ProjetAvecReferent = Projet & {
  referent: Pick<Profile, "nom" | "prenom" | "email" | "photo_url"> | null;
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
    .select("*, referent:profiles!projets_id_partenaire_createur_fkey(nom,prenom,email,photo_url)")
    .eq("id", id)
    .maybeSingle<ProjetAvecReferent>();

  if (!projet) notFound();

  const [
    { data: membres },
    { data: etapes },
    { data: messages },
    { data: etapeMessages },
    { data: etapeDocuments },
    { data: invitationsEnAttente },
  ] = await Promise.all([
    supabase
      .from("membres_projet")
      .select("*, profile:profiles(nom,prenom,email,organisation,photo_url)")
      .eq("projet_id", id)
      .returns<MembreProjet[]>(),
    supabase
      .from("etapes_projet")
      .select("*")
      .eq("projet_id", id)
      .order("ordre", { ascending: true })
      .returns<EtapeProjet[]>(),
    supabase
      .from("messages_projet")
      .select("*, auteur:profiles(nom,prenom,role,photo_url)")
      .eq("projet_id", id)
      .is("etape_id", null)
      .order("created_at", { ascending: true })
      .returns<MessageProjet[]>(),
    supabase.from("messages_projet").select("etape_id").eq("projet_id", id).not("etape_id", "is", null),
    supabase.from("documents").select("etape_id").eq("projet_id", id).not("etape_id", "is", null),
    supabase
      .from("invitations")
      .select("*")
      .eq("projet_id", id)
      .eq("statut", "en_attente")
      .returns<Invitation[]>(),
  ]);

  if (!profile) redirect("/login");

  const isReferent = profile.id === projet.id_partenaire_createur;
  const isAdmin = profile.role === "admin";
  const peutGerer = isReferent || isAdmin;

  const counts: Record<string, { messages: number; documents: number }> = {};
  for (const m of etapeMessages ?? []) {
    if (!m.etape_id) continue;
    counts[m.etape_id] ??= { messages: 0, documents: 0 };
    counts[m.etape_id].messages += 1;
  }
  for (const d of etapeDocuments ?? []) {
    if (!d.etape_id) continue;
    counts[d.etape_id] ??= { messages: 0, documents: 0 };
    counts[d.etape_id].documents += 1;
  }

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-center gap-4">
          {peutGerer ? (
            <ProjetLogoUpload projetId={projet.id} logoUrl={projet.logo_url} titre={projet.titre} />
          ) : (
            <span
              className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-xl border"
              style={{ borderColor: "var(--color-border)", background: "var(--color-surface-alt)" }}
            >
              {projet.logo_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={projet.logo_url} alt="" className="h-full w-full object-cover" />
              ) : (
                <span className="text-lg font-bold" style={{ color: "var(--color-muted)" }} aria-hidden="true">
                  {projet.titre.charAt(0).toUpperCase()}
                </span>
              )}
            </span>
          )}
          <div>
            <h1 className="text-2xl font-semibold">{projet.titre}</h1>
            <div className="mt-1 flex items-center gap-2 text-sm" style={{ color: "var(--color-muted)" }}>
              <Avatar
                nom={projet.referent?.nom}
                prenom={projet.referent?.prenom}
                photoUrl={projet.referent?.photo_url}
                size="sm"
              />
              <span>
                Référent : {projet.referent ? `${projet.referent.prenom} ${projet.referent.nom}` : "—"}
              </span>
            </div>
          </div>
        </div>
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

      {projet.description && (
        <div className="card mb-8 p-5">
          <h2 className="mb-2 text-lg font-medium">Description</h2>
          <p className="text-sm whitespace-pre-wrap">{projet.description}</p>
        </div>
      )}

      <section aria-labelledby="equipe-heading" className="mb-8">
        <h2 id="equipe-heading" className="mb-3 text-lg font-medium">
          Porteurs de projet ({membres?.length ?? 0})
        </h2>
        {!membres?.length && !invitationsEnAttente?.length ? (
          <p className="text-sm" style={{ color: "var(--color-muted)" }}>
            Aucun porteur rattaché pour le moment.
          </p>
        ) : (
          <ul className="flex flex-col gap-2">
            {membres?.map((m) => (
              <li key={m.id} className="card flex items-center gap-3 p-3 text-sm">
                <Avatar nom={m.profile?.nom} prenom={m.profile?.prenom} photoUrl={m.profile?.photo_url} size="sm" />
                <div>
                  <span className="font-medium">
                    {m.profile?.prenom} {m.profile?.nom}
                  </span>
                  {" · "}
                  <span style={{ color: "var(--color-muted)" }}>{m.profile?.email}</span>
                  {m.profile?.organisation && (
                    <span style={{ color: "var(--color-muted)" }}> · {m.profile.organisation}</span>
                  )}
                </div>
              </li>
            ))}
            {invitationsEnAttente?.map((inv) => (
              <li
                key={inv.id}
                className="card flex items-center justify-between gap-3 p-3 text-sm"
                style={{ borderStyle: "dashed" }}
              >
                <div className="flex items-center gap-3">
                  <Avatar nom={inv.nom} prenom={inv.prenom} photoUrl={null} size="sm" />
                  <div>
                    <span className="font-medium">
                      {inv.prenom || inv.nom ? `${inv.prenom ?? ""} ${inv.nom ?? ""}`.trim() : inv.email}
                    </span>
                    {" · "}
                    <span style={{ color: "var(--color-muted)" }}>{inv.email}</span>
                    {inv.organisation && (
                      <span style={{ color: "var(--color-muted)" }}> · {inv.organisation}</span>
                    )}
                    <span className="tag ml-2" style={{ "--tag-bg": "var(--color-primary-soft)", "--tag-color": "var(--color-primary)" } as React.CSSProperties}>
                      invitation en attente
                    </span>
                  </div>
                </div>
                {peutGerer && <CancelInvitationButton id={inv.id} />}
              </li>
            ))}
          </ul>
        )}
      </section>

      <KanbanEtapes projetId={projet.id} etapes={etapes ?? []} peutGerer={peutGerer} counts={counts} />

      <MessagesProjetSection projetId={projet.id} messages={messages ?? []} />

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
