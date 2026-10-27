import { supabase } from "@/lib/supabase";

// ============================================================
// Mes sites de plongée : chaque site plongé une fois, avec son lieu et sa
// position, pour le choisir dans une liste à la plongée suivante.
// La table sites_plongee est remplie côté serveur (déclencheur sur dives).
// Les sites des plongées du carnet sont aussi lus : la liste reste juste même
// avant le script SQL, ou pour une plongée encore en attente.
// ============================================================

export type MonSite = { nom: string; lieu: string; coords: string; derniere: string | null };

export const cleSite = (t: string) =>
  t
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .trim();

type LigneSite = { nom: string | null; lieu: string | null; coords: string | null; derniere_plongee: string | null };
type LigneDive = { site_name: string | null; site_location: string | null; site_coords: string | null; dive_date: string | null };

export async function chargerMesSites(): Promise<MonSite[]> {
  const [table, dives] = await Promise.all([
    supabase
      .from("sites_plongee")
      .select("nom, lieu, coords, derniere_plongee")
      .then((r) => (r.error ? [] : ((r.data ?? []) as LigneSite[]))),
    supabase
      .from("dives")
      .select("site_name, site_location, site_coords, dive_date")
      .is("deleted_at", null)
      .then((r) => (r.error ? [] : ((r.data ?? []) as LigneDive[]))),
  ]);
  const parCle = new Map<string, MonSite>();
  const ajouter = (s: MonSite) => {
    const nom = s.nom.trim();
    if (!nom) return;
    const cle = cleSite(nom);
    const deja = parCle.get(cle);
    if (!deja) return void parCle.set(cle, { ...s, nom });
    // On garde la position et le lieu connus, et la date la plus récente
    parCle.set(cle, {
      nom: deja.nom,
      lieu: deja.lieu || s.lieu,
      coords: deja.coords || s.coords,
      derniere: [deja.derniere, s.derniere].filter(Boolean).sort().pop() ?? null,
    });
  };
  table.forEach((l) => ajouter({ nom: l.nom ?? "", lieu: l.lieu ?? "", coords: l.coords ?? "", derniere: l.derniere_plongee }));
  // Plongées les plus récentes d'abord : leur lieu et leur position priment
  [...dives]
    .sort((a, b) => String(b.dive_date ?? "").localeCompare(String(a.dive_date ?? "")))
    .forEach((l) => ajouter({ nom: l.site_name ?? "", lieu: l.site_location ?? "", coords: l.site_coords ?? "", derniere: l.dive_date }));
  return [...parCle.values()].sort((a, b) => String(b.derniere ?? "").localeCompare(String(a.derniere ?? "")) || a.nom.localeCompare(b.nom, "fr"));
}

// Sites qui correspondent à ce qui est tapé (début de mot, sans accents ni majuscules)
export function filtrerSites(sites: MonSite[], saisie: string): MonSite[] {
  const q = cleSite(saisie);
  if (!q) return sites;
  return sites.filter((s) => {
    const k = cleSite(s.nom);
    return k !== q && (k.startsWith(q) || k.split(/[\s'’-]+/).some((m) => m.startsWith(q)) || cleSite(s.lieu).startsWith(q));
  });
}
