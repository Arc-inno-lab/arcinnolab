import Link from "next/link";
import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { Logo } from "@/components/Logo";
import { InterregMention } from "@/components/InterregFooter";
import type { DemandeStatut, MessageSuivi } from "@/lib/types";
import { EchangePorteur } from "./EchangePorteur";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Suivi de votre demande — ArcInnoLab",
  robots: { index: false, follow: false },
};

type Suivi = {
  titre_projet: string;
  prenom: string;
  statut: DemandeStatut;
  deposee_le: string;
  mise_a_jour_le: string;
  prise_en_charge: boolean;
  nb_orientations: number;
  promotion_nom: string | null;
  promotion_date_comite: string | null;
  message_porteur: string | null;
  instruction_en_cours: boolean;
  instruction_echeance: string | null;
};

/**
 * Ce que le porteur lit, formulé de son point de vue.
 *
 * Les libellés internes (« en accueil », « en attente du comité ») ne veulent
 * rien dire pour quelqu'un d'extérieur : chaque état est donc traduit en une
 * phrase qui répond à sa seule vraie question — que se passe-t-il maintenant,
 * et qu'est-ce que j'ai à faire ?
 */
function etat(s: Suivi): { titre: string; texte: string; aFaire: string; couleur: string } {
  switch (s.statut) {
    case "nouvelle":
      return {
        titre: "Votre demande est arrivée",
        texte:
          "Elle est dans la file de l'équipe ArcInnoLab. Quelqu'un va s'en saisir et vous proposer un échange.",
        aFaire: "Rien pour l'instant. Nous revenons vers vous.",
        couleur: "var(--color-accent)",
      };
    case "en_accueil":
      return {
        titre: "Un membre de l'équipe s'occupe de votre demande",
        texte:
          "Votre dossier a un interlocuteur. Il prend connaissance de votre projet et vous contacte pour un premier échange.",
        aFaire: "Guettez son message. Si vous ne recevez rien sous une semaine, relancez-nous.",
        couleur: "var(--color-primary-2)",
      };
    case "orientee":
      return {
        titre: "Vous avez été mis en relation",
        texte:
          s.nb_orientations > 1
            ? `L'équipe vous a orienté vers ${s.nb_orientations} structures dont le travail correspond à votre projet.`
            : "L'équipe vous a orienté vers la structure dont le travail correspond à votre projet.",
        aFaire:
          "Prenez contact si ce n'est pas déjà fait. Nous vérifions de notre côté que la mise en relation a bien abouti.",
        couleur: "var(--color-success)",
      };
    case "en_attente_comite":
      return {
        titre: "Votre candidature est retenue pour le comité",
        texte: s.promotion_date_comite
          ? `Votre projet sera examiné par le comité mixte franco-suisse de la ${s.promotion_nom}, qui se réunit le ${new Date(
              s.promotion_date_comite
            ).toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" })}.`
          : `Votre projet sera examiné par le comité mixte franco-suisse${
              s.promotion_nom ? ` de la ${s.promotion_nom}` : ""
            }. La date de sa prochaine réunion vous sera communiquée.`,
        aFaire:
          "Le comité ne se réunit qu'une fois par an : l'attente peut être longue. Votre interlocuteur reste joignable d'ici là.",
        couleur: "#c98b1e",
      };
    case "en_instruction":
      return {
        titre: "Votre projet est en cours d'instruction",
        texte: s.instruction_echeance
          ? `Les cinq structures du consortium examinent votre candidature et rendent chacune un avis. La consultation se termine le ${new Date(
              s.instruction_echeance
            ).toLocaleDateString("fr-FR", { day: "numeric", month: "long" })}.`
          : "Les cinq structures du consortium examinent votre candidature et rendent chacune un avis.",
        aFaire:
          "Rien à faire : ces avis prépareront la décision du comité, qui vous sera communiquée ici même avec ses motifs.",
        couleur: "#7c5cbf",
      };
    case "admise":
      return {
        titre: "Votre projet est retenu",
        texte:
          "Votre candidature a été retenue pour l'accompagnement ArcInnoLab. Un coach référent va construire votre parcours avec vous.",
        aFaire: "Votre interlocuteur vous contacte pour définir les prochaines étapes.",
        couleur: "var(--color-primary)",
      };
    case "non_retenue":
      return {
        titre: "Votre projet n'a pas été retenu pour l'accompagnement",
        texte:
          "Les motifs vous sont donnés ci-dessous. Cette décision ne porte pas de jugement sur la valeur de votre projet : les places sont limitées et les critères tiennent à l'adéquation avec le programme.",
        aFaire:
          "Votre interlocuteur peut vous orienter vers d'autres dispositifs. N'hésitez pas à le solliciter.",
        couleur: "var(--color-muted)",
      };
    case "close":
      return {
        titre: "Votre demande est close",
        texte: "Ce dossier n'est plus suivi par l'équipe ArcInnoLab.",
        aFaire:
          "Si c'est une erreur ou si votre projet a évolué, déposez une nouvelle demande.",
        couleur: "#8a8f98",
      };
  }
}

export default async function SuiviPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const supabase = await createClient();

  const { data } = await supabase.rpc("get_suivi_demande", { p_token: token });
  const suivi = (data as Suivi[] | null)?.[0];

  const { data: fil } = await supabase.rpc("get_messages_suivi", { p_token: token });
  const messages = (fil as MessageSuivi[] | null) ?? [];

  return (
    <main id="main" className="mx-auto w-full max-w-2xl px-4 py-10">
      <div className="mb-8 flex flex-wrap items-center justify-between gap-4">
        <Logo />
        <Link href="/a-propos" className="btn btn-outline">
          À propos du projet
        </Link>
      </div>

      {!suivi ? (
        <div className="card p-6">
          <h1 className="mb-2 text-xl font-semibold">Ce lien de suivi n&apos;est pas valide</h1>
          <p className="text-sm">
            Vérifiez que vous l&apos;avez copié en entier. Si vous ne le
            retrouvez pas, écrivez-nous ou déposez une nouvelle demande — nous
            ferons le rapprochement.
          </p>
          <Link href="/demande" className="btn btn-primary mt-5">
            Déposer une demande
          </Link>
        </div>
      ) : (
        <>
          <p className="text-sm" style={{ color: "var(--color-muted)" }}>
            Bonjour {suivi.prenom}, voici où en est votre demande.
          </p>
          <h1 className="mb-6 text-2xl font-semibold">{suivi.titre_projet}</h1>

          <section className="card mb-5 p-6">
            <span
              className="mb-3 inline-block rounded-full px-3 py-1 text-xs font-semibold"
              style={{ background: etat(suivi).couleur, color: "#fff" }}
            >
              {etat(suivi).titre}
            </span>
            <p className="text-sm">{etat(suivi).texte}</p>

            <p className="mt-4 text-sm font-medium">Ce que vous avez à faire</p>
            <p className="text-sm" style={{ color: "var(--color-muted)" }}>
              {etat(suivi).aFaire}
            </p>
          </section>

          {/* Le message de décision, quand il y en a un. Il est affiché tel que
              l'équipe l'a validé — c'est la justification que le porteur est en
              droit d'obtenir, surtout en cas de refus. */}
          {suivi.message_porteur && (
            <section className="card mb-5 p-6">
              <h2 className="mb-3 text-lg font-medium">
                {suivi.statut === "non_retenue"
                  ? "Pourquoi votre projet n'a pas été retenu"
                  : "Message de l'équipe"}
              </h2>
              <p className="whitespace-pre-wrap text-sm">{suivi.message_porteur}</p>
            </section>
          )}

          <section className="card mb-5 p-6">
            <h2 className="mb-3 text-lg font-medium">Repères</h2>
            <dl className="flex flex-col gap-2 text-sm">
              <div className="flex justify-between gap-4">
                <dt style={{ color: "var(--color-muted)" }}>Demande déposée le</dt>
                <dd>{new Date(suivi.deposee_le).toLocaleDateString("fr-FR")}</dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt style={{ color: "var(--color-muted)" }}>Dernière mise à jour</dt>
                <dd>{new Date(suivi.mise_a_jour_le).toLocaleDateString("fr-FR")}</dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt style={{ color: "var(--color-muted)" }}>Interlocuteur désigné</dt>
                <dd>{suivi.prise_en_charge ? "Oui" : "Pas encore"}</dd>
              </div>
              {suivi.nb_orientations > 0 && (
                <div className="flex justify-between gap-4">
                  <dt style={{ color: "var(--color-muted)" }}>Mises en relation</dt>
                  <dd>{suivi.nb_orientations}</dd>
                </div>
              )}
            </dl>
          </section>

          <EchangePorteur token={token} messages={messages} />

          <p className="text-sm" style={{ color: "var(--color-muted)" }}>
            Cette page se met à jour toute seule. Conservez son adresse : elle
            reste votre accès au suivi, sans compte ni mot de passe.
          </p>
        </>
      )}

      <div className="mt-8">
        <InterregMention />
      </div>
    </main>
  );
}
