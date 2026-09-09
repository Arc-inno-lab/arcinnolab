import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { addEtapeDocument } from "@/app/actions";
import {
  ETAPE_STATUT_LABELS,
  ETAPE_STATUT_COLORS,
  type DocumentProjet,
  type EtapeProjet,
  type MessageProjet,
  type Profile,
  type Projet,
} from "@/lib/types";
import { EtapeThread } from "./EtapeThread";
import { EtapeAvisForm } from "./EtapeAvisForm";

export default async function EtapePage({
  params,
}: {
  params: Promise<{ id: string; etapeId: string }>;
}) {
  const { id, etapeId } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .single<Profile>();

  const { data: projet } = await supabase
    .from("projets")
    .select("*")
    .eq("id", id)
    .maybeSingle<Projet>();
  if (!projet) notFound();

  const { data: etape } = await supabase
    .from("etapes_projet")
    .select("*")
    .eq("id", etapeId)
    .eq("projet_id", id)
    .maybeSingle<EtapeProjet>();
  if (!etape) notFound();

  const isReferent = profile?.id === projet.id_partenaire_createur;
  const isAdmin = profile?.role === "admin";
  const peutGerer = isReferent || isAdmin;

  const [{ data: messages }, { data: documents }] = await Promise.all([
    supabase
      .from("messages_projet")
      .select("*, auteur:profiles(nom,prenom,role,photo_url)")
      .eq("etape_id", etapeId)
      .order("created_at", { ascending: true })
      .returns<MessageProjet[]>(),
    supabase
      .from("documents")
      .select("*")
      .eq("etape_id", etapeId)
      .order("date_upload", { ascending: false })
      .returns<DocumentProjet[]>(),
  ]);

  return (
    <div>
      <Link href={`/projets/${id}`} className="mb-4 inline-block text-sm underline">
        ← {projet.titre}
      </Link>

      <div className="mb-1 flex flex-wrap items-center gap-3">
        <h1 className="text-2xl font-semibold">{etape.titre}</h1>
        <span
          className="tag"
          style={
            {
              "--tag-color": ETAPE_STATUT_COLORS[etape.statut],
              "--tag-bg": "var(--color-surface-alt)",
            } as React.CSSProperties
          }
        >
          {ETAPE_STATUT_LABELS[etape.statut]}
        </span>
      </div>
      <p className="mb-6 text-sm" style={{ color: "var(--color-muted)" }}>
        Le statut se change depuis le tableau Kanban de la fiche projet.
      </p>

      {peutGerer && (
        <section className="mb-8">
          <h2 className="mb-3 text-lg font-medium">Avis</h2>
          <EtapeAvisForm projetId={id} etapeId={etapeId} statut={etape.statut} avis={etape.avis} />
        </section>
      )}
      {!peutGerer && etape.avis && (
        <p className="mb-8 text-sm">
          <strong>Avis :</strong> {etape.avis}
        </p>
      )}

      <section className="mb-8">
        <h2 className="mb-3 text-lg font-medium">Pièces jointes ({documents?.length ?? 0})</h2>
        {!documents?.length ? (
          <p className="mb-3 text-sm" style={{ color: "var(--color-muted)" }}>
            Aucun fichier déposé sur cette étape.
          </p>
        ) : (
          <ul className="mb-3 flex flex-col gap-2">
            {documents.map((d) => (
              <li
                key={d.id}
                className="card flex items-center justify-between gap-2 p-3 text-sm"
              >
                <a href={d.lien_fichier} target="_blank" rel="noopener noreferrer" className="truncate underline">
                  📎 {d.nom_fichier}
                </a>
                <span style={{ color: "var(--color-muted)" }}>
                  {new Date(d.date_upload).toLocaleDateString("fr-FR")}
                </span>
              </li>
            ))}
          </ul>
        )}
        <form action={addEtapeDocument.bind(null, id, etapeId)} className="flex flex-wrap items-center gap-2">
          <label htmlFor="fichier" className="sr-only">
            Ajouter un fichier
          </label>
          <input id="fichier" type="file" name="fichier" required className="text-sm" />
          <button type="submit" className="btn btn-outline">
            Ajouter un fichier
          </button>
        </form>
      </section>

      <section>
        <h2 className="mb-3 text-lg font-medium">Discussion</h2>
        <EtapeThread projetId={id} etapeId={etapeId} messages={messages ?? []} />
      </section>
    </div>
  );
}
