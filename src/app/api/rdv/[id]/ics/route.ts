import { createClient } from "@/lib/supabase/server";
import { APP_URL } from "@/lib/config";
import { RDV_MODE_LABELS } from "@/lib/types";
import { horodatageIcs as horodatage, texteIcs as texte, reponseIcs } from "@/lib/ics";

/**
 * « Ajouter à mon agenda » : un fichier .ics que tous les agendas savent
 * ouvrir (téléphone, Outlook, Google). La lecture passe par la RLS : on ne
 * peut télécharger que les rendez-vous d'un projet dont on fait partie.
 */

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return new Response("Connectez-vous pour télécharger ce rendez-vous.", { status: 401 });

  const { data: rdv } = await supabase
    .from("etapes_projet")
    .select("id, titre, description, rdv_debut, rdv_mode, rdv_lieu, rdv_statut, type, projet:projets(titre)")
    .eq("id", id)
    .eq("type", "rendez_vous")
    .maybeSingle();

  if (!rdv || !rdv.rdv_debut) return new Response("Rendez-vous introuvable.", { status: 404 });

  const projet = (Array.isArray(rdv.projet) ? rdv.projet[0] : rdv.projet) as { titre: string } | null;
  const debut = new Date(rdv.rdv_debut);
  const fin = new Date(debut.getTime() + 60 * 60 * 1000);
  const mode = rdv.rdv_mode ? RDV_MODE_LABELS[rdv.rdv_mode as keyof typeof RDV_MODE_LABELS] : "";
  const description = [
    projet ? `Projet : ${projet.titre}` : "",
    mode ? `Rendez-vous ${mode}` : "",
    rdv.description ?? "",
    `${APP_URL}/mon-projet`,
  ]
    .filter(Boolean)
    .join("\n");

  const lignes = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//ArcInnoLab//Parcours//FR",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "BEGIN:VEVENT",
    `UID:${rdv.id}@arcinnolab`,
    `DTSTAMP:${horodatage(new Date())}`,
    `DTSTART:${horodatage(debut)}`,
    `DTEND:${horodatage(fin)}`,
    `SUMMARY:${texte(`ArcInnoLab · ${rdv.titre}`)}`,
    `DESCRIPTION:${texte(description)}`,
    ...(rdv.rdv_lieu ? [`LOCATION:${texte(rdv.rdv_lieu)}`] : []),
    `STATUS:${rdv.rdv_statut === "confirme" ? "CONFIRMED" : rdv.rdv_statut === "annule" ? "CANCELLED" : "TENTATIVE"}`,
    "BEGIN:VALARM",
    "ACTION:DISPLAY",
    "DESCRIPTION:Rendez-vous ArcInnoLab",
    "TRIGGER:-PT30M",
    "END:VALARM",
    "END:VEVENT",
    "END:VCALENDAR",
  ];

  return reponseIcs(lignes, "rendez-vous-arcinnolab.ics", true);
}
