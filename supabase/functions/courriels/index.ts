// Fonction Supabase « courriels » : vide la file `public.courriels` en
// envoyant chaque e-mail depuis l'adresse gmail d'ArcInnoLab (SMTP Gmail,
// port 465 — les ports 25 et 587 sont fermés aux fonctions Supabase).
//
// Elle ne reçoit aucune donnée : la base l'appelle (pg_net) après chaque
// ajout à la file, et toutes les 10 minutes (pg_cron). L'appeler davantage ne
// fait qu'envoyer plus tôt ce qui attendait déjà ; d'où l'absence de jeton.
//
// Secrets à renseigner dans Supabase → Edge Functions → Secrets (jamais dans
// le dépôt) :
//   GMAIL_USER          l'adresse gmail d'ArcInnoLab
//   GMAIL_APP_PASSWORD  un « mot de passe d'application » Google (16 lettres)
// SUPABASE_URL et la clé de service sont fournis par Supabase lui-même.

import { createClient } from "npm:@supabase/supabase-js@2";
import nodemailer from "npm:nodemailer@6.9.16";

type Courriel = {
  id: string;
  destinataire: string;
  sujet: string;
  titre: string;
  corps: string;
  bouton_libelle: string | null;
  bouton_lien: string | null;
  items: { texte: string; lien: string }[];
  pied: string;
};

const APP_URL = "https://arcinnolab-five.vercel.app";
const BLEU = "#183d7a";

function echapper(s: string) {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function paragraphes(s: string) {
  return s
    .split(/\n{2,}/)
    .filter((p) => p.trim())
    .map((p) => `<p style="margin:0 0 14px;font-size:16px;line-height:1.55;color:#22262e">${echapper(p).replace(/\n/g, "<br>")}</p>`)
    .join("");
}

function html(c: Courriel) {
  const items = c.items?.length
    ? `<ul style="margin:0 0 18px;padding:0;list-style:none">${c.items
        .map(
          (i) =>
            `<li style="margin:0 0 8px;padding:10px 12px;background:#f3f6fb;border-radius:8px;font-size:15px"><a href="${echapper(i.lien)}" style="color:${BLEU};text-decoration:none">${echapper(i.texte)}</a></li>`
        )
        .join("")}</ul>`
    : "";
  const bouton =
    c.bouton_libelle && c.bouton_lien
      ? `<p style="margin:22px 0"><a href="${echapper(c.bouton_lien)}" style="display:inline-block;background:${BLEU};color:#ffffff;text-decoration:none;font-weight:600;font-size:16px;padding:12px 22px;border-radius:10px">${echapper(c.bouton_libelle)}</a></p>`
      : "";
  return `<!doctype html><html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width"></head>
<body style="margin:0;padding:0;background:#eef2f8;font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#eef2f8;padding:24px 12px"><tr><td align="center">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#ffffff;border-radius:16px;overflow:hidden">
<tr><td style="padding:24px 28px 8px"><img src="${APP_URL}/brand/logo-email.png" width="120" alt="ArcInnoLab" style="display:block;border:0"></td></tr>
<tr><td style="padding:8px 28px 4px">
<h1 style="margin:0 0 16px;font-size:21px;line-height:1.3;color:${BLEU}">${echapper(c.titre)}</h1>
${paragraphes(c.corps)}${items}${bouton}
</td></tr>
<tr><td style="padding:16px 28px 24px;border-top:1px solid #e6ebf2;font-size:12px;line-height:1.5;color:#6b7280">
${echapper(c.pied)}<br>ArcInnoLab · guichet transfrontalier de l'innovation · Interreg France-Suisse
</td></tr></table></td></tr></table></body></html>`;
}

function texte(c: Courriel) {
  const items = c.items?.length ? "\n" + c.items.map((i) => `- ${i.texte}\n  ${i.lien}`).join("\n") + "\n" : "";
  const bouton = c.bouton_libelle && c.bouton_lien ? `\n${c.bouton_libelle} : ${c.bouton_lien}\n` : "";
  return `${c.titre}\n\n${c.corps}\n${items}${bouton}\n--\n${c.pied}\nArcInnoLab`;
}

function reponse(corps: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(corps), { status, headers: { "Content-Type": "application/json" } });
}

Deno.serve(async () => {
  const utilisateur = Deno.env.get("GMAIL_USER");
  const motDePasse = Deno.env.get("GMAIL_APP_PASSWORD");
  if (!utilisateur || !motDePasse) {
    // Rien n'est retiré de la file : les e-mails partiront dès la configuration
    // faite (dans la limite de 24 heures).
    return reponse({ ok: false, raison: "GMAIL_USER ou GMAIL_APP_PASSWORD manquant" }, 503);
  }

  const cleService =
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? JSON.parse(Deno.env.get("SUPABASE_SECRET_KEYS") ?? "{}").default;
  const db = createClient(Deno.env.get("SUPABASE_URL")!, cleService, { auth: { persistSession: false } });

  const { data: lot, error } = await db.rpc("reserver_courriels", { n: 20 });
  if (error) return reponse({ ok: false, raison: error.message }, 500);
  const courriels = (lot ?? []) as Courriel[];
  if (!courriels.length) return reponse({ ok: true, envoyes: 0 });

  const transport = nodemailer.createTransport({
    host: "smtp.gmail.com",
    port: 465,
    secure: true,
    auth: { user: utilisateur, pass: motDePasse },
  });

  let envoyes = 0;
  let echecs = 0;
  for (const c of courriels) {
    try {
      await transport.sendMail({
        from: { name: "ArcInnoLab", address: utilisateur },
        to: c.destinataire,
        subject: c.sujet,
        text: texte(c),
        html: html(c),
      });
      await db.rpc("marquer_courriel", { p_id: c.id, p_ok: true });
      envoyes++;
    } catch (e) {
      await db.rpc("marquer_courriel", { p_id: c.id, p_ok: false, p_erreur: String((e as Error)?.message ?? e) });
      echecs++;
    }
  }
  transport.close();
  return reponse({ ok: echecs === 0, envoyes, echecs });
});
