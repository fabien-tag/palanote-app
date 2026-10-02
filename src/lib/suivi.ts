import { supabase } from "@/lib/supabase";

// ============================================================
// Suivi pour le tableau de bord du développeur :
// présence (connectés / actifs), erreurs remontées, retours des utilisateurs.
// Rien sur le contenu du carnet, des photos ou des positions.
// ============================================================

export const VERSION_APP = "1.0.0";

// « iPhone » + « iOS 18 », « Android » + « Android 15 », « Mac » + « macOS »…
export function decrireAppareil(): { appareil: string; systeme: string } {
  if (typeof navigator === "undefined") return { appareil: "", systeme: "" };
  const ua = navigator.userAgent;
  const ios = ua.match(/(iPhone|iPad|iPod).*?OS (\d+)[_.](\d+)?/);
  if (ios) return { appareil: ios[1]!, systeme: `iOS ${ios[2]}` };
  const android = ua.match(/Android (\d+(?:\.\d+)?)/);
  if (android) {
    const modele = ua.match(/Android [^;]+; ([^;)]+?)(?: Build|\))/)?.[1]?.trim();
    return { appareil: modele && modele !== "K" ? modele : "Android", systeme: `Android ${android[1]}` };
  }
  if (/Macintosh/.test(ua)) return { appareil: "Mac", systeme: "macOS" };
  if (/Windows/.test(ua)) return { appareil: "PC", systeme: "Windows" };
  return { appareil: "Ordinateur", systeme: "" };
}

// ---------- Présence ----------

export async function signalerPresence() {
  const { data } = await supabase.auth.getSession();
  if (!data.session) return;
  const { appareil, systeme } = decrireAppareil();
  await supabase.rpc("signaler_presence", { p_appareil: [appareil, systeme].filter(Boolean).join(" · "), p_version: VERSION_APP });
}

// ---------- Erreurs ----------

let envoyees = 0;
let enCours = false;
const recentes = new Map<string, number>();
const IGNOREES = [/ResizeObserver loop/i, /AbortError/i, /The user aborted/i, /Load failed$/i];

function texteErreur(valeur: unknown): { message: string; details: string | null } {
  if (valeur instanceof Error) return { message: valeur.message || valeur.name, details: valeur.stack ?? null };
  if (valeur && typeof valeur === "object") {
    const o = valeur as Record<string, unknown>;
    const message = typeof o["message"] === "string" ? o["message"] : JSON.stringify(valeur).slice(0, 300);
    return { message, details: JSON.stringify(valeur).slice(0, 4000) };
  }
  return { message: String(valeur), details: null };
}

export function journaliserErreur(...valeurs: unknown[]) {
  if (typeof window === "undefined" || enCours || envoyees >= 25) return;
  const premiere = valeurs.find((v) => v instanceof Error || (v && typeof v === "object")) ?? valeurs[0];
  const { message: brut, details } = texteErreur(premiere);
  const contexte = valeurs.filter((v) => typeof v === "string").join(" ");
  const message = (contexte && !brut.includes(contexte) ? `${contexte} — ${brut}` : brut).slice(0, 1000);
  if (!message || IGNOREES.some((r) => r.test(message))) return;
  const maintenant = Date.now();
  if ((recentes.get(message) ?? 0) > maintenant - 60_000) return; // même erreur il y a moins d'une minute
  recentes.set(message, maintenant);
  envoyees += 1;
  enCours = true;
  const { appareil, systeme } = decrireAppareil();
  void Promise.resolve(
    supabase.from("app_errors").insert({
      message,
      details: details?.slice(0, 6000) ?? null,
      page: window.location.pathname + window.location.search,
      version: VERSION_APP,
      appareil,
      systeme,
    }),
  )
    .catch(() => undefined)
    .finally(() => {
      enCours = false;
    });
}

// À appeler une fois au démarrage de l'app (navigateur uniquement).
let installe = false;
export function installerSuivi() {
  if (typeof window === "undefined" || installe) return;
  installe = true;

  // Toutes les erreurs déjà affichées en console par l'app remontent aussi au tableau de bord.
  const consoleError = console.error.bind(console);
  console.error = (...args: unknown[]) => {
    consoleError(...args);
    journaliserErreur(...args);
  };
  window.addEventListener("error", (e) => journaliserErreur(e.error ?? e.message));
  window.addEventListener("unhandledrejection", (e) => journaliserErreur(e.reason));

  // Présence : au démarrage, puis toutes les 4 minutes tant que l'app est à l'écran.
  const ping = () => {
    if (document.visibilityState === "visible") void signalerPresence().catch(() => undefined);
  };
  ping();
  setInterval(ping, 4 * 60_000);
  document.addEventListener("visibilitychange", ping);
  supabase.auth.onAuthStateChange((evenement) => {
    if (evenement === "SIGNED_IN") ping();
  });
}

// ---------- Retours des utilisateurs ----------

export const RAISONS_RETOUR = ["Trop compliqué", "Il manque une fonction", "Ça bugue", "La numérisation lit mal", "Autre"];

export async function envoyerRetour(r: { raison: string | null; message: string; joindreEmail: boolean }) {
  const { data } = await supabase.auth.getSession();
  const { appareil, systeme } = decrireAppareil();
  const { error } = await supabase.from("feedback").insert({
    raison: r.raison,
    message: r.message.trim(),
    email: r.joindreEmail ? (data.session?.user.email ?? null) : null,
    version: VERSION_APP,
    appareil,
    systeme,
    page: typeof window === "undefined" ? null : window.location.pathname,
  });
  if (error) throw error;
}

// ---------- Tableau de bord (réservé à l'admin) ----------

export type StatsAdmin = {
  comptes: number;
  comptes_7j: number;
  connectes: number;
  actifs_jour: number;
  actifs_7j: number;
  actifs_30j: number;
  plongees: number;
  plongees_7j: number;
  retours_nouveaux: number;
  erreurs_24h: number;
  pages_numerisees?: number;
  pages_30j?: number;
  binomes?: number;
  photos?: number;
  par_jour: { jour: string; actifs: number; inscriptions: number }[];
};
export type Retour = {
  id: string;
  raison: string | null;
  message: string;
  email: string | null;
  version: string | null;
  appareil: string | null;
  systeme: string | null;
  statut: "nouveau" | "traite";
  created_at: string;
};
export type ErreurApp = { id: string; message: string; details: string | null; page: string | null; appareil: string | null; systeme: string | null; user_id: string | null; created_at: string };
export type UtilisateurAdmin = { id: string; email: string; prenom: string; inscrit_le: string; derniere_visite: string | null; appareil: string | null; plongees: number };

export async function estAdmin(): Promise<boolean> {
  const { data, error } = await supabase.rpc("est_admin");
  return !error && data === true;
}

export async function chargerTableauDeBord() {
  const [stats, retours, erreurs, utilisateurs] = await Promise.all([
    supabase.rpc("admin_stats"),
    supabase.from("feedback").select("*").order("created_at", { ascending: false }).limit(100),
    supabase.from("app_errors").select("*").order("created_at", { ascending: false }).limit(300),
    supabase.rpc("admin_utilisateurs", { p_limite: 100 }),
  ]);
  if (stats.error) throw stats.error;
  return {
    stats: stats.data as StatsAdmin,
    retours: (retours.data ?? []) as Retour[],
    erreurs: (erreurs.data ?? []) as ErreurApp[],
    utilisateurs: (utilisateurs.data ?? []) as UtilisateurAdmin[],
  };
}

export async function marquerRetour(id: string, statut: "nouveau" | "traite") {
  const { error } = await supabase.from("feedback").update({ statut }).eq("id", id);
  if (error) throw error;
}

export async function effacerErreurs(message: string) {
  const { error } = await supabase.from("app_errors").delete().eq("message", message);
  if (error) throw error;
}
