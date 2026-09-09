import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "ArcInnoLab — Gestion de projet accompagné",
  description: "Plateforme de suivi des projets accompagnés ArcInnoLab (porteurs / partenaires / admin).",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr">
      <body>
        <a href="#main" className="skip-link">
          Aller au contenu principal
        </a>
        {children}
      </body>
    </html>
  );
}
