// Plongées enregistrées pendant la visite (mode maquette, avant l'envoi réel vers Supabase).
// Les photos sont des aperçus locaux : elles ne survivent pas à un rechargement.
export type CartePlongee = {
  id: string;
  date: string;
  siteNom: string;
  siteLieu: string;
  profMax: string;
  duree: string;
  tempFond: string;
  melange: string;
  note: number;
  binomes: string[];
  photo?: string | undefined;
};

const CLE = "palanote-plongees";
let memoire: CartePlongee[] | null = null;

export function lirePlongees(): CartePlongee[] {
  if (memoire !== null) return memoire;
  if (typeof window === "undefined") return [];
  try {
    memoire = (JSON.parse(localStorage.getItem(CLE) || "[]") as CartePlongee[]).map((p) => ({
      ...p,
      photo: undefined,
    }));
  } catch {
    memoire = [];
  }
  return memoire ?? [];
}

export function enregistrerPlongee(p: CartePlongee) {
  const liste = lirePlongees().filter((x) => x.id !== p.id);
  liste.push(p);
  liste.sort((a, b) => (b.date || "").localeCompare(a.date || ""));
  memoire = liste;
  try {
    localStorage.setItem(CLE, JSON.stringify(liste.map(({ photo: _p, ...r }) => r)));
  } catch {
    /* stockage indisponible */
  }
}
