import { supabase } from "@/lib/supabase";

// ============================================================
// Tableau de bord : finances (charges, dons du Récif, coût de l'IA) et lettre annuelle.
// ============================================================

export type Charge = {
  id: string;
  libelle: string;
  categorie: string | null;
  montant: number;
  periodicite: "mois" | "an" | "unique";
  depuis: string;
  jusqu_a: string | null;
};
export type Don = {
  id: string;
  user_id: string | null;
  email: string | null;
  prenom: string | null;
  montant: number;
  formule: string | null;
  source: "manuel" | "stripe";
  recu_le: string;
  note: string | null;
};
export type Lettre = {
  id: string;
  sujet: string;
  annee: number | null;
  test: boolean;
  nb_destinataires: number;
  nb_envoyes: number;
  erreur: string | null;
  created_at: string;
};

export type DonneesFinances = {
  charges: Charge[];
  dons: Don[];
  pagesParMois: { mois: string; pages: number }[];
  coutPageIa: number;
  // Forfaits vendus (pack, Palanote+) : date et montant. Vide si le script forfaits n'est pas lancé.
  forfaits: { date: string; montant: number }[];
};

export async function chargerFinances(): Promise<DonneesFinances> {
  const [charges, dons, pages, reglages, forfaits] = await Promise.all([
    supabase.from("admin_charges").select("*").order("created_at", { ascending: true }),
    supabase.from("recif_dons").select("*").order("recu_le", { ascending: false }),
    supabase.rpc("admin_pages_par_mois"),
    supabase.from("admin_reglages").select("cout_page_ia").maybeSingle(),
    supabase.rpc("admin_forfaits"),
  ]);
  if (charges.error) throw charges.error;
  return {
    charges: ((charges.data ?? []) as Charge[]).map((c) => ({ ...c, montant: Number(c.montant) })),
    dons: ((dons.data ?? []) as Don[]).map((d) => ({ ...d, montant: Number(d.montant) })),
    pagesParMois: ((pages.data ?? []) as { mois: string; pages: number }[]).map((p) => ({ mois: p.mois, pages: Number(p.pages) })),
    coutPageIa: Number((reglages.data as { cout_page_ia?: number } | null)?.cout_page_ia ?? 0.02),
    forfaits: forfaits.error
      ? []
      : ((forfaits.data ?? []) as { debut: string; montant: number | null }[])
          .filter((x) => Number(x.montant) > 0)
          .map((x) => ({ date: x.debut, montant: Number(x.montant) })),
  };
}

// ---------- Calculs ----------

export const moisCle = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;

export function douzeDerniersMois(): string[] {
  const maintenant = new Date();
  return Array.from({ length: 12 }, (_, i) => moisCle(new Date(maintenant.getFullYear(), maintenant.getMonth() - 11 + i, 1)));
}

// Part d'une charge pour un mois donné (une charge annuelle compte pour 1/12 par mois).
export function chargePourMois(c: Charge, mois: string): number {
  const debut = c.depuis.slice(0, 7);
  const fin = c.jusqu_a ? c.jusqu_a.slice(0, 7) : null;
  if (mois < debut || (fin && mois > fin)) return 0;
  if (c.periodicite === "mois") return c.montant;
  if (c.periodicite === "an") return c.montant / 12;
  return mois === debut ? c.montant : 0;
}

// recettes = dons du Récif + forfaits vendus
export type BilanMois = {
  mois: string;
  charges: number;
  ia: number;
  depenses: number;
  dons: number;
  forfaits: number;
  recettes: number;
  solde: number;
  pages: number;
};

export function bilanParMois(f: DonneesFinances): BilanMois[] {
  return douzeDerniersMois().map((mois) => {
    const charges = f.charges.reduce((t, c) => t + chargePourMois(c, mois), 0);
    const pages = f.pagesParMois.find((p) => p.mois === mois)?.pages ?? 0;
    const ia = pages * f.coutPageIa;
    const dons = f.dons.filter((d) => d.recu_le.slice(0, 7) === mois).reduce((t, d) => t + d.montant, 0);
    const forfaits = f.forfaits.filter((x) => x.date.slice(0, 7) === mois).reduce((t, x) => t + x.montant, 0);
    const recettes = dons + forfaits;
    return { mois, charges, ia, depenses: charges + ia, dons, forfaits, recettes, solde: recettes - charges - ia, pages };
  });
}

// Un membre du Récif = un donateur (compte, sinon e-mail, sinon prénom).
export function membresRecif(dons: Don[]) {
  return new Set(dons.map((d) => d.user_id ?? d.email?.toLowerCase() ?? `${d.prenom ?? ""}#${d.id}`)).size;
}

export const euros = (n: number, decimales = 0) =>
  n.toLocaleString("fr-FR", { style: "currency", currency: "EUR", minimumFractionDigits: decimales, maximumFractionDigits: decimales });

// ---------- Modifications ----------

export async function enregistrerCharge(c: Omit<Charge, "id"> & { id?: string }) {
  const { error } = c.id ? await supabase.from("admin_charges").update(c).eq("id", c.id) : await supabase.from("admin_charges").insert(c);
  if (error) throw error;
}
export async function supprimerCharge(id: string) {
  const { error } = await supabase.from("admin_charges").delete().eq("id", id);
  if (error) throw error;
}
export async function ajouterDon(d: { prenom: string; email: string; montant: number; formule: string; recu_le: string; note: string }) {
  const { error } = await supabase.from("recif_dons").insert({
    prenom: d.prenom || null,
    email: d.email || null,
    montant: d.montant,
    formule: d.formule || null,
    recu_le: d.recu_le ? new Date(d.recu_le).toISOString() : new Date().toISOString(),
    note: d.note || null,
    source: "manuel",
  });
  if (error) throw error;
}
export async function supprimerDon(id: string) {
  const { error } = await supabase.from("recif_dons").delete().eq("id", id);
  if (error) throw error;
}
export async function changerCoutPageIa(v: number) {
  const { error } = await supabase.from("admin_reglages").update({ cout_page_ia: v, updated_at: new Date().toISOString() }).eq("id", true);
  if (error) throw error;
}

// ---------- Lettre annuelle ----------

export async function chargerLettres(): Promise<{ destinataires: number; lettres: Lettre[] }> {
  const [n, l] = await Promise.all([
    supabase.rpc("admin_nb_destinataires"),
    supabase.from("lettres").select("id, sujet, annee, test, nb_destinataires, nb_envoyes, erreur, created_at").order("created_at", { ascending: false }).limit(20),
  ]);
  if (n.error) throw n.error;
  return { destinataires: Number(n.data ?? 0), lettres: (l.data ?? []) as Lettre[] };
}

export async function envoyerLettre(o: { sujet: string; contenu: string; annee: number; test: boolean }) {
  const { data, error } = await supabase.functions.invoke("envoyer-lettre", { body: o });
  if (error) {
    // Le détail renvoyé par la fonction est plus parlant que l'erreur générique.
    const ctx = (error as { context?: Response }).context;
    let detail = error.message;
    try {
      const corps = ctx ? await ctx.json() : null;
      if (corps?.erreur) detail = corps.erreur;
    } catch {
      /* pas de corps lisible */
    }
    throw new Error(detail);
  }
  return data as { ok: boolean; envoyes: number; destinataires: number; erreurs: string[] };
}

export const CONTENU_LETTRE_DEFAUT = `Et si tu offrais un café à Palanote ?

Palanote est gratuite et le restera. Elle est faite par un plongeur, sur son temps libre, et son hébergement coûte quelques dizaines d'euros par mois.

Si elle t'a fait gagner une soirée cette année, {prenom}, tu peux rejoindre le Récif. Et si tu préfères ne rien faire, l'app ne changera pas d'un pixel.

Merci de plonger avec nous,
Fabien`;
