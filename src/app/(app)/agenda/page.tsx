import { createClient } from "@/lib/supabase/server";
import type { Evenement, Profile } from "@/lib/types";
import { CarteEvenement } from "@/components/CarteEvenement";
import { champsParis, estPasse, grouperParMois } from "@/lib/agenda";
import { EtatEvenement, FormEvenement } from "./FormEvenement";

export const dynamic = "force-dynamic";

/** Lecture de l'heure, hors du rendu (règle de pureté de React). */
function instantCourant(): number {
  return Date.now();
}

/**
 * L'agenda ArcInnoLab : ateliers, challenges, conférences, permanences.
 * L'équipe publie, tout le monde consulte et ajoute à son propre agenda.
 */
export default async function AgendaPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const { data: profile } = await supabase.from("profiles").select("*").eq("id", user!.id).single<Profile>();
  const porteur = profile?.role === "porteur";
  const equipe = profile?.role === "admin" || profile?.role === "partenaire";
  const estAdmin = profile?.role === "admin";

  const maintenant = instantCourant();
  const depuis = new Date(maintenant - 180 * 86_400_000).toISOString();
  const { data } = await supabase
    .from("evenements")
    .select("*")
    .eq("retire", false)
    .gte("debut", depuis)
    .order("debut", { ascending: true })
    .returns<Evenement[]>();
  const evenements = data ?? [];
  const aVenir = evenements.filter((e) => !estPasse(e, maintenant));
  const passes = evenements.filter((e) => estPasse(e, maintenant)).reverse();

  const gestion = (e: Evenement) => {
    if (!(estAdmin || (equipe && e.cree_par === user!.id))) return null;
    const d = champsParis(e.debut);
    const f = e.fin ? champsParis(e.fin) : null;
    return (
      <>
        <FormEvenement
          evenement={e}
          champs={{ jour: d.jour, heureDebut: d.heure, jourFin: f?.jour ?? "", heureFin: f?.heure ?? "" }}
          libelle="Modifier"
          classe="btn btn-outline text-sm"
        />
        <EtatEvenement evenement={e} />
      </>
    );
  };

  return (
    <div className={`flex flex-col gap-6 ${porteur ? "text-[17px]" : ""}`}>
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold md:text-3xl">Agenda</h1>
          <p className="text-sm" style={{ color: "var(--color-muted)" }}>
            {porteur
              ? "Les rendez-vous du réseau ArcInnoLab : ateliers, rencontres, challenges. Ajoutez ceux qui vous intéressent à votre agenda."
              : "Les événements du réseau. Les événements publics s'affichent aussi sur la page de dépôt."}
          </p>
        </div>
        {equipe && <FormEvenement libelle="+ Nouvel événement" />}
      </header>

      {aVenir.length === 0 ? (
        <section className="card p-6">
          <p className="font-semibold">Aucun événement à venir pour l&apos;instant.</p>
          <p className="mt-1 text-sm" style={{ color: "var(--color-muted)" }}>
            {equipe ? "Publiez le prochain atelier ou la prochaine rencontre : il apparaîtra ici et, s'il est public, sur la vitrine." : "Revenez bientôt : l'équipe publie ici ses prochains rendez-vous."}
          </p>
        </section>
      ) : (
        grouperParMois(aVenir).map((g) => (
          <section key={g.mois} aria-label={g.mois} className="flex flex-col gap-3">
            <h2 className="text-lg font-semibold">{g.mois}</h2>
            {g.liste.map((e) => (
              <CarteEvenement key={e.id} evenement={e} montrerVisibilite={equipe} grand={porteur}>
                {gestion(e)}
              </CarteEvenement>
            ))}
          </section>
        ))
      )}

      {passes.length > 0 && (
        <details className="card p-4">
          <summary className="cursor-pointer font-semibold">Événements passés ({passes.length})</summary>
          <div className="mt-3 flex flex-col gap-3">
            {passes.map((e) => (
              <CarteEvenement key={e.id} evenement={e} montrerVisibilite={equipe} passe />
            ))}
          </div>
        </details>
      )}
    </div>
  );
}
