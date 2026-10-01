import { supabase } from "@/lib/supabase";

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
