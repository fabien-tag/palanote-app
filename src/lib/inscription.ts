// Données de l'étape 1, gardées en mémoire uniquement (jamais stockées dans le navigateur).
type Etape1 = { firstName: string; email: string; password: string };

let brouillon: Etape1 | null = null;

export function setEtape1(d: Etape1) {
  brouillon = d;
}
export function getEtape1() {
  return brouillon;
}
export function clearEtape1() {
  brouillon = null;
}
