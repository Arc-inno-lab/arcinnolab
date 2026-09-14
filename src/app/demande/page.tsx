import Link from "next/link";
import type { Metadata } from "next";
import { Logo } from "@/components/Logo";
import { InterregMention } from "@/components/InterregFooter";
import { DemandeForm } from "./DemandeForm";

export const metadata: Metadata = {
  title: "Parlez-nous de votre projet — ArcInnoLab",
  description:
    "Déposez votre projet auprès d'ArcInnoLab, guichet unique transfrontalier d'accompagnement à l'innovation et aux transitions, entre France et Suisse.",
};

/**
 * Porte d'entrée publique du guichet.
 *
 * Le reste de la plateforme est fermé, accessible sur invitation nominative.
 * Cette page est la seule exception, et c'est délibéré : un guichet unique où
 * il faudrait déjà être invité pour se manifester ne serait pas un guichet.
 * Le dépôt n'ouvre aucun compte — c'est un coach qui invite ensuite, une fois
 * la demande qualifiée.
 */
export default function DemandePage() {
  return (
    <main id="main" className="mx-auto w-full max-w-2xl px-4 py-10">
      <div className="mb-8 flex flex-wrap items-center justify-between gap-4">
        <Logo />
        <Link href="/login" className="btn btn-outline">
          J&apos;ai déjà un compte
        </Link>
      </div>

      <h1 className="mb-2 text-3xl font-bold">Parlez-nous de votre projet</h1>
      <p className="mb-6 max-w-xl text-sm" style={{ color: "var(--color-muted)" }}>
        ArcInnoLab accueille les porteurs de projets liés à la Transition, de
        part et d&apos;autre de la frontière franco-suisse. Que votre projet en
        soit à l&apos;idée ou déjà en production, écrivez-nous : nous vous
        répondons et vous orientons vers la bonne structure.
      </p>

      <div className="card mb-6 p-4">
        <p className="text-sm">
          <strong>Ce qui se passe ensuite.</strong> Un membre de l&apos;équipe
          lit votre demande et vous propose un échange. À l&apos;issue de ce
          premier contact, deux suites sont possibles : une mise en relation
          avec la structure la plus adaptée — c&apos;est le cas le plus
          fréquent, et c&apos;est rapide — ou une candidature à
          l&apos;accompagnement ArcInnoLab, dont la sélection se fait une fois
          par an.
        </p>
        <p className="mt-2 text-sm" style={{ color: "var(--color-muted)" }}>
          Dans les deux cas, vous repartez avec une réponse et un
          interlocuteur. C&apos;est notre engagement.
        </p>
      </div>

      <DemandeForm />

      <div className="mt-8">
        <InterregMention />
      </div>
    </main>
  );
}
