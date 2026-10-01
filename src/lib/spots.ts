import { texteVersCoords, type Coords } from "@/lib/carte";
import { dureeEnMinutes, type CartePlongee } from "@/lib/plongees";

// ============================================================
// Spots : les plongées regroupées par site, pour l'onglet Carte.
// Deux plongées sont au même site si elles ont le même nom de site (sans tenir
// compte des majuscules/accents) et sont à moins de 1,5 km l'une de l'autre
// (leurs positions sont décalées au hasard de 100 à 150 m). Sans nom, seule la
// position compte (moins de 300 m).
// ============================================================

export type Spot = {
  id: string;
  nom: string;
  lieu: string; // « Le Lavandou, France »
  ville: string; // « Le Lavandou »
  pays: string; // « France »
  coords: Coords; // moyenne des positions des plongées
  plongees: CartePlongee[]; // de la plus récente à la plus ancienne
  derniere: Date | null;
  profMax: number | null;
  noteMoyenne: number | null;
  minutes: number;
};

const sansAccents = (t: string) =>
  t
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .trim();

function distanceM(a: Coords, b: Coords) {
  const r = (x: number) => (x * Math.PI) / 180;
  const dLat = r(b.lat - a.lat);
  const dLng = r(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(r(a.lat)) * Math.cos(r(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * 6_371_000 * Math.asin(Math.sqrt(h));
}

export function decouperLieu(lieu: string) {
  const parts = lieu
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  if (parts.length === 0) return { ville: "", pays: "" };
  if (parts.length === 1) return { ville: parts[0]!, pays: "" };
  return { ville: parts.slice(0, -1).join(", "), pays: parts[parts.length - 1]! };
}

const dateDe = (p: CartePlongee) => {
  const d = p.date ? new Date(p.date) : null;
  return d && !isNaN(d.getTime()) ? d : null;
};

export function regrouperEnSpots(plongees: CartePlongee[]): Spot[] {
  const groupes: { nom: string; cle: string; points: Coords[]; plongees: CartePlongee[] }[] = [];
  for (const p of plongees) {
    const c = texteVersCoords(p.coords);
    if (!c) continue;
    const cle = sansAccents(p.siteNom);
    const g = groupes.find((x) => {
      const centre = x.points[0]!;
      return cle ? x.cle === cle && distanceM(centre, c) < 1500 : !x.cle && distanceM(centre, c) < 300;
    });
    if (g) {
      g.points.push(c);
      g.plongees.push(p);
    } else groupes.push({ nom: p.siteNom, cle, points: [c], plongees: [p] });
  }

  return groupes
    .map((g, i) => {
      const tri = [...g.plongees].sort((a, b) => (dateDe(b)?.getTime() ?? 0) - (dateDe(a)?.getTime() ?? 0));
      const lieu = tri.find((p) => p.siteLieu)?.siteLieu ?? "";
      const { ville, pays } = decouperLieu(lieu);
      const profs = tri.map((p) => Number(p.profMax.replace(",", "."))).filter((n) => Number.isFinite(n) && n > 0);
      const notes = tri.map((p) => p.note).filter((n) => n > 0);
      return {
        id: `spot-${i}-${g.cle || "sans-nom"}`,
        nom: g.nom || "Site sans nom",
        lieu,
        ville,
        pays,
        coords: {
          lat: g.points.reduce((t, c) => t + c.lat, 0) / g.points.length,
          lng: g.points.reduce((t, c) => t + c.lng, 0) / g.points.length,
        },
        plongees: tri,
        derniere: dateDe(tri[0]!),
        profMax: profs.length ? Math.max(...profs) : null,
        noteMoyenne: notes.length ? notes.reduce((a, b) => a + b, 0) / notes.length : null,
        minutes: tri.reduce((t, p) => t + (dureeEnMinutes(p.duree) ?? 0), 0),
      } satisfies Spot;
    })
    .sort((a, b) => b.plongees.length - a.plongees.length || (b.derniere?.getTime() ?? 0) - (a.derniere?.getTime() ?? 0));
}

// ---------- Textes ----------

export function ilYA(d: Date | null) {
  if (!d) return "";
  const j = new Date();
  j.setHours(0, 0, 0, 0);
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  const jours = Math.round((j.getTime() - x.getTime()) / 86_400_000);
  if (jours <= 0) return "aujourd'hui";
  if (jours === 1) return "hier";
  if (jours < 31) return `il y a ${jours} jours`;
  if (jours < 365) return `il y a ${Math.round(jours / 30)} mois`;
  const ans = Math.round(jours / 365);
  return `il y a ${ans} an${ans > 1 ? "s" : ""}`;
}

const MOIS_COURTS = ["janv.", "févr.", "mars", "avr.", "mai", "juin", "juil.", "août", "sept.", "oct.", "nov.", "déc."];
export function moisAnnee(d: Date | null) {
  return d ? `${MOIS_COURTS[d.getMonth()]} ${d.getFullYear()}` : "";
}

export const pluriel = (n: number, mot: string) => `${n} ${mot}${n > 1 ? "s" : ""}`;

export function resumeSpots(spots: Spot[]) {
  const nb = spots.reduce((t, s) => t + s.plongees.length, 0);
  const pays = new Set(spots.map((s) => s.pays).filter(Boolean));
  const annees = spots
    .flatMap((s) => s.plongees.map((p) => dateDe(p)?.getFullYear()))
    .filter((a): a is number => typeof a === "number");
  const premiere = annees.length ? Math.min(...annees) : null;
  const derniere = annees.length ? Math.max(...annees) : null;
  const periode =
    premiere === null
      ? ""
      : derniere === new Date().getFullYear() && premiere !== derniere
        ? `de ${premiere} à aujourd'hui`
        : premiere === derniere
          ? `en ${premiere}`
          : `de ${premiere} à ${derniere}`;
  return { nbPlongees: nb, nbSites: spots.length, nbPays: pays.size, periode };
}

// Pays → spots, triés par nombre de plongées (vue liste).
export function spotsParPays(spots: Spot[]) {
  const m = new Map<string, Spot[]>();
  for (const s of spots) {
    const k = s.pays || "Autres lieux";
    m.set(k, [...(m.get(k) ?? []), s]);
  }
  return [...m.entries()]
    .map(([pays, liste]) => ({ pays, spots: liste, plongees: liste.reduce((t, s) => t + s.plongees.length, 0) }))
    .sort((a, b) => b.plongees - a.plongees);
}

// Identifiant stable d'un spot dans l'URL de sa fiche (nom + position arrondie).
export function cleSpot(s: Spot) {
  return `${sansAccents(s.nom)}@${s.coords.lat.toFixed(2)},${s.coords.lng.toFixed(2)}`;
}
export function trouverSpot(spots: Spot[], cle: string) {
  return spots.find((s) => cleSpot(s) === cle) ?? null;
}
