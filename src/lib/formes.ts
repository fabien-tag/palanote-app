// Formes « organiques » (test accueil) : coins asymétriques, comme des galets.
// Chaque forme = 4 rayons horizontaux / 4 rayons verticaux (CSS border-radius).

export const GALETS = [
  "34px 18px 30px 16px / 26px 22px 34px 18px",
  "18px 36px 20px 30px / 24px 30px 18px 34px",
  "28px 22px 38px 18px / 20px 32px 26px 30px",
] as const;

// Même forme, réduite de quelques pixels (photo à l'intérieur d'une carte à marge).
export const GALETS_INTERIEURS = [
  "28px 13px 25px 11px / 21px 17px 29px 13px",
  "13px 30px 15px 25px / 19px 25px 13px 29px",
  "23px 17px 32px 13px / 15px 27px 21px 25px",
] as const;

// Pour les petites pastilles d'icône : une goutte plutôt qu'un carré.
export const GOUTTE = "58% 42% 52% 48% / 46% 56% 44% 54%";

// Choix stable d'une forme à partir d'un identifiant (une plongée garde toujours la même).
export function indiceForme(id: string, n: number = GALETS.length) {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) | 0;
  return Math.abs(h) % n;
}
