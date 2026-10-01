import { supabase } from "@/lib/supabase";

// Carte affichée dans le carnet.
// Connecté : les plongées viennent de la table `dives` du Supabase Palanote.
// Non connecté (mode maquette) : elles restent sur l'appareil, sans les photos.
export type CartePlongee = {
  id: string;
  date: string;
  siteNom: string;
  siteLieu: string;
  profMax: string;
  duree: string; // en minutes
  tempFond: string;
  melange: string;
  note: number;
  binomes: string[];
  type?: string; // type de plongée : Exploration, Épave, Formation…
  coords?: string; // « 43.55120, 7.04780 » (déjà décalé de 100 à 150 m)
  faune?: string[];
  club?: string;
  photo?: string | undefined;
};

// Ligne de la table `dives` (colonnes écrites par l'app).
export type LignePlongee = {
  id: string;
  dive_date: string | null;
  start_time: string | null;
  site_name: string | null;
  site_location: string | null;
  site_coords: string | null;
  max_depth_m: number | null;
  avg_depth_m: number | null;
  duration_min: number | null;
  end_time: string | null;
  total_time_min: number | null;
  surface_interval_min: number | null;
  stops: { profondeur: number | null; duree: number | null }[];
  method: string | null;
  computer: string | null;
  gas_mix: string | null;
  o2_pct: number | null;
  he_pct: number | null;
  tank_config: string | null;
  tank_volume_l: number | null;
  weight_kg: number | null;
  pressure_start_bar: number | null;
  pressure_end_bar: number | null;
  suit_type: string | null;
  suit_thickness_mm: number | null;
  temp_surface_c: number | null;
  temp_bottom_c: number | null;
  temp_air_c: number | null;
  visibility_m: number | null;
  current_strength: string | null;
  sea_state: string | null;
  weather: string | null;
  buddies: string[];
  guide_name: string | null;
  dive_leader: string | null;
  club_name: string | null;
  boat_name: string | null;
  dive_type: string | null;
  environment: string | null;
  entry_type: string | null;
  rating: number | null;
  rating_place: number | null;
  rating_conditions: number | null;
  rating_wildlife: number | null;
  comment: string | null;
  wildlife: string[];
  visibility: "private" | "friends" | "public";
};

// ---------- Conversions des champs saisis ----------

export const texte = (v: string) => (v.trim() === "" ? null : v.trim());

export function nombre(v: string): number | null {
  if (v.trim() === "") return null;
  const n = Number(v.replace(",", "."));
  return Number.isFinite(n) ? n : null;
}

export function entier(v: string): number | null {
  const n = nombre(v);
  return n === null ? null : Math.round(n);
}

// « 1 h 10 », « 1 h », « 40 min » ou « 40 » → minutes
export function dureeEnMinutes(v: string): number | null {
  const s = v.trim().toLowerCase();
  if (s === "") return null;
  const h = s.match(/^(\d+)\s*h\s*(\d+)?/);
  if (h) return Number(h[1]) * 60 + Number(h[2] ?? 0);
  return entier(s.replace("min", ""));
}

// minutes → « 40 min », « 1 h », « 1 h 10 »
export function minutesEnTexte(min: number | string | null | undefined): string {
  const n = typeof min === "string" ? Number(min) : min;
  if (n === null || n === undefined || !Number.isFinite(n) || String(min).trim() === "") return "";
  const h = Math.floor(n / 60);
  const m = n % 60;
  if (h === 0) return `${m} min`;
  return m === 0 ? `${h} h` : `${h} h ${m}`;
}

export const VISIBILITE_DEPUIS_BASE: Record<LignePlongee["visibility"], string> = {
  private: "Moi seul",
  friends: "Mes amis",
  public: "Public",
};

export const VISIBILITE_VERS_BASE: Record<string, LignePlongee["visibility"]> = {
  "Moi seul": "private",
  "Mes amis": "friends",
  Public: "public",
};

// ---------- Supabase ----------

export async function utilisateurConnecte() {
  const { data } = await supabase.auth.getSession();
  return data.session?.user ?? null;
}

// Crée la plongée, ou la met à jour si elle existe déjà (même id).
export async function sauverPlongee(ligne: LignePlongee) {
  const user = await utilisateurConnecte();
  if (!user) throw Object.assign(new Error("non_connecte"), { code: "non_connecte" });
  const { error } = await supabase.from("dives").upsert({ ...ligne, user_id: user.id });
  if (error) throw error;
}

export async function chargerPlongees(): Promise<CartePlongee[]> {
  const { data, error } = await supabase
    .from("dives")
    .select(
      "id, dive_date, site_name, site_location, site_coords, max_depth_m, duration_min, temp_bottom_c, gas_mix, rating, buddies, dive_type, wildlife, club_name",
    )
    .is("deleted_at", null) // les plongées supprimées n'apparaissent plus
    .order("dive_date", { ascending: false, nullsFirst: false })
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []).map((d) => ({
    id: d.id,
    date: d.dive_date ?? "",
    siteNom: d.site_name ?? "",
    siteLieu: d.site_location ?? "",
    profMax: d.max_depth_m === null ? "" : String(d.max_depth_m),
    duree: d.duration_min === null ? "" : String(d.duration_min),
    tempFond: d.temp_bottom_c === null ? "" : String(d.temp_bottom_c),
    melange: d.gas_mix ?? "",
    note: d.rating ?? 0,
    binomes: d.buddies ?? [],
    type: d.dive_type ?? "",
    coords: d.site_coords ?? "",
    faune: d.wildlife ?? [],
    club: d.club_name ?? "",
  }));
}

// Une plongée complète du compte connecté (pour la page détail).
export async function chargerPlongee(id: string): Promise<LignePlongee | null> {
  const { data, error } = await supabase.from("dives").select("*").eq("id", id).is("deleted_at", null).maybeSingle();
  if (error) throw error;
  return (data as LignePlongee | null) ?? null;
}

// Nombre de plongées déjà faites avant l'app (question du profil plongeur).
export async function chargerNumeroDepart(userId: string): Promise<number> {
  const { data } = await supabase.from("profiles").select("numero_depart").eq("id", userId).maybeSingle();
  const n = Number(data?.numero_depart ?? 0);
  return Number.isFinite(n) ? n : 0;
}

// ---------- Mode maquette (non connecté) ----------

const CLE = "palanote-plongees";
let memoire: CartePlongee[] | null = null;

export function lirePlongees(): CartePlongee[] {
  if (memoire !== null) return memoire;
  if (typeof window === "undefined") return [];
  try {
    memoire = (JSON.parse(localStorage.getItem(CLE) || "[]") as CartePlongee[]).map((p) => ({
      ...p,
      photo: undefined,
    }));
  } catch {
    memoire = [];
  }
  return memoire ?? [];
}

export function enregistrerPlongee(p: CartePlongee) {
  const liste = lirePlongees().filter((x) => x.id !== p.id);
  liste.push(p);
  liste.sort((a, b) => (b.date || "").localeCompare(a.date || ""));
  memoire = liste;
  try {
    localStorage.setItem(CLE, JSON.stringify(liste.map(({ photo: _p, ...r }) => r)));
  } catch {
    /* stockage indisponible */
  }
}

// Supprime une plongée : connecté, elle est retirée du carnet (suppression douce, deleted_at) ;
// sinon, elle est retirée de celles gardées sur l'appareil.
export async function supprimerPlongee(id: string) {
  if (await utilisateurConnecte()) {
    const { error } = await supabase.from("dives").update({ deleted_at: new Date().toISOString() }).eq("id", id);
    if (error) throw error;
    return;
  }
  memoire = lirePlongees().filter((x) => x.id !== id);
  try {
    localStorage.setItem(CLE, JSON.stringify(memoire.map(({ photo: _p, ...r }) => r)));
  } catch {
    /* stockage indisponible */
  }
}
