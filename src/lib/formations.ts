import { supabase } from "@/lib/supabase";

// Les formations du club (sql/palanote-formations.sql) : catalogue, élèves, séances, rappels.

async function rpc<T>(nom: string, args: Record<string, unknown> = {}): Promise<T> {
  const { data, error } = await supabase.rpc(nom, args);
  if (error) throw error;
  return data as T;
}

export type CategorieFormation = "niveau" | "gaz" | "encadrement" | "secourisme" | "specialite";
export const CATEGORIES_FORMATION: { id: CategorieFormation; libelle: string }[] = [
  { id: "niveau", libelle: "Niveaux" },
  { id: "gaz", libelle: "Nitrox et Trimix" },
  { id: "encadrement", libelle: "Encadrement" },
  { id: "secourisme", libelle: "Secourisme" },
  { id: "specialite", libelle: "Spécialités" },
];

export type FormationCatalogue = {
  id: string;
  code: string;
  intitule: string;
  organisme: string;
  categorie: CategorieFormation;
  prix: number | null;
  nb_theorie: number;
  nb_pratique: number;
  prerequis: string | null;
  description: string | null;
  actif: boolean;
  ordre: number;
  en_cours: number;
};

export type Seance = {
  id?: string;
  type: "theorie" | "pratique";
  jour: string;
  heure_debut: string;
  heure_fin: string | null;
  intitule: string | null;
  lieu?: string | null;
  faite?: boolean;
  moniteur?: string | null;
};

export type StatutFormation = "prevue" | "en_cours" | "validee" | "abandon";
export const STATUTS_FORMATION: { id: StatutFormation; libelle: string; classe: string }[] = [
  { id: "prevue", libelle: "Programmée", classe: "bg-[#E3F2FB] text-[#1176A8]" },
  { id: "en_cours", libelle: "En cours", classe: "bg-[#FFF1D6] text-[#8A5A10]" },
  { id: "validee", libelle: "Validée", classe: "bg-[#E2F8EF] text-[#14805F]" },
  { id: "abandon", libelle: "Abandon", classe: "bg-[#EEF2F6] text-[#7D93A8]" },
];

export type FormationEleve = {
  id: string;
  catalogue_id: string | null;
  code: string | null;
  intitule: string;
  adherent_id: string | null;
  eleve_id: string | null;
  eleve_nom: string;
  eleve_niveau: string | null;
  moniteur_id: string | null;
  moniteur: { id: string; nom: string; niveau: string | null } | null;
  date_debut: string;
  date_fin: string;
  prix: number | null;
  statut: StatutFormation;
  note: string | null;
  seances: Seance[];
  club?: string;
};

export type SeancePlanning = {
  id: string;
  formation_id: string;
  code: string;
  eleve: string;
  type: "theorie" | "pratique";
  jour: string;
  heure_debut: string;
  heure_fin: string | null;
  moniteur_id: string | null;
};

export const catalogueFormations = (centre: string) => rpc<FormationCatalogue[]>("catalogue_formations", { p_centre: centre }).then((l) => l ?? []);
export const enregistrerFormationCatalogue = (centre: string, f: Partial<FormationCatalogue>) =>
  rpc<string>("enregistrer_formation_catalogue", { p_centre: centre, p_formation: f });
export const retirerFormationCatalogue = (id: string) => rpc<null>("retirer_formation_catalogue", { p_id: id });
export const catalogueFormationsType = (centre: string) => rpc<number>("catalogue_formations_type", { p_centre: centre });
export const formationsCentre = (centre: string) => rpc<FormationEleve[]>("formations_centre", { p_centre: centre }).then((l) => l ?? []);
export const programmerFormation = (
  centre: string,
  f: { id?: string; catalogue_id: string; adherent_id: string; moniteur_id: string | null; prix?: string; note?: string },
  seances: Seance[],
) => rpc<FormationEleve>("programmer_formation", { p_centre: centre, p_formation: f, p_seances: seances });
export const modifierFormation = (id: string, statut: StatutFormation | null, moniteur: string | null = null) =>
  rpc<FormationEleve>("modifier_formation", { p_formation: id, p_statut: statut, p_moniteur: moniteur });
export const cocherSeance = (id: string, faite: boolean) => rpc<null>("cocher_seance", { p_seance: id, p_faite: faite });
export const supprimerFormation = (id: string) => rpc<null>("supprimer_formation", { p_formation: id });
export const seancesCentre = (centre: string, debut: string, fin: string) =>
  rpc<SeancePlanning[]>("seances_centre", { p_centre: centre, p_debut: debut, p_fin: fin }).then((l) => l ?? []);
export const mesFormations = () => rpc<FormationEleve[]>("mes_formations").then((l) => l ?? []);

const ajouterJour = (iso: string, n: number) => {
  const d = new Date(`${iso}T12:00:00`);
  d.setDate(d.getDate() + n);
  return d.toISOString().slice(0, 10);
};

// Programme proposé : chaque jour, pratique le matin, théorie entre midi et deux,
// pratique l'après-midi, jusqu'à épuiser les cours du cursus.
export function programmeType(nbTheorie: number, nbPratique: number, debut: string): Seance[] {
  const s: Seance[] = [];
  let th = nbTheorie;
  let pr = nbPratique;
  let j = 0;
  while ((th > 0 || pr > 0) && j < 60) {
    const jour = ajouterJour(debut, j);
    if (pr > 0) {
      s.push({ type: "pratique", jour, heure_debut: "09:00", heure_fin: "12:00", intitule: null });
      pr--;
    }
    if (th > 0) {
      s.push({ type: "theorie", jour, heure_debut: "12:30", heure_fin: "13:45", intitule: null });
      th--;
    }
    if (pr > 0) {
      s.push({ type: "pratique", jour, heure_debut: "14:30", heure_fin: "17:30", intitule: null });
      pr--;
    }
    j++;
  }
  return s;
}

export const prixTexte = (p: number | null) => (p === null || p === undefined ? "Sur devis" : `${Number(p).toLocaleString("fr-FR", { maximumFractionDigits: 2 })} €`);
export const jourLong = (iso: string) => {
  const t = new Date(`${iso}T12:00:00`).toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long" });
  return t.charAt(0).toUpperCase() + t.slice(1); // « Mardi 13 octobre »
};
export const jourCourt = (iso: string) => new Date(`${iso}T12:00:00`).toLocaleDateString("fr-FR", { day: "numeric", month: "short" });
