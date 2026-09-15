import Link from "next/link";
import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { Logo } from "@/components/Logo";
import { InterregMention } from "@/components/InterregFooter";
import { FormulaireReinitialisation } from "./FormulaireReinitialisation";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Choisir un nouveau mot de passe — ArcInnoLab",
  robots: { index: false, follow: false },
};

type Reinit = { email: string; prenom: string; valide: boolean };

/**
 * Page de réinitialisation de mot de passe.
 *
 * Elle est publique par nécessité : quelqu'un qui a perdu son mot de passe ne
 * peut pas se connecter pour le changer. Ce qui protège ici n'est pas la
 * session mais le jeton — à usage unique, expirant, et vérifié par la base
 * elle-même. Le nouveau mot de passe n'est connu que de la personne : ni
 * l'administrateur qui a émis le lien, ni l'application ne le voient.
 */
export default async function ReinitialiserPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const supabase = await createClient();

  const { data } = await supabase.rpc("get_reinitialisation", { p_token: token });
  const reinit = (data as Reinit[] | null)?.[0];

  return (
    <main id="main" className="mx-auto w-full max-w-md px-4 py-12">
      <div className="mb-8">
        <Logo />
      </div>

      {!reinit || !reinit.valide ? (
        <div className="card p-6">
          <h1 className="mb-2 text-xl font-semibold">Ce lien n&apos;est plus utilisable</h1>
          <p className="text-sm">
            Un lien de réinitialisation ne sert qu&apos;une fois et ne reste
            valable que quelques jours. Demandez-en un nouveau à
            l&apos;administrateur de la plateforme.
          </p>
          <Link href="/login" className="btn btn-outline mt-5">
            Retour à la connexion
          </Link>
        </div>
      ) : (
        <div className="card p-6">
          <h1 className="mb-1 text-xl font-semibold">
            Bonjour {reinit.prenom}, choisissez votre mot de passe
          </h1>
          <p className="mb-5 text-sm" style={{ color: "var(--color-muted)" }}>
            Il remplacera l&apos;ancien pour le compte {reinit.email}. Personne
            d&apos;autre que vous ne le connaîtra.
          </p>
          <FormulaireReinitialisation token={token} />
        </div>
      )}

      <div className="mt-8">
        <InterregMention />
      </div>
    </main>
  );
}
