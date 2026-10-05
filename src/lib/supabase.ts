import { createClient } from "@supabase/supabase-js";

// User's own Supabase project "Palanote" (linked manually — never Lovable Cloud).
export const SUPABASE_URL = "https://imjbtxvhanvewopafmxk.supabase.co";
export const SUPABASE_PUBLISHABLE_KEY = "sb_publishable_SSRMCVheaMzjik34iwg7gA_R0U0G4xY";

// « Se souvenir de moi » (écran Connexion) :
// coché (par défaut) → la session est gardée dans localStorage, on reste connecté même après avoir fermé l'app ;
// décoché → la session est gardée dans sessionStorage, elle disparaît quand on ferme l'onglet ou l'app.
const CLE_SOUVENIR = "palanote-se-souvenir";

function lire(store: () => Storage, cle: string) {
  try {
    return store().getItem(cle);
  } catch {
    return null;
  }
}
function ecrire(store: () => Storage, cle: string, valeur: string | null) {
  try {
    if (valeur === null) store().removeItem(cle);
    else store().setItem(cle, valeur);
  } catch {
    /* stockage indisponible (navigation privée…) */
  }
}
const local = () => window.localStorage;
const session = () => window.sessionStorage;

export function seSouvenirDeMoi(): boolean {
  if (typeof window === "undefined") return true;
  return lire(local, CLE_SOUVENIR) !== "non";
}

export function choisirSeSouvenir(oui: boolean) {
  if (typeof window === "undefined") return;
  ecrire(local, CLE_SOUVENIR, oui ? null : "non");
}

const stockageSession = {
  getItem: (cle: string) => lire(local, cle) ?? lire(session, cle),
  setItem: (cle: string, valeur: string) => {
    if (seSouvenirDeMoi()) {
      ecrire(local, cle, valeur);
      ecrire(session, cle, null);
    } else {
      ecrire(session, cle, valeur);
      ecrire(local, cle, null);
    }
  },
  removeItem: (cle: string) => {
    ecrire(local, cle, null);
    ecrire(session, cle, null);
  },
};

export const supabase = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
  auth: {
    storage: typeof window !== "undefined" ? stockageSession : undefined,
    persistSession: typeof window !== "undefined",
    autoRefreshToken: typeof window !== "undefined",
  },
});
