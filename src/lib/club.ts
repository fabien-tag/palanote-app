import { supabase } from "@/lib/supabase";

// ============================================================
// Sortie club et tampon numérique (parcours 15)
// Le directeur de plongée (DP) prépare la sortie de son centre, y ajoute les
// plongeurs (QR, recherche, lien), note les infos communes après la plongée,
// puis pose le tampon numérique d'un geste.
// Toutes les écritures passent par les fonctions sécurisées de la base
// (sql/palanote-sorties-club.sql).
// ============================================================

export type Centre = { id: string; nom: string; ville: string | null; verifie: boolean; nb_dp?: number; membre?: boolean; role?: string };

export type StatutSortie = "prevue" | "terminee" | "validee" | "annulee";

export type SortieResume = {
  id: string;
  date: string;
  date_texte?: string;
  heure: string | null;
  site: string;
  lieu: string | null;
  statut: StatutSortie;
  centre: string | null;
  centre_id?: string | null;
  entre_amis?: boolean;
  nb_inscrits?: number;
  nb_prevus?: number;
  nb_completees?: number;
  dp?: string;
  dive_id?: string | null;
  tamponne_le?: string | null;
  a_completer?: boolean;
};

export type Participant = {
  id: string | null; // vide = prénom noté à l'avance par le DP, pas encore rattaché à un compte
  prenom: string;
  prevu?: boolean;
  nom_prevu?: string | null;
  niveau: string | null;
  club: string | null;
  participant_id: string;
  palanquee_id: string | null;
  via: "qr" | "lien" | "recherche";
  complete: boolean;
  tamponne_le: string | null;
  exclu_tampon: boolean;
  moi: boolean;
};

export type DetailSortie = {
  id: string;
  date: string;
  date_texte: string;
  heure: string | null;
  site: string;
  lieu: string | null;
  coords: string | null;
  bateau: string | null;
  profondeur_prevue: number | null;
  consignes: string | null;
  statut: StatutSortie;
  duree_min: number | null;
  temp_fond_c: number | null;
  visibilite_m: number | null;
  validee_le: string | null;
  jeton: string | null;
  centre: { id: string | null; nom: string | null; ville: string | null; verifie: boolean | null };
  entre_amis?: boolean; // sortie organisée par un plongeur avec ses binômes : pas de centre, pas de tampon
  dp: { id: string; prenom: string; niveau: string | null };
  est_dp: boolean;
  moi: { participant_id: string; dive_id: string | null; palanquee_id: string | null; tamponne_le: string | null; exclu_tampon: boolean } | null;
  palanquees: { id: string; numero: number; guide_id: string | null }[];
  participants: Participant[];
  noms_libres?: NomLibre[] | null;
};

// Un prénom préparé par le DP, que le plongeur peut prendre en scannant le QR
export type NomLibre = { id: string; nom: string; palanquee: number | null; le_mien?: boolean };

export type ApercuSortie = {
  etat: "ouverte" | "validee" | "annulee" | "introuvable";
  id?: string;
  date?: string;
  date_texte?: string;
  heure?: string | null;
  site?: string;
  lieu?: string | null;
  bateau?: string | null;
  profondeur_prevue?: number | null;
  centre?: string;
  ville?: string | null;
  centre_verifie?: boolean;
  dp?: string;
  nb_inscrits?: number;
  deja_inscrit?: boolean;
  noms_libres?: NomLibre[] | null;
};

export type Preremplissage = {
  sortie_id: string;
  dive_id: string | null;
  statut: StatutSortie;
  dive_date: string | null;
  start_time: string | null;
  site_name: string | null;
  site_location: string | null;
  site_coords: string | null;
  duration_min: number | null;
  temp_bottom_c: number | null;
  visibility_m: number | null;
  club_name: string | null;
  boat_name: string | null;
  dive_leader: string | null;
  guide_name: string | null;
  buddies: string[];
  palanquee: number | null;
};

export type TamponInfos = {
  dp?: string;
  dp_niveau?: string | null;
  centre?: string;
  ville?: string | null;
  centre_verifie?: boolean;
  date_sortie?: string;
  site?: string;
  retire_le?: string;
  raison?: string;
};

async function rpc<T>(nom: string, args: Record<string, unknown> = {}): Promise<T> {
  const { data, error } = await supabase.rpc(nom, args);
  if (error) throw error;
  return data as T;
}

// Le script SQL n'est pas encore lancé : on le dit clairement plutôt que d'afficher une erreur technique.
export function scriptManquant(e: unknown) {
  const m = String((e as { message?: string; code?: string } | null)?.message ?? "");
  const c = String((e as { code?: string } | null)?.code ?? "");
  return c === "PGRST202" || c === "42883" || /Could not find the function|does not exist/i.test(m);
}

// ---------- Centres ----------
export const mesCentres = () => rpc<Centre[]>("mes_centres").then((l) => l ?? []);
export const chercherCentres = (q: string) => rpc<Centre[]>("chercher_centres", { p_q: q }).then((l) => l ?? []);
export const creerCentre = (nom: string, ville: string) => rpc<Centre>("creer_centre", { p_nom: nom, p_ville: ville || null, p_coords: null });
export const rejoindreCentre = (id: string) => rpc<Centre>("rejoindre_centre", { p_centre: id });
export const quitterCentre = (id: string) => rpc<null>("quitter_centre", { p_centre: id });

// Centre choisi en dernier (si le DP en a plusieurs)
const CLE_CENTRE = "palanote-centre";
export function centreChoisi(): string | null {
  try {
    return localStorage.getItem(CLE_CENTRE);
  } catch {
    return null;
  }
}
export function choisirCentre(id: string) {
  try {
    localStorage.setItem(CLE_CENTRE, id);
  } catch {
    /* stockage indisponible */
  }
  signalerCentreModifie();
}

// Le centre a changé (renommé, ou un autre centre choisi) : la barre du haut se met à jour
export const EVENEMENT_CENTRE = "palanote-centre-modifie";
export function signalerCentreModifie() {
  if (typeof window !== "undefined") window.dispatchEvent(new Event(EVENEMENT_CENTRE));
}

// ---------- Sorties (DP) ----------
export type NouvelleSortie = {
  centre: string;
  date: string;
  heure: string;
  site: string;
  lieu: string;
  coords: string;
  bateau: string;
  profondeur: string;
  consignes: string;
  palanquees: number;
};

export function creerSortie(s: NouvelleSortie) {
  const prof = Number(s.profondeur.replace(",", "."));
  return rpc<{ id: string; jeton: string }>("creer_sortie", {
    p_centre: s.centre,
    p_date: s.date,
    p_heure: s.heure || null,
    p_site: s.site,
    p_lieu: s.lieu || null,
    p_coords: s.coords || null,
    p_bateau: s.bateau || null,
    p_profondeur: s.profondeur && Number.isFinite(prof) ? prof : null,
    p_consignes: s.consignes || null,
    p_palanquees: s.palanquees,
  });
}

export const sortiesDp = () => rpc<SortieResume[]>("sorties_dp").then((l) => l ?? []);
export const detailSortie = (id: string) => rpc<DetailSortie>("detail_sortie", { p_id: id });
export const chercherPlongeurs = (sortie: string, q: string) =>
  rpc<(Participant & { deja_inscrit: boolean })[]>("chercher_plongeurs_sortie", { p_sortie: sortie, p_q: q }).then((l) => l ?? []);
// Liste d'attente quand le bateau est plein (sql/palanote-liste-attente.sql)
export type PlacesSortie = { restantes: number | null; complet: boolean; en_attente: number; mon_rang: number | null };
export const placesSortie = (jeton: string) => rpc<PlacesSortie | null>("places_sortie", { p_jeton: jeton });
export const quitterAttente = (sortie: string, user: string | null = null) => rpc<null>("quitter_attente", { p_sortie: sortie, p_user: user });
export type EnAttente = { id: string; prenom: string; niveau: string | null; depuis: string; via: string };
export const attenteSortie = (sortie: string) => rpc<{ restantes: number | null; liste: EnAttente[] }>("attente_sortie", { p_sortie: sortie });

// Désistement d'un plongeur, validé par le DP (sql/palanote-desistement.sql)
export type Desistement = { participant_id: string; user_id: string | null; prenom: string; le: string; motif: string | null; palanquee: number | null };
export const MOTIFS_DESISTEMENT = ["Malade", "Empêchement", "Pas en forme", "Problème de matériel", "Autre"];
export const seDesister = (sortie: string, motif: string | null) => rpc<null>("se_desister", { p_sortie: sortie, p_motif: motif });
export const annulerDesistement = (sortie: string) => rpc<null>("annuler_desistement", { p_sortie: sortie });
export const validerDesistement = (participant: string) => rpc<null>("valider_desistement", { p_participant: participant });
export const desistementsSortie = (sortie: string) => rpc<Desistement[]>("desistements_sortie", { p_sortie: sortie }).then((l) => l ?? []);

export const ajouterParticipant = (sortie: string, user: string) => rpc<{ ajoute: boolean }>("ajouter_participant", { p_sortie: sortie, p_user: user });
export const retirerParticipant = (participant: string) => rpc<null>("retirer_participant", { p_participant: participant });
export const placerParticipant = (participant: string, palanquee: string | null) =>
  rpc<null>("placer_participant", { p_participant: participant, p_palanquee: palanquee });
export const ajouterPalanquee = (sortie: string) => rpc<string>("ajouter_palanquee", { p_sortie: sortie });
export const definirGuide = (palanquee: string, user: string | null) => rpc<null>("definir_guide", { p_palanquee: palanquee, p_user: user });
export const terminerSortie = (id: string, duree: number, temp: number | null, visibilite: number | null) =>
  rpc<null>("terminer_sortie", { p_id: id, p_duree: duree, p_temp: temp, p_visibilite: visibilite });
export const poserTampon = (id: string, exclus: string[]) => rpc<{ tamponnes: number }>("poser_tampon", { p_id: id, p_exclus: exclus });
// Sortie entre amis : palanquées = listes d'identifiants de binômes ("moi" = l'organisateur)
export function creerSortieAmis(s: Omit<NouvelleSortie, "centre" | "bateau" | "palanquees">, palanquees: string[][]) {
  const prof = Number(s.profondeur.replace(",", "."));
  return rpc<{ id: string; jeton: string }>("creer_sortie_amis", {
    p_date: s.date,
    p_heure: s.heure || null,
    p_site: s.site,
    p_lieu: s.lieu || null,
    p_coords: s.coords || null,
    p_profondeur: s.profondeur && Number.isFinite(prof) ? prof : null,
    p_consignes: s.consignes || null,
    p_palanquees: palanquees,
  });
}

export const annulerSortie = (id: string) => rpc<null>("annuler_sortie", { p_id: id });
// Prénoms préparés à l'avance : [["Léa","Paul"],["Sophie"]] = palanquée 1, palanquée 2
export const ajouterNomsPrevus = (sortie: string, noms: string[][]) => rpc<number>("ajouter_noms_prevus", { p_sortie: sortie, p_noms: noms });
export const ajouterNomPrevu = (palanquee: string, nom: string) => rpc<string>("ajouter_nom_prevu", { p_palanquee: palanquee, p_nom: nom });

// Le QR code et le lien envoyé mènent au même endroit ; « via » sert juste à savoir comment chacun s'est inscrit.
export function lienSortie(jeton: string, via?: "lien") {
  return `${window.location.origin}/sortie?code=${encodeURIComponent(jeton)}${via ? "&via=lien" : ""}`;
}

// ---------- Côté plongeur ----------
export const voirSortie = (jeton: string) => rpc<ApercuSortie>("voir_sortie", { p_jeton: jeton });
export const rejoindreSortie = (jeton: string, via: "qr" | "lien" = "qr", place: string | null = null) =>
  rpc<{ id: string; rejoint: boolean; attente?: number; nom_prevu: string | null; palanquee: number | null }>("rejoindre_sortie", { p_jeton: jeton, p_via: via, p_place: place });
export const preremplirSortie = (id: string) => rpc<Preremplissage>("preremplir_sortie", { p_id: id });
export const lierPlongeeSortie = (sortie: string, dive: string) => rpc<{ tamponnee: boolean }>("lier_plongee_sortie", { p_sortie: sortie, p_dive: dive });

export async function mesSorties(): Promise<SortieResume[]> {
  try {
    return (await rpc<SortieResume[]>("mes_sorties")) ?? [];
  } catch (e) {
    if (scriptManquant(e)) return [];
    throw e;
  }
}

// Sortie scannée avant d'avoir un compte : gardée sur l'appareil, rejointe dès la connexion.
const CLE_SORTIE = "palanote-sortie";
export function garderSortie(jeton: string, via: "qr" | "lien") {
  try {
    localStorage.setItem(CLE_SORTIE, JSON.stringify({ jeton, via }));
  } catch {
    /* stockage indisponible */
  }
}
export async function rejoindreSortieGardee(): Promise<string | null> {
  let gardee: { jeton: string; via: "qr" | "lien" } | null = null;
  try {
    const t = localStorage.getItem(CLE_SORTIE);
    gardee = t ? JSON.parse(t) : null;
  } catch {
    gardee = null;
  }
  if (!gardee) return null;
  const { data } = await supabase.auth.getSession();
  if (!data.session) return null;
  try {
    const r = await rejoindreSortie(gardee.jeton, gardee.via);
    const a = await voirSortie(gardee.jeton);
    localStorage.removeItem(CLE_SORTIE);
    if (r.attente) return `Le bateau est complet : tu es ${r.attente === 1 ? "1er" : `${r.attente}e`} sur la liste d'attente${a.site ? ` (${a.site})` : ""}. On te prévient dès qu'une place se libère.`;
    return a.site ? `Tu es inscrit à la sortie : ${a.date_texte ?? ""} · ${a.site}` : "Tu es inscrit à la sortie";
  } catch (e) {
    console.error(e);
    try {
      localStorage.removeItem(CLE_SORTIE);
    } catch {
      /* stockage indisponible */
    }
    return null;
  }
}

// ---------- Affichage ----------
export function heureCourte(h: string | null | undefined) {
  return h ? h.slice(0, 5).replace(":", "h") : "";
}

export const LIBELLE_STATUT: Record<StatutSortie, string> = {
  prevue: "Prévue",
  terminee: "À tamponner",
  validee: "Tamponnée",
  annulee: "Annulée",
};

export function dateLongue(d: string) {
  const x = new Date(`${d}T12:00:00`);
  return isNaN(x.getTime()) ? d : x.toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long" });
}

// ---------- Onglet « Sorties » de la barre du bas ----------
// Visible pour les membres d'un centre, et pour les profils encadrant, directeur de plongée ou club.
const CLE_DP = "palanote-dp";
export function ongletSortiesGarde(): boolean {
  try {
    return localStorage.getItem(CLE_DP) === "oui";
  } catch {
    return false;
  }
}
export function garderOngletSorties(oui: boolean) {
  try {
    if (oui) localStorage.setItem(CLE_DP, "oui");
    else localStorage.removeItem(CLE_DP);
  } catch {
    /* stockage indisponible */
  }
}
let verification: Promise<boolean | null> | null = null;
export function estDirecteurDePlongee(): Promise<boolean | null> {
  // Une seule vérification par ouverture de l'app
  verification ??= (async () => {
    const { data } = await supabase.auth.getSession();
    const u = data.session?.user;
    if (!u) return false;
    try {
      const [centres, profil] = await Promise.all([
        mesCentres().catch(() => [] as Centre[]),
        supabase.from("profiles").select("role_plongee").eq("id", u.id).maybeSingle(),
      ]);
      const role = (profil.data as { role_plongee?: string | null } | null)?.role_plongee ?? "";
      const oui = centres.length > 0 || ["encadrant", "directeur", "centre"].includes(role);
      garderOngletSorties(oui);
      return oui;
    } catch {
      return null; // sans réseau : on garde ce qu'on savait
    }
  })();
  return verification;
}
export function oublierVerificationDp() {
  verification = null;
}

// ---------- Accueil du directeur de plongée (sql/palanote-accueil-dp.sql) ----------
export type ProchaineSortie = {
  id: string;
  date: string;
  date_texte: string;
  heure: string | null;
  site: string;
  lieu: string | null;
  bateau: string | null;
  profondeur_prevue: number | null;
  dans_jours: number;
  mienne: boolean;
  nb_inscrits: number;
  nb_prevus: number;
  nb_palanquees: number;
  sans_guide: number;
  sans_palanquee: number;
};

export type ActionDp = {
  type: "tampon" | "fiches" | "noms";
  sortie_id: string;
  site: string;
  date: string;
  date_texte: string;
  nb: number;
  total?: number;
  manquantes?: number;
  relance_le?: string | null;
};

export type StatsDp = {
  annee: number;
  sorties: number;
  sorties_mois: number;
  plongees: number;
  plongeurs: number;
  tampons: number;
  minutes: number;
};

export type PlongeurCentre = { id: string; prenom: string; niveau: string | null; club: string | null; nb?: number; derniere?: string; premiere?: string; site?: string };

export type AccueilDp = {
  prochaine: ProchaineSortie | null;
  a_faire: ActionDp[];
  stats: StatsDp;
  habitues: PlongeurCentre[];
  nouveaux: PlongeurCentre[];
  sites: { site: string; nb: number; duree_moy: number | null; prof_max: number | null }[];
};

export const accueilDp = (centre: string) => rpc<AccueilDp>("accueil_dp", { p_centre: centre });
export const relancerFiches = (sortie: string) => rpc<number>("relancer_fiches", { p_sortie: sortie });

// Relancé il y a moins de 20 h : la base refuse une 2e relance le même jour
export function relanceRecente(le: string | null | undefined) {
  return Boolean(le && Date.now() - new Date(le).getTime() < 20 * 3600 * 1000);
}

export type FicheSecurite = {
  id: string;
  date: string;
  date_texte: string;
  heure: string | null;
  site: string;
  lieu: string | null;
  bateau: string | null;
  profondeur_prevue: number | null;
  consignes: string | null;
  statut: StatutSortie;
  duree_min: number | null;
  temp_fond_c: number | null;
  visibilite_m: number | null;
  centre: { nom: string; ville: string | null } | null;
  dp: { id: string; prenom: string; nom: string | null; niveau: string | null };
  plongeurs: {
    palanquee: number | null;
    user_id?: string | null;
    prenom: string;
    nom: string | null;
    niveau: string | null;
    guide: boolean;
    prevu: boolean;
    prof_max: number | null;
    duree: number | null;
    immersion: string | null;
    sortie: string | null;
  }[];
};

export const ficheSecurite = (sortie: string) => rpc<FicheSecurite>("fiche_securite", { p_sortie: sortie });
