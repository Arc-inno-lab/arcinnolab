import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { ROLE_LABELS, type Profile } from "@/lib/types";
import { ProfilPhotoForm } from "./ProfilPhotoForm";

export default async function ProfilPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .single<Profile>();

  if (!profile) redirect("/login");

  return (
    <div className="max-w-md">
      <h1 className="mb-2 text-2xl font-semibold">Mon profil</h1>
      <p className="mb-6 text-sm" style={{ color: "var(--color-muted)" }}>
        {profile.prenom} {profile.nom} · {ROLE_LABELS[profile.role]}
        {profile.organisation ? ` · ${profile.organisation}` : ""}
        <br />
        {profile.email}
      </p>
      <div className="card p-6">
        <ProfilPhotoForm nom={profile.nom} prenom={profile.prenom} photoUrl={profile.photo_url} />
      </div>
    </div>
  );
}
