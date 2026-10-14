// ============================================================
// Palanote — Edge Function « abonnement-club »
// L'abonnement du site d'un club (Premium, Advanced), payé par Stripe.
//
// Appels depuis l'app (personne connectée, DP du centre) :
//   { action: "checkout", centre, offre, retour }  → { url } : la page de paiement Stripe
//   { action: "confirmer", centre, session_id }     → { offre } : au retour du paiement, l'offre est appliquée
//   { action: "portail", centre, retour }           → { url } : gérer, changer ou résilier l'abonnement
// Appel de Stripe (webhook, en-tête stripe-signature) : renouvellement, impayé, résiliation.
//
// Secrets (Supabase → Edge Functions → Secrets) :
//   STRIPE_SECRET_KEY      clé secrète Stripe (sk_test_… pour la démo)
//   STRIPE_WEBHOOK_SECRET  facultatif : secret du webhook (whsec_…), pour suivre les renouvellements
// Les prix sont créés à la volée (price_data) : rien à configurer dans Stripe pour commencer.
// « Verify JWT » peut rester désactivé : la personne est vérifiée ici même, et Stripe n'a pas de jeton.
// ============================================================
import { createClient, type SupabaseClient } from "npm:@supabase/supabase-js@2";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

// Les offres payantes, en centimes par mois (le Starter est compris avec l'app)
const OFFRES: Record<string, { nom: string; prix: number }> = {
  premium: { nom: "Palanote Premium · site du club avec son nom de domaine", prix: Number(Deno.env.get("PRIX_PREMIUM") ?? 6900) },
  advanced: { nom: "Palanote Advanced · site du club avec réservation en ligne", prix: Number(Deno.env.get("PRIX_ADVANCED") ?? 12900) },
};

function json(corps: unknown, status = 200) {
  return new Response(JSON.stringify(corps), { status, headers: { ...CORS, "Content-Type": "application/json" } });
}

function cleSecrete(): string {
  const legacy = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (legacy) return legacy;
  try {
    const cles = JSON.parse(Deno.env.get("SUPABASE_SECRET_KEYS") ?? "{}") as Record<string, string>;
    return cles["default"] ?? Object.values(cles)[0] ?? "";
  } catch {
    return "";
  }
}

// Appel à l'API Stripe (formulaire encodé, sans bibliothèque)
async function stripe(methode: "GET" | "POST", chemin: string, params: Record<string, string> = {}) {
  const corps = new URLSearchParams(params).toString();
  const r = await fetch(`https://api.stripe.com/v1/${chemin}${methode === "GET" && corps ? `?${corps}` : ""}`, {
    method: methode,
    headers: {
      Authorization: `Bearer ${Deno.env.get("STRIPE_SECRET_KEY")}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    ...(methode === "POST" ? { body: corps } : {}),
  });
  const data = await r.json();
  if (!r.ok) throw new Error(`Stripe : ${data?.error?.message ?? r.status}`);
  return data;
}

const statutDe = (s: string) => (s === "active" || s === "trialing" ? "actif" : s === "past_due" || s === "unpaid" ? "impaye" : "annule");

// Fin de la période payée (selon la version de l'API Stripe, elle est sur l'abonnement ou sur sa ligne)
const finDe = (abo: Record<string, unknown>) => {
  const t = (abo["current_period_end"] as number | undefined) ?? ((abo["items"] as { data?: { current_period_end?: number }[] })?.data?.[0]?.current_period_end);
  return t ? new Date(t * 1000).toISOString() : null;
};

async function appliquer(admin: SupabaseClient, centre: string, abo: Record<string, unknown>) {
  const meta = (abo["metadata"] ?? {}) as Record<string, string>;
  const statut = statutDe(String(abo["status"]));
  const offre = statut === "annule" ? "starter" : meta["offre"] && OFFRES[meta["offre"]] ? meta["offre"] : "premium";
  const { error } = await admin.rpc("appliquer_abonnement_club", {
    p_centre: centre,
    p_offre: offre,
    p_statut: statut,
    p_fin: finDe(abo),
    p_client: typeof abo["customer"] === "string" ? abo["customer"] : null,
    p_abonnement: String(abo["id"]),
  });
  if (error) throw error;
  return offre;
}

// Vérification de la signature d'un webhook Stripe (HMAC SHA-256)
async function signatureValide(corps: string, entete: string, secret: string) {
  const parts = Object.fromEntries(entete.split(",").map((p) => p.split("=") as [string, string]));
  const t = parts["t"];
  const v1 = entete
    .split(",")
    .filter((p) => p.startsWith("v1="))
    .map((p) => p.slice(3));
  if (!t || v1.length === 0 || Math.abs(Date.now() / 1000 - Number(t)) > 300) return false;
  const cle = await crypto.subtle.importKey("raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const sig = await crypto.subtle.sign("HMAC", cle, new TextEncoder().encode(`${t}.${corps}`));
  const hex = [...new Uint8Array(sig)].map((b) => b.toString(16).padStart(2, "0")).join("");
  return v1.includes(hex);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return json({ erreur: "méthode non autorisée" }, 405);
  if (!Deno.env.get("STRIPE_SECRET_KEY")) return json({ erreur: "secret STRIPE_SECRET_KEY manquant" }, 500);
  const admin = createClient(Deno.env.get("SUPABASE_URL")!, cleSecrete(), { auth: { persistSession: false } });

  // ——— Webhook Stripe ———
  const signature = req.headers.get("stripe-signature");
  if (signature) {
    const secret = Deno.env.get("STRIPE_WEBHOOK_SECRET");
    const corps = await req.text();
    if (!secret || !(await signatureValide(corps, signature, secret))) return json({ erreur: "signature invalide" }, 400);
    const evt = JSON.parse(corps);
    if (String(evt.type).startsWith("customer.subscription.")) {
      const abo = evt.data.object;
      const centre = abo?.metadata?.centre_id;
      if (centre) await appliquer(admin, centre, abo);
    }
    return json({ recu: true });
  }

  // ——— Appels de l'app ———
  let corps: Record<string, string> = {};
  try {
    corps = await req.json();
  } catch {
    /* corps vide */
  }
  const jeton = (req.headers.get("Authorization") ?? "").replace(/^Bearer\s+/i, "");
  const { data: auth } = jeton ? await admin.auth.getUser(jeton) : { data: { user: null } };
  if (!auth?.user) return json({ erreur: "connexion requise" }, 401);
  const centre = corps["centre"] ?? "";
  const { data: club } = await admin.rpc("club_pour_abonnement", { p_user: auth.user.id, p_centre: centre });
  if (!club) return json({ erreur: "réservé aux directeurs de plongée du centre" }, 403);

  try {
    if (corps["action"] === "checkout") {
      const offre = corps["offre"] ?? "";
      if (!OFFRES[offre]) return json({ erreur: "offre inconnue" }, 400);
      // Déjà abonné : on change d'offre depuis le portail Stripe
      if (club.stripe_abonnement && club.offre !== "starter") return json({ erreur: "deja_abonne" }, 409);
      const retour = corps["retour"] ?? "";
      const session = await stripe("POST", "checkout/sessions", {
        mode: "subscription",
        "line_items[0][quantity]": "1",
        "line_items[0][price_data][currency]": "eur",
        "line_items[0][price_data][unit_amount]": String(OFFRES[offre]!.prix),
        "line_items[0][price_data][recurring][interval]": "month",
        "line_items[0][price_data][product_data][name]": OFFRES[offre]!.nom,
        success_url: `${retour}?abonnement=ok&session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: `${retour}?abonnement=annule`,
        client_reference_id: centre,
        "metadata[centre_id]": centre,
        "metadata[offre]": offre,
        "subscription_data[metadata][centre_id]": centre,
        "subscription_data[metadata][offre]": offre,
        "subscription_data[description]": `${OFFRES[offre]!.nom} · ${club.nom}`,
        locale: "fr",
        ...(club.stripe_client ? { customer: club.stripe_client } : club.email ? { customer_email: club.email } : {}),
      });
      return json({ url: session.url });
    }

    if (corps["action"] === "confirmer") {
      const session = await stripe("GET", `checkout/sessions/${encodeURIComponent(corps["session_id"] ?? "")}`, { "expand[]": "subscription" });
      if (session?.metadata?.centre_id !== centre) return json({ erreur: "ce paiement ne concerne pas ce club" }, 403);
      if (session.status !== "complete" || !session.subscription) return json({ erreur: "paiement non terminé" }, 409);
      const offre = await appliquer(admin, centre, session.subscription);
      return json({ offre });
    }

    if (corps["action"] === "portail") {
      if (!club.stripe_client) return json({ erreur: "aucun abonnement" }, 404);
      const portail = await stripe("POST", "billing_portal/sessions", { customer: club.stripe_client, return_url: corps["retour"] ?? "" });
      return json({ url: portail.url });
    }

    return json({ erreur: "action inconnue" }, 400);
  } catch (e) {
    console.error(e);
    return json({ erreur: String((e as Error)?.message ?? e) }, 502);
  }
});
