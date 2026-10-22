// Audience du site (Vercel Web Analytics), pour l'onglet « Audience » du tableau de bord.
// Réservé aux comptes de la table app_admins. La clé Vercel reste ici, côté serveur.
//
// Secrets Supabase à créer (Edge Functions › Secrets) :
//   VERCEL_TOKEN       jeton d'accès Vercel (Account Settings › Tokens), portée : l'équipe fabientag
// Les identifiants du projet et de l'équipe ne sont pas secrets : ils ont une valeur par défaut,
// qu'on peut remplacer par les secrets VERCEL_PROJECT_ID et VERCEL_TEAM_ID.
// SUPABASE_URL et la clé secrète du projet sont fournis automatiquement.

import { createClient } from "npm:@supabase/supabase-js@2";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
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

type Ligne = Record<string, string | number | null>;

const jourIso = (d: Date) => d.toISOString().slice(0, 10);

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return json({ erreur: "méthode non autorisée" }, 405);

  const admin = createClient(Deno.env.get("SUPABASE_URL")!, cleSecrete(), { auth: { persistSession: false } });
  const jeton = (req.headers.get("Authorization") ?? "").replace(/^Bearer\s+/i, "");
  const { data: auth } = jeton ? await admin.auth.getUser(jeton) : { data: { user: null } };
  if (!auth?.user) return json({ erreur: "connexion requise" }, 401);
  const { data: estAdmin } = await admin.from("app_admins").select("user_id").eq("user_id", auth.user.id).maybeSingle();
  if (!estAdmin) return json({ erreur: "réservé à l'administrateur" }, 403);

  const token = Deno.env.get("VERCEL_TOKEN");
  const projet = Deno.env.get("VERCEL_PROJECT_ID") ?? "prj_cBqqv9KJPiqy6PpsMGdp9AP1bPMH";
  const equipe = Deno.env.get("VERCEL_TEAM_ID") ?? "team_sdhPlUcHdiZjcOaFf6qHV2T1";
  if (!token || !projet) return json({ etat: "non_configure" });

  let jours = 7;
  try {
    const corps = (await req.json()) as { jours?: number };
    if (corps?.jours === 30) jours = 30;
  } catch {
    /* corps vide : 7 jours */
  }
  const fin = new Date();
  const debut = new Date(fin.getTime() - (jours - 1) * 86_400_000);
  const since = jourIso(debut);
  const until = jourIso(new Date(fin.getTime() + 86_400_000));

  const appel = async (chemin: string, params: Record<string, string>) => {
    const q = new URLSearchParams({ projectId: projet, since, until, filter: "environment eq 'production'", ...params });
    if (equipe) q.set("teamId", equipe);
    const r = await fetch(`https://api.vercel.com/v1/query/web-analytics/visits/${chemin}?${q}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const corps = (await r.json().catch(() => ({}))) as { data?: unknown; error?: { code?: string; message?: string } };
    if (!r.ok) throw new Error(corps.error?.code ?? `vercel_${r.status}`);
    return corps.data;
  };
  const groupe = async (by: string, limit?: number) => ((await appel("aggregate", { by, ...(limit ? { limit: String(limit) } : {}) })) as Ligne[]) ?? [];

  try {
    const [total, parJour, pages, appareils, pays, sources] = await Promise.all([
      appel("count", {}) as Promise<{ pageviews?: number; visitors?: number }>,
      groupe("day"),
      groupe("requestPath", 8),
      groupe("deviceType", 5),
      groupe("country", 6),
      groupe("referrerHostname", 6),
    ]);
    const vers = (l: Ligne[], cle: string) =>
      l.map((x) => ({ nom: String(x[cle] ?? "") || "—", visiteurs: Number(x["visitors"] ?? 0), pages: Number(x["pageviews"] ?? 0) }));
    return json({
      etat: "ok",
      jours,
      depuis: since,
      visiteurs: Number(total?.visitors ?? 0),
      pagesVues: Number(total?.pageviews ?? 0),
      parJour: parJour.map((x) => ({ jour: String(x["timestamp"] ?? "").slice(0, 10), visiteurs: Number(x["visitors"] ?? 0), pages: Number(x["pageviews"] ?? 0) })),
      pages: vers(pages, "requestPath"),
      appareils: vers(appareils, "deviceType"),
      pays: vers(pays, "country"),
      sources: vers(sources, "referrerHostname"),
    });
  } catch (e) {
    const code = e instanceof Error ? e.message : "inconnu";
    if (code === "web_analytics_not_enabled") return json({ etat: "desactive" });
    console.error("Vercel Analytics indisponible", code);
    return json({ etat: "erreur", code });
  }
});
