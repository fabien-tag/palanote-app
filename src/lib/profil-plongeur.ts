// Choix communs à l'inscription (étape 2) et à Moi › Mon profil.

export const NIVEAUX = ["N1 / Open Water", "N2 / Advanced", "N3 / Rescue", "N4 / Divemaster", "Encadrant"];

// Rôle en plongée : sert plus tard à ouvrir un espace « organiser les palanquées »
// aux encadrants, directeurs de plongée et centres.
export const ROLES = [
  { valeur: "plongeur", label: "Je plonge" },
  { valeur: "encadrant", label: "J'encadre" },
  { valeur: "directeur", label: "Directeur de plongée" },
  { valeur: "centre", label: "Club ou centre" },
] as const;

export type RolePlongee = (typeof ROLES)[number]["valeur"];

export function libelleRole(role: string | null | undefined): string {
  return ROLES.find((r) => r.valeur === role)?.label ?? "";
}

export const AIDE_ROLE = "Directeur de plongée ou centre : prépare tes sorties, compose les palanquées et tamponne les carnets dans Moi › Espace club.";

// Heures sous l'eau avant Palanote : estimées à partir du nombre de plongées.
// Une plongée dure en général de 40 min à 1 h ; 50 min par défaut.
export const DUREES_MOYENNES = [40, 50, 60] as const;
export const DUREE_MOYENNE_DEFAUT = 50;

export function heuresEstimees(nbPlongees: number, dureeMoyenne: number = DUREE_MOYENNE_DEFAUT): number {
  if (!Number.isFinite(nbPlongees) || nbPlongees <= 0) return 0;
  return Math.round((nbPlongees * dureeMoyenne) / 60);
}

// Minutes passées sous l'eau avant Palanote : les heures renseignées,
// sinon une estimation à partir des plongées déjà faites.
export function minutesAvant(numeroDepart: number, heuresAvant: number | null | undefined): number {
  if (typeof heuresAvant === "number" && Number.isFinite(heuresAvant) && heuresAvant >= 0) return Math.round(heuresAvant * 60);
  return numeroDepart > 0 ? numeroDepart * DUREE_MOYENNE_DEFAUT : 0;
}

export function dureeEnTexte(minutes: number): string {
  return minutes === 0 ? "—" : minutes < 60 ? `${minutes} min` : `${Math.round(minutes / 60)} h`;
}
