// ============================================================
// Le Récif : les dons qui font tenir l'app (paiement unique).
// Les liens de paiement viennent de Stripe (Payment Links) ou d'un service équivalent.
// Tant qu'un lien est vide, le bouton l'indique au lieu d'ouvrir une page de paiement.
// ============================================================

export type FormuleRecif = { id: "cafe" | "coup-de-main" | "a-vie"; titre: string; texte: string; montant: number; lien: string };

export const FORMULES_RECIF: FormuleRecif[] = [
  { id: "cafe", titre: "Un café", texte: "une fois, sans suite", montant: 5, lien: "" },
  { id: "coup-de-main", titre: "Un coup de main", texte: "une fois, le corail est acquis", montant: 15, lien: "" },
  { id: "a-vie", titre: "À vie", texte: "une fois, et la question est réglée", montant: 49, lien: "" },
];

export const COUTS_RECIF: [string, string][] = [
  ["Le serveur et la base", "25 € / mois"],
  ["L'hébergement du site", "20 € / mois"],
  ["Le nom de domaine", "15 € / an"],
  ["Le compte développeur Apple", "99 € / an"],
];

// Lien de paiement complété avec l'e-mail et l'identifiant du plongeur,
// pour pouvoir rattacher le don à son compte (champs reconnus par Stripe).
export function lienPaiement(f: FormuleRecif, compte: { id: string; email: string } | null) {
  if (!f.lien) return null;
  const url = new URL(f.lien);
  if (compte) {
    url.searchParams.set("client_reference_id", compte.id);
    if (compte.email) url.searchParams.set("prefilled_email", compte.email);
  }
  return url.toString();
}
