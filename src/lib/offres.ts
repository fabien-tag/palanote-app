import { supabase } from "@/lib/supabase";

// Les offres du site du club et son nom de domaine (sql/palanote-offres-domaine.sql,
// fonction serveur supabase/functions/abonnement-club).

export type CleOffre = "starter" | "premium" | "advanced";
export type Hebergeur = "ovh" | "hostinger" | "ionos" | "autre";

export type OffreClub = {
  offre: CleOffre;
  abonnement_statut: "aucun" | "actif" | "impaye" | "annule";
  abonnement_fin: string | null;
  avec_stripe: boolean;
  slug: string;
  domaine: string | null;
  domaine_hebergeur: Hebergeur | null;
  domaine_statut: "aucun" | "en_attente" | "branche";
  domaine_jeton: string | null;
  domaine_verifie_le: string | null;
};

// Les prix affichés : les mêmes que dans la fonction serveur (en euros par mois)
export const OFFRES: { cle: CleOffre; nom: string; prix: number; accroche: string; inclus: string[]; bientot: string[] }[] = [
  {
    cle: "starter",
    nom: "Starter",
    prix: 0,
    accroche: "Compris avec Palanote",
    inclus: [
      "Le site vitrine du club, à l'adresse palanote/clubs/votre-club",
      "Tarifs, formations, sites, matériel et équipe repris du back-office",
      "Modèles de page, couleurs du club, logo et photo",
      "Chiffres clés et note Google",
    ],
    bientot: [],
  },
  {
    cle: "premium",
    nom: "Premium",
    prix: 69,
    accroche: "Votre site à votre nom",
    inclus: ["Tout le Starter", "Votre propre nom de domaine (club-le-lion.fr)", "Pas-à-pas pour OVH, Hostinger et IONOS, vérification automatique"],
    bientot: ["Les prochaines sorties en direct sur le site", "Formulaire de demande d'inscription"],
  },
  {
    cle: "advanced",
    nom: "Advanced",
    prix: 129,
    accroche: "Votre site qui réserve",
    inclus: ["Tout le Premium"],
    bientot: ["Réservation et paiement en ligne des plongées", "Inscription à la liste d'attente depuis le site", "Statistiques de visite", "Site en anglais"],
  },
];

// L'hôte de Palanote vers lequel pointe le domaine du club (à confirmer avec l'hébergement multi-domaines)
export const CIBLE_DNS = "sites.palanote.fr";

export const HEBERGEURS: { cle: Hebergeur; nom: string; acheter: string | null; etapes: string[] }[] = [
  {
    cle: "ovh",
    nom: "OVH",
    acheter: "https://www.ovhcloud.com/fr/domains/",
    etapes: [
      "Connecte-toi à l'espace client OVHcloud, rubrique « Web Cloud ».",
      "Ouvre « Noms de domaine », puis ton domaine, onglet « Zone DNS ».",
      "« Ajouter une entrée » : choisis TXT, sous-domaine _palanote, colle la valeur.",
      "Ajoute une 2e entrée : CNAME, sous-domaine www, cible indiquée ci-dessus (avec le point final).",
    ],
  },
  {
    cle: "hostinger",
    nom: "Hostinger",
    acheter: "https://www.hostinger.fr/nom-de-domaine",
    etapes: [
      "Connecte-toi à hPanel, menu « Domaines ».",
      "Choisis ton domaine, puis « DNS / Serveurs de noms ».",
      "Dans « Gérer les enregistrements DNS », ajoute un TXT : nom _palanote, valeur à coller.",
      "Ajoute un CNAME : nom www, pointe vers la cible indiquée ci-dessus.",
    ],
  },
  {
    cle: "ionos",
    nom: "IONOS",
    acheter: "https://www.ionos.fr/domaine/noms-de-domaine",
    etapes: [
      "Connecte-toi à ton compte IONOS, menu « Domaines & SSL ».",
      "Clique sur l'engrenage de ton domaine, puis « DNS ».",
      "« Ajouter un enregistrement » : TXT, nom d'hôte _palanote, valeur à coller.",
      "Ajoute un CNAME : nom d'hôte www, pointe vers la cible indiquée ci-dessus.",
    ],
  },
  {
    cle: "autre",
    nom: "Autre",
    acheter: null,
    etapes: [
      "Ouvre la gestion DNS de ton nom de domaine chez ton hébergeur.",
      "Ajoute un enregistrement TXT : nom _palanote, valeur à coller.",
      "Ajoute un enregistrement CNAME : nom www, cible indiquée ci-dessus.",
    ],
  },
];

export async function chargerOffre(centre: string): Promise<OffreClub | null> {
  const { data, error } = await supabase.rpc("offre_site_club", { p_centre: centre });
  if (error) throw error;
  return (data as OffreClub | null) ?? null;
}

export async function definirDomaine(centre: string, domaine: string, hebergeur: Hebergeur): Promise<OffreClub> {
  const { data, error } = await supabase.rpc("definir_domaine_club", { p_centre: centre, p_domaine: domaine, p_hebergeur: hebergeur });
  if (error) throw error;
  return data as OffreClub;
}

export async function retirerDomaine(centre: string): Promise<OffreClub> {
  const { data, error } = await supabase.rpc("retirer_domaine_club", { p_centre: centre });
  if (error) throw error;
  return data as OffreClub;
}

// Interroge le DNS public (DNS over HTTPS) : le TXT de vérification et le CNAME du www
async function dns(nom: string, type: "TXT" | "CNAME"): Promise<string[]> {
  for (const base of ["https://cloudflare-dns.com/dns-query", "https://dns.google/resolve"]) {
    try {
      const r = await fetch(`${base}?name=${encodeURIComponent(nom)}&type=${type}`, { headers: { accept: "application/dns-json" } });
      if (!r.ok) continue;
      const d = (await r.json()) as { Answer?: { data: string }[] };
      return (d.Answer ?? []).map((a) => a.data.replace(/^"|"$/g, "").replace(/\.$/, "").toLowerCase());
    } catch {
      /* on essaie le résolveur suivant */
    }
  }
  return [];
}

export async function verifierDomaine(centre: string, o: OffreClub): Promise<{ txt: boolean; cname: boolean; offre: OffreClub }> {
  if (!o.domaine || !o.domaine_jeton) return { txt: false, cname: false, offre: o };
  const [txt, cname] = await Promise.all([dns(`_palanote.${o.domaine}`, "TXT"), dns(`www.${o.domaine}`, "CNAME")]);
  const ok = { txt: txt.includes(o.domaine_jeton.toLowerCase()), cname: cname.includes(CIBLE_DNS) };
  const { data, error } = await supabase.rpc("noter_verification_domaine", { p_centre: centre, p_ok: ok.txt && ok.cname });
  if (error) throw error;
  return { ...ok, offre: data as OffreClub };
}

// Paiement de l'abonnement (Stripe), par la fonction serveur
async function abonnement<T>(corps: Record<string, string>): Promise<T> {
  const { data, error } = await supabase.functions.invoke("abonnement-club", { body: corps });
  if (error) {
    // Le message de la fonction (ex. « secret STRIPE_SECRET_KEY manquant ») plutôt que l'erreur HTTP
    const ctx = (error as { context?: Response }).context;
    const detail = ctx && typeof ctx.json === "function" ? ((await ctx.json().catch(() => null)) as { erreur?: string } | null)?.erreur : null;
    throw new Error(detail ?? error.message);
  }
  return data as T;
}

export const ouvrirPaiement = (centre: string, offre: CleOffre, retour: string) => abonnement<{ url: string }>({ action: "checkout", centre, offre, retour });
export const confirmerPaiement = (centre: string, sessionId: string) => abonnement<{ offre: CleOffre }>({ action: "confirmer", centre, session_id: sessionId });
export const ouvrirPortail = (centre: string, retour: string) => abonnement<{ url: string }>({ action: "portail", centre, retour });
