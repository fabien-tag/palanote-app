import { supabase } from "@/lib/supabase";

// Le banc d'essai de l'agent de lecture (sql/palanote-eval-agent.sql) : l'eval set et ses résultats.

export type TypeCas = "nominal" | "bordure" | "hostile";
export type ValeurAttendue = string | number | null;
export type Attendu = { lisible: boolean; plongees: Record<string, ValeurAttendue>[] };

export type CasEval = { id: string; titre: string; type: TypeCas; chemin: string; attendu: Attendu; note: string | null; created_at: string };
export type RunEval = { id: string; mode: "direct" | "agent"; modele: string | null; etapes_max: number | null; created_at: string };
export type ChampNote = { plongee: number; champ: string; attendu: unknown; lu: unknown; confiance: string; verdict: "exact" | "exact_signale" | "signale" | "faux" | "invente" };
export type ResultatEval = {
  id: string;
  run_id: string;
  cas_id: string;
  reussi: boolean;
  details: {
    hostile?: boolean;
    structure?: boolean;
    attendu_n?: number;
    lu_n?: number;
    exact?: number;
    signale?: number;
    faux?: number;
    invente?: number;
    inventees?: number;
    champs?: ChampNote[];
  };
  journal: { outil: string; raison: string }[];
  etapes: number | null;
  tokens_entree: number | null;
  tokens_sortie: number | null;
  duree_ms: number | null;
  erreur: string | null;
};

// Les champs vérifiés par l'eval set (les plus importants pour un carnet)
export const CHAMPS_EVAL: { cle: string; label: string; aide: string }[] = [
  { cle: "date", label: "Date", aide: "AAAA-MM-JJ" },
  { cle: "site", label: "Site", aide: "Épave du Togo" },
  { cle: "profondeur_max", label: "Profondeur (m)", aide: "32" },
  { cle: "duree", label: "Durée (min)", aide: "45" },
  { cle: "temperature", label: "Température (°C)", aide: "19" },
];

// Estimation du coût en euros (tarif public Sonnet, à ajuster selon le modèle)
export const PRIX_ENTREE_PAR_MILLION = 3;
export const PRIX_SORTIE_PAR_MILLION = 15;
export const coutEuros = (entree: number, sortie: number) => (entree * PRIX_ENTREE_PAR_MILLION + sortie * PRIX_SORTIE_PAR_MILLION) / 1_000_000;

export async function chargerBanc() {
  const [cas, runs] = await Promise.all([
    supabase.from("agent_eval_cas").select("*").order("created_at"),
    supabase.from("agent_eval_runs").select("*").order("created_at", { ascending: false }).limit(20),
  ]);
  if (cas.error) throw cas.error;
  if (runs.error) throw runs.error;
  const ids = (runs.data ?? []).map((r) => r.id);
  const res = ids.length ? await supabase.from("agent_eval_resultats").select("*").in("run_id", ids) : { data: [], error: null };
  if (res.error) throw res.error;
  return { cas: (cas.data ?? []) as CasEval[], runs: (runs.data ?? []) as RunEval[], resultats: (res.data ?? []) as ResultatEval[] };
}

export async function ajouterCas(fichier: File, titre: string, type: TypeCas, attendu: Attendu, note: string) {
  const ext = fichier.type === "image/png" ? "png" : fichier.type === "image/webp" ? "webp" : "jpg";
  const chemin = `cas/${crypto.randomUUID()}.${ext}`;
  const envoi = await supabase.storage.from("evals").upload(chemin, fichier, { contentType: fichier.type });
  if (envoi.error) throw envoi.error;
  const { error } = await supabase.from("agent_eval_cas").insert({ titre, type, chemin, attendu, note: note || null });
  if (error) throw error;
}

export async function retirerCas(c: CasEval) {
  await supabase.storage.from("evals").remove([c.chemin]);
  const { error } = await supabase.from("agent_eval_cas").delete().eq("id", c.id);
  if (error) throw error;
}

export async function urlPhotoCas(chemin: string) {
  const { data } = await supabase.storage.from("evals").createSignedUrl(chemin, 3600);
  return data?.signedUrl ?? null;
}

export async function nouveauRun(mode: "direct" | "agent") {
  const { data, error } = await supabase.from("agent_eval_runs").insert({ mode, etapes_max: mode === "direct" ? 1 : 4 }).select("*").single();
  if (error) throw error;
  return data as RunEval;
}

// Un cas évalué par la fonction serveur (même code que la vraie lecture)
export async function evaluerCas(runId: string, casId: string, mode: "direct" | "agent") {
  const { data, error } = await supabase.functions.invoke("lire-page", { body: { eval: { run_id: runId, cas_id: casId, mode } } });
  if (error) {
    const ctx = (error as { context?: Response }).context;
    const detail = ctx && typeof ctx.json === "function" ? ((await ctx.json().catch(() => null)) as { erreur?: string } | null)?.erreur : null;
    throw new Error(detail ?? error.message);
  }
  return data as Omit<ResultatEval, "id" | "run_id" | "cas_id">;
}

// Le résumé d'une évaluation : taux de réussite, champs, coût, durée
export function resume(resultats: ResultatEval[]) {
  const n = resultats.length;
  const somme = (f: (r: ResultatEval) => number) => resultats.reduce((t, r) => t + f(r), 0);
  const exact = somme((r) => r.details.exact ?? 0);
  const signale = somme((r) => r.details.signale ?? 0);
  const faux = somme((r) => r.details.faux ?? 0);
  const invente = somme((r) => (r.details.invente ?? 0) + (r.details.inventees ?? 0));
  const champs = exact + signale + faux + somme((r) => r.details.invente ?? 0);
  const cout = somme((r) => coutEuros(r.tokens_entree ?? 0, r.tokens_sortie ?? 0));
  return {
    n,
    reussis: resultats.filter((r) => r.reussi).length,
    exactPct: champs ? Math.round((exact / champs) * 100) : 0,
    signale,
    faux,
    invente,
    erreurs: resultats.filter((r) => r.erreur).length,
    verifications: somme((r) => (Array.isArray(r.journal) ? r.journal.length : 0)),
    coutParPage: n ? cout / n : 0,
    dureeMoyenne: n ? Math.round(somme((r) => r.duree_ms ?? 0) / n / 100) / 10 : 0,
  };
}
