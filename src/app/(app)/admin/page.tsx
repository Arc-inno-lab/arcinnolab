import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { Profile, Invitation, Promotion } from "@/lib/types";
import { ROLE_LABELS } from "@/lib/types";
import { CancelInvitationButton } from "./CancelInvitationButton";
import { GestionCompte } from "./GestionCompte";
import { NouvellePromotion } from "../demandes/NouvellePromotion";

export default async function AdminPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const { data: me } = await supabase.from("profiles").select("*").eq("id", user!.id).single<Profile>();

  if (!me || me.role !== "admin") redirect("/");

  const { data: profiles } = await supabase
    .from("profiles")
    .select("*")
    .order("created_at", { ascending: false })
    .returns<Profile[]>();

  const { data: invitations } = await supabase
    .from("invitations")
    .select("*")
    .order("date_envoi", { ascending: false })
    .returns<Invitation[]>();

  const { data: promotions } = await supabase
    .from("promotions")
    .select("*")
    .order("created_at", { ascending: false })
    .returns<Promotion[]>();

  return (
    <div>
      <h1 className="mb-6 text-2xl font-semibold">Back-office administrateur</h1>

      {/* Les promotions viennent en premier : sans promotion ouverte, aucune
          candidature ne peut être versée au comité, et toute la voie
          « accompagnement » reste théorique. C'est la première chose à faire
          sur une plateforme neuve, donc la première chose à voir. */}
      <section aria-labelledby="promotions-heading" className="mb-10">
        <h2 id="promotions-heading" className="mb-1 text-lg font-medium">
          Promotions ({promotions?.length ?? 0})
        </h2>
        <p className="mb-3 text-sm" style={{ color: "var(--color-muted)" }}>
          Une promotion, c&apos;est la cohorte examinée par un comité mixte
          franco-suisse donné. Tant qu&apos;il n&apos;y en a aucune
          d&apos;ouverte, une candidature retenue n&apos;a nulle part où aller.
        </p>

        {!promotions?.length ? (
          <div className="card mb-4 p-4 text-sm">
            <p className="mb-1 font-medium">Aucune promotion n&apos;existe encore.</p>
            <p style={{ color: "var(--color-muted)" }}>
              Créez la première ci-dessous, avec la date réelle du prochain
              comité si vous la connaissez.
            </p>
          </div>
        ) : (
          <ul className="mb-4 flex flex-col gap-2">
            {promotions.map((p) => (
              <li key={p.id} className="card flex flex-wrap items-center justify-between gap-2 p-4">
                <div>
                  <p className="font-medium">{p.nom}</p>
                  <p className="text-sm" style={{ color: "var(--color-muted)" }}>
                    {p.date_comite
                      ? `Comité le ${new Date(p.date_comite).toLocaleDateString("fr-FR", {
                          day: "numeric",
                          month: "long",
                          year: "numeric",
                        })}`
                      : "Date du comité non renseignée"}
                  </p>
                </div>
                <span
                  className="rounded-full px-2 py-0.5 text-xs font-semibold"
                  style={{
                    background: p.ouverte ? "var(--color-success)" : "var(--color-muted)",
                    color: "#fff",
                  }}
                >
                  {p.ouverte ? "Ouverte" : "Close"}
                </span>
              </li>
            ))}
          </ul>
        )}

        <NouvellePromotion />
      </section>

      <section aria-labelledby="comptes-heading" className="mb-10">
        <h2 id="comptes-heading" className="mb-3 text-lg font-medium">
          Comptes ({profiles?.length ?? 0})
        </h2>
        <div className="overflow-x-auto rounded-lg border" style={{ borderColor: "var(--color-border)" }}>
          <table className="w-full text-sm">
            <caption className="sr-only">Liste des comptes utilisateurs</caption>
            <thead>
              <tr className="border-b text-left" style={{ borderColor: "var(--color-border)", background: "var(--color-bg)" }}>
                <th scope="col" className="px-4 py-2 font-medium">Nom</th>
                <th scope="col" className="px-4 py-2 font-medium">Email</th>
                <th scope="col" className="px-4 py-2 font-medium">Rôle</th>
                <th scope="col" className="px-4 py-2 font-medium">Organisation</th>
                <th scope="col" className="px-4 py-2 font-medium">Gestion</th>
              </tr>
            </thead>
            <tbody>
              {profiles?.map((p) => (
                <tr key={p.id} className="border-b last:border-0 align-top" style={{ borderColor: "var(--color-border)" }}>
                  <td className="px-4 py-2">{p.prenom} {p.nom}</td>
                  <td className="px-4 py-2">{p.email}</td>
                  <td className="px-4 py-2">{ROLE_LABELS[p.role]}</td>
                  <td className="px-4 py-2">{p.organisation || "—"}</td>
                  <td className="px-4 py-2">
                    <GestionCompte profil={p} estMoi={p.id === me.id} />
                  </td>
                </tr>
              ))}
              {!profiles?.length && (
                <tr>
                  <td colSpan={5} className="px-4 py-3 text-center" style={{ color: "var(--color-muted)" }}>
                    Aucun compte.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      <section aria-labelledby="invitations-heading">
        <h2 id="invitations-heading" className="mb-3 text-lg font-medium">
          Invitations ({invitations?.length ?? 0})
        </h2>
        <div className="overflow-x-auto rounded-lg border" style={{ borderColor: "var(--color-border)" }}>
          <table className="w-full text-sm">
            <caption className="sr-only">Liste des invitations envoyées</caption>
            <thead>
              <tr className="border-b text-left" style={{ borderColor: "var(--color-border)", background: "var(--color-bg)" }}>
                <th scope="col" className="px-4 py-2 font-medium">Email</th>
                <th scope="col" className="px-4 py-2 font-medium">Rôle cible</th>
                <th scope="col" className="px-4 py-2 font-medium">Statut</th>
                <th scope="col" className="px-4 py-2 font-medium">Expire le</th>
                <th scope="col" className="px-4 py-2 font-medium">
                  <span className="sr-only">Actions</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {invitations?.map((inv) => (
                <tr key={inv.id} className="border-b last:border-0" style={{ borderColor: "var(--color-border)" }}>
                  <td className="px-4 py-2">{inv.email}</td>
                  <td className="px-4 py-2">{ROLE_LABELS[inv.role_cible]}</td>
                  <td className="px-4 py-2">{inv.statut}</td>
                  <td className="px-4 py-2">{new Date(inv.date_expiration).toLocaleDateString("fr-FR")}</td>
                  <td className="px-4 py-2">
                    {inv.statut === "en_attente" && <CancelInvitationButton id={inv.id} />}
                  </td>
                </tr>
              ))}
              {!invitations?.length && (
                <tr>
                  <td colSpan={5} className="px-4 py-3 text-center" style={{ color: "var(--color-muted)" }}>
                    Aucune invitation envoyée.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
