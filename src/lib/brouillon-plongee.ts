import type { PhotoPlongee } from "@/lib/photos-plongee";

// Brouillon passé de la saisie express à la fiche complète (« Ajouter les détails »).
// Gardé en mémoire seulement : les photos choisies sont des fichiers, impossibles à mettre dans le stockage du navigateur.

export type BrouillonPlongee = {
  siteNom: string;
  siteLieu: string;
  siteCoords: string;
  date: string; // AAAA-MM-JJ
  immersion: string; // HH:MM
  profMax: string;
  duree: string; // « 42 min »
  note: number;
  binomes: string[]; // noms écrits à la main
  identifies: string[]; // binômes Palanote (ids)
  photos: PhotoPlongee[];
};

let brouillon: BrouillonPlongee | null = null;

export function garderBrouillon(b: BrouillonPlongee) {
  brouillon = b;
}

export function reprendreBrouillon(): BrouillonPlongee | null {
  const b = brouillon;
  brouillon = null;
  return b;
}
