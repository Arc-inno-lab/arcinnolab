import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { Profile, Invitation } from "@/lib/types";
import { ROLE_LABELS } from "@/lib/types";
import { CancelInvitationButton } from "./CancelInvitationButton";
import { GestionCompte } from "./GestionCompte";

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

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold">Administration</h1>
        <Link href="/invitations/new" className="btn btn-primary">
          Inviter un partenaire ou un porteur
        </Link>
      </div>

      <section className="card mb-10 flex flex-wrap items-center justify-between gap-3 p-4">
        <p className="text-sm">
          <strong>Promotions</strong> — création, dates du comité, candidats et suivi des projets : tout est dans le
          menu Promotions.
        </p>
        <Link href="/promotions" className="btn btn-outline">
          Ouvrir les promotions
        </Link>
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
                  <td className="px-4 py-2">{new Date(inv.date_expiration).toLocaleDateString("fr-FR", { timeZone: "Europe/Paris" })}</td>
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
