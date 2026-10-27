import { supabase } from "@/lib/supabase";

// ============================================================
// Informations légales : éditeur, hébergeurs, prestataires,
// et acceptation des conditions (table consents).
// ============================================================

// Changer cette date oblige chaque plongeur à accepter à nouveau les conditions.
export const VERSION_CONDITIONS = "2026-10-27-pages-offertes";
export const DATE_CONDITIONS = "27 octobre 2026";

// Pages de carnet papier lues gratuitement par l'IA (le serveur fait foi : admin_reglages.pages_offertes)
export const PAGES_OFFERTES = 20;

export const EDITEUR = {
  nom: "Fabien Tagliareni",
  enseigne: "Fabientag",
  statut: "Entrepreneur individuel (micro-entreprise)",
  siren: "529 606 972",
  adresse: "47 rue Vivienne, 75002 Paris, France",
  // À COMPLÉTER À LA MISE EN LIGNE (voir docs/mise-en-ligne.md)
  email: null as string | null,
};

export const HEBERGEURS = [
  { nom: "Vercel Inc.", role: "hébergement de l'application", lieu: "440 N Barranca Ave #4133, Covina, CA 91723, États-Unis", site: "vercel.com" },
  { nom: "Lovable Labs Incorporated", role: "hébergement de l'application (version de développement)", lieu: "Stockholm, Suède", site: "lovable.dev" },
  { nom: "Supabase Pte. Ltd.", role: "base de données, comptes et photos", lieu: "serveurs en Irlande (Union européenne)", site: "supabase.com" },
];

// Ceux qui traitent des données pour le compte de Palanote
export const PRESTATAIRES = [
  { nom: "Supabase", role: "stockage du carnet, des comptes et des photos", lieu: "Irlande (UE)" },
  { nom: "Vercel", role: "hébergement de l'application et mesure d'audience anonyme, sans cookie (pages vues, type d'appareil, pays)", lieu: "États-Unis" },
  { nom: "Lovable", role: "hébergement de la version de développement", lieu: "Suède" },
  { nom: "Anthropic (Claude)", role: "lecture des carnets papier et des photos, uniquement à ta demande", lieu: "États-Unis" },
  { nom: "Resend", role: "envoi des e-mails (lettre annuelle)", lieu: "États-Unis" },
  { nom: "Google", role: "connexion avec Google, si tu la choisis", lieu: "États-Unis" },
  { nom: "OpenStreetMap et Esri", role: "fonds de carte et recherche de lieux", lieu: "Royaume-Uni, États-Unis" },
];

// Rappel affiché dans le tableau de bord tant que tout n'est pas fait
export const AVANT_MISE_EN_LIGNE: { tache: string; fait: boolean }[] = [
  { tache: "Ajouter l'e-mail de contact dans src/lib/legal.ts (EDITEUR.email)", fait: EDITEUR.email !== null },
  { tache: "Vérifier l'hébergeur final (Lovable ou autre) dans les mentions légales", fait: true },
  { tache: "Retirer « Se souvenir de moi » de la page Connexion", fait: true },
  { tache: "Configurer la connexion Google (Google Cloud + Supabase)", fait: true },
  { tache: "Ajouter le domaine final dans Supabase › Authentication › URL Configuration", fait: true },
  { tache: "Brancher le paiement des forfaits (Stripe), avec conditions de vente et médiateur de la consommation", fait: false },
];

// ---------- Acceptation des conditions ----------

const CLE_COCHEE = "palanote-conditions-cochees";

// Case cochée juste avant de partir chez Google : on l'enregistre au retour.
export function memoriserCaseCochee() {
  try {
    sessionStorage.setItem(CLE_COCHEE, VERSION_CONDITIONS);
  } catch {
    /* stockage indisponible */
  }
}

function caseCocheeAvantGoogle() {
  try {
    return sessionStorage.getItem(CLE_COCHEE) === VERSION_CONDITIONS;
  } catch {
    return false;
  }
}

export async function conditionsAcceptees(): Promise<boolean> {
  const { data, error } = await supabase
    .from("consents")
    .select("id")
    .eq("type", "cgu")
    .eq("version", VERSION_CONDITIONS)
    .is("revoque_le", null)
    .limit(1);
  if (error) return true; // en cas de souci technique, on ne bloque pas l'app
  return (data ?? []).length > 0;
}

export async function accepterConditions() {
  const { error } = await supabase.rpc("accepter_conditions", { p_version: VERSION_CONDITIONS });
  if (!error) return;
  // Script SQL pas encore lancé : on écrit directement dans la table
  const { data: s } = await supabase.auth.getSession();
  const uid = s.session?.user.id;
  if (!uid) throw error;
  const { error: e2 } = await supabase.from("consents").insert([
    { user_id: uid, type: "cgu", version: VERSION_CONDITIONS },
    { user_id: uid, type: "confidentialite", version: VERSION_CONDITIONS },
  ]);
  if (e2) throw e2;
}

// Au démarrage : déjà acceptées ? sinon, acceptées à l'inscription (case cochée) ?
// Renvoie true s'il faut encore demander au plongeur.
export async function verifierConditions(metadata: Record<string, unknown> | undefined): Promise<boolean> {
  if (await conditionsAcceptees()) return false;
  if (metadata?.["conditions_acceptees"] === VERSION_CONDITIONS || caseCocheeAvantGoogle()) {
    try {
      await accepterConditions();
      try {
        sessionStorage.removeItem(CLE_COCHEE);
      } catch {
        /* rien */
      }
      return false;
    } catch {
      return true;
    }
  }
  return true;
}
