import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type {
  ColonneProjet,
  EtapeProjet,
  Invitation,
  MembreProjet,
  MessageProjet,
  Profile,
  Projet,
} from "@/lib/types";
import { ETAT_LABELS } from "@/lib/types";
import { EtatSelect } from "./EtatSelect";
import { KanbanEtapes } from "./KanbanEtapes";
import { FilProjet } from "./FilProjet";
import { ProjetLogoUpload } from "./ProjetLogoUpload";
import { DescriptionProjet } from "./DescriptionProjet";
import { EquipeProjet } from "./EquipeProjet";

type ProjetAvecReferent = Projet & {
  referent: Pick<Profile, "nom" | "prenom" | "email" | "photo_url"> | null;
};

/** L'instant du chargement : lu ici, hors rendu, puis transmis tel quel. */
function maintenant() {
  return Date.now();
}

function ouvertLe(iso: string) {
  return new Date(iso).toLocaleDateString("fr-FR", { timeZone: "Europe/Paris", day: "numeric", month: "long" });
}

/**
 * La fiche projet, côté équipe : qui, quoi, le passeport, et le fil toujours
 * visible à droite. Le porteur, lui, a sa propre page (/mon-projet), plus
 * simple : une liste de choses à faire plutôt qu'un tableau.
 */
export default async function ProjetPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  const { data: profile } = await supabase.from("profiles").select("*").eq("id", user!.id).single<Profile>();
  if (!profile) redirect("/login");
  if (profile.role === "porteur") redirect(`/mon-projet?p=${id}`);

  const { data: projet } = await supabase
    .from("projets")
    .select("*, referent:profiles!projets_id_partenaire_createur_fkey(nom,prenom,email,photo_url)")
    .eq("id", id)
    .maybeSingle<ProjetAvecReferent>();

  if (!projet) notFound();

  const [
    { data: membres },
    { data: etapes },
    { data: colonnes },
    { data: messages },
    { data: etapeMessages },
    { data: etapeDocuments },
    { data: invitationsEnAttente },
    { data: liens },
    { data: tousPartenaires },
    { data: demande },
  ] = await Promise.all([
    supabase
      .from("membres_projet")
      .select("*, profile:profiles(nom,prenom,email,organisation,photo_url)")
      .eq("projet_id", id)
      .returns<MembreProjet[]>(),
    supabase.from("etapes_projet").select("*").eq("projet_id", id).order("ordre", { ascending: true }).returns<EtapeProjet[]>(),
    supabase.from("colonnes_projet").select("*").eq("projet_id", id).order("ordre", { ascending: true }).returns<ColonneProjet[]>(),
    supabase
      .from("messages_projet")
      .select("*, auteur:profiles(nom,prenom,role,photo_url)")
      .eq("projet_id", id)
      .is("etape_id", null)
      .order("created_at", { ascending: true })
      .returns<MessageProjet[]>(),
    supabase
      .from("messages_projet")
      .select("*, auteur:profiles(nom,prenom,role,photo_url)")
      .eq("projet_id", id)
      .not("etape_id", "is", null)
      .order("created_at", { ascending: true })
      .returns<MessageProjet[]>(),
    supabase.from("documents").select("etape_id").eq("projet_id", id).not("etape_id", "is", null),
    supabase.from("invitations").select("*").eq("projet_id", id).eq("statut", "en_attente").returns<Invitation[]>(),
    supabase
      .from("projet_partenaire")
      .select("partenaire_id, profile:profiles(id,nom,prenom,email,organisation,photo_url,role)")
      .eq("projet_id", id)
      .returns<{ partenaire_id: string; profile: Profile | null }[]>(),
    supabase.from("profiles").select("*").eq("role", "partenaire").order("nom", { ascending: true }).returns<Profile[]>(),
    supabase.from("demandes_accueil").select("id, statut, tours_vote(statut, votes(position))").eq("projet_id", id).maybeSingle(),
  ]);

  const partenairesRattaches = (liens ?? []).map((l) => l.profile).filter((p): p is Profile => Boolean(p));

  const isAdmin = profile.role === "admin";
  // Référent au sens de la base : le créateur, mais aussi tout partenaire
  // rattaché au projet (cf. is_project_referent).
  const isReferent =
    profile.id === projet.id_partenaire_createur || partenairesRattaches.some((p) => p.id === profile.id);
  const peutGerer = isReferent || isAdmin;
  // Un partenaire qui n'est pas rattaché consulte : il voit, il écrit dans le
  // fil, mais il ne mène pas le passeport d'un projet qui n'est pas le sien.
  const peutEditer = peutGerer;

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

  const dejaRattaches = new Set([projet.id_partenaire_createur, ...partenairesRattaches.map((p) => p.id)]);
  const partenairesDisponibles = (tousPartenaires ?? []).filter((p) => !dejaRattaches.has(p.id));

  // Les noms utiles aux cartes (« proposé par Jennifer ») et au choix
  // « avec qui ? » d'un rendez-vous.
  const porteurs = (membres ?? [])
    .filter((m) => m.profile)
    .map((m) => ({ id: m.user_id, prenom: m.profile!.prenom, nom: m.profile!.nom }));
  const noms: Record<string, string> = {};
  for (const p of porteurs) noms[p.id] = p.prenom;
  for (const p of partenairesRattaches) noms[p.id] = p.prenom;
  if (projet.referent) noms[projet.id_partenaire_createur] = projet.referent.prenom;
  noms[profile.id] = profile.prenom;

  // Frise : d'où vient ce projet. Un projet né avant la refonte n'a pas de
  // demande ; la frise se réduit alors à son état.
  const tours = (demande?.tours_vote ?? []) as { statut: string; votes: { position: string }[] }[];
  const favorables = tours.flatMap((t) => t.votes ?? []).filter((v) => v.position === "favorable").length;
  const frise = demande
    ? [
        "Demande",
        "Prise en charge",
        tours.length ? `Consultation · ${favorables} avis favorable${favorables > 1 ? "s" : ""}` : "Orientation",
        "Admise",
      ]
    : [];

  const porteurPrincipal = porteurs[0];

  return (
    <div className="flex flex-col gap-5">
      <Link href="/projets" className="text-sm">
        ← Projets
      </Link>

      <header className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex min-w-0 items-center gap-4">
          <ProjetLogoUpload projetId={projet.id} logoUrl={projet.logo_url} titre={projet.titre} modifiable={peutEditer} />
          <div className="min-w-0">
            <h1 className="text-2xl font-bold md:text-3xl">{projet.titre}</h1>
            <p className="text-sm" style={{ color: "var(--color-muted)" }}>
              {porteurPrincipal
                ? `Porteur : ${porteurPrincipal.prenom} ${porteurPrincipal.nom}`
                : invitationsEnAttente?.length
                  ? "Porteur : invitation envoyée"
                  : "Aucun porteur"}
              {projet.referent ? ` · Référent : ${projet.referent.prenom} ${projet.referent.nom}` : ""}
              {` · ouvert le ${ouvertLe(projet.date_creation)}`}
            </p>
          </div>
        </div>
        {peutGerer ? (
          <EtatSelect projetId={projet.id} etat={projet.etat} />
        ) : (
          <span className="rounded-full px-3 py-1 text-sm font-semibold" style={{ background: "#e9edf4", color: "#3b4452" }}>
            {ETAT_LABELS[projet.etat]}
          </span>
        )}
      </header>

      {frise.length > 0 && (
        <ol className="card flex flex-wrap items-center gap-x-3 gap-y-1 px-4 py-2.5 text-sm font-semibold" aria-label="Historique du dossier">
          {frise.map((etape) => (
            <li key={etape} className="flex items-center gap-3" style={{ color: "var(--color-success)" }}>
              <span>✓ {etape}</span>
              <span className="hidden h-px w-8 md:inline-block lg:w-16" style={{ background: "#b9dccb" }} aria-hidden="true" />
            </li>
          ))}
          <li style={{ color: "var(--color-primary)" }} aria-current="step">
            ● Projet {ETAT_LABELS[projet.etat].toLowerCase()}
          </li>
        </ol>
      )}

      <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,1fr)_340px]">
        <div className="flex min-w-0 flex-col gap-5">
          <div className="grid gap-5 md:grid-cols-2">
            <DescriptionProjet
              projetId={projet.id}
              description={projet.description}
              peutEditer={peutEditer}
              lienDemande={demande ? `/demandes/${demande.id}` : null}
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
          </div>

          <KanbanEtapes
            projetId={projet.id}
            etapes={etapes ?? []}
            colonnes={colonnes ?? []}
            instant={maintenant()}
            moi={profile.id}
            noms={noms}
            interlocuteurs={porteurs}
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
