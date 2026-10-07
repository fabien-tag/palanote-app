import { supabase } from "@/lib/supabase";

// ============================================================
// Version gratuite et forfaits (palanote-forfaits.sql)
// Gratuit : tout le carnet + 50 pages lues par l'IA (espèces illimitées).
// Au-delà : le pack « Numériser mes carnets » ou Palanote+.
// Le compteur est tenu par le serveur (fonction lire-page).
// ============================================================

export type Forfait = {
  offertes: number;
  achetees: number;
  lues: number;
  plus: boolean;
  plusJusquAu: string | null;
  restantes: number | null; // null = illimité (Palanote+)
};

export const OFFRES = {
  pack: { nom: "Numériser mes carnets", prix: "4,99 €", pages: 200 },
  plus: { nom: "Palanote+", prix: "19 €", periode: "par an" },
};

// null si le script SQL n'est pas encore lancé : on n'affiche alors rien.
export async function chargerForfait(): Promise<Forfait | null> {
  const { data, error } = await supabase.rpc("mon_forfait");
  if (error || !data) return null;
  const d = data as Record<string, unknown>;
  return {
    offertes: Number(d["offertes"] ?? 0),
    achetees: Number(d["achetees"] ?? 0),
    lues: Number(d["lues"] ?? 0),
    plus: d["plus"] === true,
    plusJusquAu: typeof d["plus_jusqu_au"] === "string" ? d["plus_jusqu_au"] : null,
    restantes: d["restantes"] === null || d["restantes"] === undefined ? null : Number(d["restantes"]),
  };
}

export function resumeForfait(f: Forfait) {
  if (f.plus) return "Palanote+";
  const r = f.restantes ?? 0;
  return `${r} page${r > 1 ? "s" : ""} restante${r > 1 ? "s" : ""}`;
}

// « Je suis intéressé » : on note l'intérêt dans les retours, en attendant le paiement en ligne.
export async function signalerInteret(offre: "pack" | "plus") {
  const { error } = await supabase.from("feedback").insert({
    raison: "Forfait",
    message: `Intéressé par ${offre === "pack" ? OFFRES.pack.nom : OFFRES.plus.nom}`,
    page: typeof window === "undefined" ? null : window.location.pathname,
  });
  if (error) throw error;
}

// ---------- Tableau de bord ----------

export type ForfaitAdmin = {
  id: string;
  email: string;
  type: "pack" | "plus";
  pages: number | null;
  debut: string;
  fin: string | null;
  montant: number | null;
  source: string;
  note: string | null;
  actif: boolean;
};

export async function chargerForfaitsAdmin(): Promise<ForfaitAdmin[] | null> {
  const { data, error } = await supabase.rpc("admin_forfaits");
  if (error) return null;
  return (data ?? []) as ForfaitAdmin[];
}

export async function donnerForfait(email: string, type: "pack" | "plus", montant: number | null, note: string) {
  const { error } = await supabase.rpc("admin_donner_forfait", { p_email: email, p_type: type, p_montant: montant, p_note: note });
  if (error) throw error;
}

export async function retirerForfait(id: string) {
  const { error } = await supabase.rpc("admin_retirer_forfait", { p_id: id });
  if (error) throw error;
}
