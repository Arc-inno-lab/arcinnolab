import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { DemandeAccueil, Orientation, Profile, Promotion } from "@/lib/types";
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

export const dynamic = "force-dynamic";

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

  const deposee = new Date(demande.created_at);

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
              {demande.statut !== "en_attente_comite" && demande.statut !== "admise" && (
                <FormPromotion demandeId={demande.id} promotions={promotions ?? []} />
              )}
              <FormDecision demandeId={demande.id} statut={demande.statut} />
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
