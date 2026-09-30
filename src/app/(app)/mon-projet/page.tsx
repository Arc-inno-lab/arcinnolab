import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { chargerMonProjet, type Personne } from "@/lib/mon-projet";
import { aujourdhuiIso, estEnRetard, heure, jourCourt, jourLong, lireParcours, ordreParcours } from "@/lib/parcours";
import { RDV_MODE_LABELS, type EtapeProjet, type Profile } from "@/lib/types";
import { AjoutParcours } from "@/components/AjoutParcours";
import { Avatar } from "@/components/Avatar";
import { ChatProjet } from "@/components/ChatProjet";
import { AFaireMaintenant } from "./AFaireMaintenant";
import { ReponseRdv } from "./ProchainRdv";

export const dynamic = "force-dynamic";

/** L'instant du chargement, lu hors rendu. */
function maintenant() {
  return Date.now();
}

function majuscule(texte: string) {
  return texte.charAt(0).toUpperCase() + texte.slice(1);
}

/**
 * La page du porteur. Elle répond à trois questions, dans cet ordre : qu'ai-je
 * à faire maintenant ? quand est mon prochain rendez-vous ? qui m'accompagne ?
 * Le parcours complet vient ensuite, en simple liste. Pas de tableau, pas de
 * colonnes, pas de jargon : les porteurs ne vivent pas dans les logiciels.
 */
export default async function MonProjetPage({ searchParams }: { searchParams: Promise<{ p?: string }> }) {
  const { p } = await searchParams;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const { data: profile } = await supabase.from("profiles").select("*").eq("id", user!.id).single<Profile>();
  if (!profile) redirect("/login");
  if (profile.role !== "porteur") redirect("/projets");

  const donnees = await chargerMonProjet(supabase, profile.id, p);

  if (!donnees) {
    return (
      <div className="mx-auto flex max-w-xl flex-col gap-4 py-6 text-[17px]">
        <p style={{ color: "var(--color-muted)" }}>Bonjour {profile.prenom},</p>
        <h1 className="text-2xl font-bold">Votre projet arrive bientôt</h1>
        <p>
          Votre compte est prêt. Dès que l&apos;équipe ArcInnoLab aura ouvert votre projet, vous le retrouverez ici avec
          les prochaines étapes et vos rendez-vous.
        </p>
        <p style={{ color: "var(--color-muted)" }}>Une question d&apos;ici là ? Répondez simplement au message qui vous a invité.</p>
      </div>
    );
  }

  const { projet, accompagnateur, partenaires, colonnes, etapes, messages, documents, autresProjets } = donnees;
  const instant = maintenant();
  const aujourdhui = aujourdhuiIso(instant);
  const lecture = lireParcours(etapes, colonnes, instant);
  const pct = lecture.total ? Math.round((lecture.validees / lecture.total) * 100) : 0;

  const equipe: Personne[] = [...(accompagnateur ? [accompagnateur] : []), ...partenaires];
  const prenoms = new Map(equipe.map((x) => [x.id, x.prenom]));
  const prenomAcc = accompagnateur?.prenom ?? "votre accompagnateur";
  const interlocuteurs = equipe.map((x) => ({ id: x.id, prenom: x.prenom, nom: x.nom }));

  const prochaine = lecture.prochaine;
  const prochaineEnRetard = prochaine ? estEnRetard(prochaine, lecture.terminales, aujourdhui) : false;
  const rdv = lecture.prochainRdv;
  const parcours = ordreParcours(
    etapes.filter((e) => e.rdv_statut !== "annule"),
    lecture.terminales
  );

  const carteAFaire = (
    <section className="card p-5 md:p-6" style={{ border: "2px solid var(--color-primary)" }} aria-labelledby="a-faire">
      <p id="a-faire" className="text-[15px] font-bold" style={{ color: "var(--color-primary)" }}>
        À faire maintenant
      </p>
      {prochaine ? (
        <>
          <h2 className="mt-1 text-[22px] font-bold leading-tight">{prochaine.titre}</h2>
          {prochaine.validation === "refusee" && prochaine.avis && (
            <p className="mt-2 rounded-lg px-3 py-2 text-[16px]" style={{ background: "var(--color-surface-alt)" }}>
              {prenomAcc} vous demande de la reprendre : « {prochaine.avis} »
            </p>
          )}
          <p className="mt-1 text-[16px] font-semibold" style={{ color: prochaineEnRetard ? "var(--color-danger)" : "#3b4452" }}>
            {prochaine.date_echeance
              ? `Prévue le ${jourCourt(prochaine.date_echeance)}${prochaineEnRetard ? " · un peu en retard" : ""}`
              : "Pas de date prévue"}
          </p>
          <AFaireMaintenant
            key={prochaine.id}
            projetId={projet.id}
            etapeId={prochaine.id}
            titre={prochaine.titre}
            dateEcheance={prochaine.date_echeance}
          />
        </>
      ) : (
        <>
          <h2 className="mt-1 text-[22px] font-bold leading-tight">
            {lecture.total ? "Tout est fait pour l'instant" : "Votre parcours commence"}
          </h2>
          <p className="mt-1 text-[16px]" style={{ color: "#3b4452" }}>
            {lecture.total
              ? `${lecture.aValider ? `${majuscule(prenomAcc)} relit ce que vous avez terminé. ` : ""}Ajoutez la suite quand vous êtes prêt.`
              : `Avec ${prenomAcc}, notez ici les premières choses à faire.`}
          </p>
          <div className="mt-4">
            <AjoutParcours
              projetId={projet.id}
              interlocuteurs={interlocuteurs}
              prenomAccompagnateur={accompagnateur?.prenom}
              libelle="Ajouter une étape ou un rendez-vous"
              classeBouton="btn btn-primary btn-grand w-full md:w-auto"
            />
          </div>
        </>
      )}
    </section>
  );

  const carteRdv = rdv && rdv.rdv_debut && (
    <section className="card p-5" aria-labelledby="prochain-rdv">
      <p id="prochain-rdv" className="flex items-center gap-2 text-[15px] font-bold" style={{ color: "#7a4a00" }}>
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
          <rect x="4" y="5" width="16" height="15" rx="2" />
          <path d="M4 10h16M9 3v4M15 3v4" />
        </svg>
        Prochain rendez-vous
      </p>
      <h2 className="mt-1 text-[20px] font-bold">
        {majuscule(jourLong(rdv.rdv_debut))} à {heure(rdv.rdv_debut)}
      </h2>
      <p className="text-[17px]">
        {rdv.titre}
        {rdv.rdv_mode ? ` · ${RDV_MODE_LABELS[rdv.rdv_mode]}` : ""}
      </p>
      {rdv.rdv_lieu &&
        (/^https?:\/\//.test(rdv.rdv_lieu) ? (
          <a href={rdv.rdv_lieu} target="_blank" rel="noopener noreferrer" className="text-[16px]">
            Rejoindre la visio
          </a>
        ) : (
          <p className="text-[16px]" style={{ color: "#3b4452" }}>
            {rdv.rdv_lieu}
          </p>
        ))}
      <p className="mt-1 text-[15px]" style={{ color: "var(--color-muted)" }}>
        {rdv.rdv_statut === "confirme"
          ? "Confirmé"
          : rdv.cree_par === profile.id
            ? `Proposé par vous · ${rdv.rdv_avec ? (prenoms.get(rdv.rdv_avec) ?? prenomAcc) : "l'équipe"} doit encore confirmer`
            : `${rdv.cree_par ? (prenoms.get(rdv.cree_par) ?? "L'équipe") : "L'équipe"} vous propose ce moment`}
      </p>
      {rdv.rdv_statut === "propose" && rdv.cree_par !== profile.id ? (
        <ReponseRdv key={rdv.id} projetId={projet.id} etapeId={rdv.id} />
      ) : (
        <a href={`/api/rdv/${rdv.id}/ics`} className="btn btn-outline btn-grand mt-3 w-full md:w-auto">
          Ajouter à mon agenda
        </a>
      )}
    </section>
  );

  const carteAccompagnateur = accompagnateur && (
    <section className="card flex items-center gap-4 p-5">
      <Avatar prenom={accompagnateur.prenom} nom={accompagnateur.nom} photoUrl={accompagnateur.photo_url} size="lg" />
      <div className="min-w-0 flex-1">
        <p className="text-[15px]" style={{ color: "var(--color-muted)" }}>
          Votre accompagnateur
        </p>
        <p className="text-[18px] font-bold">
          {accompagnateur.prenom} {accompagnateur.nom}
        </p>
        {accompagnateur.organisation && (
          <p className="text-[15px]" style={{ color: "var(--color-muted)" }}>
            {accompagnateur.organisation}
          </p>
        )}
      </div>
      <Link
        href={`/mon-projet/messages?p=${projet.id}`}
        className="btn btn-grand shrink-0 lg:hidden"
        style={{ background: "var(--color-primary-soft)", color: "var(--color-primary)" }}
      >
        Écrire
      </Link>
    </section>
  );

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-5 text-[17px]">
      <header>
        <p className="text-[17px]" style={{ color: "var(--color-muted)" }}>
          Bonjour {profile.prenom},
        </p>
        <h1 className="text-[26px] font-bold leading-tight md:text-3xl">{projet.titre}</h1>
        {lecture.total > 0 && (
          <div className="mt-3 flex flex-col gap-2 md:flex-row-reverse md:items-center md:justify-end md:gap-4">
            <p className="text-[16px] font-bold">
              {lecture.validees} étape{lecture.validees > 1 ? "s" : ""} validée{lecture.validees > 1 ? "s" : ""} sur {lecture.total}
            </p>
            <div className="h-2.5 overflow-hidden rounded-full md:w-72" style={{ background: "#dfe4ec" }} role="img" aria-label={`Avancement : ${pct} %`}>
              <div className="h-full rounded-full" style={{ width: `${pct}%`, background: "var(--color-success)" }} />
            </div>
          </div>
        )}
        {autresProjets.length > 0 && (
          <p className="mt-2 text-[15px]">
            Vos autres projets :{" "}
            {autresProjets.map((a, i) => (
              <span key={a.id}>
                {i > 0 && ", "}
                <Link href={`/mon-projet?p=${a.id}`}>{a.titre}</Link>
              </span>
            ))}
          </p>
        )}
      </header>

      <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,1fr)_400px]">
        <div className="flex min-w-0 flex-col gap-5">
          {carteAFaire}
          <div className="flex flex-col gap-5 lg:hidden">
            {carteRdv}
            {carteAccompagnateur}
          </div>

          <section className="card p-5 md:p-6" aria-labelledby="parcours">
            <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
              <h2 id="parcours" className="text-[20px] font-bold">
                Votre parcours
              </h2>
              <div className="hidden md:block">
                <AjoutParcours
                  projetId={projet.id}
                  interlocuteurs={interlocuteurs}
                  prenomAccompagnateur={accompagnateur?.prenom}
                  libelle="+ Ajouter une étape ou un rendez-vous"
                  classeBouton="text-[16px] font-bold"
                />
              </div>
            </div>
            {!parcours.length ? (
              <p style={{ color: "var(--color-muted)" }}>Rien pour l&apos;instant.</p>
            ) : (
              <ul className="flex flex-col">
                {parcours.map((e) => (
                  <LigneParcours
                    key={e.id}
                    etape={e}
                    projetId={projet.id}
                    courante={prochaine?.id === e.id}
                    enRetard={estEnRetard(e, lecture.terminales, aujourdhui)}
                    faite={e.colonne_id ? lecture.terminales.has(e.colonne_id) : false}
                    prenomValidateur={e.id_partenaire_validateur ? (prenoms.get(e.id_partenaire_validateur) ?? prenomAcc) : prenomAcc}
                    prenomAcc={prenomAcc}
                  />
                ))}
              </ul>
            )}
            <div className="mt-4 md:hidden">
              <AjoutParcours
                projetId={projet.id}
                interlocuteurs={interlocuteurs}
                prenomAccompagnateur={accompagnateur?.prenom}
                libelle="+ Ajouter une étape ou un rendez-vous"
                classeBouton="w-full rounded-2xl border-2 border-dashed px-4 py-3 text-left text-[17px] font-bold"
              />
            </div>
          </section>
        </div>

        <aside className="hidden flex-col gap-5 lg:flex">
          {carteAccompagnateur}
          {carteRdv}
          <section className="card flex flex-col overflow-hidden" aria-labelledby="echanges">
            <h2 id="echanges" className="border-b px-5 py-4 text-[18px] font-bold" style={{ borderColor: "var(--color-border)" }}>
              Vos échanges avec l&apos;équipe
            </h2>
            <ChatProjet
              projetId={projet.id}
              messages={messages.slice(-20)}
              documents={documents}
              moi={profile.id}
              aujourdhui={aujourdhui}
              hauteur="22rem"
            />
          </section>
        </aside>
      </div>
    </div>
  );
}

function LigneParcours({
  etape: e,
  projetId,
  courante,
  enRetard,
  faite,
  prenomValidateur,
  prenomAcc,
}: {
  etape: EtapeProjet;
  projetId: string;
  courante: boolean;
  enRetard: boolean;
  faite: boolean;
  prenomValidateur: string;
  prenomAcc: string;
}) {
  const rdv = e.type === "rendez_vous";
  let rond: React.ReactNode;
  let detail: string;
  let couleur = "var(--color-muted)";

  if (rdv) {
    rond = (
      <span className="flex h-8 w-8 items-center justify-center rounded-lg" style={{ background: "#fdf1dc", color: "#7a4a00" }}>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden="true">
          <rect x="4" y="5" width="16" height="15" rx="2" />
          <path d="M4 10h16M9 3v4M15 3v4" />
        </svg>
      </span>
    );
    detail = e.rdv_debut
      ? `${majuscule(jourCourt(e.rdv_debut))}, ${heure(e.rdv_debut)} · ${e.rdv_statut === "confirme" ? "confirmé" : "à confirmer"}`
      : "Date à fixer";
    couleur = "#7a4a00";
  } else if (e.validation === "validee") {
    rond = (
      <span className="flex h-8 w-8 items-center justify-center rounded-full text-white" style={{ background: "var(--color-success)" }}>
        ✓
      </span>
    );
    detail = `Validée par ${prenomValidateur}`;
    couleur = "var(--color-success)";
  } else if (e.validation === "a_valider" || faite) {
    rond = (
      <span className="flex h-8 w-8 items-center justify-center rounded-full border-2" style={{ borderColor: "var(--color-success)", color: "var(--color-success)" }}>
        ✓
      </span>
    );
    detail = `Faite · ${prenomAcc} va la relire`;
  } else if (courante) {
    rond = (
      <span className="flex h-8 w-8 items-center justify-center rounded-full" style={{ background: "var(--color-primary-soft)" }}>
        <span className="h-3 w-3 rounded-full" style={{ background: "var(--color-primary)" }} />
      </span>
    );
    detail = `${e.validation === "refusee" ? "À reprendre" : "En cours"}${e.date_echeance ? ` · prévue le ${jourCourt(e.date_echeance)}` : ""}`;
    couleur = enRetard ? "var(--color-danger)" : "var(--color-primary)";
  } else {
    rond = <span className="block h-8 w-8 rounded-full border-2" style={{ borderColor: "#cfd6e2" }} />;
    detail = `${e.type === "document" ? "Document à fournir · " : ""}${
      e.validation === "refusee" ? "À reprendre · " : ""
    }${e.date_echeance ? `Pour le ${jourCourt(e.date_echeance)}` : "Pas encore de date"}`;
    if (enRetard) couleur = "var(--color-danger)";
  }

  const contenu = (
    <>
      <span className="shrink-0 pt-0.5 md:pt-0" aria-hidden="true">
        {rond}
      </span>
      <span className="flex min-w-0 flex-1 flex-col md:flex-row md:items-center md:justify-between md:gap-4">
        <span className={`text-[17px] leading-snug ${courante ? "font-bold" : ""}`}>
          {rdv && !/^rendez-vous/i.test(e.titre) ? `Rendez-vous : ${e.titre}` : e.titre}
        </span>
        <span className="text-[15px] md:shrink-0 md:text-right" style={{ color: couleur, fontWeight: couleur === "var(--color-muted)" ? 400 : 600 }}>
          {detail}
        </span>
      </span>
    </>
  );

  return (
    <li className="border-t first:border-t-0" style={{ borderColor: "#eef1f6" }}>
      {rdv ? (
        // Un rendez-vous n'a pas de page à lui : tout ce qu'il y a à en savoir
        // tient dans cette ligne et dans la carte « Prochain rendez-vous ».
        <div className="flex items-start gap-3 py-3 md:items-center">{contenu}</div>
      ) : (
        <Link
          href={`/projets/${projetId}/etapes/${e.id}`}
          className="flex items-start gap-3 py-3 md:items-center"
          style={{ color: "var(--color-text)", textDecoration: "none" }}
        >
          {contenu}
        </Link>
      )}
    </li>
  );
}
