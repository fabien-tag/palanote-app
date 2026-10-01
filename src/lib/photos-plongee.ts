import { supabase } from "@/lib/supabase";
import { preparerPhoto } from "@/lib/numerisation";

// ============================================================
// Photos d'une plongée : fichiers dans le stockage « photos »
// (dossier <compte>/plongees/<plongée>/), une ligne par photo dans « media ».
// La première photo (la plus ancienne) sert de couverture dans le carnet.
// ============================================================

export type PhotoPlongee = { id?: string; chemin?: string; url: string; fichier?: File };

async function urlsSignees(chemins: string[]): Promise<Map<string, string>> {
  const m = new Map<string, string>();
  if (chemins.length === 0) return m;
  const { data } = await supabase.storage.from("photos").createSignedUrls(chemins, 60 * 60 * 6);
  for (const d of data ?? []) if (d.path && d.signedUrl) m.set(d.path, d.signedUrl);
  return m;
}

export async function chargerPhotosPlongee(diveId: string): Promise<PhotoPlongee[]> {
  const { data, error } = await supabase
    .from("media")
    .select("id, chemin")
    .eq("dive_id", diveId)
    .is("deleted_at", null)
    .order("created_at", { ascending: true });
  if (error) throw error;
  const lignes = (data ?? []) as { id: string; chemin: string }[];
  const urls = await urlsSignees(lignes.map((l) => l.chemin));
  return lignes.filter((l) => urls.has(l.chemin)).map((l) => ({ id: l.id, chemin: l.chemin, url: urls.get(l.chemin)! }));
}

// Envoie les nouvelles photos (dans l'ordre) et efface celles qu'on a retirées.
export async function enregistrerPhotosPlongee(diveId: string, photos: PhotoPlongee[], retirees: PhotoPlongee[]) {
  const { data: s } = await supabase.auth.getSession();
  const uid = s.session?.user.id;
  if (!uid) throw new Error("non_connecte");

  for (const p of retirees) {
    if (!p.id) continue;
    if (p.chemin) await supabase.storage.from("photos").remove([p.chemin]);
    const { error } = await supabase.from("media").delete().eq("id", p.id);
    if (error) throw error;
  }

  for (const p of photos) {
    if (!p.fichier) continue;
    const fichier = await preparerPhoto(p.fichier);
    const chemin = `${uid}/plongees/${diveId}/${Date.now()}-${crypto.randomUUID().slice(0, 8)}.jpg`;
    const envoi = await supabase.storage.from("photos").upload(chemin, fichier, { contentType: "image/jpeg" });
    if (envoi.error) throw envoi.error;
    const { error } = await supabase.from("media").insert({
      user_id: uid,
      dive_id: diveId,
      bucket: "photos",
      chemin,
      octets: fichier.size,
      prise_le: new Date(p.fichier.lastModified || Date.now()).toISOString(),
    });
    if (error) throw error;
  }
}
