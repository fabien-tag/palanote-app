import { useEffect, useState } from "react";
import { centreChoisi, mesCentres, scriptManquant, type Centre } from "@/lib/club";

// Le centre de plongée en cours (le dernier choisi dans l'espace club), pour les pages du DP.
export function useCentre(pret: boolean) {
  const [centres, setCentres] = useState<Centre[] | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);
  useEffect(() => {
    if (!pret) return;
    mesCentres()
      .then(setCentres)
      .catch((e) => {
        console.error(e);
        setCentres([]);
        setErreur(scriptManquant(e) ? "Le script « palanote-sorties-club.sql » n'est pas encore lancé dans Supabase." : "Tes centres n'ont pas pu être chargés.");
      });
  }, [pret]);
  const centre = centres?.find((c) => c.id === centreChoisi()) ?? centres?.[0] ?? null;
  return { centres, centre, erreur };
}

// Message clair quand le script du planning n'est pas encore lancé
export function messagePlanning(e: unknown, defaut: string) {
  if (scriptManquant(e)) return "Le planning n'est pas encore activé : lance le script « palanote-planning-club.sql » dans Supabase.";
  const m = String((e as { message?: string } | null)?.message ?? "");
  return m ? `${defaut} (détail : ${m})` : defaut;
}
