import { supabase } from "@/lib/supabase";
import { preparerPhoto } from "@/lib/numerisation";

// ============================================================
// Le passeport du plongeur (sql/palanote-passeport.sql) : ses brevets avec la photo de
// ses cartes, et la fin de son certificat médical (la date seulement).
// Les photos vont dans le stockage privé « passeports », un dossier par plongeur ;
// seuls le plongeur et les DP qui l'encadrent peuvent les voir.
// ============================================================

export type TypeBrevet = "niveau" | "nitrox" | "trimix" | "autre";
export const TYPES_BREVET: { id: TypeBrevet; libelle: string; suggestions: string[] }[] = [
  { id: "niveau", libelle: "Niveau", suggestions: ["N1", "N2", "N3", "N4", "PE20", "PA20", "PE40", "PA40", "Open Water", "Advanced Open Water", "Rescue Diver"] },
  { id: "nitrox", libelle: "Nitrox", suggestions: ["Nitrox", "Nitrox confirmé", "Enriched Air Diver", "Nitrox avancé"] },
  { id: "trimix", libelle: "Trimix", suggestions: ["Trimix élémentaire", "Trimix", "Trimix normoxique", "Trimix hypoxique"] },
  { id: "autre", libelle: "Autre", suggestions: ["RIFAP", "Plongée de nuit", "Épave", "Recycleur", "Secourisme"] },
];
export const ORGANISMES = ["FFESSM", "PADI", "SSI", "CMAS", "ANMP", "FSGT", "NAUI", "Autre"];

export type Brevet = {
  id: string;
  type: TypeBrevet;
  intitule: string;
  organisme: string | null;
  numero: string | null;
  obtenu_le: string | null;
  photo_recto: string | null;
  photo_verso: string | null;
  verifie_le: string | null;
  verifie_centre: string | null;
  verifie_par: string | null;
};
export type Passeport = {
  id: string;
  prenom: string;
  niveau: string | null;
  club: string | null;
  certificat_fin: string | null;
  moi: boolean;
  brevets: Brevet[];
};
export type ResumePasseport = {
  user_id: string;
  certificat_fin: string | null;
  nitrox: boolean;
  trimix: boolean;
  nitrox_carte: boolean;
  brevets: number;
  verifies: number;
};

async function rpc<T>(nom: string, args: Record<string, unknown> = {}): Promise<T> {
  const { data, error } = await supabase.rpc(nom, args);
  if (error) throw error;
  return data as T;
}

async function monId() {
  const { data } = await supabase.auth.getSession();
  const id = data.session?.user.id;
  if (!id) throw Object.assign(new Error("non_connecte"), { code: "non_connecte" });
  return id;
}

export async function chargerPasseport(userId?: string) {
  return rpc<Passeport>("passeport_plongeur", { p_user: userId ?? (await monId()) });
}
export const passeportsSortie = (sortie: string) => rpc<ResumePasseport[]>("passeports_sortie", { p_sortie: sortie }).then((l) => l ?? []);
export const verifierBrevet = (brevet: string, oui: boolean) => rpc<null>("verifier_brevet", { p_brevet: brevet, p_oui: oui });

// Liens temporaires vers les photos des cartes (1 h)
export async function urlsPhotos(chemins: (string | null)[]): Promise<Record<string, string>> {
  const liste = chemins.filter((c): c is string => Boolean(c));
  if (liste.length === 0) return {};
  const { data } = await supabase.storage.from("passeports").createSignedUrls(liste, 3600);
  const r: Record<string, string> = {};
  for (const x of data ?? []) if (x.path && x.signedUrl) r[x.path] = x.signedUrl;
  return r;
}

async function envoyerPhoto(uid: string, brevet: string, face: "recto" | "verso", fichier: File) {
  const blob = await preparerPhoto(fichier);
  const chemin = `${uid}/${brevet}-${face}-${Date.now()}.jpg`;
  const { error } = await supabase.storage.from("passeports").upload(chemin, blob, { contentType: "image/jpeg" });
  if (error) throw error;
  return chemin;
}

export type BrouillonBrevet = {
  id?: string;
  type: TypeBrevet;
  intitule: string;
  organisme: string;
  numero: string;
  obtenu_le: string;
  recto?: File | null; // nouvelle photo
  verso?: File | null;
  retirerRecto?: boolean;
  retirerVerso?: boolean;
};

export async function enregistrerBrevet(b: BrouillonBrevet, avant?: Brevet) {
  const uid = await monId();
  const champs = {
    type: b.type,
    intitule: b.intitule.trim(),
    organisme: b.organisme.trim() || null,
    numero: b.numero.trim() || null,
    obtenu_le: b.obtenu_le || null,
  };
  let id = b.id;
  if (!id) {
    const { data, error } = await supabase.from("plongeur_brevets").insert({ ...champs, user_id: uid }).select("id").single();
    if (error) throw error;
    id = (data as { id: string }).id;
  }
  const photos: { photo_recto?: string | null; photo_verso?: string | null } = {};
  const anciennes: string[] = [];
  if (b.recto) {
    photos.photo_recto = await envoyerPhoto(uid, id, "recto", b.recto);
    if (avant?.photo_recto) anciennes.push(avant.photo_recto);
  } else if (b.retirerRecto && avant?.photo_recto) {
    photos.photo_recto = null;
    anciennes.push(avant.photo_recto);
  }
  if (b.verso) {
    photos.photo_verso = await envoyerPhoto(uid, id, "verso", b.verso);
    if (avant?.photo_verso) anciennes.push(avant.photo_verso);
  } else if (b.retirerVerso && avant?.photo_verso) {
    photos.photo_verso = null;
    anciennes.push(avant.photo_verso);
  }
  const { error } = await supabase.from("plongeur_brevets").update({ ...champs, ...photos }).eq("id", id);
  if (error) throw error;
  if (anciennes.length) await supabase.storage.from("passeports").remove(anciennes);
  // Le profil suit : un brevet Nitrox ou Trimix ajoute la certification au profil
  if (b.type === "nitrox" || b.type === "trimix") {
    const { data } = await supabase.from("profiles").select("certifications").eq("id", uid).maybeSingle();
    const actuelles = ((data as { certifications?: string[] } | null)?.certifications ?? []) as string[];
    const voulue = b.type === "nitrox" ? "Nitrox" : "Trimix";
    if (!actuelles.includes(voulue)) await supabase.from("profiles").update({ certifications: [...actuelles, voulue] }).eq("id", uid);
  }
  return id;
}

export async function supprimerBrevet(b: Brevet) {
  const chemins = [b.photo_recto, b.photo_verso].filter((c): c is string => Boolean(c));
  if (chemins.length) await supabase.storage.from("passeports").remove(chemins);
  const { error } = await supabase.from("plongeur_brevets").delete().eq("id", b.id);
  if (error) throw error;
}

export async function enregistrerCertificat(fin: string | null) {
  const uid = await monId();
  const { error } = await supabase.from("profiles").update({ certificat_fin: fin }).eq("id", uid);
  if (error) throw error;
}

// État du certificat médical à une date donnée (par défaut aujourd'hui)
export function etatCertificat(fin: string | null, le?: string): "absent" | "expire" | "bientot" | "valide" {
  if (!fin) return "absent";
  const ref = new Date(`${le ?? new Date().toISOString().slice(0, 10)}T12:00:00`).getTime();
  const j = Math.round((new Date(`${fin}T12:00:00`).getTime() - ref) / 86400000);
  return j < 0 ? "expire" : j <= 30 ? "bientot" : "valide";
}

// Pour le DP : ce qui manque au passeport d'un inscrit, pour une sortie donnée
export function alertesPasseport(r: ResumePasseport | undefined, melange: string | null, date: string): string[] {
  if (!r) return [];
  const a: string[] = [];
  if (etatCertificat(r.certificat_fin, date) === "expire") a.push("certificat médical expiré");
  if (melange === "Trimix" && !r.trimix) a.push("pas de brevet Trimix");
  else if (melange === "Nitrox" && !r.nitrox) a.push("pas de brevet Nitrox");
  return a;
}
