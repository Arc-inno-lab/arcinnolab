import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type {
  DemandeAccueil,
  Orientation,
  Profile,
  Promotion,
  TourVote,
  Vote,
  MessageDemande,
  NoteDemande,
} from "@/lib/types";
import {
  DEMANDE_STATUT_LABELS,
  DEMANDE_STATUT_COLORS,
  PAYS_LABELS,
  PERSONA_LABELS,
} from "@/lib/types";
import { BoutonPriseEnCharge } from "./TraitementDemande";
import { TourEnCours, ProncerDecision } from "./TourDeVote";
import {
  CarteQualification,
  ResumeQualification,
  AbandonnerVote,
  ReprendreSuivi,
  Rouvrir,
  SuiviOrientations,
  type PartenaireChoix,
} from "./Qualification";
import { FilInterne, type Equipier } from "./FilInterne";
import { Echange } from "./Echange";
import { LienSuivi } from "./LienSuivi";
import { APP_URL } from "@/lib/config";

export const dynamic = "force-dynamic";

/**
 * Lecture de l'heure courante, volontairement hors du composant : React
 * interdit les appels impurs pendant le rendu, et à juste titre — leur résultat
 * change à chaque exécution. L'instant est capté une fois, puis transmis.
 */
/** Date et heure formatées côté serveur, pour que le navigateur affiche la même chose. */
function horodatage(iso: string) {
  return new Date(iso).toLocaleString("fr-FR", {
    timeZone: "Europe/Paris",
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function instantCourant(): number {
  return Date.now();
}

export default async function DemandePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  const { data: profile } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user!.id)
    .single<Profile>();

  if (profile?.role === "porteur") redirect("/");

  const { data: demande } = await supabase
    .from("demandes_accueil")
    .select("*, coach:profiles!demandes_accueil_coach_id_fkey(nom, prenom, photo_url)")
    .eq("id", id)
    .single<DemandeAccueil>();

  if (!demande) notFound();

  const { data: orientations } = await supabase
    .from("orientations")
    .select("*")
    .eq("demande_id", id)
    .order("created_at", { ascending: false })
    .returns<Orientation[]>();

  const { data: promotions } = await supabase
    .from("promotions")
    .select("*")
    .eq("ouverte", true)
    .order("date_comite", { ascending: true })
    .returns<Promotion[]>();

  const { data: promotionRattachee } = demande.promotion_id
    ? await supabase
        .from("promotions")
        .select("*")
        .eq("id", demande.promotion_id)
        .single<Promotion>()
    : { data: null };

  // Le dernier tour de vote, avec les avis déjà exprimés.
  const { data: tours } = await supabase
    .from("tours_vote")
    .select("*, votes(*, votant:profiles!votes_votant_id_fkey(nom, prenom, organisation, photo_url))")
    .eq("demande_id", id)
    .order("created_at", { ascending: false })
    .limit(1)
    .returns<TourVote[]>();

  // Le vote ne compte que tant que la demande est au vote : une demande
  // rouverte après un refus ne doit pas ressortir l'ancienne décision.
  const tour = demande.statut === "en_instruction" ? (tours?.[0] ?? null) : null;
  const monVote =
    (tour?.votes ?? []).find((v: Vote) => v.votant_id === user!.id) ?? null;

  // L'équipe (admins et partenaires) : pour orienter vers un partenaire, et
  // pour mentionner quelqu'un dans la discussion interne.
  const [{ data: equipeProfils }, { data: notes }] = await Promise.all([
    supabase
      .from("profiles")
      .select("id, prenom, nom, organisation, role")
      .in("role", ["admin", "partenaire"])
      .order("prenom", { ascending: true }),
    supabase
      .from("notes_demande")
      .select("*, auteur:profiles!notes_demande_auteur_id_fkey(nom, prenom, photo_url)")
      .eq("demande_id", id)
      .order("created_at", { ascending: true })
      .returns<NoteDemande[]>(),
  ]);
  const equipe: Equipier[] = (equipeProfils ?? []).map((p) => ({ id: p.id, prenom: p.prenom, nom: p.nom, organisation: p.organisation }));
  const partenairesChoix: PartenaireChoix[] = (equipeProfils ?? [])
    .filter((p) => p.role === "partenaire")
    .map((p) => ({ id: p.id, prenom: p.prenom, nom: p.nom, organisation: p.organisation }));
  const qualificateur = demande.qualifie_par
    ? (equipeProfils ?? []).find((p) => p.id === demande.qualifie_par)?.prenom ?? null
    : null;

  const { data: messages } = await supabase
    .from("messages_demande")
    .select("*, profil:profiles!messages_demande_auteur_id_fkey(nom, prenom, photo_url)")
    .eq("demande_id", id)
    .order("created_at", { ascending: true })
    .returns<MessageDemande[]>();

  // Le jeton de suivi n'est jamais montré au public : il sert ici à donner à
  // l'équipe le lien exact que le porteur utilise, pour le lui renvoyer s'il
  // l'a perdu et pour vérifier ce qu'il voit réellement.
  const { data: jeton } = await supabase
    .from("demandes_accueil")
    .select("token_suivi")
    .eq("id", id)
    .single<{ token_suivi: string }>();

  const lienSuivi = `${APP_URL}/suivi/${jeton?.token_suivi ?? ""}`;

  const estAdmin = profile?.role === "admin";
  const tourOuvert = tour && (tour.statut === "en_cours" || tour.statut === "complet");
  const tourClos = tour && tour.statut === "clos";
  const decisionPrononcee = demande.statut === "admise" || demande.statut === "non_retenue";

  const deposee = new Date(demande.created_at);
  const maintenant = instantCourant();

  const attente =
    demande.statut === "nouvelle" && maintenant - deposee.getTime() > 7 * 86_400_000
      ? Math.floor((maintenant - deposee.getTime()) / 86_400_000)
      : null;

  // « en_accueil » est l'ancien statut « Prise en charge », désormais fondu dans la qualification.
  const enQualification = ["en_accueil", "en_qualification", "en_attente_comite"].includes(demande.statut);
  const aVote = !!tour || demande.statut === "en_instruction";
  const orientee = demande.statut === "orientee";
  const refusee = demande.statut === "non_retenue" || demande.statut === "close";
  const etapes: Array<{ label: string; fait: boolean }> = [
    { label: "Demande reçue", fait: true },
    {
      label: "Prise en charge et qualification",
      fait: aVote || orientee || refusee || demande.statut === "admise",
    },
    ...(orientee
      ? [{ label: "Orientée vers un partenaire", fait: true }]
      : [
          { label: "Vote des partenaires", fait: !!tourClos || (decisionPrononcee && (tours?.length ?? 0) > 0) },
          { label: "Décision", fait: decisionPrononcee },
          { label: "Projet", fait: !!demande.projet_id },
        ]),
  ];
  const courante = etapes.findIndex((e) => !e.fait);
  const frise = etapes.map((e, i) => ({
    label: e.label,
    etat: e.fait ? "fait" : i === courante ? "encours" : "a_venir",
  }));

  return (
    <div>
      <Link href="/demandes" className="mb-3 inline-block text-sm" style={{ color: "var(--color-primary)" }}>
        ← Demandes
      </Link>

      {/* L'en-tête porte l'action qui fait avancer le dossier, et elle seule.
          Elle était auparavant tout en bas, sous le fil d'échange : la seule
          chose utile à faire sur une demande neuve était la dernière qu'on
          voyait. */}
      <header className="mb-5 flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0 flex-1 basis-96">
          <h1 className="text-2xl font-bold">{demande.titre_projet}</h1>
          <p className="mt-1 text-sm" style={{ color: "var(--color-muted)" }}>
            {demande.prenom} {demande.nom}
            {demande.organisation ? ` · ${demande.organisation}` : ""} · {PAYS_LABELS[demande.pays]} · déposée le{" "}
            {deposee.toLocaleDateString("fr-FR", { timeZone: "Europe/Paris", day: "numeric", month: "long" })}
            {attente !== null && (
              <span style={{ color: "var(--color-danger)", fontWeight: 600 }}>
                {" "}· sans réponse depuis {attente} jours
              </span>
            )}
          </p>
        </div>
        <div className="flex shrink-0 flex-wrap items-center gap-2">
          {demande.statut === "nouvelle" ? (
            <BoutonPriseEnCharge demandeId={demande.id} />
          ) : !demande.coach_id && !["admise", "non_retenue", "close"].includes(demande.statut) ? (
            <ReprendreSuivi demandeId={demande.id} />
          ) : demande.statut === "admise" && demande.projet_id ? (
            <Link href={`/projets/${demande.projet_id}`} className="btn btn-primary">
              Ouvrir le projet
            </Link>
          ) : tourOuvert && !monVote ? (
            <a href="#consultation" className="btn btn-primary">
              Donner mon avis
            </a>
          ) : tourClos && estAdmin && !decisionPrononcee ? (
            <a href="#decision" className="btn btn-primary">
              Prononcer la décision
            </a>
          ) : enQualification ? (
            <a href="#qualification" className="btn btn-primary">
              Qualifier
            </a>
          ) : (
            <span
              className="rounded-full px-3 py-1 text-sm font-semibold"
              style={{ background: DEMANDE_STATUT_COLORS[demande.statut], color: "#fff" }}
            >
              {DEMANDE_STATUT_LABELS[demande.statut]}
            </span>
          )}
        </div>
      </header>

      {/* La même frise que celle du porteur, étape courante marquée : sans
          ce repère, une fonctionnalité pas encore accessible passe pour une
          fonctionnalité absente. */}
      <ol
        aria-label="Parcours de la demande"
        className="card mb-6 flex flex-wrap items-center gap-x-3 gap-y-2 px-5 py-4 text-sm"
      >
        {frise.map((e, i) => (
          <li key={e.label} className="flex items-center gap-2" aria-current={e.etat === "encours" ? "step" : undefined}>
            {i > 0 && <span aria-hidden="true" className="hidden h-0.5 w-8 sm:inline-block" style={{ background: e.etat === "fait" ? "#b9dcc9" : "var(--color-border)" }} />}
            <span
              aria-hidden="true"
              className="flex h-6 w-6 items-center justify-center rounded-full text-xs font-bold"
              style={
                e.etat === "fait"
                  ? { background: "var(--color-success)", color: "#fff" }
                  : e.etat === "encours"
                    ? { background: "var(--color-primary)", color: "#fff" }
                    : { border: "2px solid #c9d1de", color: "var(--color-muted)" }
              }
            >
              {e.etat === "fait" ? "✓" : i + 1}
            </span>
            <span
              style={{
                color: e.etat === "fait" ? "var(--color-success)" : e.etat === "encours" ? "var(--color-primary)" : "var(--color-muted)",
                fontWeight: e.etat === "a_venir" ? 400 : 600,
              }}
            >
              {e.label}
            </span>
          </li>
        ))}
      </ol>

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_340px]">
        <div className="flex min-w-0 flex-col gap-5">
          <section className="card p-5">
            <h2 className="mb-3 text-lg font-medium">Ce que le porteur a écrit</h2>
            <p className="whitespace-pre-wrap text-sm">{demande.description}</p>
          </section>

          <Echange
            demandeId={demande.id}
            messages={messages ?? []}
            prenomPorteur={demande.prenom}
            emailPorteur={demande.email}
            lienSuivi={lienSuivi}
            monPrenom={profile?.prenom ?? ""}
          />

          {demande.statut === "nouvelle" ? null : (
            <div id="traitement" className="flex scroll-mt-6 flex-col gap-5">
              {enQualification && (
                <CarteQualification
                  demande={demande}
                  partenaires={partenairesChoix}
                  promotions={promotions ?? []}
                  qualificateur={qualificateur}
                />
              )}

              {!enQualification && (
                <ResumeQualification demande={demande} qualificateur={qualificateur} />
              )}

              {orientee && (orientations?.length ?? 0) > 0 && (
                <SuiviOrientations demandeId={demande.id} orientations={orientations ?? []} />
              )}

              {tourOuvert && (
                <div id="consultation" className="scroll-mt-6">
                  <TourEnCours tour={tour!} demandeId={demande.id} monVote={monVote} estAdmin={estAdmin} maintenant={maintenant} />
                </div>
              )}

              {demande.statut === "en_instruction" && estAdmin && <AbandonnerVote demandeId={demande.id} />}

              {tourClos && !decisionPrononcee && (
                <div id="decision" className="scroll-mt-6">
                  {estAdmin ? (
                    <ProncerDecision tour={tour!} demandeId={demande.id} messageActuel={demande.message_porteur} />
                  ) : (
                    <section className="card p-5">
                      <h2 className="mb-1 text-lg font-semibold">Vote clos</h2>
                      <p className="text-sm" style={{ color: "#3b4452" }}>
                        Les avis sont rendus. L&apos;administrateur prononce la décision.
                      </p>
                    </section>
                  )}
                </div>
              )}

              {demande.message_porteur && !enQualification && (
                <section className="card p-5">
                  <h2 className="mb-2 text-lg font-medium">Message communiqué au porteur</h2>
                  <p className="whitespace-pre-wrap text-sm">{demande.message_porteur}</p>
                  <p className="mt-3 text-xs" style={{ color: "var(--color-muted)" }}>
                    Visible sur sa page de suivi.
                  </p>
                </section>
              )}

              {(orientee || refusee) && (
                <div>
                  <Rouvrir demandeId={demande.id} />
                </div>
              )}
            </div>
          )}
        </div>

        <aside className="flex min-w-0 flex-col gap-5">
          <FilInterne
            demandeId={demande.id}
            notes={(notes ?? []).map((n) => ({ ...n, quand: horodatage(n.created_at) }))}
            equipe={equipe}
            moi={user!.id}
          />

          <section className="card p-5">
            <h2 className="mb-3 text-lg font-medium">Contact</h2>
            <dl className="flex flex-col gap-2 text-sm">
              <div>
                <dt className="text-xs" style={{ color: "var(--color-muted)" }}>
                  Personne
                </dt>
                <dd className="font-medium">
                  {demande.prenom} {demande.nom}
                </dd>
              </div>
              <div>
                <dt className="text-xs" style={{ color: "var(--color-muted)" }}>
                  Email
                </dt>
                <dd>
                  <a href={`mailto:${demande.email}`} className="underline">
                    {demande.email}
                  </a>
                </dd>
              </div>
              {demande.telephone && (
                <div>
                  <dt className="text-xs" style={{ color: "var(--color-muted)" }}>
                    Téléphone
                  </dt>
                  <dd>
                    <a href={`tel:${demande.telephone}`} className="underline">
                      {demande.telephone}
                    </a>
                  </dd>
                </div>
              )}
              {demande.organisation && (
                <div>
                  <dt className="text-xs" style={{ color: "var(--color-muted)" }}>
                    Structure
                  </dt>
                  <dd>{demande.organisation}</dd>
                </div>
              )}
              <div>
                <dt className="text-xs" style={{ color: "var(--color-muted)" }}>
                  Territoire
                </dt>
                <dd>{PAYS_LABELS[demande.pays]}</dd>
              </div>
            </dl>
          </section>

          <LienSuivi lien={lienSuivi} prenom={demande.prenom} />

          <section className="card p-5">
            <h2 className="mb-3 text-lg font-medium">Suivi</h2>
            <dl className="flex flex-col gap-2 text-sm">
              <div>
                <dt className="text-xs" style={{ color: "var(--color-muted)" }}>
                  Interlocuteur
                </dt>
                <dd>
                  {demande.coach
                    ? `${demande.coach.prenom} ${demande.coach.nom}`
                    : "Aucun"}
                </dd>
              </div>
              <div>
                <dt className="text-xs" style={{ color: "var(--color-muted)" }}>
                  Profil
                </dt>
                <dd>
                  {demande.persona ? PERSONA_LABELS[demande.persona] : "Non déterminé"}
                  {demande.persona === "autre" && demande.persona_precision ? ` : ${demande.persona_precision}` : ""}
                </dd>
              </div>
              <div>
                <dt className="text-xs" style={{ color: "var(--color-muted)" }}>
                  Promotion
                </dt>
                <dd>
                  {promotionRattachee
                    ? `${promotionRattachee.nom}${
                        promotionRattachee.date_comite
                          ? ` — comité le ${new Date(
                              promotionRattachee.date_comite
                            ).toLocaleDateString("fr-FR", { timeZone: "Europe/Paris" })}`
                          : ""
                      }`
                    : "Aucune"}
                </dd>
              </div>
              <div>
                <dt className="text-xs" style={{ color: "var(--color-muted)" }}>
                  Orientations
                </dt>
                <dd>
                  {orientations?.length
                    ? `${orientations.length} mise(s) en relation`
                    : "Aucune"}
                </dd>
              </div>
            </dl>
          </section>

        </aside>
      </div>
    </div>
  );
}
