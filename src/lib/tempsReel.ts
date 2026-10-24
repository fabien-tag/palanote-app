import { useEffect, useRef } from "react";
import type { RealtimeChannel } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase";

// Temps réel (Supabase Realtime) : l'écran est prévenu dès qu'une ligne qui concerne
// le plongeur connecté change dans la base. La RLS s'applique aussi aux événements :
// chacun ne reçoit que ce qu'il a le droit de lire.
// Les tables doivent être dans la publication supabase_realtime (sql/palanote-temps-reel.sql).
// Une vérification régulière reste en place en secours (réseau coupé, script pas lancé).

export type TableTempsReel = "notifications" | "dive_buddies" | "friendships";

// La colonne qui désigne le plongeur concerné, pour ne recevoir que ses lignes
const COLONNES: Record<TableTempsReel, string[]> = {
  notifications: ["user_id"],
  dive_buddies: ["buddy_user_id"],
  friendships: ["user_a", "user_b"],
};

export function useTempsReel(tables: TableTempsReel[], quandCaChange: () => void, actifSi = true) {
  const rappel = useRef(quandCaChange);
  rappel.current = quandCaChange;
  const cle = tables.join(",");
  useEffect(() => {
    if (!actifSi) return;
    let actif = true;
    let canal: RealtimeChannel | null = null;
    void supabase.auth.getSession().then(({ data }) => {
      const uid = data.session?.user.id;
      if (!uid || !actif) return;
      canal = supabase.channel(`temps-reel-${cle}-${Math.random().toString(36).slice(2, 8)}`);
      for (const table of cle.split(",") as TableTempsReel[]) {
        for (const colonne of COLONNES[table]) {
          canal.on(
            "postgres_changes",
            { event: "*", schema: "public", table, filter: `${colonne}=eq.${uid}` },
            () => rappel.current(),
          );
        }
      }
      canal.subscribe();
    });
    return () => {
      actif = false;
      if (canal) void supabase.removeChannel(canal);
    };
  }, [cle, actifSi]);
}
