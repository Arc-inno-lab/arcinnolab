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
import { DescriptionProjet } from "./DescriptionProjet";
import { PartenairesProjet } from "./PartenairesProjet";
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
    { data: liens },
    { data: tousPartenaires },
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
    // Les messages d'étape sont chargés en entier : le panneau latéral les
    // affiche sans changer de page, il ne peut donc plus se contenter d'un
    // décompte.
    supabase
      .from("messages_projet")
      .select("*, auteur:profiles(nom,prenom,role,photo_url)")
      .eq("projet_id", id)
      .not("etape_id", "is", null)
      .order("created_at", { ascending: true })
      .returns<MessageProjet[]>(),
    supabase.from("documents").select("etape_id").eq("projet_id", id).not("etape_id", "is", null),
    supabase
      .from("invitations")
      .select("*")
      .eq("projet_id", id)
      .eq("statut", "en_attente")
      .returns<Invitation[]>(),
    supabase
      .from("projet_partenaire")
      .select("partenaire_id, profile:profiles(id,nom,prenom,email,organisation,photo_url,role)")
      .eq("projet_id", id)
      .returns<{ partenaire_id: string; profile: Profile | null }[]>(),
    supabase
      .from("profiles")
      .select("*")
      .eq("role", "partenaire")
      .order("nom", { ascending: true })
      .returns<Profile[]>(),
  ]);

  if (!profile) redirect("/login");

  const partenairesRattaches = (liens ?? [])
    .map((l) => l.profile)
    .filter((p): p is Profile => Boolean(p));

  const isAdmin = profile.role === "admin";
  // Référent au sens de la base : le créateur, mais aussi tout partenaire
  // rattaché au projet (cf. is_project_referent, migration 001).
  const isReferent =
    profile.id === projet.id_partenaire_createur ||
    partenairesRattaches.some((p) => p.id === profile.id);
  const estMembre = (membres ?? []).some((m) => m.user_id === profile.id);

  // Deux droits distincts, et c'est tout l'enjeu : le porteur mène son projet
  // (descriptif, logo, étapes, dates), le partenaire garde la validation et
  // l'état du projet. Confondre les deux, c'est soit river le porteur à un
  // écran en lecture seule, soit lui laisser valider ses propres jalons.
  const peutGerer = isReferent || isAdmin;
  const peutEditer = peutGerer || estMembre;

  const documentsParEtape: Record<string, number> = {};
  for (const d of etapeDocuments ?? []) {
    if (!d.etape_id) continue;
    documentsParEtape[d.etape_id] = (documentsParEtape[d.etape_id] ?? 0) + 1;
  }

  const messagesParEtape: Record<string, MessageProjet[]> = {};
  for (const m of etapeMessages ?? []) {
    if (!m.etape_id) continue;
    (messagesParEtape[m.etape_id] ??= []).push(m);
  }

  const dejaRattaches = new Set([
    projet.id_partenaire_createur,
    ...partenairesRattaches.map((p) => p.id),
  ]);
  const partenairesDisponibles = (tousPartenaires ?? []).filter((p) => !dejaRattaches.has(p.id));

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-center gap-4">
          {peutEditer ? (
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

      <DescriptionProjet
        projetId={projet.id}
        description={projet.description}
        peutEditer={peutEditer}
      />

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

      <PartenairesProjet
        projetId={projet.id}
        rattaches={partenairesRattaches}
        disponibles={partenairesDisponibles}
        referent={projet.referent}
        peutGerer={peutGerer}
      />

      <KanbanEtapes
        projetId={projet.id}
        etapes={etapes ?? []}
        peutEditer={peutEditer}
        peutValider={peutGerer}
        messagesParEtape={messagesParEtape}
        documentsParEtape={documentsParEtape}
      />

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
