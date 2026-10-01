// Petit message transmis d'un écran à l'autre (ex. « Ta plongée a bien été enregistrée »).
// Gardé en mémoire et dans la session du navigateur (survit à un rechargement de page) ;
// l'écran d'accueil l'efface une fois affiché.
const CLE = "palanote-message-accueil";
let enAttente: string | null = null;

export function annoncerSurAccueil(texte: string) {
  enAttente = texte;
  try {
    sessionStorage.setItem(CLE, texte);
  } catch {
    /* stockage indisponible */
  }
}

export function lireMessageAccueil(): string | null {
  if (enAttente) return enAttente;
  try {
    return sessionStorage.getItem(CLE);
  } catch {
    return null;
  }
}

export function effacerMessageAccueil() {
  enAttente = null;
  try {
    sessionStorage.removeItem(CLE);
  } catch {
    /* stockage indisponible */
  }
}
