"use server";

/**
 * Demandes d'accès à la plateforme (migration 028). Rien n'est créé sans
 * l'administrateur : le formulaire public et l'import ne déposent que des
 * demandes ; seule la validation, rôle par rôle, crée des invitations — qui
 * partent par e-mail, la personne choisissant elle-même son mot de passe.
 */

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

type Resultat = { error?: string; success?: boolean; message?: string };

function msg(error: { code?: string; message: string } | null, defaut: string) {
  if (!error) return undefined;
  return error.code === "P0001" ? error.message : defaut;
}

/** Le formulaire public « Rejoindre ArcInnoLab ». */
export async function demanderAcces(_prev: Resultat, fd: FormData): Promise<Resultat> {
  if (fd.get("consentement") !== "on") {
    return { error: "Merci de cocher la case d'accord pour que nous puissions traiter votre demande." };
  }
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("demander_acces", {
    p_prenom: String(fd.get("prenom") || ""),
    p_nom: String(fd.get("nom") || ""),
    p_email: String(fd.get("email") || ""),
    p_organisation: String(fd.get("organisation") || ""),
    p_fonction: String(fd.get("fonction") || ""),
    p_role: String(fd.get("role") || "partenaire"),
    p_message: String(fd.get("message") || ""),
  });
  const erreur = msg(error, "Votre demande n'a pas pu être enregistrée. Réessayez dans un instant.");
  if (erreur) return { error: erreur };
  return { success: true, message: data === "mise_a_jour" ? "mise_a_jour" : "cree" };
}

export async function validerDemandesAcces(ids: string[], roles: string[]): Promise<Resultat> {
  if (!ids.length) return { error: "Cochez au moins une demande." };
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("valider_demandes_acces", { p_ids: ids, p_roles: roles });
  const erreur = msg(error, "Validation impossible : " + (error?.message ?? ""));
  if (erreur) return { error: erreur };
  revalidatePath("/admin");
  const n = Number(data ?? 0);
  return { success: true, message: n === 0 ? "Aucune invitation créée." : `${n} invitation${n > 1 ? "s" : ""} envoyée${n > 1 ? "s" : ""} par e-mail.` };
}

export async function refuserDemandesAcces(ids: string[]): Promise<Resultat> {
  if (!ids.length) return { error: "Cochez au moins une demande." };
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("refuser_demandes_acces", { p_ids: ids });
  const erreur = msg(error, "Refus impossible : " + (error?.message ?? ""));
  if (erreur) return { error: erreur };
  revalidatePath("/admin");
  const n = Number(data ?? 0);
  return { success: true, message: `${n} demande${n > 1 ? "s" : ""} refusée${n > 1 ? "s" : ""}.` };
}

/**
 * Import d'une liste (modèle CSV, ou copier-coller depuis Excel). Chaque ligne
 * devient une demande d'accès en attente, jamais un compte.
 * Colonnes : prénom ; nom ; e-mail ; organisation ; fonction ; rôle.
 */
export async function importerDemandesAcces(_prev: Resultat, fd: FormData): Promise<Resultat> {
  const brut = String(fd.get("liste") || "").replace(/^﻿/, "").trim();
  if (!brut) return { error: "Collez la liste (une personne par ligne)." };

  const lignes = brut.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  const sep = lignes[0].includes("\t") ? "\t" : lignes[0].includes(";") ? ";" : ",";
  const cellules = lignes.map((l) => l.split(sep).map((c) => c.trim().replace(/^"(.*)"$/, "$1")));
  if (cellules.length && cellules[0].some((c) => /mail/i.test(c))) cellules.shift();
  if (cellules.length > 300) return { error: "300 lignes au plus par import." };

  const supabase = await createClient();
  let ajoutees = 0;
  const rejets: string[] = [];
  for (const [i, c] of cellules.entries()) {
    const [prenom = "", nom = "", email = "", organisation = "", fonction = "", role = ""] = c;
    const adresse = email.toLowerCase();
    if (!prenom || !nom || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(adresse)) {
      rejets.push(`ligne ${i + 1} (incomplète)`);
      continue;
    }
    const { error } = await supabase.from("demandes_acces").insert({
      prenom: prenom.slice(0, 80),
      nom: nom.slice(0, 80),
      email: adresse,
      organisation: organisation ? organisation.slice(0, 160) : null,
      fonction: fonction ? fonction.slice(0, 160) : null,
      role_souhaite: /porteur/i.test(role) ? "porteur" : "partenaire",
      source: "import",
    });
    if (error) rejets.push(`${adresse} (${error.code === "23505" ? "déjà en attente" : error.code === "42501" ? "droits" : "refusée"})`);
    else ajoutees++;
  }
  revalidatePath("/admin");
  if (!ajoutees && rejets.length) return { error: `Aucune ligne importée : ${rejets.slice(0, 5).join(", ")}${rejets.length > 5 ? "…" : ""}` };
  return {
    success: true,
    message: `${ajoutees} demande${ajoutees > 1 ? "s" : ""} ajoutée${ajoutees > 1 ? "s" : ""} à valider${rejets.length ? ` · ignorées : ${rejets.slice(0, 5).join(", ")}${rejets.length > 5 ? "…" : ""}` : ""}.`,
  };
}
