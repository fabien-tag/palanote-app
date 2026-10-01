// ============================================================
// Cartes et lieux (OpenStreetMap)
// - Fond de carte : au choix dans FONDS (OpenStreetMap standard, ou « océan » d'Esri).
//   (Les fonds CARTO demandent désormais une clé : « API key required ».)
// - Recherche et nom des lieux : Nominatim (OpenStreetMap), gratuit, sans clé.
//   Règle d'usage : 1 requête par seconde au maximum → recherches temporisées.
// Pour une forte audience, il suffira de remplacer FOND_DE_CARTE (et les URL Nominatim)
// par un fournisseur avec clé (MapTiler, Stadia…) : le reste de l'app ne bouge pas.
// ============================================================

type Couche = { url: string; maxNativeZoom: number };
export type FondDeCarte = {
  fond: Couche;
  /** Couche de noms posée par-dessus (facultative). */
  noms?: Couche;
  attribution: string;
  zoomMax: number;
};

export const FONDS: Record<"osm" | "ocean", FondDeCarte> = {
  // Carte standard OpenStreetMap : gratuite, sans clé, détaillée (routes, noms…).
  osm: {
    fond: { url: "https://tile.openstreetmap.org/{z}/{x}/{y}.png", maxNativeZoom: 19 },
    attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
    zoomMax: 19,
  },
  // Carte « océan » d'Esri : relief des fonds marins en dégradés de bleu.
  // Gratuite pour tester ; pour une app publiée, Esri demande un compte (gratuit).
  // Les tuiles détaillées s'arrêtent vers le zoom 13 : au-delà, elles sont agrandies.
  ocean: {
    fond: { url: "https://server.arcgisonline.com/ArcGIS/rest/services/Ocean/World_Ocean_Base/MapServer/tile/{z}/{y}/{x}", maxNativeZoom: 13 },
    noms: { url: "https://server.arcgisonline.com/ArcGIS/rest/services/Ocean/World_Ocean_Reference/MapServer/tile/{z}/{y}/{x}", maxNativeZoom: 13 },
    attribution: "Fond © Esri — GEBCO, NOAA, National Geographic, Garmin, HERE",
    zoomMax: 17,
  },
};

// Fond utilisé partout dans l'app : changer cette ligne suffit pour changer de carte.
export const FOND_DE_CARTE: FondDeCarte = FONDS.ocean;

export type Coords = { lat: number; lng: number };
export type Lieu = { nom: string; lieu: string; coords: Coords };

// Vue par défaut quand aucun lieu n'est connu : la France.
export const VUE_FRANCE = { centre: { lat: 46.6, lng: 2.4 }, zoom: 5 };

// ---------- Coordonnées ----------

// Stockées en texte dans dives.site_coords : « 43.55120, 7.04780 ».
export function coordsVersTexte(c: Coords) {
  return `${c.lat.toFixed(5)}, ${c.lng.toFixed(5)}`;
}

export function texteVersCoords(t: string | null | undefined): Coords | null {
  const m = (t ?? "").match(/(-?\d+(?:[.,]\d+)?)\s*[,; ]\s*(-?\d+(?:[.,]\d+)?)/);
  if (!m) return null;
  const lat = Number(m[1]!.replace(",", "."));
  const lng = Number(m[2]!.replace(",", "."));
  if (!Number.isFinite(lat) || !Number.isFinite(lng) || Math.abs(lat) > 90 || Math.abs(lng) > 180) return null;
  return { lat, lng };
}

// ---------- Respect des spots des clubs ----------
// La position enregistrée n'est jamais le point exact : elle est décalée au hasard
// de 100 à 150 m (direction aléatoire), et le point exact n'est conservé nulle part.
export const DECALAGE_MIN_M = 100;
export const DECALAGE_MAX_M = 150;

export function flouterPosition(c: Coords): Coords {
  const distance = DECALAGE_MIN_M + Math.random() * (DECALAGE_MAX_M - DECALAGE_MIN_M);
  const angle = Math.random() * 2 * Math.PI;
  const mParDegreLat = 111_320;
  const mParDegreLng = 111_320 * Math.cos((c.lat * Math.PI) / 180) || 1;
  return {
    lat: c.lat + (distance * Math.cos(angle)) / mParDegreLat,
    lng: c.lng + (distance * Math.sin(angle)) / mParDegreLng,
  };
}

// Affichage : « 43,5512° N · 7,0478° E »
export function coordsLisibles(c: Coords) {
  const f = (n: number) => Math.abs(n).toFixed(4).replace(".", ",");
  return `${f(c.lat)}° ${c.lat >= 0 ? "N" : "S"} · ${f(c.lng)}° ${c.lng >= 0 ? "E" : "O"}`;
}

// ---------- Leaflet (chargé seulement dans le navigateur) ----------

let leaflet: Promise<typeof import("leaflet")> | null = null;
export function chargerLeaflet() {
  if (!leaflet) leaflet = import("leaflet").then((m) => (m.default ?? m) as typeof import("leaflet"));
  return leaflet;
}

// ---------- Lieux (Nominatim) ----------

type AdresseNominatim = Partial<
  Record<"city" | "town" | "village" | "municipality" | "hamlet" | "island" | "county" | "state" | "country" | "bay" | "water", string>
>;
type ResultatNominatim = {
  lat: string;
  lon: string;
  name?: string;
  display_name: string;
  address?: AdresseNominatim;
};

const NOMINATIM = "https://nominatim.openstreetmap.org";

function libelleLieu(a: AdresseNominatim | undefined, repli: string) {
  if (!a) return repli;
  const ville = a.city ?? a.town ?? a.village ?? a.municipality ?? a.island ?? a.hamlet ?? a.county ?? a.state;
  return [ville, a.country].filter(Boolean).join(", ") || repli;
}

export async function rechercherLieux(texte: string, signal?: AbortSignal): Promise<Lieu[]> {
  const q = texte.trim();
  if (q.length < 3) return [];
  const url = `${NOMINATIM}/search?format=jsonv2&addressdetails=1&limit=6&accept-language=fr&q=${encodeURIComponent(q)}`;
  const r = await fetch(url, { signal: signal ?? null, headers: { Accept: "application/json" } });
  if (!r.ok) throw new Error(`recherche : ${r.status}`);
  const liste = (await r.json()) as ResultatNominatim[];
  return liste.map((x) => {
    const lieu = libelleLieu(x.address, x.display_name.split(",").slice(-1)[0]?.trim() ?? "");
    return {
      nom: x.name || x.display_name.split(",")[0]!.trim(),
      lieu,
      coords: { lat: Number(x.lat), lng: Number(x.lon) },
    };
  });
}

// Nom du lieu le plus proche d'un point (« Golfe-Juan, France »). En pleine mer,
// on élargit la recherche pour trouver la côte la plus proche.
export async function lieuDepuisCoords(c: Coords, signal?: AbortSignal): Promise<string | null> {
  for (const zoom of [14, 10, 8]) {
    const url = `${NOMINATIM}/reverse?format=jsonv2&addressdetails=1&accept-language=fr&zoom=${zoom}&lat=${c.lat}&lon=${c.lng}`;
    const r = await fetch(url, { signal: signal ?? null, headers: { Accept: "application/json" } });
    if (!r.ok) continue;
    const x = (await r.json()) as ResultatNominatim & { error?: string };
    if (!x.error && x.address) return libelleLieu(x.address, x.display_name);
  }
  return null;
}

// ---------- Position du téléphone ----------

export function positionActuelle(): Promise<Coords> {
  return new Promise((ok, ko) => {
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      ko(new Error("indisponible"));
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (p) => ok({ lat: p.coords.latitude, lng: p.coords.longitude }),
      (e) => ko(Object.assign(new Error(e.message), { code: e.code })),
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 60000 },
    );
  });
}

export function messageErreurPosition(e: unknown) {
  const code = (e as { code?: number })?.code;
  if (code === 1) return "Autorise l'accès à ta position dans les réglages du navigateur, ou choisis le lieu sur la carte.";
  if (code === 3) return "La position met trop de temps à arriver. Réessaie, ou choisis le lieu sur la carte.";
  return "Ta position n'a pas pu être trouvée. Choisis le lieu sur la carte.";
}
