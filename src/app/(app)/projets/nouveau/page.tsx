import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { Profile } from "@/lib/types";
import { ProjetForm } from "./ProjetForm";

export default async function NouveauProjetPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const { data: profile } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user!.id)
    .single<Profile>();

  if (!profile || (profile.role !== "admin" && profile.role !== "partenaire")) {
    redirect("/projets");
  }

  return (
    <div className="max-w-md">
      <h1 className="mb-2 text-2xl font-semibold">Nouveau projet</h1>
      <p className="mb-6 text-sm" style={{ color: "var(--color-muted)" }}>
        Vous en serez le référent. Le projet est actif dès sa création — vous pourrez ensuite y
        inviter un porteur de projet.
      </p>
      <ProjetForm />
    </div>
  );
}
