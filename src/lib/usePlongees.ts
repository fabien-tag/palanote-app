import { useEffect, useState } from "react";
import { chargerPlongees, lirePlongees, utilisateurConnecte, type CartePlongee } from "@/lib/plongees";

// Plongées du carnet : celles du compte connecté (Supabase), sinon celles gardées sur l'appareil.
export function usePlongees() {
  const [plongees, setPlongees] = useState<CartePlongee[] | null>(null);
  useEffect(() => {
    let actif = true;
    (async () => {
      try {
        const liste = (await utilisateurConnecte()) ? await chargerPlongees() : [...lirePlongees()];
        if (actif) setPlongees(liste);
      } catch (e) {
        console.error(e);
        if (actif) setPlongees([...lirePlongees()]);
      }
    })();
    return () => {
      actif = false;
    };
  }, []);
  return plongees;
}
