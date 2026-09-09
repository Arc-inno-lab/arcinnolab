import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { Profile } from "@/lib/types";
import { InvitationForm } from "./InvitationForm";

export default async function NewInvitationPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const { data: profile } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user!.id)
    .single<Profile>();

  if (!profile || (profile.role !== "admin" && profile.role !== "partenaire")) {
    redirect("/");
  }

  return (
    <div className="max-w-md">
      <h1 className="mb-2 text-2xl font-semibold">Inviter un membre</h1>
      <p className="mb-6 text-sm" style={{ color: "var(--color-muted)" }}>
        {profile.role === "admin"
          ? "Comme administrateur, vous pouvez inviter un Partenaire ArcInnoLab ou un Porteur de projet."
          : "Vous pouvez inviter un Porteur de projet."}
        {" "}Un lien à usage unique, valable 7 jours, sera généré.
      </p>
      <InvitationForm canInvitePartenaire={profile.role === "admin"} />
    </div>
  );
}
