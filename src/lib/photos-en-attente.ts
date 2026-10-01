// Photos choisies sur l'écran Numériser, transmises à l'écran « Choisir des pages ».
let enAttente: File[] = [];

export function deposerPhotosEnAttente(fichiers: File[]) {
  enAttente = fichiers;
}

export function prendrePhotosEnAttente(): File[] {
  const f = enAttente;
  enAttente = [];
  return f;
}
