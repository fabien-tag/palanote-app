import { supabase, SUPABASE_PUBLISHABLE_KEY, SUPABASE_URL } from "@/lib/supabase";

// Le site internet du club (sql/palanote-site-club.sql) : réglages + données vivantes du back-office.

export type Zone = { nom: string; profondeur: number | string | null; niveau: string; description: string };
export type Atout = { titre: string; texte: string };
export type Tarif = { libelle: string; detail: string; prix: number | string | null; groupe: "formation" | "plongee" };
export type Sections = { palanote?: boolean; tarifs?: boolean; formations: boolean; zones: boolean; materiel: boolean; equipe: boolean; infos: boolean };

export type ReglagesSite = {
  centre_id: string;
  slug: string;
  publie: boolean;
  offre: "starter" | "premium" | "advanced";
  modele: string;
  couleur_accent: string;
  couleur_secondaire: string;
  couleur_tertiaire: string;
  couleur_fond: string;
  couleur_texte: string;
  logo_url: string | null;
  couverture_url: string | null;
  accroche: string | null;
  sous_titre: string | null;
  presentation: string | null;
  atouts: Atout[];
  zones: Zone[];
  adresse: string | null;
  telephone: string | null;
  email: string | null;
  horaires: string | null;
  saison: string | null;
  infos: string | null;
  tarifs: Tarif[];
  annee_creation?: number | string | null;
  satisfaction?: number | string | null;
  note_google?: number | string | null;
  nb_avis_google?: number | string | null;
  lien_google?: string | null;
  chiffres?: string[];
  sections: Sections;
  updated_at?: string;
};

export type FormationSite = {
  code: string;
  intitule: string;
  organisme: string;
  categorie: "niveau" | "gaz" | "encadrement" | "secourisme" | "specialite";
  prix: number | null;
  nb_theorie: number;
  nb_pratique: number;
  prerequis: string | null;
  description: string | null;
  accroche?: string | null;
  objectifs?: string | null;
  age_min?: number | null;
  profondeur_max?: number | null;
  contenu?: string[];
  inclus?: string[];
  prerogatives?: string | null;
  documents?: string[];
  periode?: string | null;
  cursus?: string | null;
};
export type BateauSite = { nom: string; modele?: string | null; type?: string | null; places?: string | null; longueur?: string | null; moteur?: string | null; port?: string | null; oxygene?: string | null };
export type EquipementSite = { categorie: string; variante: string; nb: number };
export type EquipierSite = { nom: string; role: string; niveau: string | null };

export type ContenuSite = {
  site: ReglagesSite;
  centre: { nom: string; ville: string | null; verifie: boolean };
  formations: FormationSite[];
  bateaux: BateauSite[];
  equipement: EquipementSite[];
  equipe: EquipierSite[];
  zones_sorties?: Zone[];
};

// Les modèles de page : une mise en page, une typographie, des couleurs de départ
export const MODELES = [
  {
    id: "lagon",
    nom: "Lagon",
    texte: "Clair et lumineux",
    titres: "'Urbanist', system-ui, sans-serif",
    corps: "'Onest', system-ui, sans-serif",
    fond: "#F3F6F9",
    texteCouleur: "#0E2238",
  },
  {
    id: "abysse",
    nom: "Abysse",
    texte: "Sombre, ambiance grand bleu",
    titres: "'Unbounded', system-ui, sans-serif",
    corps: "'Onest', system-ui, sans-serif",
    fond: "#06182B",
    texteCouleur: "#E6F0F8",
  },
] as const;

export const POLICES_SITE =
  "https://fonts.googleapis.com/css2?family=Onest:wght@400;500;600&family=Unbounded:wght@400;500;600&family=Urbanist:wght@400;500;600;700&display=swap";

// Palettes de départ : accent, secondaire, troisième couleur
export const PALETTES = [
  { nom: "Méditerranée", accent: "#14B8C4", secondaire: "#0B3B63", tertiaire: "#FF8A75" },
  { nom: "Grand bleu", accent: "#2563EB", secondaire: "#0A1F44", tertiaire: "#38BDF8" },
  { nom: "Posidonie", accent: "#2F9E6E", secondaire: "#0F3D3A", tertiaire: "#E8B04A" },
  { nom: "Corail", accent: "#FF6F59", secondaire: "#132E4F", tertiaire: "#FFC65C" },
  { nom: "Lagon", accent: "#00B3A6", secondaire: "#073B4C", tertiaire: "#7BDFF2" },
];

// Un site enregistré avant l'ajout des tarifs : liste vide plutôt qu'absente
const normaliser = (c: ContenuSite | null): ContenuSite | null => (c ? { ...c, site: { ...c.site, tarifs: c.site.tarifs ?? [] } } : c);

// Les chiffres clés que le DP peut afficher sous le haut de page (4 au plus)
export const CHIFFRES_SITE: { cle: string; nom: string }[] = [
  { cle: "annees", nom: "Années d'existence" },
  { cle: "encadrants", nom: "Encadrants" },
  { cle: "satisfaction", nom: "Plongeurs satisfaits" },
  { cle: "google", nom: "Note Google" },
  { cle: "sites", nom: "Sites de plongée" },
  { cle: "formations", nom: "Formations" },
  { cle: "profondeur", nom: "Profondeur max" },
  { cle: "places", nom: "Places sur le bateau" },
];
export const CHIFFRES_DEFAUT = ["annees", "encadrants", "satisfaction", "sites"];

export const nombre = (v: number | string | null | undefined) => {
  const n = Number(String(v ?? "").replace(",", "."));
  return v === null || v === undefined || v === "" || !Number.isFinite(n) ? null : n;
};

export const modeleDe = (id: string) => MODELES.find((m) => m.id === id) ?? MODELES[0];

const rpcPublic = async (slug: string): Promise<ContenuSite | null> => {
  const r = await fetch(`${SUPABASE_URL}/rest/v1/rpc/site_club_public`, {
    method: "POST",
    headers: { apikey: SUPABASE_PUBLISHABLE_KEY, Authorization: `Bearer ${SUPABASE_PUBLISHABLE_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({ p_slug: slug }),
  });
  if (!r.ok) throw new Error(`site_club_public ${r.status}`);
  return normaliser((await r.json()) as ContenuSite | null);
};

// Côté public : sans compte (rendu serveur, pour Google), puis avec la session du DP (aperçu non publié)
export async function sitePublic(slug: string): Promise<ContenuSite | null> {
  try {
    const anonyme = await rpcPublic(slug);
    if (anonyme) return anonyme;
  } catch {
    /* réseau : on retente côté navigateur */
  }
  if (typeof window === "undefined") return null;
  const { data, error } = await supabase.rpc("site_club_public", { p_slug: slug });
  if (error) throw error;
  return normaliser((data as ContenuSite | null) ?? null);
}

export async function chargerMonSite(centre: string): Promise<ContenuSite> {
  const { data, error } = await supabase.rpc("mon_site_club", { p_centre: centre });
  if (error) throw error;
  return normaliser(data as ContenuSite)!;
}

export async function enregistrerSite(centre: string, reglages: Partial<ReglagesSite>): Promise<ContenuSite> {
  const { data, error } = await supabase.rpc("enregistrer_site_club", { p_centre: centre, p: reglages });
  if (error) throw error;
  return normaliser(data as ContenuSite)!;
}

// Logo ou photo de couverture : rangés dans le dossier du centre, lisibles par tous
export async function envoyerImageSite(centre: string, quoi: "logo" | "couverture", fichier: File): Promise<string> {
  const ext = fichier.type === "image/png" ? "png" : fichier.type === "image/webp" ? "webp" : "jpg";
  const chemin = `${centre}/${quoi}-${Date.now()}.${ext}`;
  const seau = supabase.storage.from("sites-clubs");
  const { error } = await seau.upload(chemin, fichier, { contentType: fichier.type, upsert: true });
  if (error) throw error;
  return seau.getPublicUrl(chemin).data.publicUrl;
}

export const lienSite = (slug: string) => `${typeof window === "undefined" ? "" : window.location.origin}/clubs/${slug}`;

export const prixEuros = (p: number | null) =>
  p === null || p === undefined ? null : `${Number(p).toLocaleString("fr-FR", { maximumFractionDigits: 0 })} €`;

export const LIBELLE_ROLE: Record<string, string> = { dp: "Directeur de plongée", guide: "Moniteur", pilote: "Pilote du bateau" };

export const LIBELLE_EQUIPEMENT: Record<string, string> = {
  bloc: "Blocs",
  detendeur: "Détendeurs",
  combinaison: "Combinaisons",
  gilet: "Gilets stabilisateurs",
  ordinateur: "Ordinateurs de plongée",
  recycleur: "Recycleurs",
  autre: "Autre matériel",
};
