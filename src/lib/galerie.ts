import { supabase } from "@/lib/supabase";
import type { Plongeur } from "@/lib/amis";

// ============================================================
// Galerie commune d'une plongée (parcours 08) : mes photos + celles que ma
// palanquée a partagées. Une seule copie stockée ; les autres carnets pointent dessus.
// ============================================================

export type PhotoGalerie = {
  id: string;
  chemin: string;
  url: string;
  auteur: Plongeur;
  moi: boolean;
  partagee: boolean;
  cree_le: string;
};

async function urlsSignees(chemins: string[]): Promise<Map<string, string>> {
  const m = new Map<string, string>();
  if (chemins.length === 0) return m;
  const { data } = await supabase.storage.from("photos").createSignedUrls(chemins, 60 * 60 * 6);
  for (const d of data ?? []) if (d.path && d.signedUrl) m.set(d.path, d.signedUrl);
  return m;
}

export async function chargerGalerie(diveId: string): Promise<PhotoGalerie[]> {
  const { data, error } = await supabase.rpc("galerie_plongee", { p_dive: diveId });
  if (error) throw error;
  const lignes = (data ?? []) as Omit<PhotoGalerie, "url">[];
  const urls = await urlsSignees(lignes.map((l) => l.chemin));
  return lignes.filter((l) => urls.has(l.chemin)).map((l) => ({ ...l, url: urls.get(l.chemin)! }));
}

// Les autres plongeurs qui ont cette plongée dans leur carnet (ceux qui verront mes photos partagées)
export async function palanqueePlongee(diveId: string): Promise<Plongeur[]> {
  const { data, error } = await supabase.rpc("palanquee_plongee", { p_dive: diveId });
  if (error) throw error;
  return (data ?? []) as Plongeur[];
}

// Choisit lesquelles de mes photos de la plongée sont visibles par la palanquée.
export async function partagerPhotos(diveId: string, ids: string[]): Promise<number> {
  const { data, error } = await supabase.rpc("partager_photos", { p_dive: diveId, p_ids: ids });
  if (error) throw error;
  return Number(data ?? 0);
}

export function nomCourt(p: Plongeur, moi: boolean) {
  return moi ? "Toi" : p.prenom;
}

// ---------- Accord de partage (demandé une fois, réglable dans Moi › Confidentialité) ----------
// null : jamais demandé ; true : mes photos de plongée sont partagées d'office avec la palanquée ; false : non.
export async function reglagePartagePhotos(): Promise<boolean | null | undefined> {
  const { data: s } = await supabase.auth.getSession();
  const uid = s.session?.user.id;
  if (!uid) return undefined;
  const { data, error } = await supabase.from("profiles").select("partage_photos").eq("id", uid).maybeSingle();
  if (error) return undefined; // script palanote-partage-photos.sql pas encore lancé : on ne demande rien
  return (data as { partage_photos?: boolean | null } | null)?.partage_photos ?? null;
}

export async function reglerPartagePhotos(actif: boolean): Promise<number> {
  const { data, error } = await supabase.rpc("regler_partage_photos", { p_actif: actif });
  if (error) throw error;
  return Number(data ?? 0);
}
