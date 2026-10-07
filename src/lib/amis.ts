import { supabase } from "@/lib/supabase";
import { viderCacheCarnet } from "@/lib/plongees";

// ============================================================
// Binômes et invitations par QR code (onglet Amis)
// Le QR code contient un lien vers /invitation?code=… valable 10 minutes.
// ============================================================

export type Plongeur = { id: string; prenom: string; niveau: string | null; club: string | null; depuis?: string | null };
export type EtatInvitation = "valide" | "expiree" | "utilisee" | "introuvable" | "acceptee" | "soi_meme";
export type Invitation = Partial<Plongeur> & { etat: EtatInvitation; expire_le?: string };

export async function creerInvitation(): Promise<{ token: string; expire_le: string }> {
  const { data, error } = await supabase.rpc("creer_invitation");
  if (error) throw error;
  return data as { token: string; expire_le: string };
}

export function lienInvitation(token: string) {
  return `${window.location.origin}/invitation?code=${encodeURIComponent(token)}`;
}

export async function voirInvitation(token: string): Promise<Invitation> {
  const { data, error } = await supabase.rpc("voir_invitation", { p_token: token });
  if (error) throw error;
  return data as Invitation;
}

export async function accepterInvitation(token: string): Promise<Invitation> {
  const { data, error } = await supabase.rpc("accepter_invitation", { p_token: token });
  if (error) throw error;
  return data as Invitation;
}

export async function mesBinomes(): Promise<Plongeur[]> {
  const { data, error } = await supabase.rpc("mes_binomes");
  if (error) throw error;
  return (data ?? []) as Plongeur[];
}

// Ma carte de plongeur (affichée sous le QR code).
export async function monProfil(): Promise<{ prenom: string; niveau: string | null; club: string | null } | null> {
  const { data } = await supabase.auth.getSession();
  const user = data.session?.user;
  if (!user) return null;
  const meta = (user.user_metadata ?? {}) as Record<string, string | undefined>;
  const { data: p } = await supabase.from("profiles").select("*").eq("id", user.id).maybeSingle();
  const profil = (p ?? {}) as Record<string, unknown>;
  const texte = (v: unknown) => (typeof v === "string" && v.trim() ? v.trim() : null);
  return {
    prenom:
      texte(profil["first_name"]) ??
      texte(profil["prenom"]) ??
      texte(meta["first_name"]) ??
      texte(meta["full_name"]?.split(" ")[0]) ??
      texte(meta["name"]?.split(" ")[0]) ??
      user.email?.split("@")[0] ??
      "Moi",
    niveau: texte(profil["niveau"]),
    club: texte(profil["club"]),
  };
}

export function initiales(prenom: string) {
  const m = prenom.trim().split(/\s+/);
  return ((m[0]?.[0] ?? "") + (m[1]?.[0] ?? m[0]?.[1] ?? "")).toUpperCase();
}

const COULEURS = ["#3DEFBE", "#FF8A75", "#57D4F5", "#FFC65C", "#B9A6F5"];
export function couleurAvatar(id: string) {
  let h = 0;
  for (const c of id) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  return COULEURS[h % COULEURS.length]!;
}

// ---------- Invitation reçue avant d'avoir un compte (ou d'être connecté) ----------
// Gardée sur l'appareil, puis acceptée automatiquement dès la connexion.

const CLE = "palanote-invitation";

export function garderInvitation(token: string) {
  try {
    localStorage.setItem(CLE, token);
  } catch {
    /* stockage indisponible */
  }
}

export function invitationGardee(): string | null {
  try {
    return localStorage.getItem(CLE);
  } catch {
    return null;
  }
}

export function oublierInvitation() {
  try {
    localStorage.removeItem(CLE);
  } catch {
    /* stockage indisponible */
  }
}

// À appeler une fois connecté : accepte l'invitation gardée, renvoie le message à afficher.
export async function accepterInvitationGardee(): Promise<string | null> {
  const token = invitationGardee();
  if (!token) return null;
  const { data } = await supabase.auth.getSession();
  if (!data.session) return null;
  try {
    const r = await accepterInvitation(token);
    oublierInvitation();
    if (r.etat === "acceptee") return `Toi et ${r.prenom ?? "ton binôme"}, vous êtes maintenant binômes`;
    if (r.etat === "expiree") return "L'invitation a expiré : demande à ton binôme de t'en montrer une nouvelle";
    return null;
  } catch (e) {
    console.error(e);
    return null;
  }
}

// ---------- Binômes identifiés sur une plongée ----------
// On choisit ses binômes Palanote dans la fiche de plongée ; la plongée leur est
// proposée (« À confirmer »). Sur la fiche d'un binôme, on ne voit que les plongées faites ensemble.

export type ResumePlongee = {
  date: string | null;
  site: string | null;
  lieu: string | null;
  prof_max: number | null;
  duree: number | null;
  temp_fond: number | null;
  melange: string | null;
};
export type PlongeeAConfirmer = ResumePlongee & { id: string; de: Plongeur; cree_le?: string; expire_le?: string };
export type PlongeeEnsemble = ResumePlongee & {
  id: string;
  statut: "a_confirmer" | "ajoutee" | "refusee";
  identifie_par_moi: boolean;
  ma_plongee: string | null;
};

export async function identifierBinomes(diveId: string, amis: string[]) {
  const { error } = await supabase.rpc("identifier_binomes", { p_dive: diveId, p_amis: amis });
  if (error) throw error;
}

// Binômes déjà identifiés sur une de mes plongées.
export async function binomesIdentifies(diveId: string): Promise<string[]> {
  const { data: s } = await supabase.auth.getSession();
  const moi = s.session?.user.id;
  const { data, error } = await supabase.from("dive_buddies").select("buddy_user_id, identifie_par").eq("dive_id", diveId);
  if (error) throw error;
  return (data ?? [])
    .filter((r: { buddy_user_id: string | null; identifie_par: string | null }) => r.identifie_par === moi && r.buddy_user_id)
    .map((r: { buddy_user_id: string | null }) => r.buddy_user_id as string);
}

export async function plongeesAConfirmer(): Promise<PlongeeAConfirmer[]> {
  const { data, error } = await supabase.rpc("plongees_a_confirmer");
  if (error) throw error;
  return (data ?? []) as PlongeeAConfirmer[];
}

// Ce que je saisis moi-même en acceptant une proposition (jamais copié du binôme).
export type ChampsPerso = { prof_max?: string; pression_debut?: string; pression_fin?: string; lestage?: string; note?: number };

export async function ajouterPlongeeIdentifiee(id: string, perso: ChampsPerso = {}): Promise<string> {
  const nettoye = Object.fromEntries(
    Object.entries(perso)
      .map(([k, v]) => [k, typeof v === "string" ? v.trim().replace(",", ".") : v])
      .filter(([, v]) => v !== "" && v !== undefined && v !== 0),
  );
  const { data, error } = await supabase.rpc("ajouter_plongee_identifiee", { p_id: id, p_perso: nettoye });
  if (error) throw error;
  viderCacheCarnet();
  return data as string;
}

// ---------- Parcours « Compléter les carnets ensemble » ----------

export type Proposition = {
  id: string;
  statut: "a_confirmer" | "ajoutee" | "refusee";
  de: Plongeur;
  cree_le: string;
  expire_le: string;
  validee_le: string;
  commun: {
    date: string | null;
    heure: string | null;
    site: string | null;
    lieu: string | null;
    duree: number | null;
    temp_fond: number | null;
    visibilite: number | null;
    bateau: string | null;
    club: string | null;
    type: string | null;
  };
  palanquee: Plongeur[];
  noms_libres: string[];
  // Ma plongée du même jour, si je l'avais déjà notée
  deja: null | {
    id: string;
    saisie_le: string;
    heure: string | null;
    site: string | null;
    prof_max: number | null;
    duree: number | null;
    temp_fond: number | null;
    visibilite: number | null;
    bateau: string | null;
    club: string | null;
    nb_binomes: number;
  };
};

export async function chargerProposition(id: string): Promise<Proposition> {
  const { data, error } = await supabase.rpc("proposition_plongee", { p_id: id });
  if (error) throw error;
  return data as Proposition;
}

// « Compléter ma plongée » : remplit seulement mes cases vides.
export async function completerPlongeeIdentifiee(id: string, maPlongee: string): Promise<string> {
  const { data, error } = await supabase.rpc("completer_plongee_identifiee", { p_id: id, p_dive: maPlongee });
  if (error) throw error;
  viderCacheCarnet();
  return data as string;
}

// Fiche préremplie (écran 40) : j'enregistre mes champs à moi sur la plongée ajoutée.
export async function enregistrerChampsPerso(diveId: string, perso: ChampsPerso) {
  const n = (v?: string) => {
    const t = (v ?? "").trim().replace(",", ".");
    return t === "" || !Number.isFinite(Number(t)) ? null : Number(t);
  };
  const { error } = await supabase
    .from("dives")
    .update({
      max_depth_m: n(perso.prof_max),
      pressure_start_bar: n(perso.pression_debut),
      pressure_end_bar: n(perso.pression_fin),
      weight_kg: n(perso.lestage),
      rating: perso.note && perso.note > 0 ? perso.note : null,
    })
    .eq("id", diveId);
  if (error) throw error;
  viderCacheCarnet();
}

// « disparaît dans 30 jours »
export function joursRestants(expireLe: string | undefined) {
  if (!expireLe) return null;
  const j = Math.ceil((new Date(expireLe).getTime() - Date.now()) / 86400000);
  return Number.isFinite(j) ? Math.max(0, j) : null;
}

export function heureCourte(iso: string | null | undefined) {
  if (!iso) return "";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "";
  return `${d.getHours()} h ${String(d.getMinutes()).padStart(2, "0")}`;
}

export async function refuserIdentification(id: string) {
  const { error } = await supabase.rpc("refuser_identification", { p_id: id });
  if (error) throw error;
}

export async function plongeesEnsemble(ami: string): Promise<PlongeeEnsemble[]> {
  const { data, error } = await supabase.rpc("plongees_ensemble", { p_ami: ami });
  if (error) throw error;
  return (data ?? []) as PlongeeEnsemble[];
}

// { idDuBinome: nombre de plongées ensemble }
export async function compterPlongeesEnsemble(): Promise<Record<string, number>> {
  const { data, error } = await supabase.rpc("compter_plongees_ensemble");
  if (error) throw error;
  const r: Record<string, number> = {};
  for (const x of (data ?? []) as { id: string; n: number }[]) r[x.id] = Number(x.n);
  return r;
}

export function plongeesEnsembleTexte(n: number) {
  return n === 0 ? "Pas encore de plongée ensemble" : `${n} plongée${n > 1 ? "s" : ""} ensemble`;
}

const MOIS = ["janvier", "février", "mars", "avril", "mai", "juin", "juillet", "août", "septembre", "octobre", "novembre", "décembre"];
export function dateCourte(iso: string | null | undefined) {
  if (!iso) return "Date inconnue";
  const [a, m, j] = iso.slice(0, 10).split("-").map(Number);
  if (!a || !m || !j) return iso;
  const annee = a === new Date().getFullYear() ? "" : ` ${a}`;
  return `${j} ${MOIS[m - 1]}${annee}`;
}

export function chiffresPlongee(p: ResumePlongee) {
  const nb = (v: number | null) => (v === null || v === undefined ? null : String(Number(v)).replace(".", ","));
  return [
    nb(p.prof_max) && `${nb(p.prof_max)} m`,
    p.duree ? `${p.duree} min` : null,
    nb(p.temp_fond) && `${nb(p.temp_fond)} °C`,
    p.melange ? p.melange.toLowerCase() : null,
  ]
    .filter(Boolean)
    .join(" · ");
}
