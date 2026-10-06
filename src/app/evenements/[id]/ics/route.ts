import { createClient } from "@/lib/supabase/server";
import { APP_URL } from "@/lib/config";
import { horodatageIcs, texteIcs, reponseIcs } from "@/lib/ics";

/**
 * « Ajouter à mon agenda » pour un événement ArcInnoLab. Sans compte, seuls
 * les événements publics sont lisibles (la RLS le garantit) ; un membre
 * connecté obtient aussi ceux qui lui sont réservés.
 */
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) return new Response("Événement introuvable.", { status: 404 });

  const supabase = await createClient();
  const { data: e } = await supabase
    .from("evenements")
    .select("id, titre, description, debut, fin, lieu, lien, organisateur, public, annule, updated_at")
    .eq("id", id)
    .maybeSingle();
  if (!e) return new Response("Événement introuvable.", { status: 404 });

  const debut = new Date(e.debut);
  const fin = e.fin ? new Date(e.fin) : new Date(debut.getTime() + 2 * 3600_000);
  const description = [
    e.description ?? "",
    e.organisateur ? `Organisé par ${e.organisateur}` : "",
    e.lien ?? "",
    `${APP_URL}${e.public ? "/demande#agenda" : "/agenda"}`,
  ]
    .filter(Boolean)
    .join("\n\n");

  const lignes = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//ArcInnoLab//Agenda//FR",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "BEGIN:VEVENT",
    `UID:evenement-${e.id}@arcinnolab`,
    `DTSTAMP:${horodatageIcs(new Date())}`,
    `LAST-MODIFIED:${horodatageIcs(new Date(e.updated_at))}`,
    `DTSTART:${horodatageIcs(debut)}`,
    `DTEND:${horodatageIcs(fin)}`,
    `SUMMARY:${texteIcs(`ArcInnoLab · ${e.titre}`)}`,
    `DESCRIPTION:${texteIcs(description)}`,
    ...(e.lieu ? [`LOCATION:${texteIcs(e.lieu)}`] : []),
    ...(e.lien ? [`URL:${e.lien}`] : []),
    `STATUS:${e.annule ? "CANCELLED" : "CONFIRMED"}`,
    "END:VEVENT",
    "END:VCALENDAR",
  ];

  return reponseIcs(lignes, "evenement-arcinnolab.ics", !e.public);
}
