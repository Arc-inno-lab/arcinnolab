import { createAdminClient } from "@/lib/supabase/admin";
import { AcceptInvitationForm } from "./AcceptInvitationForm";
import { ROLE_LABELS, type Invitation } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function InvitePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const admin = createAdminClient();

  const { data: invitation } = await admin
    .from("invitations")
    .select("*")
    .eq("token", token)
    .single<Invitation>();

  const now = new Date();
  const expired = invitation && new Date(invitation.date_expiration) < now;
  const invalid = !invitation || invitation.statut !== "en_attente" || expired;

  return (
    <main id="main" className="flex min-h-screen items-center justify-center px-4 py-10">
      <div className="w-full max-w-sm">
        <div
          className="rounded-lg border p-6"
          style={{ background: "var(--color-surface)", borderColor: "var(--color-border)" }}
        >
          {invalid ? (
            <>
              <h1 className="mb-2 text-xl font-semibold">Invitation invalide</h1>
              <p className="text-sm" style={{ color: "var(--color-muted)" }}>
                {!invitation
                  ? "Ce lien d'invitation n'existe pas."
                  : expired
                  ? "Ce lien d'invitation a expiré. Demandez à votre référent ArcInnoLab de vous en envoyer un nouveau."
                  : "Ce lien d'invitation a déjà été utilisé ou a été annulé."}
              </p>
            </>
          ) : (
            <>
              <h1 className="mb-1 text-xl font-semibold">Bienvenue sur ArcInnoLab</h1>
              <p className="mb-5 text-sm" style={{ color: "var(--color-muted)" }}>
                Vous avez été invité·e en tant que <strong>{ROLE_LABELS[invitation.role_cible]}</strong>{" "}
                ({invitation.email}). Créez votre mot de passe pour finaliser votre accès.
              </p>
              <AcceptInvitationForm token={token} email={invitation.email} />
            </>
          )}
        </div>
      </div>
    </main>
  );
}
