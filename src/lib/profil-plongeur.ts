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

export const AIDE_ROLE = "Bientôt, les encadrants, directeurs de plongée et centres auront un espace pour organiser les palanquées.";
