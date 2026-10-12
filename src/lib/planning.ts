import { supabase } from "@/lib/supabase";
import type { StatutSortie } from "@/lib/club";

// ============================================================
// Poste de pilotage du DP (version ordinateur) : planning, équipe, matériel.
// Toutes les écritures passent par les fonctions de la base
// (sql/palanote-planning-club.sql).
// ============================================================

async function rpc<T>(nom: string, args: Record<string, unknown> = {}): Promise<T> {
  const { data, error } = await supabase.rpc(nom, args);
  if (error) throw error;
  return data as T;
}

export type RoleEquipe = "dp" | "guide" | "pilote" | "gonfleur" | "autre";
export const ROLES_EQUIPE: { id: RoleEquipe; libelle: string; court: string }[] = [
  { id: "dp", libelle: "Directeur de plongée", court: "DP" },
  { id: "guide", libelle: "Guide de palanquée", court: "GP" },
  { id: "pilote", libelle: "Pilote du bateau", court: "Pilote" },
  { id: "gonfleur", libelle: "Gonfleur", court: "Gonfl." },
  { id: "autre", libelle: "Autre", court: "Autre" },
];
export const libelleRole = (r: string) => ROLES_EQUIPE.find((x) => x.id === r)?.libelle ?? r;
export const roleCourt = (r: string) => ROLES_EQUIPE.find((x) => x.id === r)?.court ?? r;

export type Equipier = {
  id: string;
  user_id: string | null;
  nom: string;
  role: RoleEquipe;
  niveau: string | null;
  telephone: string | null;
  actif: boolean;
};

export type TypeMateriel = "bateau" | "bloc" | "gilet" | "detendeur" | "combinaison" | "ordinateur" | "autre";
export const TYPES_MATERIEL: { id: TypeMateriel; libelle: string; pluriel: string }[] = [
  { id: "bateau", libelle: "Bateau", pluriel: "Bateaux" },
  { id: "bloc", libelle: "Bloc", pluriel: "Blocs" },
  { id: "gilet", libelle: "Gilet", pluriel: "Gilets" },
  { id: "detendeur", libelle: "Détendeur", pluriel: "Détendeurs" },
  { id: "combinaison", libelle: "Combinaison", pluriel: "Combinaisons" },
  { id: "ordinateur", libelle: "Ordinateur", pluriel: "Ordinateurs" },
  { id: "autre", libelle: "Autre", pluriel: "Autre matériel" },
];

export type Materiel = {
  id: string;
  type: TypeMateriel;
  libelle: string;
  quantite: number;
  places: number | null;
  prochain_controle: string | null;
  note: string | null;
};

export type SortiePlanning = {
  id: string;
  date: string;
  heure: string | null;
  site: string;
  lieu: string | null;
  statut: StatutSortie;
  dp_id: string;
  dp: string;
  mienne: boolean;
  bateau: string | null;
  bateau_id: string | null;
  places: number | null;
  profondeur_prevue: number | null;
  duree_min: number | null;
  nb_inscrits: number;
  nb_prevus: number;
  nb_completees: number;
  nb_palanquees: number;
  sans_guide: number;
  equipe: { id: string; nom: string; role: RoleEquipe; user_id: string | null }[];
  materiel: { materiel_id: string; quantite: number }[];
};

export type Planning = { sorties: SortiePlanning[]; equipe: Equipier[]; materiel: Materiel[] };

export const planningCentre = (centre: string, debut: string, fin: string) =>
  rpc<Planning>("planning_centre", { p_centre: centre, p_debut: debut, p_fin: fin });
export const deplacerSortie = (sortie: string, date: string, heure: string | null = null) =>
  rpc<null>("deplacer_sortie", { p_sortie: sortie, p_date: date, p_heure: heure });

export const equipeCentre = (centre: string) => rpc<Equipier[]>("equipe_centre", { p_centre: centre }).then((l) => l ?? []);
export const enregistrerEquipier = (centre: string, e: { id?: string | null; nom: string; role: RoleEquipe; niveau?: string; telephone?: string; actif?: boolean }) =>
  rpc<Equipier>("enregistrer_equipier", {
    p_centre: centre,
    p_id: e.id ?? null,
    p_nom: e.nom,
    p_role: e.role,
    p_niveau: e.niveau || null,
    p_telephone: e.telephone || null,
    p_actif: e.actif ?? true,
  });
export const affecterEquipier = (sortie: string, equipier: string, role: RoleEquipe | null) =>
  rpc<null>("affecter_equipier", { p_sortie: sortie, p_equipier: equipier, p_role: role ?? "" });

export const materielCentre = (centre: string) => rpc<Materiel[]>("materiel_centre", { p_centre: centre }).then((l) => l ?? []);
export const enregistrerMateriel = (
  centre: string,
  m: { id?: string | null; type: TypeMateriel; libelle: string; quantite: number; places?: number | null; controle?: string | null; note?: string | null },
) =>
  rpc<Materiel>("enregistrer_materiel", {
    p_centre: centre,
    p_id: m.id ?? null,
    p_type: m.type,
    p_libelle: m.libelle,
    p_quantite: m.quantite,
    p_places: m.places ?? null,
    p_controle: m.controle || null,
    p_note: m.note || null,
  });
export const retirerMateriel = (id: string) => rpc<null>("retirer_materiel", { p_id: id });
export const reserverMateriel = (sortie: string, materiel: string, quantite: number) =>
  rpc<null>("reserver_materiel", { p_sortie: sortie, p_materiel: materiel, p_quantite: quantite });
export const choisirBateau = (sortie: string, bateau: string | null) => rpc<null>("choisir_bateau", { p_sortie: sortie, p_bateau: bateau });

// ---------- Dates (calendrier) ----------
export function iso(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
export function depuisIso(s: string) {
  return new Date(`${s}T12:00:00`);
}
export function ajouterJours(s: string, n: number) {
  const d = depuisIso(s);
  d.setDate(d.getDate() + n);
  return iso(d);
}
// Le lundi de la semaine
export function lundi(s: string) {
  const d = depuisIso(s);
  const j = (d.getDay() + 6) % 7;
  d.setDate(d.getDate() - j);
  return iso(d);
}
export function aujourdhui() {
  return iso(new Date());
}

// ---------- Contrôles ----------
// Profondeur maximale d'un niveau (en palanquée encadrée), pour alerter le DP.
// Repères FFESSM et PADI ; le DP reste seul juge (aptitudes, encadrement, autonomie).
export function profondeurMaxNiveau(niveau: string | null | undefined): number | null {
  if (!niveau) return null;
  const n = niveau.toUpperCase().replace(/\s+/g, "");
  if (/^(E[1-5]|MF[12]|N4|N5|GP|INSTRUCTOR|DIVEMASTER)/.test(n)) return 60;
  if (/^(N3|PA60|PE60)/.test(n)) return 60;
  if (/^(N2|PE40|PA40)/.test(n)) return 40;
  if (/^(PA20)/.test(n)) return 20;
  if (/ADVANCED|AOWD|AOW/.test(n)) return 30;
  if (/^(N1|PE20)/.test(n)) return 20;
  if (/OPENWATER|OWD|^OW$/.test(n)) return 18;
  if (/^(PE12|BAPT|DEBUTANT|DÉBUTANT)/.test(n)) return 12;
  return null;
}

// Deux sorties trop proches pour la même personne (moins de 3 h d'écart le même jour)
export function enConflit(a: { date: string; heure: string | null }, b: { date: string; heure: string | null }) {
  if (a.date !== b.date) return false;
  if (!a.heure || !b.heure) return true;
  const m = (h: string) => Number(h.slice(0, 2)) * 60 + Number(h.slice(3, 5));
  return Math.abs(m(a.heure) - m(b.heure)) < 180;
}

// Quantité réservée ce jour-là, toutes sorties confondues (hors annulées)
export function reserveLeJour(sorties: SortiePlanning[], date: string, materiel: string, sauf?: string) {
  return sorties
    .filter((s) => s.date === date && s.statut !== "annulee" && s.id !== sauf)
    .reduce((t, s) => t + (s.materiel.find((m) => m.materiel_id === materiel)?.quantite ?? 0), 0);
}

// Les alertes d'une sortie prévue, affichées sur sa carte dans le calendrier
export function alertesSortie(s: SortiePlanning, tout: SortiePlanning[], materiel: Materiel[]) {
  if (s.statut !== "prevue") return [] as string[];
  const a: string[] = [];
  const monde = s.nb_inscrits + s.nb_prevus;
  if (s.bateau_id && !s.equipe.some((e) => e.role === "pilote")) a.push("Pas de pilote");
  if (s.places && monde > s.places) a.push(`Bateau plein (${monde}/${s.places})`);
  if (s.sans_guide > 0) a.push(`${s.sans_guide} palanquée${s.sans_guide > 1 ? "s" : ""} sans guide`);
  for (const m of materiel) {
    if (m.type === "bateau") continue;
    const r = reserveLeJour(tout, s.date, m.id);
    if (r > m.quantite && s.materiel.some((x) => x.materiel_id === m.id)) a.push(`${m.libelle} : ${r}/${m.quantite}`);
  }
  return a;
}

export function controleProche(date: string | null) {
  if (!date) return null;
  const j = Math.round((depuisIso(date).getTime() - depuisIso(aujourdhui()).getTime()) / 86400000);
  return j < 0 ? "depasse" : j <= 30 ? "proche" : null;
}

// ---------- Espace club : carte, membres, paramètres (sql/palanote-espace-club.sql) ----------
export type SortieCarte = {
  id: string;
  date: string;
  site: string;
  lieu: string | null;
  coords: string;
  statut: StatutSortie;
  profondeur: number | null;
  duree: number | null;
  dp: string;
  nb: number;
};
export const carteCentre = (centre: string) => rpc<SortieCarte[]>("carte_centre", { p_centre: centre }).then((l) => l ?? []);

export type MembreClub = {
  id: string;
  prenom: string;
  niveau: string | null;
  club: string | null;
  sorties: number;
  premiere: string | null;
  derniere: string | null;
  fiches: number;
  tampons: number;
  prochaine: string | null;
};
export const membresCentre = (centre: string) => rpc<MembreClub[]>("membres_centre", { p_centre: centre }).then((l) => l ?? []);

export type ParametresCentre = {
  id: string;
  nom: string;
  ville: string | null;
  verifie: boolean;
  cree_le: string;
  nb_sorties: number;
  dp: { id: string; prenom: string; niveau: string | null; depuis: string; moi: boolean }[];
};
export const parametresCentre = (centre: string) => rpc<ParametresCentre>("parametres_centre", { p_centre: centre });
export const modifierCentre = (centre: string, nom: string, ville: string) =>
  rpc<null>("modifier_centre", { p_centre: centre, p_nom: nom, p_ville: ville });

// ---------- Import Excel du club (sql/palanote-import-excel.sql) ----------
type Lignes = Record<string, string | number | null>[];
export const importerAdherents = (centre: string, lignes: Lignes) =>
  rpc<{ ajoutes: number; mis_a_jour: number; ignorees: number }>("importer_adherents", { p_centre: centre, p_lignes: lignes });
export const importerHistorique = (centre: string, lignes: Lignes) =>
  rpc<{ plongees: number; nouveaux_adherents: number; doublons: number; ignorees: number }>("importer_historique", { p_centre: centre, p_lignes: lignes });
export const importerEquipe = (centre: string, lignes: Lignes) => rpc<{ ajoutes: number; mis_a_jour: number }>("importer_equipe", { p_centre: centre, p_lignes: lignes });
export const importerMateriel = (centre: string, lignes: Lignes) => rpc<{ ajoutes: number; mis_a_jour: number }>("importer_materiel", { p_centre: centre, p_lignes: lignes });

export type Adherent = {
  id: string;
  prenom: string;
  nom: string | null;
  email: string | null;
  telephone: string | null;
  niveau: string | null;
  licence: string | null;
  certificat_fin: string | null;
  adhesion: string | null;
  note: string | null;
  sur_palanote: boolean;
  plongees: number;
  derniere: string | null;
  prof_max: number | null;
  recuperees: number;
  sorties: number;
};
export const adherentsCentre = (centre: string) => rpc<Adherent[]>("adherents_centre", { p_centre: centre }).then((l) => l ?? []);
export const supprimerAdherent = (id: string) => rpc<null>("supprimer_adherent", { p_id: id });

// Côté plongeur : ses plongées gardées par un club, à ajouter à son carnet
export type HistoriqueClub = {
  centre_id: string;
  centre: string;
  ville: string | null;
  plongees: { id: string; date: string; heure: string | null; site: string | null; lieu: string | null; profondeur: number | null; duree: number | null; palanquee: string | null; role: string | null; note: string | null }[];
};
export const monHistoriqueClub = () => rpc<HistoriqueClub[]>("mon_historique_club").then((l) => l ?? []);
export const marquerHistoriqueClub = (centre: string) => rpc<number>("marquer_historique_club", { p_centre: centre });

// Certificat médical : expiré, ou qui expire dans le mois
export const certificatProche = controleProche;
