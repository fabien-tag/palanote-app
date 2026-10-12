import { supabase } from "@/lib/supabase";
import { utilisateurConnecte } from "@/lib/plongees";
import { coordsVersTexte, flouterPosition, rechercherLieux } from "@/lib/carte";

// ============================================================
// Numérisation des carnets papier
// Un « lot » = un carnet. Chaque page photographiée est envoyée dans le
// stockage privé, puis lue sur le serveur (fonction lire-page).
// ============================================================

export type StatutPage = "en_attente" | "en_cours" | "lue" | "illisible" | "erreur";
export type Confiance = "sur" | "a_verifier" | "non_lu";

export type Lot = {
  id: string;
  numero: number | null;
  libelle: string | null;
  statut: "en_attente" | "en_cours" | "a_relire" | "termine" | "erreur";
  created_at: string;
  termine_le: string | null;
};

export type Page = {
  id: string;
  ordre: number;
  statut: StatutPage;
  relue: boolean;
  erreur: string | null;
  chemin: string | null;
};

export type Extraction = {
  id: string;
  page_id: string;
  ordre: number;
  statut: "a_relire" | "validee" | "rejetee" | "doublon";
  champs: Record<string, string | null>;
  confiances: Record<string, Confiance>;
  lectures: Record<string, string | null>;
  dive_id: string | null;
};

// ---------- Photos ----------

// Réduit la photo (2 000 px max, JPEG) : plus rapide à envoyer, et au bon format pour l'IA.
export async function preparerPhoto(fichier: Blob): Promise<Blob> {
  try {
    const image = await createImageBitmap(fichier);
    const echelle = Math.min(1, 2000 / Math.max(image.width, image.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(image.width * echelle);
    canvas.height = Math.round(image.height * echelle);
    canvas.getContext("2d")?.drawImage(image, 0, 0, canvas.width, canvas.height);
    image.close();
    const blob = await new Promise<Blob | null>((ok) => canvas.toBlob(ok, "image/jpeg", 0.85));
    return blob ?? fichier;
  } catch {
    return fichier;
  }
}

const urlsSignees = new Map<string, string>();

export async function urlPhoto(chemin: string | null): Promise<string | null> {
  if (!chemin) return null;
  const connue = urlsSignees.get(chemin);
  if (connue) return connue;
  const { data } = await supabase.storage.from("photos").createSignedUrl(chemin, 60 * 60);
  if (data?.signedUrl) urlsSignees.set(chemin, data.signedUrl);
  return data?.signedUrl ?? null;
}

// ---------- Lots (carnets) ----------

export async function creerLot(): Promise<Lot> {
  const user = await utilisateurConnecte();
  if (!user) throw Object.assign(new Error("non_connecte"), { code: "non_connecte" });
  const { count } = await supabase.from("ocr_batches").select("id", { count: "exact", head: true });
  const numero = (count ?? 0) + 1;
  const { data, error } = await supabase
    .from("ocr_batches")
    .insert({ user_id: user.id, numero, libelle: `Carnet n° ${numero}`, statut: "en_attente" })
    .select("id, numero, libelle, statut, created_at, termine_le")
    .single();
  if (error) throw error;
  return data as Lot;
}

// Le carnet en cours (pas terminé) le plus récent, s'il y en a un.
export async function lotEnCours(): Promise<Lot | null> {
  if (!(await utilisateurConnecte())) return null;
  const { data } = await supabase
    .from("ocr_batches")
    .select("id, numero, libelle, statut, created_at, termine_le")
    .neq("statut", "termine")
    .is("deleted_at", null)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  return (data as Lot | null) ?? null;
}

export async function chargerLot(lotId: string) {
  const [lot, pages, extractions] = await Promise.all([
    supabase
      .from("ocr_batches")
      .select("id, numero, libelle, statut, created_at, termine_le")
      .eq("id", lotId)
      .single(),
    supabase
      .from("ocr_pages")
      .select("id, ordre, statut, relue, erreur, media:media_id (chemin)")
      .eq("batch_id", lotId)
      .order("ordre"),
    supabase
      .from("ocr_extractions")
      .select("id, page_id, ordre, statut, champs, confiances, lectures, dive_id, ocr_pages!inner(batch_id)")
      .eq("ocr_pages.batch_id", lotId)
      .order("ordre"),
  ]);
  if (lot.error) throw lot.error;
  if (pages.error) throw pages.error;
  if (extractions.error) throw extractions.error;
  return {
    lot: lot.data as Lot,
    pages: (pages.data ?? []).map((p) => ({
      id: p.id,
      ordre: p.ordre,
      statut: p.statut,
      relue: p.relue,
      erreur: p.erreur,
      chemin: (p.media as unknown as { chemin: string } | null)?.chemin ?? null,
    })) as Page[],
    extractions: (extractions.data ?? []).map(({ ocr_pages: _p, ...e }) => e) as Extraction[],
  };
}

// ---------- Pages ----------

// Envoie une page dans le stockage, l'enregistre et lance sa lecture sur le serveur.
// Si `ordre` existe déjà (page reprise en photo), la page est remplacée.
export async function envoyerPage(lotId: string, photo: Blob, ordre: number): Promise<string> {
  const user = await utilisateurConnecte();
  if (!user) throw Object.assign(new Error("non_connecte"), { code: "non_connecte" });

  const fichier = await preparerPhoto(photo);
  const chemin = `${user.id}/${lotId}/${ordre}-${crypto.randomUUID().slice(0, 8)}.jpg`;
  const envoi = await supabase.storage.from("photos").upload(chemin, fichier, { contentType: "image/jpeg" });
  if (envoi.error) throw envoi.error;

  const media = await supabase
    .from("media")
    .insert({ user_id: user.id, bucket: "photos", chemin, octets: fichier.size, prise_le: new Date().toISOString() })
    .select("id")
    .single();
  if (media.error) throw media.error;

  const existante = await supabase.from("ocr_pages").select("id").eq("batch_id", lotId).eq("ordre", ordre).maybeSingle();
  let pageId: string;
  if (existante.data) {
    pageId = existante.data.id;
    const maj = await supabase
      .from("ocr_pages")
      .update({ media_id: media.data.id, statut: "en_attente", relue: false, erreur: null })
      .eq("id", pageId);
    if (maj.error) throw maj.error;
  } else {
    const page = await supabase
      .from("ocr_pages")
      .insert({ batch_id: lotId, media_id: media.data.id, ordre, statut: "en_attente" })
      .select("id")
      .single();
    if (page.error) throw page.error;
    pageId = page.data.id;
  }

  const { count } = await supabase.from("ocr_pages").select("id", { count: "exact", head: true }).eq("batch_id", lotId);
  await supabase.from("ocr_batches").update({ nb_pages: count ?? ordre, statut: "en_cours" }).eq("id", lotId);

  await lancerLecture(pageId);
  return pageId;
}

// Demande au serveur de lire la page (il répond tout de suite, la lecture continue sans nous).
export async function lancerLecture(pageId: string) {
  const { error } = await supabase.functions.invoke("lire-page", { body: { page_id: pageId } });
  // Quota atteint (402) : le serveur a déjà noté « quota_atteint » sur la page.
  const statut = (error as { context?: { status?: number } } | null)?.context?.status;
  if (error && statut === 402) return;
  if (error) {
    await supabase.from("ocr_pages").update({ statut: "erreur", erreur: String(error.message) }).eq("id", pageId);
  }
}

// ---------- Relecture ----------

const nombre = (v: string | null | undefined) => {
  if (v === null || v === undefined || String(v).trim() === "") return null;
  const n = Number(String(v).replace(",", "."));
  return Number.isFinite(n) ? n : null;
};
const texte = (v: string | null | undefined) => (v && String(v).trim() ? String(v).trim() : null);
const ouiNon = (v: string | null | undefined) => (v === "oui" ? true : v === "non" ? false : null);

// Valide une plongée relue : elle entre dans le carnet (table dives).
export async function validerExtraction(e: Extraction, champs: Record<string, string | null>, garderCommentaire: boolean) {
  const user = await utilisateurConnecte();
  if (!user) throw Object.assign(new Error("non_connecte"), { code: "non_connecte" });
  const melange = texte(champs["melange"]);
  const ligne = {
    user_id: user.id,
    source: "ocr",
    dive_date: texte(champs["date"]),
    start_time: texte(champs["heure"]),
    site_name: texte(champs["site"]),
    site_location: texte(champs["lieu"]),
    max_depth_m: nombre(champs["profondeur_max"]),
    duration_min: nombre(champs["duree"]) === null ? null : Math.round(nombre(champs["duree"])!),
    temp_bottom_c: nombre(champs["temperature"]),
    pressure_start_bar: nombre(champs["pression_debut"]),
    pressure_end_bar: nombre(champs["pression_fin"]),
    gas_mix: melange ? melange.charAt(0).toUpperCase() + melange.slice(1).toLowerCase() : null,
    buddies: (texte(champs["binomes"]) ?? "")
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean),
    club_name: texte(champs["club"]),
    signed: ouiNon(champs["signee"]),
    stamped: ouiNon(champs["tamponnee"]),
    comment: garderCommentaire ? texte(champs["commentaire"]) : null,
  };
  // Placer la plongée sur la carte : on cherche le site (et le lieu) par leur nom,
  // puis on floute la position de 100 à 150 m, comme pour une saisie à la main.
  const position = await localiserSite(ligne.site_name, ligne.site_location);
  const complete = position
    ? { ...ligne, site_coords: position.coords, site_location: ligne.site_location ?? position.lieu }
    : ligne;
  const dive = e.dive_id
    ? await supabase.from("dives").update(complete).eq("id", e.dive_id).select("id").single()
    : await supabase.from("dives").insert(complete).select("id").single();
  if (dive.error) throw dive.error;
  const maj = await supabase
    .from("ocr_extractions")
    .update({ statut: "validee", dive_id: dive.data.id, champs })
    .eq("id", e.id);
  if (maj.error) throw maj.error;
  // Une plongée d'un vieux carnet faisait partie des « plongées d'avant Palanote » déclarées
  // à l'inscription : on la retire de ce nombre, pour ne pas la compter deux fois.
  if (!e.dive_id) await retirerDesPlongeesDAvant(user.id, ligne.duration_min).catch(() => undefined);
}

async function retirerDesPlongeesDAvant(userId: string, dureeMin: number | null) {
  const { data } = await supabase.from("profiles").select("numero_depart, heures_avant").eq("id", userId).maybeSingle();
  const p = (data ?? {}) as { numero_depart?: number | null; heures_avant?: number | null };
  const avant = Number(p.numero_depart ?? 0);
  if (avant <= 0) return;
  const maj: Record<string, number> = { numero_depart: avant - 1 };
  if (p.heures_avant !== null && p.heures_avant !== undefined && dureeMin)
    maj["heures_avant"] = Math.max(0, Math.round((Number(p.heures_avant) - dureeMin / 60) * 10) / 10);
  await supabase.from("profiles").update(maj).eq("id", userId);
  try {
    localStorage.removeItem("palanote-entete");
  } catch {
    /* stockage indisponible */
  }
}

// Cherche la position d'un site lu sur un carnet : « site + lieu », puis le lieu seul,
// puis le site seul. 4 secondes au plus : sans réseau ou sans résultat, la plongée
// est enregistrée sans position (on peut la placer ensuite depuis sa fiche).
export async function localiserSite(site: string | null, lieu: string | null): Promise<{ coords: string; lieu: string } | null> {
  const essais = [site && lieu ? `${site}, ${lieu}` : null, lieu, site].filter((q): q is string => Boolean(q && q.trim().length >= 3));
  const arret = new AbortController();
  const minuterie = setTimeout(() => arret.abort(), 4000);
  try {
    for (const q of [...new Set(essais)]) {
      const trouves = await rechercherLieux(q, arret.signal);
      const premier = trouves[0];
      if (premier) return { coords: coordsVersTexte(flouterPosition(premier.coords)), lieu: premier.lieu };
    }
  } catch {
    /* pas de réseau ou service indisponible */
  } finally {
    clearTimeout(minuterie);
  }
  return null;
}

export async function rejeterExtraction(e: Extraction) {
  const { error } = await supabase.from("ocr_extractions").update({ statut: "rejetee" }).eq("id", e.id);
  if (error) throw error;
}

export async function marquerPageRelue(pageId: string) {
  await supabase.from("ocr_pages").update({ relue: true }).eq("id", pageId);
}

export async function terminerLot(lotId: string) {
  await supabase.from("ocr_batches").update({ statut: "termine", termine_le: new Date().toISOString() }).eq("id", lotId);
}

// ---------- Résumés ----------

export const CHAMPS_RELECTURE = ["date", "site", "profondeur_max", "duree", "temperature", "pression_fin"] as const;

export function resumeLot(pages: Page[], extractions: Extraction[]) {
  const pretes = pages.filter((p) => p.statut === "lue" && !p.relue);
  return {
    total: pages.length,
    lues: pages.filter((p) => p.statut === "lue" || p.statut === "illisible" || p.statut === "erreur").length,
    enCours: pages.filter((p) => p.statut === "en_cours").length,
    enAttente: pages.filter((p) => p.statut === "en_attente").length,
    illisibles: pages.filter((p) => p.statut === "illisible" || p.statut === "erreur"),
    relues: pages.filter((p) => p.relue),
    aRelire: pretes,
    validees: extractions.filter((e) => e.statut === "validee"),
    restantes: extractions.filter((e) => e.statut === "a_relire"),
  };
}

// Prochaine plongée à relire, dans l'ordre des pages puis de la page.
export function prochaineARelire(pages: Page[], extractions: Extraction[], apres?: { pageOrdre: number; ordre: number }) {
  const ordrePage = new Map(pages.map((p) => [p.id, p.ordre]));
  const candidates = extractions
    .filter((e) => e.statut === "a_relire")
    .map((e) => ({ e, po: ordrePage.get(e.page_id) ?? 0 }))
    .sort((a, b) => a.po - b.po || a.e.ordre - b.e.ordre);
  const suivante = apres
    ? candidates.find((c) => c.po > apres.pageOrdre || (c.po === apres.pageOrdre && c.e.ordre > apres.ordre))
    : undefined;
  return (suivante ?? candidates[0])?.e ?? null;
}
