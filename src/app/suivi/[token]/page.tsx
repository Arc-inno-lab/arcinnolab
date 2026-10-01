import Link from "next/link";
import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { Logo } from "@/components/Logo";
import { InterregMention } from "@/components/InterregFooter";
import type { DemandeStatut, MessageSuivi } from "@/lib/types";
import { EchangePorteur } from "./EchangePorteur";
import { VotreDemande, type DemandePorteur, type DocumentPorteur } from "./VotreDemande";

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
  // Ajoutés en migration 018 : le prénom de l'interlocuteur, pour que le
  // porteur sache à qui il parle, et son invitation une fois admis.
  coach_prenom: string | null;
  coach_nom: string | null;
  invitation_token: string | null;
  a_deja_un_acces: boolean;
};

const ETAPES = ["Demande reçue", "Premier échange", "Mise en relation ou candidature", "Réponse et prochaines étapes"];

function numeroEtape(s: Suivi): number {
  switch (s.statut) {
    case "nouvelle":
      return 1;
    case "en_accueil":
    case "en_qualification":
      return 2;
    case "orientee":
    case "en_attente_comite":
    case "en_instruction":
      return 3;
    default:
      return 4;
  }
}

function grandTitre(s: Suivi): string {
  switch (s.statut) {
    case "nouvelle":
      return "Votre demande est bien arrivée";
    case "en_accueil":
    case "en_qualification":
      return "Votre demande est entre de bonnes mains";
    case "orientee":
      return "Vous avez été mis en relation";
    case "en_attente_comite":
      return "Votre candidature ira au comité";
    case "en_instruction":
      return "Votre projet est à l'étude";
    case "admise":
      return "Bonne nouvelle : votre projet est retenu";
    case "non_retenue":
      return "Votre projet n'a pas été retenu";
    case "close":
      return "Votre demande est close";
  }
}

function jour(iso: string) {
  return new Date(iso).toLocaleDateString("fr-FR", { timeZone: "Europe/Paris", day: "numeric", month: "long", year: "numeric" });
}

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
    case "en_qualification":
      return {
        titre: "Votre interlocuteur étudie votre projet avec vous",
        texte:
          "Il fait le point avec vous pour comprendre votre projet et voir comment ArcInnoLab peut vous aider : une mise en relation directe, ou une candidature à une promotion d'accompagnement.",
        aFaire: "Répondez-lui ici ou par téléphone : c'est cet échange qui décide de la suite.",
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
            ).toLocaleDateString("fr-FR", { timeZone: "Europe/Paris", day: "numeric", month: "long", year: "numeric" })}.`
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
            ).toLocaleDateString("fr-FR", { timeZone: "Europe/Paris", day: "numeric", month: "long" })}.`
          : "Les cinq structures du consortium examinent votre candidature et rendent chacune un avis.",
        aFaire:
          "Rien à faire : ces avis prépareront la décision du comité, qui vous sera communiquée ici même avec ses motifs.",
        couleur: "#7c5cbf",
      };
    case "admise":
      return {
        titre: "Votre projet est retenu",
        texte:
          "Votre candidature a été retenue pour l'accompagnement ArcInnoLab. Un accompagnateur va construire votre parcours avec vous.",
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

  // Sa demande telle qu'il l'a écrite, et la liste de ses documents. Les
  // fichiers eux-mêmes ne sont lisibles que par l'équipe : le porteur garde
  // ses originaux.
  const [{ data: dem }, { data: docs }] = await Promise.all([
    supabase.rpc("get_demande_porteur", { p_token: token }),
    supabase.rpc("get_documents_suivi", { p_token: token }),
  ]);
  const demande = (dem as DemandePorteur[] | null)?.[0] ?? null;
  const fichiers = (docs as { id: string; nom: string; taille: number; ajoute_le: string }[] | null) ?? [];
  const documents: DocumentPorteur[] = fichiers.map((f) => ({
    id: f.id,
    nom: f.nom,
    taille: f.taille,
    quand: jour(f.ajoute_le),
  }));

  return (
    <main id="main" className="mx-auto w-full max-w-2xl px-4 py-6 text-[17px] md:py-10">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <Logo />
        <Link href="/a-propos" className="text-[15px]" style={{ color: "#3b4452" }}>
          À propos d&apos;ArcInnoLab
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
        <Contenu suivi={suivi} token={token} messages={messages} demande={demande} documents={documents} />
      )}

      <div className="mt-8">
        <InterregMention />
      </div>
    </main>
  );
}

function Contenu({
  suivi,
  token,
  messages,
  demande,
  documents,
}: {
  suivi: Suivi;
  token: string;
  messages: MessageSuivi[];
  demande: DemandePorteur | null;
  documents: DocumentPorteur[];
}) {
  const e = etat(suivi);
  const n = numeroEtape(suivi);
  const coach = suivi.coach_prenom;
  const dernier = messages[messages.length - 1];
  const aVousDeJouer = dernier?.auteur === "equipe" && !["admise", "non_retenue", "close"].includes(suivi.statut);
  const initiales = `${suivi.coach_prenom?.charAt(0) ?? ""}${suivi.coach_nom?.charAt(0) ?? ""}`.toUpperCase();

  return (
    <>
      <p style={{ color: "var(--color-muted)" }}>Bonjour {suivi.prenom},</p>
      <h1 className="mb-1 text-[26px] font-bold leading-tight">{grandTitre(suivi)}</h1>
      <p className="mb-5 text-[15px]" style={{ color: "var(--color-muted)" }}>
        Votre demande : {suivi.titre_projet}
        {demande && (
          <>
            {" · "}
            <a href="#ma-demande" className="font-semibold underline" style={{ color: "var(--color-primary)" }}>
              {demande.modifiable ? "la revoir, la compléter" : "la relire, ajouter un document"}
            </a>
          </>
        )}
      </p>

      <section className="card mb-6 p-5">
        <div className="mb-3 grid grid-cols-4 gap-1.5" aria-hidden="true">
          {ETAPES.map((_, i) => (
            <span
              key={i}
              className="h-1.5 rounded-full"
              style={{ background: i + 1 < n ? "var(--color-success)" : i + 1 === n ? "var(--color-primary)" : "#dfe4ec" }}
            />
          ))}
        </div>
        <p className="text-[15px] font-bold" style={{ color: "var(--color-primary)" }}>
          Étape {n} sur 4 · {ETAPES[n - 1]}
        </p>

        {coach && (
          <div className="mt-4 flex items-center gap-3">
            <span
              className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full text-lg font-bold text-white"
              style={{ background: "var(--color-primary)" }}
              aria-hidden="true"
            >
              {initiales}
            </span>
            <div>
              <p className="text-[18px] font-bold">
                {suivi.coach_prenom} {suivi.coach_nom}
              </p>
              <p className="text-[15px]" style={{ color: "var(--color-muted)" }}>
                s&apos;occupe de votre demande
              </p>
            </div>
          </div>
        )}

        <div className="mt-4 rounded-xl p-4" style={{ background: "var(--color-primary-soft)" }}>
          <p className="text-[15px] font-bold" style={{ color: "var(--color-primary)" }}>
            {aVousDeJouer ? "À vous de jouer" : "Ce qui se passe maintenant"}
          </p>
          <p className="mt-1">
            {aVousDeJouer
              ? `${coach ?? "L'équipe"} vous a écrit. Répondez juste en dessous.`
              : `${e.texte} ${e.aFaire}`}
          </p>
        </div>

        {suivi.statut === "admise" && (
          <div className="mt-4">
            {suivi.a_deja_un_acces ? (
              <>
                <p className="mb-3">Votre espace projet est prêt : vos étapes, vos rendez-vous et vos échanges vous y attendent.</p>
                <Link href="/login" className="btn btn-primary btn-grand w-full">
                  Accéder à mon espace
                </Link>
              </>
            ) : suivi.invitation_token ? (
              <>
                <p className="mb-3">
                  Votre espace projet vous attend : vos étapes, vos rendez-vous et vos échanges avec
                  {coach ? ` ${coach}` : " votre accompagnateur"}, au même endroit.
                </p>
                <Link href={`/invite/${suivi.invitation_token}`} className="btn btn-primary btn-grand w-full">
                  Créer mon accès
                </Link>
              </>
            ) : (
              <p style={{ color: "#3b4452" }}>
                {coach ?? "Votre accompagnateur"} vous envoie bientôt le lien pour créer votre accès à votre espace projet.
              </p>
            )}
          </div>
        )}
      </section>

      {/* Le message de décision, tel que l'équipe l'a validé : c'est la
          justification que le porteur est en droit d'obtenir, surtout en cas
          de refus. */}
      {suivi.message_porteur && (
        <section className="card mb-6 p-5">
          <h2 className="mb-2 text-[18px] font-bold">
            {suivi.statut === "non_retenue" ? "Pourquoi votre projet n'a pas été retenu" : "Le message de l'équipe"}
          </h2>
          <p className="whitespace-pre-wrap">{suivi.message_porteur}</p>
        </section>
      )}

      <EchangePorteur token={token} messages={messages} coach={coach} />

      {demande && <VotreDemande token={token} demande={demande} documents={documents} interlocuteur={coach} />}

      <section className="card mb-6 p-5">
        <h2 className="mb-3 text-[18px] font-bold">La suite, en 4 étapes</h2>
        <ol className="flex flex-col gap-3">
          {ETAPES.map((libelle, i) => {
            const fait = i + 1 < n || (i + 1 === n && n === 4);
            const courant = i + 1 === n && n !== 4;
            return (
              <li key={libelle} className="flex items-center gap-3">
                <span
                  className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[15px] font-bold"
                  style={
                    fait
                      ? { background: "var(--color-success)", color: "#fff" }
                      : courant
                        ? { background: "var(--color-primary)", color: "#fff" }
                        : { border: "2px solid #cfd6e2", color: "#3b4452" }
                  }
                  aria-hidden="true"
                >
                  {fait ? "✓" : i + 1}
                </span>
                <span className={courant ? "font-bold" : ""}>
                  {i === 1 && coach ? `Premier échange avec ${coach}` : libelle}
                </span>
              </li>
            );
          })}
        </ol>
        <p className="mt-4 text-[15px]" style={{ color: "var(--color-muted)" }}>
          Déposée le {jour(suivi.deposee_le)} · mise à jour le {jour(suivi.mise_a_jour_le)}
          {suivi.nb_orientations > 0
            ? ` · ${suivi.nb_orientations} mise${suivi.nb_orientations > 1 ? "s" : ""} en relation`
            : ""}
        </p>
      </section>

      <p className="text-[15px]" style={{ color: "var(--color-muted)" }}>
        Gardez cette page dans vos favoris : c&apos;est votre accès, sans mot de passe. Elle se met à jour toute seule.
      </p>
    </>
  );
}
