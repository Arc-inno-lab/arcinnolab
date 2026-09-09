import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { BootstrapForm } from "./BootstrapForm";

// Dépend de l'état courant de la base (existe-t-il déjà un admin ?) : jamais prérendu statiquement.
export const dynamic = "force-dynamic";

export default async function BootstrapPage() {
  const supabase = await createClient();
  const { data: exists } = await supabase.rpc("admin_exists");

  if (exists) {
    redirect("/login");
  }

  return (
    <main id="main" className="flex min-h-screen items-center justify-center px-4 py-10">
      <div className="w-full max-w-sm">
        <div
          className="rounded-lg border p-6"
          style={{ background: "var(--color-surface)", borderColor: "var(--color-border)" }}
        >
          <h1 className="mb-1 text-xl font-semibold">Initialisation ArcInnoLab</h1>
          <p className="mb-5 text-sm" style={{ color: "var(--color-muted)" }}>
            Aucun compte administrateur n&apos;existe encore. Créez le premier compte — cette page
            se désactivera automatiquement ensuite.
          </p>
          <BootstrapForm />
        </div>
      </div>
    </main>
  );
}
