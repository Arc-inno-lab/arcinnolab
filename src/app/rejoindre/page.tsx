import Link from "next/link";
import type { Metadata } from "next";
import { Logo } from "@/components/Logo";
import { InterregMention } from "@/components/InterregFooter";
import { FormulaireRejoindre } from "./FormulaireRejoindre";
import { PARTENAIRES } from "../demande/contenu";

export const metadata: Metadata = {
  title: "Rejoindre la plateforme — ArcInnoLab",
  description: "Demandez votre accès à la plateforme ArcInnoLab : l'équipe valide chaque compte et vous envoie votre lien par e-mail.",
};

/**
 * Le lien à envoyer aux partenaires pour ouvrir leurs comptes : chacun remplit
 * sa demande, l'administrateur choisit le rôle et valide. Rien n'est créé
 * automatiquement.
 */
export default function RejoindrePage() {
  const structures = Array.from(new Set(["ArcInnoLab", ...PARTENAIRES.map((p) => p.nom)]));
  return (
    <main id="main" className="mx-auto w-full max-w-xl px-4 py-8 text-[17px] md:py-12">
      <div className="mb-6 flex items-center justify-between gap-4">
        <Link href="/" aria-label="ArcInnoLab, accueil">
          <Logo />
        </Link>
      </div>
      <h1 className="text-[28px] font-bold leading-tight">Rejoindre la plateforme ArcInnoLab</h1>
      <p className="mt-2" style={{ color: "#3b4452" }}>
        Pour les équipes des structures partenaires et les porteurs accompagnés. Remplissez ce formulaire : l&apos;équipe
        ArcInnoLab vérifie votre demande et attribue votre rôle, puis vous recevez par e-mail un lien pour créer votre
        accès et choisir votre mot de passe.
      </p>
      <p className="mt-2 text-[15px]" style={{ color: "var(--color-muted)" }}>
        Vous avez un projet à présenter ? Ce n&apos;est pas ici :{" "}
        <Link href="/demande#deposer" className="font-semibold">
          déposez votre projet
        </Link>
        .
      </p>
      <div className="card mt-6 p-5 md:p-6">
        <FormulaireRejoindre structures={structures} />
      </div>
      <div className="mt-8">
        <InterregMention />
      </div>
    </main>
  );
}
