import { supabase } from "@/lib/supabase";
import { viderCacheCarnet } from "@/lib/plongees";
import { VERSION_CONDITIONS } from "@/lib/legal";

export async function signInWithEmail(email: string, password: string) {
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) throw error;
  await appliquerProfilEnAttente(data.user);
}

export type ProfilInscription = {
  niveau?: string;
  club?: string;
  premiere_plongee_le?: string;
  numero_depart?: number;
  role_plongee?: string;
};

export async function signUpWithEmail(
  email: string,
  password: string,
  firstName: string,
  profil: ProfilInscription = {},
) {
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      emailRedirectTo: `${window.location.origin}/connexion`,
      // Case cochée à l'étape 1 : enregistrée dans consents à la première connexion
      data: { first_name: firstName, profil_en_attente: profil, conditions_acceptees: VERSION_CONDITIONS },
    },
  });
  if (error) throw error;
  // Adresse déjà connue : le service ne renvoie pas d'erreur mais aucune identité.
  if (data.user && data.user.identities && data.user.identities.length === 0) {
    throw Object.assign(new Error("exists"), { code: "user_already_exists" });
  }
}

// Recopie une seule fois dans le profil les réponses de l'étape 2.
async function appliquerProfilEnAttente(
  user: { id: string; user_metadata?: Record<string, unknown> } | null,
) {
  const profil = user?.user_metadata?.["profil_en_attente"] as ProfilInscription | undefined;
  if (!user || !profil) return;
  if (Object.keys(profil).length > 0) {
    const { error } = await supabase.from("profiles").update(profil).eq("id", user.id);
    // Colonne « role_plongee » pas encore créée (script SQL non lancé) : on garde le reste.
    if (error && profil.role_plongee) {
      const { role_plongee: _ignore, ...reste } = profil;
      if (Object.keys(reste).length > 0) await supabase.from("profiles").update(reste).eq("id", user.id);
    }
  }
  await supabase.auth.updateUser({ data: { profil_en_attente: null } });
}

export async function signInWithGoogle() {
  // Google via le projet Supabase de l'utilisateur (pas de Lovable Cloud).
  // Nécessite l'activation du fournisseur Google dans Supabase > Authentication > Sign In / Providers.
  const { error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: { redirectTo: `${window.location.origin}/carnet` }, // retour direct sur l'accueil connecté
  });
  if (error) throw error;
}

export async function sendResetLink(email: string) {
  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${window.location.origin}/nouveau-mot-de-passe`,
  });
  if (error) throw error;
}

export async function updatePassword(newPassword: string) {
  const { error } = await supabase.auth.updateUser({ password: newPassword });
  if (error) throw error;
}

export async function signOut() {
  viderCacheCarnet();
  try {
    sessionStorage.removeItem("palanote-entete");
  } catch {
    /* stockage indisponible */
  }
  await supabase.auth.signOut();
}
