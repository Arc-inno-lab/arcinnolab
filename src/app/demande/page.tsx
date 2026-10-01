import Link from "next/link";
import type { Metadata } from "next";
import "@fontsource-variable/inter";
import { DemandeForm } from "./DemandeForm";
import { BoutonMobile } from "./BoutonMobile";
import { Pictogramme } from "./Decor";
import { CarteArc } from "./CarteArc";
import {
  AVANTAGES,
  CHIFFRES,
  CONVICTIONS,
  DOMAINES,
  ETAPES,
  FINANCEMENT,
  PARTENAIRES,
  PHOTOS,
  SOLUTIONS,
  CONTACT_EMAIL,
  LINKEDIN,
} from "./contenu";

export const metadata: Metadata = {
  title: "ArcInnoLab — L'innovation au service des transitions de l'Arc jurassien",
  description:
    "ArcInnoLab, guichet unique transfrontalier franco-suisse : déposez votre projet de transition écologique, numérique, sociétale ou industrielle. Un interlocuteur vous répond et vous oriente.",
};

/* eslint-disable @next/next/no-img-element -- images statiques de la charte, déjà optimisées */

/**
 * La porte d'entrée publique d'ArcInnoLab : d'abord comprendre ce qu'est
 * ArcInnoLab (le sens, les solutions, les partenaires, les lieux), puis
 * déposer son projet. Le contenu vient des supports officiels (manifeste,
 * affiche, carte des partenaires) pour que le site dise la même chose que ce
 * qui est affiché dans les lieux.
 *
 * Aucun compte n'est ouvert au dépôt : un accompagnateur prend contact, et
 * l'accès à la plateforme ne vient qu'ensuite.
 */
export default function DemandePage() {
  return (
    <div className="vitrine">
      {/* ── En-tête ─────────────────────────────────────────────── */}
      <header className="sticky top-0 z-30 border-b bg-white/90 backdrop-blur" style={{ borderColor: "#e8eef6" }}>
        <div className="vit-conteneur flex items-center justify-between gap-4 px-4 py-3">
          <a href="#haut" aria-label="ArcInnoLab, haut de page" className="shrink-0">
            <img src="/brand/logo-arcinnolab.svg" alt="ArcInnoLab" className="h-14 w-auto md:h-16" />
          </a>
          <nav aria-label="Sections" className="hidden items-center gap-6 text-sm font-semibold lg:flex" style={{ color: "#3b4452" }}>
            <a href="#projet" style={{ color: "inherit" }}>Le projet</a>
            <a href="#fonctionnement" style={{ color: "inherit" }}>Comment ça marche</a>
            <a href="#solutions" style={{ color: "inherit" }}>Nos solutions</a>
            <a href="#partenaires" style={{ color: "inherit" }}>Partenaires</a>
          </nav>
          <div className="flex items-center gap-2">
            <Link href="/login" className="hidden text-sm font-semibold sm:inline" style={{ color: "#3b4452" }}>
              Espace membres
            </Link>
            <a href="#deposer" className="btn btn-primary">
              Déposer mon projet
            </a>
          </div>
        </div>
      </header>

      <main id="main">
        {/* ── Haut de page ──────────────────────────────────────── */}
        <section id="haut" className="vit-hero vit-section" style={{ paddingTop: "3.5rem" }}>
          <div className="vit-conteneur grid items-center gap-10 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)]">
            <div>
              <img src="/brand/logo-arcinnolab.svg" alt="ArcInnoLab" className="mb-6 h-28 w-auto md:h-36" />
              <p className="vit-kicker">
                <span aria-hidden="true">●</span> Guichet unique franco-suisse
              </p>
              <h1 className="mt-3 text-[2.4rem] font-medium leading-[1.08] md:text-[3.6rem]" style={{ color: "#12151c" }}>
                L&apos;<strong className="font-extrabold">innovation</strong> au service des transitions de l&apos;
                <strong className="font-extrabold" style={{ color: "var(--color-primary)" }}>
                  Arc jurassien
                </strong>
              </h1>
              <p className="mt-5 max-w-xl text-lg leading-relaxed" style={{ color: "#3b4452" }}>
                ArcInnoLab accueille, oriente et accompagne les porteurs de projets de la transition écologique,
                numérique, sociétale et industrielle — de part et d&apos;autre de la frontière.
              </p>
              <div className="mt-7 flex flex-col gap-3 sm:flex-row">
                <a href="#deposer" className="btn btn-primary btn-grand">
                  Déposer mon projet
                </a>
                <a href="#projet" className="btn btn-outline btn-grand">
                  Découvrir ArcInnoLab
                </a>
              </div>
              <ul className="mt-6 flex flex-wrap gap-x-5 gap-y-2 text-sm font-medium" style={{ color: "#3b4452" }}>
                {["Sans compte à créer", "Un interlocuteur dédié", "Une réponse, toujours"].map((t) => (
                  <li key={t} className="flex items-center gap-2">
                    <span className="flex h-5 w-5 items-center justify-center rounded-full text-[11px] text-white" style={{ background: "var(--color-success)" }} aria-hidden="true">
                      ✓
                    </span>
                    {t}
                  </li>
                ))}
              </ul>
            </div>

            {/* Le réseau de l'affiche : les partenaires et les publics qu'ArcInnoLab
                relie, de part et d'autre de la frontière. */}
            <figure className="relative mx-auto w-full max-w-[38rem]">
              <img
                src="/brand/vitrine/reseau-arcinnolab.webp"
                alt="Le réseau ArcInnoLab : KMØ, Basel Area, Ville de Delémont, Haute École Arc et UTBM Crunchlab, reliés aux industries, associations, citoyens, étudiants et collectivités"
                className="vit-flotte w-full"
                style={{ maskImage: "linear-gradient(180deg, #000 78%, transparent)", WebkitMaskImage: "linear-gradient(180deg, #000 78%, transparent)" }}
              />
            </figure>
          </div>
        </section>

        {/* ── Chiffres ──────────────────────────────────────────── */}
        <section className="vit-bande-chiffres px-4 py-8" aria-label="ArcInnoLab en chiffres">
          <ul className="vit-conteneur grid grid-cols-2 gap-6 md:grid-cols-4">
            {CHIFFRES.map((c) => (
              <li key={c.libelle} className="text-center">
                <p className="text-4xl font-extrabold md:text-5xl">{c.valeur}</p>
                <p className="mt-1 text-sm font-medium opacity-90">{c.libelle}</p>
              </li>
            ))}
          </ul>
        </section>

        {/* ── Le projet ─────────────────────────────────────────── */}
        <section id="projet" className="vit-section scroll-mt-20">
          <div className="vit-conteneur">
            <p className="vit-kicker">ArcInnoLab, c&apos;est quoi ?</p>
            <h2 className="mt-2 max-w-3xl text-3xl font-bold md:text-4xl">
              Un point d&apos;entrée simple pour passer de l&apos;intention à l&apos;action
            </h2>
            <p className="mt-4 max-w-3xl text-lg leading-relaxed" style={{ color: "#3b4452" }}>
              Une plateforme transfrontalière dédiée à l&apos;<strong>accompagnement des porteurs de projets</strong>,
              née de l&apos;alliance de <strong>cinq acteurs</strong> de l&apos;innovation en France et en Suisse, pour{" "}
              <strong>accélérer la transition écologique, numérique et industrielle</strong> de nos territoires.
            </p>

            <div className="mt-10 grid gap-5 md:grid-cols-3">
              {CONVICTIONS.map((c, i) => (
                <article key={c.titre} className="vit-carte p-6">
                  <p className="text-sm font-extrabold" style={{ color: i === 1 ? "var(--color-accent)" : "var(--color-primary-2)" }}>
                    0{i + 1}
                  </p>
                  <h3 className="mt-1 text-xl font-bold">{c.titre}</h3>
                  <p className="mt-2 leading-relaxed" style={{ color: "#3b4452" }}>
                    {c.texte}
                  </p>
                </article>
              ))}
            </div>

            <blockquote className="mx-auto mt-12 max-w-3xl text-center text-2xl font-semibold leading-snug md:text-3xl" style={{ color: "var(--vit-navy)" }}>
              « Un porteur de projet n&apos;est jamais seul : il sait toujours à qui s&apos;adresser, et comment avancer. »
              <footer className="mt-3 text-sm font-medium" style={{ color: "var(--color-muted)" }}>
                Manifeste ArcInnoLab
              </footer>
            </blockquote>

            <div className="mt-12">
              <p className="text-center text-sm font-bold uppercase tracking-wider" style={{ color: "var(--color-muted)" }}>
                Pour tous les projets de transition
              </p>
              <ul className="mt-4 flex flex-wrap justify-center gap-2">
                {DOMAINES.map((d) => (
                  <li key={d} className="rounded-full border px-4 py-2 text-sm font-semibold" style={{ borderColor: "#cfe0f5", color: "var(--vit-navy)" }}>
                    {d}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </section>

        {/* ── Photos ────────────────────────────────────────────── */}
        <section aria-label="Les lieux et les projets en images" className="overflow-hidden pb-4">
          <ul className="flex gap-3 overflow-x-auto px-4 pb-2 md:grid md:grid-cols-5 md:overflow-visible md:px-[max(1rem,calc((100vw-72rem)/2))]">
            {PHOTOS.map((p) => (
              <li key={p.src} className="w-56 shrink-0 md:w-auto">
                <img src={p.src} alt={p.alt} loading="lazy" className="aspect-[6/5] w-full rounded-2xl object-cover" />
              </li>
            ))}
          </ul>
        </section>

        {/* ── Comment ça marche ─────────────────────────────────── */}
        <section id="fonctionnement" className="vit-section scroll-mt-20">
          <div className="vit-conteneur">
            <p className="vit-kicker">Comment ça marche</p>
            <h2 className="mt-2 text-3xl font-bold md:text-4xl">De votre idée à votre projet, en quatre temps</h2>
            <ol className="mt-10 grid gap-5 md:grid-cols-4">
              {ETAPES.map((e, i) => (
                <li key={e.titre} className="vit-carte relative p-6">
                  <span
                    className="flex h-11 w-11 items-center justify-center rounded-full text-lg font-extrabold text-white"
                    style={{ background: i === ETAPES.length - 1 ? "var(--color-accent)" : "var(--color-primary)" }}
                    aria-hidden="true"
                  >
                    {i + 1}
                  </span>
                  <h3 className="mt-4 text-lg font-bold">{e.titre}</h3>
                  <p className="mt-2 leading-relaxed" style={{ color: "#3b4452" }}>
                    {e.texte}
                  </p>
                </li>
              ))}
            </ol>
          </div>
        </section>

        {/* ── Solutions ─────────────────────────────────────────── */}
        <section id="solutions" className="vit-section scroll-mt-20" style={{ background: "var(--vit-bleu-clair)" }}>
          <div className="vit-conteneur">
            <p className="vit-kicker">Nos solutions</p>
            <h2 className="mt-2 text-3xl font-bold md:text-4xl">Pour déployer vos idées et vos projets</h2>
            <ul className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {SOLUTIONS.map((s) => (
                <li key={s.titre} className="vit-carte flex items-center gap-4 p-5">
                  <span className="vit-icone">
                    <Pictogramme nom={s.icone} />
                  </span>
                  <span className="font-semibold leading-snug">{s.titre}</span>
                </li>
              ))}
            </ul>

            <div className="mt-14 grid items-start gap-8 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
              <div>
                <h3 className="text-2xl font-bold md:text-3xl">
                  Bénéficiez du réseau ArcInnoLab pour <span style={{ color: "var(--color-accent)" }}>booster</span> vos projets
                </h3>
                <p className="mt-3 leading-relaxed" style={{ color: "#3b4452" }}>
                  En rejoignant ArcInnoLab, votre projet profite de la force combinée de nos écosystèmes académiques,
                  industriels et institutionnels — et d&apos;un label qui inspire confiance.
                </p>
              </div>
              <ul className="grid gap-3 sm:grid-cols-2">
                {AVANTAGES.map((a) => (
                  <li key={a.titre} className="rounded-xl border-l-4 bg-white px-4 py-3" style={{ borderColor: "var(--color-accent)" }}>
                    <p className="font-bold" style={{ color: "var(--color-accent-2)" }}>
                      {a.titre}
                    </p>
                    <p className="text-sm" style={{ color: "#3b4452" }}>
                      {a.texte}
                    </p>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </section>

        {/* ── Partenaires et lieux ──────────────────────────────── */}
        <section id="partenaires" className="vit-section scroll-mt-20">
          <div className="vit-conteneur">
            <p className="vit-kicker">Partenaires et lieux</p>
            <h2 className="mt-2 max-w-3xl text-3xl font-bold md:text-4xl">Cinq acteurs, deux pays, un même territoire</h2>
            <p className="mt-4 max-w-3xl text-lg leading-relaxed" style={{ color: "#3b4452" }}>
              Deux lieux d&apos;accueil — le Techn&apos;Hom à Belfort et le site Gare Sud-SAFED à Delémont — et une
              plateforme numérique commune, qui complètent l&apos;offre du KMØ à Mulhouse et du Switzerland Innovation
              Park Basel Area, site Jura.
            </p>

            <div className="mt-10 grid items-start gap-8 lg:grid-cols-[minmax(0,0.85fr)_minmax(0,1.15fr)]">
              <figure className="vit-carte overflow-hidden p-3 lg:sticky lg:top-28">
                <CarteArc />
                <figcaption className="px-2 pb-1 pt-3 text-xs" style={{ color: "var(--color-muted)" }}>
                  De Mulhouse à Neuchâtel, cinq lieux reliés par-dessus la frontière.
                </figcaption>
              </figure>

              <ul className="grid gap-4 sm:grid-cols-2">
                {PARTENAIRES.map((p) => (
                  <li key={p.nom} className="vit-carte flex flex-col p-5">
                    <div className="flex h-14 items-center gap-3">
                      {p.logos.map((l) => (
                        <img key={l.src} src={l.src} alt={l.alt} className="h-auto max-h-11 min-w-0 max-w-[48%] object-contain object-left" />
                      ))}
                    </div>
                    <p className="mt-3 font-bold">{p.nom}</p>
                    <p className="text-sm" style={{ color: "var(--color-muted)" }}>
                      <span
                        className="mr-1 inline-block rounded px-1.5 text-[11px] font-bold text-white"
                        style={{ background: p.pays === "France" ? "var(--color-primary)" : "var(--color-accent)" }}
                      >
                        {p.pays === "France" ? "FR" : "CH"}
                      </span>
                      {p.lieu}
                    </p>
                    <ul className="mt-3 flex flex-wrap gap-1.5">
                      {p.thematiques.map((t) => (
                        <li key={t} className="vit-puce">
                          {t}
                        </li>
                      ))}
                    </ul>
                    <p className="mt-3 text-sm leading-relaxed" style={{ color: "#3b4452" }}>
                      {p.services.join(" · ")}
                    </p>
                  </li>
                ))}
                <li className="flex flex-col justify-center rounded-[1.25rem] p-5 text-white" style={{ background: "var(--vit-navy)" }}>
                  <p className="text-lg font-bold">Et tout un écosystème</p>
                  <p className="mt-1 text-sm opacity-90">
                    Financeurs, experts, coachs et mentors, en France comme en Suisse : nous vous orientons vers la bonne
                    ressource, au bon moment.
                  </p>
                </li>
              </ul>
            </div>
          </div>
        </section>

        {/* ── Dépôt ─────────────────────────────────────────────── */}
        <section id="deposer" className="vit-section scroll-mt-20" style={{ background: "linear-gradient(180deg, #f3f7fd 0%, #e4edf8 100%)" }}>
          <div className="vit-conteneur grid items-start gap-10 lg:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)]">
            <div className="lg:sticky lg:top-28">
              <p className="vit-kicker">Déposez votre projet</p>
              <h2 className="mt-2 text-3xl font-bold md:text-4xl">Parlez-nous de votre projet</h2>
              <p className="mt-4 text-lg leading-relaxed" style={{ color: "#3b4452" }}>
                Citoyen engagé, étudiant, association, entreprise ou collectivité : que votre projet en soit à l&apos;idée
                ou déjà en marche, écrivez-nous.
              </p>
              <div className="vit-carte mt-6 p-5">
                <p className="font-bold">Ce qui se passe ensuite</p>
                <p className="mt-2 leading-relaxed" style={{ color: "#3b4452" }}>
                  Un membre de l&apos;équipe lit votre demande et vous propose un échange. Ensuite : une mise en relation
                  avec la structure la plus adaptée, ou une candidature à une promotion d&apos;accompagnement ArcInnoLab.
                </p>
                <p className="mt-3 font-semibold" style={{ color: "var(--color-primary)" }}>
                  Dans tous les cas, vous repartez avec une réponse et un interlocuteur. C&apos;est notre engagement.
                </p>
              </div>
              <p className="mt-5 text-sm" style={{ color: "#3b4452" }}>
                Une question avant de déposer ? Écrivez-nous :{" "}
                <a href={`mailto:${CONTACT_EMAIL}`} className="font-semibold">
                  {CONTACT_EMAIL}
                </a>
              </p>
            </div>
            <DemandeForm />
          </div>
        </section>
      </main>

      {/* ── Pied de page ────────────────────────────────────────── */}
      <footer className="border-t px-4 pb-28 pt-12 md:pb-12" style={{ borderColor: "#e8eef6" }}>
        <div className="vit-conteneur grid gap-10 md:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)]">
          <div>
            <img src="/brand/logo-arcinnolab.svg" alt="ArcInnoLab" className="h-24 w-auto" />
            <p className="mt-3 text-sm font-semibold" style={{ color: "var(--vit-navy)" }}>
              Tous ensemble pour les transitions !
            </p>
            <ul className="mt-3 flex flex-col gap-2 text-sm">
              <li>
                <a href={LINKEDIN} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 font-semibold">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="#0a66c2" aria-hidden="true">
                    <path d="M20.4 3H3.6A.6.6 0 0 0 3 3.6v16.8c0 .3.3.6.6.6h16.8c.3 0 .6-.3.6-.6V3.6a.6.6 0 0 0-.6-.6ZM8.3 18.3H5.7V9.8h2.6v8.5ZM7 8.6a1.5 1.5 0 1 1 0-3 1.5 1.5 0 0 1 0 3Zm11.3 9.7h-2.6v-4.1c0-1 0-2.3-1.4-2.3s-1.6 1.1-1.6 2.2v4.2h-2.6V9.8h2.5v1.2c.4-.7 1.2-1.4 2.5-1.4 2.7 0 3.2 1.8 3.2 4.1v4.6Z" />
                  </svg>
                  Suivre ArcInnoLab sur LinkedIn
                </a>
              </li>
              <li>
                <a href={`mailto:${CONTACT_EMAIL}`} className="font-semibold">
                  {CONTACT_EMAIL}
                </a>
              </li>
            </ul>
            <div className="mt-4 flex flex-wrap gap-x-5 gap-y-2 text-sm">
              <Link href="/a-propos">À propos du projet</Link>
              <Link href="/login">Espace membres</Link>
            </div>
          </div>
          <div>
            <div className="flex flex-wrap items-center gap-x-8 gap-y-4">
              <img src="/brand/vitrine/logos/interreg.png" alt="Interreg France – Suisse, cofinancé par l'Union européenne" className="h-12 w-auto" />
              <img src="/brand/vitrine/logos/suisse.png" alt="Confédération suisse" className="h-10 w-auto" />
              <img src="/brand/vitrine/logos/jura.png" alt="République et Canton du Jura" className="h-9 w-auto" />
            </div>
            <p className="mt-4 text-xs leading-relaxed" style={{ color: "var(--color-muted)" }}>
              {FINANCEMENT}{" "}
              <a href="https://www.interreg-francesuisse.eu" target="_blank" rel="noopener noreferrer">
                interreg-francesuisse.eu
              </a>
            </p>
          </div>
        </div>
      </footer>

      <BoutonMobile />
    </div>
  );
}
