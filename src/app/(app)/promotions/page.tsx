import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { Profile, Promotion } from "@/lib/types";
import { FormPromotion } from "./FormPromotion";

export const dynamic = "force-dynamic";

function jour(d: string) {
  return new Date(`${d}T12:00:00Z`).toLocaleDateString("fr-FR", { timeZone: "Europe/Paris", day: "numeric", month: "long", year: "numeric" });
}

/**
 * Les promotions : les cohortes de projets accompagnés. Pour chacune, où en
 * est la sélection (au vote, admis) et combien de places restent.
 */
export default async function PromotionsPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const { data: profile } = await supabase.from("profiles").select("*").eq("id", user!.id).single<Profile>();
  if (profile?.role === "porteur") redirect("/mon-projet");
  const estAdmin = profile?.role === "admin";

  const [{ data: promotions }, { data: demandes }] = await Promise.all([
    supabase.from("promotions").select("*").order("created_at", { ascending: false }).returns<Promotion[]>(),
    supabase.from("demandes_accueil").select("promotion_id, statut").not("promotion_id", "is", null),
  ]);

  const compte = (promoId: string, statut: string) =>
    (demandes ?? []).filter((d) => d.promotion_id === promoId && d.statut === statut).length;

  return (
    <div className="flex flex-col gap-5">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold md:text-3xl">Promotions</h1>
          <p className="text-sm" style={{ color: "var(--color-muted)" }}>
            Les cohortes accompagnées. Un projet y entre après le vote des partenaires et la décision de l&apos;administrateur.
          </p>
        </div>
        {estAdmin && <FormPromotion libelle="+ Nouvelle promotion" />}
      </header>

      {!promotions?.length ? (
        <div className="card p-5 text-sm">
          <p className="font-semibold">Aucune promotion pour l&apos;instant.</p>
          <p style={{ color: "var(--color-muted)" }}>
            {estAdmin
              ? "Créez la première : sans promotion ouverte, aucun projet ne peut être mis au vote."
              : "Un administrateur doit créer la première promotion."}
          </p>
        </div>
      ) : (
        <ul className="grid gap-4 md:grid-cols-2">
          {promotions.map((p) => {
            const admis = compte(p.id, "admise");
            const auVote = compte(p.id, "en_instruction");
            const pct = p.places ? Math.min(100, Math.round((admis / p.places) * 100)) : 0;
            return (
              <li key={p.id}>
                <Link href={`/promotions/${p.id}`} className="card card-hover flex h-full flex-col gap-3 p-5" style={{ color: "var(--color-text)" }}>
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-lg font-bold">{p.nom}</p>
                      <p className="text-sm" style={{ color: "var(--color-muted)" }}>
                        {p.date_comite ? `Comité le ${jour(p.date_comite)}` : "Date du comité à fixer"}
                      </p>
                    </div>
                    <span
                      className="pastille"
                      style={p.ouverte ? { background: "var(--color-success-soft)", color: "var(--color-success)" } : { background: "#e9edf4", color: "#3b4452" }}
                    >
                      {p.ouverte ? "Ouverte" : "Fermée"}
                    </span>
                  </div>
                  {p.description && <p className="line-clamp-2 text-sm">{p.description}</p>}
                  <div className="flex flex-col gap-1.5">
                    <div className="flex justify-between text-sm">
                      <span className="font-semibold">
                        {admis} projet{admis > 1 ? "s" : ""} admis{p.places ? ` sur ${p.places} places` : ""}
                      </span>
                      {auVote > 0 && <span style={{ color: "#5b4bb7", fontWeight: 600 }}>{auVote} au vote</span>}
                    </div>
                    {p.places && (
                      <div className="h-2 overflow-hidden rounded-full" style={{ background: "#eef1f6" }}>
                        <div className="h-full" style={{ width: `${pct}%`, background: "var(--color-primary)" }} />
                      </div>
                    )}
                  </div>
                  {(p.date_debut || p.date_fin) && (
                    <p className="text-xs" style={{ color: "var(--color-muted)" }}>
                      Accompagnement {p.date_debut ? `du ${jour(p.date_debut)}` : ""} {p.date_fin ? `au ${jour(p.date_fin)}` : ""}
                    </p>
                  )}
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
