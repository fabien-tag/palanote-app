import { createClient } from "@supabase/supabase-js";

// User's own Supabase project "Palanote" (linked manually — never Lovable Cloud).
export const SUPABASE_URL = "https://imjbtxvhanvewopafmxk.supabase.co";
export const SUPABASE_PUBLISHABLE_KEY = "sb_publishable_SSRMCVheaMzjik34iwg7gA_R0U0G4xY";

export const supabase = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
  auth: {
    storage: typeof window !== "undefined" ? window.localStorage : undefined,
    persistSession: typeof window !== "undefined",
    autoRefreshToken: typeof window !== "undefined",
  },
});
