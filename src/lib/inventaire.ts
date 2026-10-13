import { supabase } from "@/lib/supabase";

// L'inventaire du matériel, pièce par pièce (sql/palanote-inventaire-materiel.sql)

export type CategorieArticle = "bateau" | "bloc" | "detendeur" | "combinaison" | "recycleur" | "gilet" | "ordinateur" | "autre";
export type EtatArticle = "ok" | "a_controler" | "en_reparation" | "hors_service";

export type Article = {
  id: string;
  centre_id: string;
  materiel_id: string | null;
  categorie: CategorieArticle;
  reference: string;
  libelle: string | null;
  marque: string | null;
  modele: string | null;
  taille: string | null;
  numero_serie: string | null;
  mise_en_service: string | null;
  dernier_controle: string | null;
  prochain_controle: string | null;
  derniere_requalif: string | null;
  prochaine_requalif: string | null;
  etat: EtatArticle;
  caracteristiques: Record<string, string>;
  note: string | null;
};

export const CATEGORIES: { id: CategorieArticle; libelle: string; controle: string; requalif?: string }[] = [
  { id: "bateau", libelle: "Bateaux", controle: "Visite annuelle" },
  { id: "bloc", libelle: "Blocs", controle: "Inspection visuelle (TIV)", requalif: "Requalification" },
  { id: "detendeur", libelle: "Détendeurs", controle: "Révision" },
  { id: "combinaison", libelle: "Combinaisons", controle: "Révision (étanches)" },
  { id: "recycleur", libelle: "Recycleurs", controle: "Révision" },
  { id: "gilet", libelle: "Gilets", controle: "Révision" },
  { id: "ordinateur", libelle: "Ordinateurs", controle: "Contrôle" },
  { id: "autre", libelle: "Autre", controle: "Contrôle" },
];

export const ETATS: { id: EtatArticle; libelle: string; classe: string }[] = [
  { id: "ok", libelle: "En service", classe: "bg-[#E2F8EF] text-[#14805F]" },
  { id: "a_controler", libelle: "À contrôler", classe: "bg-[#FFF1D6] text-[#8A5A10]" },
  { id: "en_reparation", libelle: "En réparation", classe: "bg-[#E3F2FB] text-[#1176A8]" },
  { id: "hors_service", libelle: "Hors service", classe: "bg-[#FFE9E2] text-[#D9573F]" },
];

// Libellés lisibles des caractéristiques
export const LIBELLES_CARAC: Record<string, string> = {
  type: "Type",
  immatriculation: "Immatriculation",
  places: "Capacité",
  longueur: "Longueur",
  largeur: "Largeur",
  moteur: "Moteur",
  heures_moteur: "Heures moteur",
  categorie_conception: "Catégorie de conception",
  port_attache: "Port d'attache",
  vhf_mmsi: "VHF (MMSI)",
  assurance: "Assurance",
  revision_moteur: "Révision moteur",
  materiel_securite: "Matériel de sécurité",
  oxygene: "Oxygène à bord",
  volume: "Volume",
  pression_service: "Pression de service",
  robinetterie: "Robinetterie",
  gaz: "Gaz",
  couleur: "Couleur",
  poids_vide: "Poids à vide",
  usage: "Usage",
  nettoyage_o2: "Nettoyage oxygène",
  raccord: "Raccord",
  eau_froide: "Eau froide",
  octopus: "Octopus",
  manometre: "Manomètre",
  flexible_direct_system: "Direct system",
  usage_nitrox: "Nitrox",
  epaisseur: "Épaisseur",
  cagoule: "Cagoule",
  genre: "Coupe",
  fermeture: "Fermeture",
  matiere: "Matière",
  manchons: "Manchons",
  bottillons: "Bottillons",
  soupapes: "Soupapes",
  test_etancheite: "Test d'étanchéité",
  cellules_o2: "Cellules O2",
  chaux: "Chaux",
  blocs: "Blocs",
  controleur: "Contrôleur",
  heures: "Heures de plongée",
  niveau_requis: "Niveau requis",
  lestage_integre: "Lestage intégré",
  inflateur: "Inflateur",
  purges: "Purges",
  nitrox: "Nitrox",
  pile: "Pile",
  algorithme: "Algorithme",
};

export async function chargerInventaire(centre: string): Promise<Article[]> {
  const { data, error } = await supabase
    .from("materiel_articles")
    .select("*")
    .eq("centre_id", centre)
    .is("deleted_at", null)
    .order("reference");
  if (error) throw error;
  return (data ?? []) as Article[];
}

export async function modifierArticle(id: string, champs: Partial<Pick<Article, "etat" | "dernier_controle" | "prochain_controle" | "note">>) {
  const { error } = await supabase.from("materiel_articles").update(champs).eq("id", id);
  if (error) throw error;
}

// Échéance la plus proche (contrôle ou requalification) et son état
export function echeance(a: Article): { date: string | null; etat: "depasse" | "bientot" | "ok" | "aucune" } {
  const dates = [a.prochain_controle, a.prochaine_requalif].filter((d): d is string => Boolean(d)).sort();
  const date = dates[0] ?? null;
  if (!date) return { date: null, etat: "aucune" };
  const j = Math.round((new Date(`${date}T12:00:00`).getTime() - new Date(`${new Date().toISOString().slice(0, 10)}T12:00:00`).getTime()) / 86400000);
  return { date, etat: j < 0 ? "depasse" : j <= 30 ? "bientot" : "ok" };
}

export const dateFr = (d: string | null) => (d ? new Date(`${d}T12:00:00`).toLocaleDateString("fr-FR", { day: "numeric", month: "short", year: "numeric" }) : "—");
