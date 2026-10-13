import { supabase } from "@/lib/supabase";

// La cloche de l'accueil : inscriptions aux sorties, fiches à compléter, tampons…
// Les notifications sont créées uniquement par les fonctions de la base.

export type Notification = {
  id: string;
  type: string;
  titre: string;
  texte: string | null;
  lien: string | null;
  lue_le: string | null;
  created_at: string;
};

export async function chargerNotifications(): Promise<Notification[]> {
  const { data, error } = await supabase
    .from("notifications")
    .select("id, type, titre, texte, lien, lue_le, created_at")
    .order("created_at", { ascending: false })
    .limit(40);
  if (error) return []; // script SQL pas encore lancé : cloche vide
  return (data ?? []) as Notification[];
}

export async function nombreNonLues(): Promise<number> {
  const { count, error } = await supabase.from("notifications").select("id", { count: "exact", head: true }).is("lue_le", null);
  if (error) return 0;
  return count ?? 0;
}

export async function marquerLues(ids?: string[]) {
  await supabase.rpc("marquer_notifications_lues", { p_ids: ids ?? null });
}

export function ilYA(iso: string) {
  const s = Math.max(0, (Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 60) return "à l'instant";
  if (s < 3600) return `il y a ${Math.floor(s / 60)} min`;
  if (s < 86400) return `il y a ${Math.floor(s / 3600)} h`;
  const j = Math.floor(s / 86400);
  if (j === 1) return "hier";
  if (j < 7) return `il y a ${j} jours`;
  return new Date(iso).toLocaleDateString("fr-FR", { day: "numeric", month: "short" });
}

// Rappels du directeur de plongée (sql/palanote-rappels-dp.sql) : contrôles du matériel,
// certificats des adhérents, sorties à préparer, à clôturer, à tamponner.
// Créés à l'ouverture de l'app, au plus toutes les 30 minutes ; chacun n'est envoyé qu'une fois.
export const EVENEMENT_NOTIFICATIONS = "palanote-notifications";

export const genererRappelsDp = (forcer = false) => generer("generer_rappels_dp", "palanote-rappels-dp", forcer);

// Rappel de la veille pour le plongeur (sql/palanote-rappels-plongeur.sql) : heure, lieu,
// mélange, consignes, et ce qu'il doit régler (certificat, carte Nitrox ou Trimix)
export const genererRappelsPlongeur = (forcer = false) => generer("generer_rappels_plongeur", "palanote-rappels-plongeur", forcer);

// Formations du club (sql/palanote-formations.sql) : 3 jours avant, la veille de chaque journée de cours
export const genererRappelsFormations = (forcer = false) => generer("generer_rappels_formations", "palanote-rappels-formations", forcer);

async function generer(fonction: string, cle: string, forcer: boolean) {
  try {
    const avant = Number(sessionStorage.getItem(cle) ?? 0);
    if (!forcer && Date.now() - avant < 30 * 60 * 1000) return 0;
    sessionStorage.setItem(cle, String(Date.now()));
  } catch {
    /* stockage indisponible : on génère quand même */
  }
  const { data, error } = await supabase.rpc(fonction);
  if (error) return 0; // script pas encore lancé
  const nb = Number(data ?? 0);
  if (nb > 0) window.dispatchEvent(new Event(EVENEMENT_NOTIFICATIONS));
  return nb;
}
