import { supabase } from "@/lib/supabase";
import { viderCacheCarnet, type CartePlongee } from "@/lib/plongees";

// ============================================================
// Espèces rencontrées (parcours 08) : l'agent IA « identifier-especes » propose,
// le plongeur valide. Les espèces validées rejoignent la faune de la plongée (dives.wildlife).
// ============================================================

export type EspecePlongee = {
  id: string;
  dive_id: string;
  media_id: string | null;
  nom: string;
  nom_latin: string | null;
  confiance: number | null;
  alternative: string | null;
  source: "ia" | "manuel";
  statut: "proposee" | "validee" | "rejetee";
};

export type StatutAnalyse = "en_cours" | "terminee" | "aucune" | "erreur" | null;

export async function chargerEspeces(diveId: string): Promise<EspecePlongee[]> {
  const { data, error } = await supabase
    .from("dive_species")
    .select("id, dive_id, media_id, nom, nom_latin, confiance, alternative, source, statut")
    .eq("dive_id", diveId)
    .order("confiance", { ascending: false, nullsFirst: false });
  if (error) throw error;
  return (data ?? []) as EspecePlongee[];
}

// Toutes mes espèces validées (pour les fiches espèce : nom latin, photo)
export async function mesEspecesValidees(): Promise<EspecePlongee[]> {
  const { data, error } = await supabase
    .from("dive_species")
    .select("id, dive_id, media_id, nom, nom_latin, confiance, alternative, source, statut")
    .eq("statut", "validee");
  if (error) throw error;
  return (data ?? []) as EspecePlongee[];
}

export async function statutAnalyse(diveId: string): Promise<StatutAnalyse> {
  const { data, error } = await supabase.from("dives").select("analyse_statut").eq("id", diveId).maybeSingle();
  if (error) throw error;
  return ((data as { analyse_statut?: StatutAnalyse } | null)?.analyse_statut ?? null) as StatutAnalyse;
}

// Accord pour envoyer ses photos à l'IA (écran 45), modifiable dans Moi › Confidentialité
export async function accordAnalyse(): Promise<boolean> {
  const { data: s } = await supabase.auth.getSession();
  const uid = s.session?.user.id;
  if (!uid) return false;
  const { data } = await supabase.from("profiles").select("analyse_especes_le").eq("id", uid).maybeSingle();
  return Boolean((data as { analyse_especes_le?: string | null } | null)?.analyse_especes_le);
}

export async function changerAccordAnalyse(oui: boolean) {
  const { data: s } = await supabase.auth.getSession();
  const uid = s.session?.user.id;
  if (!uid) throw new Error("non_connecte");
  const { error } = await supabase
    .from("profiles")
    .update({ analyse_especes_le: oui ? new Date().toISOString() : null })
    .eq("id", uid);
  if (error) throw error;
}

export async function lancerAnalyse(diveId: string) {
  const { error } = await supabase.functions.invoke("identifier-especes", { body: { dive_id: diveId } });
  if (error) throw error;
}

// Valide la sélection : statuts, espèces ajoutées à la main, et faune de la plongée.
export async function validerEspeces(diveId: string, decisions: { id: string; garder: boolean }[], ajouts: string[]) {
  for (const d of decisions) {
    const { error } = await supabase
      .from("dive_species")
      .update({ statut: d.garder ? "validee" : "rejetee" })
      .eq("id", d.id);
    if (error) throw error;
  }
  const propres = [...new Set(ajouts.map((a) => a.trim()).filter(Boolean))];
  if (propres.length > 0) {
    const { error } = await supabase
      .from("dive_species")
      .insert(propres.map((nom) => ({ dive_id: diveId, nom, nom_latin: latinDe(nom), source: "manuel", statut: "validee" })));
    if (error) throw error;
  }
  // La faune de la plongée = les espèces validées (et ce qui y était déjà)
  const [{ data: plongee }, { data: validees }] = await Promise.all([
    supabase.from("dives").select("wildlife").eq("id", diveId).maybeSingle(),
    supabase.from("dive_species").select("nom").eq("dive_id", diveId).eq("statut", "validee"),
  ]);
  const deja = ((plongee as { wildlife?: string[] | null } | null)?.wildlife ?? []) as string[];
  const noms = ((validees ?? []) as { nom: string }[]).map((v) => v.nom);
  const faune = [...deja];
  for (const n of noms) if (!faune.some((f) => normaliser(f) === normaliser(n))) faune.push(n);
  const { error } = await supabase.from("dives").update({ wildlife: faune }).eq("id", diveId);
  if (error) throw error;
  viderCacheCarnet();
}

export function normaliser(nom: string) {
  return nom
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .trim();
}

// Espèces courantes (suggestions pour « Ajouter une espèce ») avec leur nom latin
export const ESPECES_COURANTES: [string, string][] = [
  ["Mérou brun", "Epinephelus marginatus"],
  ["Corb", "Sciaena umbra"],
  ["Sar commun", "Diplodus sargus"],
  ["Castagnole", "Chromis chromis"],
  ["Girelle", "Coris julis"],
  ["Saupe", "Sarpa salpa"],
  ["Barracuda", "Sphyraena viridensis"],
  ["Denti", "Dentex dentex"],
  ["Loup", "Dicentrarchus labrax"],
  ["Daurade royale", "Sparus aurata"],
  ["Serran écriture", "Serranus scriba"],
  ["Rascasse rouge", "Scorpaena scrofa"],
  ["Murène", "Muraena helena"],
  ["Congre", "Conger conger"],
  ["Poulpe", "Octopus vulgaris"],
  ["Seiche", "Sepia officinalis"],
  ["Langouste", "Palinurus elephas"],
  ["Homard", "Homarus gammarus"],
  ["Grande cigale", "Scyllarides latus"],
  ["Anthias", "Anthias anthias"],
  ["Poisson-lune", "Mola mola"],
  ["Hippocampe", "Hippocampus guttulatus"],
  ["Grande nacre", "Pinna nobilis"],
  ["Gorgone rouge", "Paramuricea clavata"],
  ["Gorgone jaune", "Eunicella cavolini"],
  ["Spirographe", "Sabella spallanzanii"],
  ["Posidonie", "Posidonia oceanica"],
  ["Étoile de mer rouge", "Echinaster sepositus"],
  ["Oursin violet", "Paracentrotus lividus"],
  ["Flabelline", "Flabellina affinis"],
  ["Doris dalmatienne", "Peltodoris atromaculata"],
  ["Raie torpille", "Torpedo marmorata"],
  ["Tortue caouanne", "Caretta caretta"],
  ["Dauphin", "Tursiops truncatus"],
  ["Corail rouge", "Corallium rubrum"],
];

export function latinDe(nom: string): string | null {
  return ESPECES_COURANTES.find(([n]) => normaliser(n) === normaliser(nom))?.[1] ?? null;
}

// Espèces protégées en Méditerranée française (liste simplifiée)
const PROTEGEES = ["merou brun", "merou", "corb", "grande nacre", "hippocampe", "grande cigale", "tortue caouanne", "posidonie", "datte de mer", "dauphin", "oursin diademe"];
export function estProtegee(nom: string) {
  const n = normaliser(nom);
  return PROTEGEES.some((p) => n === p || n.startsWith(`${p} `));
}

const MOIS = ["janvier", "février", "mars", "avril", "mai", "juin", "juillet", "août", "septembre", "octobre", "novembre", "décembre"];

// Statistiques d'une espèce dans mon carnet (écran 47)
export function statsEspece(nom: string, plongees: CartePlongee[]) {
  const cle = normaliser(nom);
  const avec = plongees.filter((p) => (p.faune ?? []).some((f) => normaliser(f) === cle));
  const parMois = Array.from({ length: 12 }, () => 0);
  const sites = new Map<string, { nom: string; lieu: string; n: number }>();
  for (const p of avec) {
    const m = Number((p.date || "").slice(5, 7));
    if (m >= 1 && m <= 12) parMois[m - 1]! += 1;
    const k = normaliser(p.siteNom || "Site sans nom");
    const s = sites.get(k) ?? { nom: p.siteNom || "Site sans nom", lieu: p.siteLieu, n: 0 };
    s.n += 1;
    sites.set(k, s);
  }
  const max = Math.max(...parMois);
  return {
    observations: avec.length,
    sites: [...sites.values()].sort((a, b) => b.n - a.n),
    parMois,
    meilleurMois: max > 0 ? MOIS[parMois.indexOf(max)]! : null,
  };
}

// Toutes les espèces de mon carnet, de la plus croisée à la plus rare
export function mesEspeces(plongees: CartePlongee[]) {
  const m = new Map<string, { nom: string; n: number }>();
  for (const p of plongees)
    for (const f of p.faune ?? []) {
      const k = normaliser(f);
      if (!k) continue;
      const e = m.get(k) ?? { nom: f, n: 0 };
      e.n += 1;
      m.set(k, e);
    }
  return [...m.values()].sort((a, b) => b.n - a.n || a.nom.localeCompare(b.nom));
}

// Lien temporaire vers une de mes photos (fiche espèce)
export async function urlPhotoMedia(mediaId: string): Promise<string | null> {
  const { data } = await supabase.from("media").select("chemin").eq("id", mediaId).maybeSingle();
  const chemin = (data as { chemin?: string } | null)?.chemin;
  if (!chemin) return null;
  const { data: s } = await supabase.storage.from("photos").createSignedUrl(chemin, 60 * 60 * 6);
  return s?.signedUrl ?? null;
}

// ---------- Image de référence d'une espèce (pour comparer avec sa propre photo avant de valider) ----------
// Tirée de Wikipédia (résumé de page, image libre) : d'abord le nom latin, puis le nom courant.
export type ImageReference = { url: string; page: string; titre: string };
const cacheReferences = new Map<string, Promise<ImageReference | null>>();

async function resumeWikipedia(langue: "fr" | "en", titre: string): Promise<ImageReference | null> {
  const r = await fetch(`https://${langue}.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(titre.trim().replace(/ /g, "_"))}`, {
    headers: { accept: "application/json" },
  });
  if (!r.ok) return null;
  const d = (await r.json()) as { type?: string; title?: string; thumbnail?: { source?: string }; content_urls?: { desktop?: { page?: string } } };
  if (d.type === "disambiguation" || !d.thumbnail?.source) return null;
  return { url: d.thumbnail.source, page: d.content_urls?.desktop?.page ?? `https://${langue}.wikipedia.org/wiki/${encodeURIComponent(titre)}`, titre: d.title ?? titre };
}

export function imageReference(nom: string, nomLatin: string | null): Promise<ImageReference | null> {
  const latin = nomLatin ?? latinDe(nom);
  const cle = `${latin ?? ""}|${nom}`;
  let p = cacheReferences.get(cle);
  if (!p) {
    p = (async () => {
      const essais: ["fr" | "en", string][] = [];
      if (latin) essais.push(["fr", latin]);
      essais.push(["fr", nom]);
      if (latin) essais.push(["en", latin]);
      for (const [langue, titre] of essais) {
        try {
          const ref = await resumeWikipedia(langue, titre);
          if (ref) return ref;
        } catch {
          /* hors ligne ou page absente : essai suivant */
        }
      }
      return null;
    })();
    cacheReferences.set(cle, p);
  }
  return p;
}
