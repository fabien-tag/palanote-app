import { supabase } from "@/lib/supabase";
import { lovable } from "@/integrations/lovable";

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
      data: { first_name: firstName, profil_en_attente: profil },
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
    await supabase.from("profiles").update(profil).eq("id", user.id);
  }
  await supabase.auth.updateUser({ data: { profil_en_attente: null } });
}

export async function signInWithGoogle() {
  const result = await lovable.auth.signInWithOAuth("google", {
    redirect_uri: window.location.origin,
  });

  if (result.error) {
    throw result.error;
  }

  // Si le navigateur part vers Google, la suite est gérée par la redirection.
  if (result.redirected) {
    return;
  }
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
  await supabase.auth.signOut();
}
