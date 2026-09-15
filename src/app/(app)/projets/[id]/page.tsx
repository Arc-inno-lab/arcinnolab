import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { Profile, Projet, MembreProjet, EtapeProjet, MessageProjet, Invitation } from "@/lib/types";
import { ETAT_LABELS } from "@/lib/types";
import { EtatSelect } from "./EtatSelect";
import { KanbanEtapes } from "./KanbanEtapes";
import { FilProjet } from "./FilProjet";
import { ProjetLogoUpload } from "./ProjetLogoUpload";
import { DescriptionProjet } from "./DescriptionProjet";
import { EquipeProjet } from "./EquipeProjet";
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

      {/* Deux colonnes : le travail à gauche, la conversation à droite et
          toujours visible. Le fil placé en bas de page obligeait à faire
          défiler tout l'écran, et l'on perdait de vue ce dont on parlait. */}
      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
        <div className="flex min-w-0 flex-col gap-6">
          <DescriptionProjet
            projetId={projet.id}
            description={projet.description}
            peutEditer={peutEditer}
          />

          <EquipeProjet
            projetId={projet.id}
            membres={membres ?? []}
            invitations={invitationsEnAttente ?? []}
            referent={projet.referent}
            partenaires={partenairesRattaches}
            partenairesDisponibles={partenairesDisponibles}
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
        </div>

        <FilProjet projetId={projet.id} messages={messages ?? []} />
      </div>
    </div>
  );
}
