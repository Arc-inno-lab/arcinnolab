import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { chargerAFaire } from "@/lib/a-faire";
import type { AppNotification, Profile } from "@/lib/types";

export const dynamic = "force-dynamic";

function salutation(): string {
  return new Date().toLocaleDateString("fr-FR", {
    timeZone: "Europe/Paris",
    weekday: "long",
    day: "numeric",
    month: "long",
  });
}

function quand(iso: string): string {
  return new Date(iso).toLocaleString("fr-FR", {
    timeZone: "Europe/Paris",
    day: "numeric",
    month: "long",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/**
 * L'accueil de l'équipe ne répond qu'à une question : qu'attend-on de moi ?
 * Tout ce qui s'affiche ici appelle un geste, avec son bouton. Le reste —
 * l'historique, les chiffres — se trouve ailleurs.
 */
export default async function AFairePage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const { data: profile } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user!.id)
    .single<Profile>();

  if (!profile) return null;
  if (profile.role === "porteur") redirect("/mon-projet");

  const [aFaire, { data: nouvelles }] = await Promise.all([
    chargerAFaire(supabase, user!.id, profile.role),
    supabase
      .from("notifications")
      .select("*")
      .eq("user_id", user!.id)
      .order("created_at", { ascending: false })
      .limit(6)
      .returns<AppNotification[]>(),
  ]);

  const titre =
    aFaire.total === 0
      ? "Rien ne vous attend pour l'instant"
      : aFaire.total === 1
        ? "Une chose attend une action de votre part"
        : `${aFaire.total} choses attendent une action de votre part`;

  return (
    <div className="flex flex-col gap-6">
      <header>
        <p className="text-sm" style={{ color: "var(--color-muted)" }}>
          Bonjour {profile.prenom} · {salutation()}
        </p>
        <h1 className="text-2xl font-bold md:text-3xl">{titre}</h1>
      </header>

      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
        <div className="flex flex-col gap-5">
          <Bloc titre="Demandes sans réponse" lien={{ href: "/demandes", label: "Toute la file" }} vide="Toutes les demandes ont un interlocuteur.">
            {aFaire.demandes.map((d, i) => (
              <Ligne
                key={d.id}
                href={`/demandes/${d.id}`}
                titre={d.titre_projet}
                sousTitre={`${d.prenom} ${d.nom}${d.organisation ? ` · ${d.organisation}` : ""}`}
                etat={
                  d.joursAttente >= 7
                    ? { texte: `Sans réponse depuis ${d.joursAttente} jours`, alerte: true }
                    : { texte: d.joursAttente === 0 ? "Arrivée aujourd'hui" : `Arrivée il y a ${d.joursAttente} j` }
                }
                action="Je prends en charge"
                principale={i === 0}
              />
            ))}
          </Bloc>

          <Bloc titre="Votre avis est attendu" note="Tous les partenaires doivent se prononcer" vide="Aucune consultation n'attend votre avis.">
            {aFaire.avis.map((a) => (
              <Ligne
                key={a.demandeId}
                href={`/demandes/${a.demandeId}`}
                titre={a.titre}
                sousTitre={`${a.porteur} · ${a.votes} avis rendu${a.votes > 1 ? "s" : ""} sur ${a.attendus}`}
                etat={{
                  texte:
                    a.joursRestants <= 0
                      ? "Clôture aujourd'hui"
                      : `Clôture dans ${a.joursRestants} jour${a.joursRestants > 1 ? "s" : ""}`,
                  alerte: a.joursRestants <= 1,
                }}
                action="Donner mon avis"
              />
            ))}
          </Bloc>

          <Bloc titre="Dans vos projets" lien={{ href: "/projets", label: "Tous les projets" }} vide="Aucun retard, rien à valider.">
            {aFaire.projets.map((p) => (
              <Ligne
                key={p.etapeId}
                href={`/projets/${p.projetId}`}
                titre={p.titre}
                sousTitre={`${p.projetTitre}${p.porteur ? ` · ${p.porteur}` : ""}`}
                etat={{ texte: p.detail, alerte: p.nature === "en_retard" }}
                action={p.nature === "a_valider" ? "Valider" : p.nature === "rdv_a_confirmer" ? "Répondre" : "Ouvrir"}
              />
            ))}
          </Bloc>
        </div>

        <aside className="card flex flex-col gap-4 p-5">
          <h2 className="text-base font-semibold">Dernières nouvelles</h2>
          {!nouvelles?.length ? (
            <p className="text-sm" style={{ color: "var(--color-muted)" }}>
              Rien de neuf.
            </p>
          ) : (
            <ul className="flex flex-col gap-3">
              {nouvelles.map((n) => (
                <li key={n.id} className="flex flex-col gap-0.5">
                  {n.lien ? (
                    <Link href={n.lien} className="text-sm" style={{ color: "var(--color-text)", fontWeight: n.lu ? 400 : 600 }}>
                      {n.titre}
                    </Link>
                  ) : (
                    <span className="text-sm">{n.titre}</span>
                  )}
                  <span className="text-xs" style={{ color: "var(--color-muted)" }}>
                    {quand(n.created_at)}
                  </span>
                </li>
              ))}
            </ul>
          )}
          <Link href="/notifications" className="text-sm">
            Tout l&apos;historique
          </Link>
        </aside>
      </div>
    </div>
  );
}

function Bloc({
  titre,
  note,
  lien,
  vide,
  children,
}: {
  titre: string;
  note?: string;
  lien?: { href: string; label: string };
  vide: string;
  children: React.ReactNode[];
}) {
  return (
    <section className="card p-5">
      <div className="mb-2 flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-base font-semibold">{titre}</h2>
        {lien ? (
          <Link href={lien.href} className="text-sm">
            {lien.label}
          </Link>
        ) : note ? (
          <span className="text-xs" style={{ color: "var(--color-muted)" }}>
            {note}
          </span>
        ) : null}
      </div>
      {children.length ? (
        <ul className="flex flex-col">{children}</ul>
      ) : (
        <p className="border-t pt-3 text-sm" style={{ color: "var(--color-muted)", borderColor: "#eef1f6" }}>
          {vide}
        </p>
      )}
    </section>
  );
}

function Ligne({
  href,
  titre,
  sousTitre,
  etat,
  action,
  principale = false,
}: {
  href: string;
  titre: string;
  sousTitre: string;
  etat: { texte: string; alerte?: boolean };
  action: string;
  principale?: boolean;
}) {
  return (
    <li className="flex flex-wrap items-center gap-x-4 gap-y-2 border-t py-3" style={{ borderColor: "#eef1f6" }}>
      <div className="min-w-0 flex-1 basis-64">
        <Link href={href} className="font-semibold" style={{ color: "var(--color-text)" }}>
          {titre}
        </Link>
        <p className="truncate text-sm" style={{ color: "var(--color-muted)" }}>
          {sousTitre}
        </p>
      </div>
      <span
        className="text-sm"
        style={{ color: etat.alerte ? "var(--color-danger)" : "#3b4452", fontWeight: etat.alerte ? 600 : 500 }}
      >
        {etat.texte}
      </span>
      <Link href={href} className={principale ? "btn btn-primary" : "btn btn-outline"}>
        {action}
      </Link>
    </li>
  );
}
