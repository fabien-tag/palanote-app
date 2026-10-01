// Petit message transmis d'un écran à l'autre (ex. « Ta plongée a bien été enregistrée »).
// Gardé en mémoire le temps de la navigation ; l'écran d'accueil l'efface une fois affiché.
let enAttente: string | null = null;

export function annoncerSurAccueil(texte: string) {
  enAttente = texte;
}

export function lireMessageAccueil(): string | null {
  return enAttente;
}

export function effacerMessageAccueil() {
  enAttente = null;
}
