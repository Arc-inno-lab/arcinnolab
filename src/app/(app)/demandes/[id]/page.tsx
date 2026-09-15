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
} from "@/lib/types";
import {
  DEMANDE_STATUT_LABELS,
  DEMANDE_STATUT_COLORS,
  PAYS_LABELS,
  PERSONA_LABELS,
} from "@/lib/types";
import {
  BoutonPriseEnCharge,
  FormQualification,
  FormOrientation,
  FormPromotion,
  FormDecision,
} from "./TraitementDemande";
import { OuvrirTour, TourEnCours, ProncerDecision } from "./TourDeVote";

export const dynamic = "force-dynamic";

/**
 * Lecture de l'heure courante, volontairement hors du composant : React
 * interdit les appels impurs pendant le rendu, et à juste titre — leur résultat
 * change à chaque exécution. L'instant est capté une fois, puis transmis.
 */
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

  const tour = tours?.[0] ?? null;
  const monVote =
    (tour?.votes ?? []).find((v: Vote) => v.votant_id === user!.id) ?? null;

  const { data: votantsAttendus } = await supabase.rpc("nb_votants_attendus");

  const estAdmin = profile?.role === "admin";
  const tourOuvert = tour && (tour.statut === "en_cours" || tour.statut === "complet");
  const tourClos = tour && tour.statut === "clos";
  const decisionPrononcee = demande.statut === "admise" || demande.statut === "non_retenue";

  // La consultation des partenaires est ouverte dès qu'un coach suit le
  // dossier. Elle a d'abord été conditionnée au versement préalable dans une
  // promotion : le résultat était une fonctionnalité invisible, enterrée
  // derrière deux étapes que rien n'annonçait à l'écran. Consulter ses pairs
  // sur un dossier n'a pas à dépendre de l'existence d'une promotion — le
  // rattachement, lui, reste possible et utile, mais après coup.
  const decisionPossible = demande.statut === "en_instruction" || decisionPrononcee;

  const deposee = new Date(demande.created_at);
  const maintenant = instantCourant();

  return (
    <div>
      <Link href="/demandes" className="mb-4 inline-block text-sm" style={{ color: "var(--color-primary)" }}>
        ← Retour à l&apos;accueil des porteurs
      </Link>

      <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-2xl font-semibold">{demande.titre_projet}</h1>
          <p className="text-sm" style={{ color: "var(--color-muted)" }}>
            Déposée le{" "}
            {deposee.toLocaleDateString("fr-FR", {
              day: "numeric",
              month: "long",
              year: "numeric",
            })}
          </p>
        </div>
        <span
          className="rounded-full px-3 py-1 text-sm font-semibold"
          style={{ background: DEMANDE_STATUT_COLORS[demande.statut], color: "#fff" }}
        >
          {DEMANDE_STATUT_LABELS[demande.statut]}
        </span>
      </div>

      {/* Fil conducteur. Il existe parce que les actions disponibles dépendent
          de l'étape en cours : sans ce repère, une fonctionnalité qui n'est pas
          encore accessible passe pour une fonctionnalité absente. */}
      <ol className="mb-6 flex flex-wrap gap-2" aria-label="Étapes du traitement">
        {(
          [
            { cle: "prise", label: "Prise en charge", fait: !!demande.coach_id },
            { cle: "qualif", label: "Qualification", fait: !!demande.persona },
            {
              cle: "instruction",
              label: "Consultation des partenaires",
              fait: !!tour,
              encours: !!tourOuvert,
            },
            {
              cle: "decision",
              label: "Décision",
              fait: decisionPrononcee,
              encours: !!tourClos && !decisionPrononcee,
            },
          ] as Array<{ cle: string; label: string; fait: boolean; encours?: boolean }>
        ).map((e) => (
          <li
            key={e.cle}
            className="rounded-full px-3 py-1 text-xs font-medium"
            style={
              e.encours
                ? { background: "var(--color-primary)", color: "#fff" }
                : e.fait
                ? { background: "var(--color-success)", color: "#fff" }
                : { background: "var(--color-surface-alt)", color: "var(--color-muted)" }
            }
          >
            {e.fait && !e.encours ? "✓ " : ""}
            {e.label}
          </li>
        ))}
      </ol>

      <div className="grid gap-5 lg:grid-cols-[1fr_340px]">
        <div className="flex flex-col gap-5">
          <section className="card p-5">
            <h2 className="mb-3 text-lg font-medium">Ce que le porteur a écrit</h2>
            <p className="whitespace-pre-wrap text-sm">{demande.description}</p>
          </section>

          {!demande.coach_id ? (
            <section className="card p-5">
              <h2 className="mb-1 text-lg font-medium">Personne ne suit cette demande</h2>
              <p className="mb-4 text-sm" style={{ color: "var(--color-muted)" }}>
                Prenez-la en charge pour devenir l&apos;interlocuteur de ce
                porteur. Tant que personne ne s&apos;en saisit, elle reste en
                tête de file.
              </p>
              <BoutonPriseEnCharge demandeId={demande.id} />
            </section>
          ) : (
            <>
              <FormQualification demande={demande} />
              <FormOrientation demandeId={demande.id} orientations={orientations ?? []} />

              {!decisionPossible && (
                <FormPromotion demandeId={demande.id} promotions={promotions ?? []} />
              )}

              {/* Instruction collégiale : consultation, puis décision. */}
              {!tour && !decisionPrononcee && (
                <OuvrirTour
                  demandeId={demande.id}
                  promotionId={demande.promotion_id}
                  votantsAttendus={votantsAttendus ?? 1}
                  promotions={promotions ?? []}
                />
              )}

              {tourOuvert && (
                <TourEnCours
                  tour={tour!}
                  demandeId={demande.id}
                  monVote={monVote}
                  estAdmin={estAdmin}
                  maintenant={maintenant}
                />
              )}

              {tourClos && estAdmin && !decisionPrononcee && (
                <ProncerDecision
                  tour={tour!}
                  demandeId={demande.id}
                  messageActuel={demande.message_porteur}
                />
              )}

              {decisionPrononcee && demande.message_porteur && (
                <section className="card p-5">
                  <h2 className="mb-2 text-lg font-medium">Message communiqué au porteur</h2>
                  <p className="whitespace-pre-wrap text-sm">{demande.message_porteur}</p>
                  <p className="mt-3 text-xs" style={{ color: "var(--color-muted)" }}>
                    Visible sur sa page de suivi.
                  </p>
                </section>
              )}

              {!decisionPossible && (
                <FormDecision demandeId={demande.id} statut={demande.statut} />
              )}
            </>
          )}
        </div>

        <aside className="flex flex-col gap-5">
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

          <section className="card p-5">
            <h2 className="mb-3 text-lg font-medium">Suivi</h2>
            <dl className="flex flex-col gap-2 text-sm">
              <div>
                <dt className="text-xs" style={{ color: "var(--color-muted)" }}>
                  Coach référent
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
                <dd>{demande.persona ? PERSONA_LABELS[demande.persona] : "Non déterminé"}</dd>
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
                            ).toLocaleDateString("fr-FR")}`
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

          {demande.statut === "admise" && !demande.projet_id && (
            <section className="card p-5">
              <h2 className="mb-2 text-lg font-medium">Et maintenant ?</h2>
              <p className="mb-3 text-sm">
                Cette demande a été retenue. Créez la fiche projet, puis invitez
                le porteur : il obtiendra son accès à la plateforme.
              </p>
              <Link href="/projets/nouveau" className="btn btn-primary">
                Créer la fiche projet
              </Link>
            </section>
          )}
        </aside>
      </div>
    </div>
  );
}
