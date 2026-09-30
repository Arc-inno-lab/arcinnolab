import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { addEtapeDocument } from "@/app/actions";
import {
  type DocumentProjet,
  type EtapeProjet,
  type MessageProjet,
  type Profile,
  type Projet,
} from "@/lib/types";
import { EtapeThread } from "./EtapeThread";
import { DepotDocument } from "./DepotDocument";

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

  const estPorteur = profile?.role === "porteur";
  const retour = estPorteur ? `/mon-projet?p=${id}` : `/projets/${id}`;
  const validation =
    etape.validation === "validee"
      ? { texte: "Validée", couleur: "var(--color-success)", fond: "var(--color-success-soft)" }
      : etape.validation === "a_valider"
        ? { texte: estPorteur ? "Votre accompagnateur doit la valider" : "À valider", couleur: "#3b4452", fond: "#e9edf4" }
        : etape.validation === "refusee"
          ? { texte: "À reprendre", couleur: "var(--color-danger)", fond: "var(--color-accent-soft)" }
          : null;

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
      <Link href={retour} className="mb-4 inline-block text-sm">
        ← {estPorteur ? "Mon projet" : projet.titre}
      </Link>

      <div className="mb-6 flex flex-wrap items-center gap-3">
        <h1 className="text-2xl font-bold">{etape.titre}</h1>
        {validation && (
          <span className="pastille" style={{ color: validation.couleur, background: validation.fond }}>
            {validation.texte}
          </span>
        )}
      </div>

      {etape.description && <p className="mb-6 whitespace-pre-wrap text-[17px]">{etape.description}</p>}

      {etape.avis && (
        <div className="card mb-8 p-4">
          <p className="mb-1 text-sm font-semibold" style={{ color: "var(--color-muted)" }}>
            {estPorteur ? "Le mot de votre accompagnateur" : "Avis du référent"}
          </p>
          <p className="whitespace-pre-wrap">{etape.avis}</p>
        </div>
      )}

      <section className="mb-8">
        <h2 className="mb-3 text-lg font-medium">Documents ({documents?.length ?? 0})</h2>
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
                  {d.nom_fichier}
                </a>
                <span style={{ color: "var(--color-muted)" }}>
                  {new Date(d.date_upload).toLocaleDateString("fr-FR", { timeZone: "Europe/Paris" })}
                </span>
              </li>
            ))}
          </ul>
        )}
        <DepotDocument action={addEtapeDocument.bind(null, id, etapeId)} />
      </section>

      <section>
        <h2 className="mb-3 text-lg font-medium">Discussion</h2>
        <EtapeThread projetId={id} etapeId={etapeId} messages={messages ?? []} />
      </section>
    </div>
  );
}
