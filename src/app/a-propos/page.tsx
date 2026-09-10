import Link from "next/link";
import type { Metadata } from "next";
import { Logo } from "@/components/Logo";
import { InterregFooter } from "@/components/InterregFooter";

export const metadata: Metadata = {
  title: "À propos du projet — INTERLAB / ArcInnoLab",
  description:
    "INTERLAB / ArcInnoLab : guichet unique transfrontalier d'accompagnement à l'innovation et aux transitions, cofinancé par l'Union européenne dans le cadre du programme Interreg France-Suisse 2021-2027.",
};

const PARTENAIRES = [
  { nom: "UTBM", role: "Chef de file — France", site: "Belfort · Techn'Hom", src: "/brand/partenaires/utbm.png" },
  { nom: "Basel Area Innovation", role: "Chef de file — Suisse", site: "Bâle", src: "/brand/partenaires/basel-area.svg" },
  { nom: "KMØ", role: "Partenaire — France", site: "Mulhouse", src: "/brand/partenaires/km0.png" },
  { nom: "Haute École Arc", role: "Partenaire — Suisse", site: "Neuchâtel · Jura", src: "/brand/partenaires/he-arc.png" },
  { nom: "Ville de Delémont", role: "Partenaire — Suisse", site: "Delémont · SAFED", src: "/brand/partenaires/ville-delemont.png" },
];

/**
 * Page publique dédiée au projet.
 * Elle porte les quatre éléments exigés par le Guide de communication Interreg
 * France-Suisse 2021-2027 (p. 5) pour un site internet : logos du programme et
 * des co-financeurs, lien vers interreg-francesuisse.eu, nom du projet, et
 * description succincte comprenant l'objectif principal, les résultats attendus
 * et la mise en évidence du soutien financier.
 */
export default function AProposPage() {
  return (
    <main id="main" className="mx-auto w-full max-w-3xl px-4 py-10">
      <div className="mb-8 flex flex-wrap items-center justify-between gap-4">
        <Logo />
        <Link href="/login" className="btn btn-outline">
          Accéder à la plateforme
        </Link>
      </div>

      <div className="hero mb-8">
        <div className="hero-bg" style={{ backgroundImage: "url(/brand/hero.jpg)" }} aria-hidden="true" />
        <div className="hero-content">
          <p className="mb-1 text-sm font-medium opacity-90">Projet Interreg France-Suisse 2021-2027</p>
          <h1 className="mb-2 text-3xl font-bold">INTERLAB — ArcInnoLab</h1>
          <p className="max-w-2xl text-sm opacity-90">
            Un guichet unique transfrontalier pour accueillir, orienter et accompagner les porteurs de
            projets liés à la Transition — écologique, numérique, sociétale et industrielle.
          </p>
        </div>
      </div>

      <section className="card mb-6 p-6" aria-labelledby="objectif">
        <h2 id="objectif" className="mb-2 text-lg font-medium">
          Objectif principal
        </h2>
        <p className="text-sm">
          Créer une plateforme franco-suisse d&apos;accompagnement à l&apos;innovation et aux
          transitions. ArcInnoLab ne se substitue pas aux structures existantes : il crée des ponts
          entre elles, simplifie l&apos;accès aux dispositifs et apporte une dimension transfrontalière
          unique. Un porteur de projet n&apos;est jamais seul : il sait toujours à qui s&apos;adresser,
          et comment avancer.
        </p>
      </section>

      <section className="card mb-6 p-6" aria-labelledby="resultats">
        <h2 id="resultats" className="mb-3 text-lg font-medium">
          Résultats attendus
        </h2>
        <ul className="flex flex-col gap-2 text-sm">
          <li>
            <strong>Des plateformes physiques</strong> à Belfort, Mulhouse, Delémont et Bâle, au plus
            près des porteurs de projets et des acteurs économiques.
          </li>
          <li>
            <strong>Une plateforme digitale commune</strong> — celle-ci — qui centralise
            l&apos;information et permet de trouver le bon interlocuteur rapidement.
          </li>
          <li>
            <strong>Une méthodologie d&apos;accompagnement partagée</strong> entre les cinq structures
            du consortium, de part et d&apos;autre de la frontière.
          </li>
          <li>
            <strong>Des porteurs de projets orientés et accompagnés</strong> sur les secteurs de la
            Transition : microtechniques, mobilité intelligente, industrie du futur, énergie,
            sécurité alimentaire, gestion durable des déchets.
          </li>
        </ul>
      </section>

      <section className="card mb-6 p-6" aria-labelledby="financement">
        <h2 id="financement" className="mb-2 text-lg font-medium">
          Soutien financier
        </h2>
        <p className="text-sm">
          Le projet INTERLAB est <strong>cofinancé par l&apos;Union européenne</strong> au titre du{" "}
          <strong>Fonds européen de développement régional (FEDER)</strong>, dans le cadre du
          programme <strong>Interreg France-Suisse 2021-2027</strong>. Il bénéficie également du
          soutien de fonds fédéraux suisses et du Canton du Jura. Démarré le 30 septembre 2024, il se
          déroule sur 36 mois.
        </p>
        <p className="mt-3 text-sm">
          <a
            href="https://www.interreg-francesuisse.eu"
            target="_blank"
            rel="noopener noreferrer"
            className="underline"
          >
            En savoir plus sur le programme Interreg France-Suisse
          </a>
        </p>
      </section>

      <section className="mb-6" aria-labelledby="consortium">
        <h2 id="consortium" className="mb-3 text-lg font-medium">
          Le consortium
        </h2>
        <ul className="grid gap-3 sm:grid-cols-2">
          {PARTENAIRES.map((p) => (
            <li key={p.nom} className="card flex items-center gap-3 p-4">
              <span className="flex h-10 w-20 shrink-0 items-center justify-center">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={p.src} alt={p.nom} className="max-h-10 w-auto max-w-full object-contain" />
              </span>
              <span className="min-w-0">
                <span className="block truncate text-sm font-medium">{p.nom}</span>
                <span className="block truncate text-xs" style={{ color: "var(--color-muted)" }}>
                  {p.role} · {p.site}
                </span>
              </span>
            </li>
          ))}
        </ul>
      </section>

      <InterregFooter />
    </main>
  );
}
