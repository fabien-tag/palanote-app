import { supabase } from "@/lib/supabase";
import { utilisateurConnecte, type CartePlongee, type LignePlongee } from "@/lib/plongees";

// ============================================================
// Hors ligne
// · Une plongée enregistrée sans réseau est gardée sur le téléphone (IndexedDB),
//   avec ses photos, puis envoyée dès que le réseau revient (app ouverte).
// · L'identifiant de la plongée est fixé dès la saisie : l'envoi peut être
//   retenté sans jamais créer de doublon (upsert sur le même id).
// · Chaque photo envoyée est retirée de la file : pas de photo en double non plus.
// ============================================================

export type PlongeeEnAttente = {
  id: string;
  ligne: LignePlongee & { user_id: string };
  identifies: string[]; // binômes Palanote à identifier une fois en ligne
  photos: File[];
  creeLe: string;
  erreur?: string | null;
};

const BASE = "palanote-hors-ligne";
const TABLE = "plongees";
export const EVENEMENT_ATTENTE = "palanote-attente";

export function estHorsLigne() {
  return typeof navigator !== "undefined" && navigator.onLine === false;
}

// Erreur due au réseau (pas de connexion, serveur injoignable) plutôt qu'à la donnée.
export function estErreurReseau(e: unknown) {
  if (estHorsLigne()) return true;
  const m = String((e as { message?: string; name?: string } | null)?.message ?? e ?? "");
  const n = String((e as { name?: string } | null)?.name ?? "");
  return /Failed to fetch|Load failed|NetworkError|Network request failed|fetch failed/i.test(m) || n === "AuthRetryableFetchError";
}

// ---------- Petite couche IndexedDB ----------

function ouvrir(): Promise<IDBDatabase> {
  return new Promise((ok, ko) => {
    const r = indexedDB.open(BASE, 1);
    r.onupgradeneeded = () => {
      if (!r.result.objectStoreNames.contains(TABLE)) r.result.createObjectStore(TABLE, { keyPath: "id" });
    };
    r.onsuccess = () => ok(r.result);
    r.onerror = () => ko(r.error);
  });
}

async function operation<T>(mode: IDBTransactionMode, faire: (t: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  const db = await ouvrir();
  return new Promise<T>((ok, ko) => {
    const tx = db.transaction(TABLE, mode);
    const req = faire(tx.objectStore(TABLE));
    tx.oncomplete = () => {
      db.close();
      ok(req.result);
    };
    tx.onerror = () => {
      db.close();
      ko(tx.error);
    };
  });
}

function signaler() {
  if (typeof window !== "undefined") window.dispatchEvent(new Event(EVENEMENT_ATTENTE));
}

// ---------- File d'attente ----------

export async function mettreEnAttente(p: Omit<PlongeeEnAttente, "creeLe">) {
  await operation("readwrite", (t) => t.put({ ...p, creeLe: new Date().toISOString() }));
  signaler();
}

export async function plongeesEnAttente(): Promise<PlongeeEnAttente[]> {
  if (typeof indexedDB === "undefined") return [];
  try {
    const liste = await operation("readonly", (t) => t.getAll() as IDBRequest<PlongeeEnAttente[]>);
    return liste.sort((a, b) => a.creeLe.localeCompare(b.creeLe));
  } catch {
    return [];
  }
}

async function retirer(id: string) {
  await operation("readwrite", (t) => t.delete(id));
}

// Affichage dans le carnet
export function versCarte(p: PlongeeEnAttente): CartePlongee {
  const l = p.ligne;
  return {
    id: l.id,
    date: l.dive_date ?? "",
    siteNom: l.site_name ?? "",
    siteLieu: l.site_location ?? "",
    profMax: l.max_depth_m === null ? "" : String(l.max_depth_m),
    duree: l.duration_min === null ? "" : String(l.duration_min),
    tempFond: l.temp_bottom_c === null ? "" : String(l.temp_bottom_c),
    melange: l.gas_mix ?? "",
    note: l.rating ?? 0,
    binomes: l.buddies ?? [],
    coords: l.site_coords ?? "",
    faune: l.wildlife ?? [],
    club: l.club_name ?? "",
  };
}

// Sans réseau : la plongée (et ses nouvelles photos) attend sur le téléphone.
export async function garderPourPlusTard(ligne: LignePlongee, identifies: string[], photos: File[]) {
  const user = await utilisateurConnecte();
  if (!user) throw Object.assign(new Error("non_connecte"), { code: "non_connecte" });
  await mettreEnAttente({ id: ligne.id, ligne: { ...ligne, user_id: user.id }, identifies, photos });
}

// Plongée d'une sortie club notée sans réseau : rattachée à la sortie une fois envoyée.
const CLE_LIENS_SORTIE = "palanote-liens-sortie";
function liensSortie(): Record<string, string> {
  try {
    return JSON.parse(localStorage.getItem(CLE_LIENS_SORTIE) ?? "{}") as Record<string, string>;
  } catch {
    return {};
  }
}
export function garderLienSortie(diveId: string, sortieId: string) {
  try {
    localStorage.setItem(CLE_LIENS_SORTIE, JSON.stringify({ ...liensSortie(), [diveId]: sortieId }));
  } catch {
    /* stockage indisponible */
  }
}
async function lierSiSortie(diveId: string) {
  const liens = liensSortie();
  const sortie = liens[diveId];
  if (!sortie) return;
  const { error } = await supabase.rpc("lier_plongee_sortie", { p_sortie: sortie, p_dive: diveId });
  if (error) console.error("Rattachement à la sortie impossible", error);
  delete liens[diveId];
  try {
    localStorage.setItem(CLE_LIENS_SORTIE, JSON.stringify(liens));
  } catch {
    /* stockage indisponible */
  }
}

export const MESSAGE_EN_ATTENTE = "Pas de réseau : ta plongée est gardée sur ton téléphone. Elle partira toute seule au retour du réseau.";

// ---------- Envoi ----------

let envoiEnCours: Promise<number> | null = null;

// Envoie tout ce qui attend. Renvoie le nombre de plongées envoyées.
export function envoyerEnAttente(): Promise<number> {
  if (envoiEnCours) return envoiEnCours;
  envoiEnCours = (async () => {
    if (estHorsLigne()) return 0;
    const liste = await plongeesEnAttente();
    if (liste.length === 0) return 0;
    const { data } = await supabase.auth.getSession();
    if (!data.session) return 0; // reconnecté plus tard : on garde la file
    let envoyees = 0;
    const { enregistrerPhotosPlongee } = await import("@/lib/photos-plongee");
    const { identifierBinomes } = await import("@/lib/amis");
    for (const p of liste) {
      try {
        const { error } = await supabase.from("dives").upsert(p.ligne);
        if (error) throw error;
        // Les photos une par une : chaque photo envoyée sort de la file.
        let restantes = [...p.photos];
        while (restantes.length > 0) {
          await enregistrerPhotosPlongee(p.id, [{ url: "", fichier: restantes[0]! }], []);
          restantes = restantes.slice(1);
          await operation("readwrite", (t) => t.put({ ...p, photos: restantes }));
        }
        if (p.identifies.length > 0) await identifierBinomes(p.id, p.identifies).catch(() => undefined);
        await lierSiSortie(p.id).catch(() => undefined);
        await retirer(p.id);
        envoyees += 1;
      } catch (e) {
        if (estErreurReseau(e)) break; // le réseau est retombé : on réessaiera
        console.error("Plongée en attente refusée", e);
        await operation("readwrite", (t) => t.put({ ...p, erreur: String((e as { message?: string })?.message ?? e).slice(0, 300) }));
      }
    }
    if (envoyees > 0) {
      const { viderCacheCarnet } = await import("@/lib/plongees");
      viderCacheCarnet();
    }
    signaler();
    return envoyees;
  })().finally(() => {
    envoiEnCours = null;
  });
  return envoiEnCours;
}

// ---------- Mise en route (une fois, au démarrage de l'app) ----------

export function installerHorsLigne() {
  if (typeof window === "undefined") return;
  const essayer = () => void envoyerEnAttente().catch(() => undefined);
  window.addEventListener("online", essayer);
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") essayer();
  });
  supabase.auth.onAuthStateChange((evenement) => {
    if (evenement === "SIGNED_IN" || evenement === "TOKEN_REFRESHED") essayer();
  });
  setTimeout(essayer, 1500);

  // Service worker : garde les écrans et les fichiers de l'app pour l'ouvrir sans réseau.
  // Seulement sur l'app publiée (pas pendant le développement), sauf pour les tests.
  const enTest = (() => {
    try {
      return localStorage.getItem("palanote-sw-test") === "oui";
    } catch {
      return false;
    }
  })();
  if ("serviceWorker" in navigator && (import.meta.env.PROD || enTest)) {
    void navigator.serviceWorker.register("/sw.js").then(() => prechauffer()).catch((e) => console.warn("Service worker non installé", e));
  }
}

// Garde d'avance les écrans utiles sans réseau (carnet, saisie express, saisie complète).
function prechauffer() {
  if (estHorsLigne()) return;
  setTimeout(() => {
    for (const page of ["/carnet", "/plongee-express", "/nouvelle-plongee"]) {
      void fetch(page, { credentials: "same-origin" }).catch(() => undefined);
    }
    window.dispatchEvent(new Event("palanote-prechauffer"));
  }, 4000);
}
