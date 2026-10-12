import { supabase } from "@/lib/supabase";
import { coordsVersTexte, flouterPosition } from "@/lib/carte";
import { utilisateurConnecte, viderCacheCarnet } from "@/lib/plongees";

// ============================================================
// Importer ses plongées depuis une autre app
// · UDDF (format standard) : Subsurface, MacDive, Shearwater Cloud, DiveMate… et l'export de Palanote
// · Subsurface (.ssrf ou .xml natif)
// Tout se lit sur le téléphone : le fichier n'est envoyé nulle part.
// Les plongées déjà dans le carnet (même date et même heure) ne sont pas importées deux fois.
// ============================================================

export type PlongeeImportee = {
  dive_date: string | null;
  start_time: string | null;
  site_name: string | null;
  site_location: string | null;
  site_coords: string | null;
  max_depth_m: number | null;
  avg_depth_m: number | null;
  duration_min: number | null;
  temp_bottom_c: number | null;
  visibility_m: number | null;
  rating: number | null;
  gas_mix: string | null;
  o2_pct: number | null;
  he_pct: number | null;
  pressure_start_bar: number | null;
  pressure_end_bar: number | null;
  tank_volume_l: number | null;
  buddies: string[];
  comment: string | null;
};

export type ResultatLecture = { format: "UDDF" | "Subsurface"; plongees: PlongeeImportee[] };

// ---------- Petits outils ----------
const nombre = (v: string | null | undefined) => {
  if (v === null || v === undefined) return null;
  const n = parseFloat(String(v).replace(",", ".").replace(/[^\d.+-eE]/g, ""));
  return Number.isFinite(n) ? n : null;
};
const arrondi = (n: number | null, d = 1) => (n === null ? null : Math.round(n * 10 ** d) / 10 ** d);
const enfant = (el: Element | null | undefined, nom: string): Element | null => {
  if (!el) return null;
  for (const c of Array.from(el.children)) if (c.localName.toLowerCase() === nom) return c;
  return null;
};
const descendant = (el: Element | Document | null | undefined, nom: string): Element | null => {
  if (!el) return null;
  return (el as Element).getElementsByTagName(nom)[0] ?? null;
};
const texte = (el: Element | null | undefined) => (el?.textContent ?? "").trim() || null;
const melange = (o2: number | null, he: number | null) => {
  if (he && he > 0) return "Trimix";
  if (o2 && o2 > 22) return `Nitrox ${Math.round(o2)}`;
  return "Air";
};
function position(lat: number | null, lng: number | null) {
  if (lat === null || lng === null || (lat === 0 && lng === 0)) return null;
  // Comme partout dans Palanote : la position est floutée de 100 à 150 m.
  return coordsVersTexte(flouterPosition({ lat, lng }));
}
function dateEtHeure(v: string | null) {
  if (!v) return { date: null as string | null, heure: null as string | null };
  const m = v.match(/(\d{4}-\d{2}-\d{2})(?:[T ](\d{2}:\d{2}))?/);
  return { date: m?.[1] ?? null, heure: m?.[2] ?? null };
}

// ---------- UDDF ----------
function lireUDDF(doc: Document): PlongeeImportee[] {
  const sites = new Map<string, { nom: string | null; lieu: string | null; coords: string | null }>();
  for (const s of Array.from(doc.getElementsByTagName("site"))) {
    const id = s.getAttribute("id");
    if (!id) continue;
    const geo = enfant(s, "geography");
    sites.set(id, {
      nom: texte(enfant(s, "name")),
      lieu: texte(enfant(geo, "location")) ?? texte(enfant(geo, "address")),
      coords: position(nombre(texte(enfant(geo, "latitude"))), nombre(texte(enfant(geo, "longitude")))),
    });
  }
  const gaz = new Map<string, { o2: number | null; he: number | null; nom: string | null }>();
  for (const m of Array.from(doc.getElementsByTagName("mix"))) {
    const id = m.getAttribute("id");
    if (!id) continue;
    const o2 = nombre(texte(enfant(m, "o2")));
    const he = nombre(texte(enfant(m, "he")));
    gaz.set(id, { o2: o2 === null ? null : o2 <= 1 ? o2 * 100 : o2, he: he === null ? null : he <= 1 ? he * 100 : he, nom: texte(enfant(m, "name")) });
  }
  // Prénoms des binômes déclarés dans <diver><buddy id="…">
  const binomes = new Map<string, string>();
  for (const b of Array.from(doc.getElementsByTagName("buddy"))) {
    const id = b.getAttribute("id");
    const perso = descendant(b, "personal");
    const nom = [texte(enfant(perso, "firstname")), texte(enfant(perso, "lastname"))].filter(Boolean).join(" ");
    if (id && nom) binomes.set(id, nom);
  }

  const liste: PlongeeImportee[] = [];
  for (const d of Array.from(doc.getElementsByTagName("dive"))) {
    const avant = enfant(d, "informationbeforedive");
    const apres = enfant(d, "informationafterdive");
    const { date, heure } = dateEtHeure(texte(enfant(avant, "datetime")) ?? texte(descendant(d, "datetime")));
    const refs = Array.from(avant?.getElementsByTagName("link") ?? []).map((l) => l.getAttribute("ref") ?? "");
    const site = refs.map((r) => sites.get(r)).find(Boolean) ?? null;
    const noms = [
      ...Array.from(avant?.getElementsByTagName("buddyname") ?? []).map((b) => texte(b)),
      ...refs.map((r) => binomes.get(r) ?? null),
    ].filter((x): x is string => Boolean(x));

    // Profondeur et durée : le résumé, sinon les points du profil enregistré par l'ordinateur
    let prof = nombre(texte(enfant(apres, "greatestdepth")));
    let duree = nombre(texte(enfant(apres, "diveduration")));
    if (prof === null || duree === null) {
      let maxProf = 0;
      let maxTemps = 0;
      for (const w of Array.from(d.getElementsByTagName("waypoint"))) {
        maxProf = Math.max(maxProf, nombre(texte(enfant(w, "depth"))) ?? 0);
        maxTemps = Math.max(maxTemps, nombre(texte(enfant(w, "divetime"))) ?? 0);
      }
      if (prof === null && maxProf > 0) prof = maxProf;
      if (duree === null && maxTemps > 0) duree = maxTemps;
    }
    const kelvin = nombre(texte(enfant(apres, "lowesttemperature")));
    const bloc = descendant(d, "tankdata");
    const mix = Array.from(bloc?.getElementsByTagName("link") ?? []).map((l) => gaz.get(l.getAttribute("ref") ?? "")).find(Boolean) ?? null;
    const pa = (v: number | null) => (v === null ? null : v > 1000 ? Math.round(v / 100000) : Math.round(v)); // Pa → bar
    const volume = nombre(texte(enfant(bloc, "tankvolume")));
    const note = nombre(texte(descendant(enfant(apres, "rating"), "ratingvalue")));
    const notes = Array.from(enfant(apres, "notes")?.getElementsByTagName("para") ?? [])
      .map((p) => texte(p))
      .filter(Boolean)
      .join("\n");

    if (!date && prof === null) continue;
    liste.push({
      dive_date: date,
      start_time: heure,
      site_name: site?.nom ?? null,
      site_location: site?.lieu ?? null,
      site_coords: site?.coords ?? null,
      max_depth_m: arrondi(prof),
      avg_depth_m: arrondi(nombre(texte(enfant(apres, "averagedepth")))),
      duration_min: duree === null ? null : Math.round(duree / 60),
      temp_bottom_c: kelvin === null ? null : arrondi(kelvin > 200 ? kelvin - 273.15 : kelvin),
      visibility_m: nombre(texte(enfant(apres, "visibility"))),
      rating: note === null ? null : Math.max(0, Math.min(5, Math.round(note / 2))),
      gas_mix: mix ? melange(mix.o2, mix.he) : null,
      o2_pct: mix?.o2 ? Math.round(mix.o2) : null,
      he_pct: mix?.he ? Math.round(mix.he) : null,
      pressure_start_bar: pa(nombre(texte(enfant(bloc, "tankpressurebegin")))),
      pressure_end_bar: pa(nombre(texte(enfant(bloc, "tankpressureend")))),
      tank_volume_l: volume === null ? null : arrondi(volume < 1 ? volume * 1000 : volume),
      buddies: [...new Set(noms)],
      comment: notes || null,
    });
  }
  return liste;
}

// ---------- Subsurface (format natif) ----------
function lireSubsurface(doc: Document): PlongeeImportee[] {
  const sites = new Map<string, { nom: string | null; coords: string | null }>();
  for (const s of Array.from(doc.getElementsByTagName("site"))) {
    const id = s.getAttribute("uuid");
    if (!id) continue;
    const [lat, lng] = (s.getAttribute("gps") ?? "").trim().split(/\s+/).map((x) => nombre(x));
    sites.set(id.trim(), { nom: s.getAttribute("name"), coords: position(lat ?? null, lng ?? null) });
  }
  const minutes = (v: string | null) => {
    if (!v) return null;
    const m = v.match(/(\d+):(\d+)/);
    return m ? Math.round(Number(m[1]) + Number(m[2]) / 60) : nombre(v);
  };
  const liste: PlongeeImportee[] = [];
  for (const d of Array.from(doc.getElementsByTagName("dive"))) {
    const ordi = enfant(d, "divecomputer");
    const prof = descendant(ordi ?? d, "depth");
    const temp = descendant(ordi ?? d, "temperature");
    const cyl = enfant(d, "cylinder");
    const site = sites.get((d.getAttribute("divesiteid") ?? "").trim());
    const o2 = nombre(cyl?.getAttribute("o2"));
    const he = nombre(cyl?.getAttribute("he"));
    const note = nombre(d.getAttribute("rating"));
    const binome = texte(enfant(d, "buddy"));
    liste.push({
      dive_date: d.getAttribute("date"),
      start_time: (d.getAttribute("time") ?? "").slice(0, 5) || null,
      site_name: site?.nom ?? texte(enfant(d, "location")),
      site_location: null,
      site_coords: site?.coords ?? null,
      max_depth_m: arrondi(nombre(prof?.getAttribute("max"))),
      avg_depth_m: arrondi(nombre(prof?.getAttribute("mean"))),
      duration_min: minutes(d.getAttribute("duration")),
      temp_bottom_c: arrondi(nombre(temp?.getAttribute("water"))),
      visibility_m: null,
      rating: note === null ? null : Math.max(0, Math.min(5, Math.round(note))),
      gas_mix: cyl ? melange(o2, he) : null,
      o2_pct: o2 ? Math.round(o2) : null,
      he_pct: he ? Math.round(he) : null,
      pressure_start_bar: nombre(cyl?.getAttribute("start")),
      pressure_end_bar: nombre(cyl?.getAttribute("end")),
      tank_volume_l: nombre(cyl?.getAttribute("size")),
      buddies: binome ? binome.split(/\s*,\s*/).filter(Boolean) : [],
      comment: texte(enfant(d, "notes")),
    });
  }
  return liste;
}

export async function lireFichier(fichier: File): Promise<ResultatLecture> {
  const contenu = await fichier.text();
  const doc = new DOMParser().parseFromString(contenu, "application/xml");
  if (doc.getElementsByTagName("parsererror").length > 0) throw new Error("fichier_illisible");
  const racine = doc.documentElement.localName.toLowerCase();
  if (racine === "uddf") return { format: "UDDF", plongees: lireUDDF(doc) };
  if (racine === "divelog" || doc.getElementsByTagName("divesites").length > 0) return { format: "Subsurface", plongees: lireSubsurface(doc) };
  throw new Error("format_inconnu");
}

// ---------- Doublons et import ----------
const cle = (p: { dive_date: string | null; start_time: string | null; max_depth_m: number | null; duration_min: number | null }) =>
  p.start_time
    ? `${p.dive_date}|${p.start_time.slice(0, 5)}`
    : `${p.dive_date}|${p.max_depth_m === null ? "" : Number(p.max_depth_m)}|${p.duration_min ?? ""}`;

export async function separerDoublons(liste: PlongeeImportee[]) {
  const { data, error } = await supabase.from("dives").select("dive_date, start_time, max_depth_m, duration_min").is("deleted_at", null);
  if (error) throw error;
  const deja = new Set(
    ((data ?? []) as { dive_date: string | null; start_time: string | null; max_depth_m: number | null; duration_min: number | null }[]).flatMap((d) => [
      cle(d),
      cle({ ...d, start_time: null }),
    ]),
  );
  const nouvelles: PlongeeImportee[] = [];
  const doublons: PlongeeImportee[] = [];
  const vues = new Set<string>();
  for (const p of liste) {
    const k = cle(p);
    if (deja.has(k) || deja.has(cle({ ...p, start_time: null })) || vues.has(k)) doublons.push(p);
    else {
      nouvelles.push(p);
      vues.add(k);
    }
  }
  return { nouvelles, doublons };
}

// Importe les plongées (par lots), et ajuste si demandé les plongées et heures « d'avant Palanote ».
export async function importerPlongees(liste: PlongeeImportee[], ajusterAvant: boolean) {
  const user = await utilisateurConnecte();
  if (!user) throw Object.assign(new Error("non_connecte"), { code: "non_connecte" });
  for (let i = 0; i < liste.length; i += 100) {
    const lot = liste.slice(i, i + 100).map((p) => ({ ...p, id: crypto.randomUUID(), user_id: user.id, source: "import", visibility: "private" }));
    const { error } = await supabase.from("dives").insert(lot);
    if (error) throw error;
  }
  if (ajusterAvant) {
    const { data } = await supabase.from("profiles").select("numero_depart, heures_avant").eq("id", user.id).maybeSingle();
    const avant = Number((data as { numero_depart?: number } | null)?.numero_depart ?? 0);
    const heures = (data as { heures_avant?: number | null } | null)?.heures_avant;
    const minutesImportees = liste.reduce((t, p) => t + (p.duration_min ?? 0), 0);
    const maj: Record<string, number> = { numero_depart: Math.max(0, avant - liste.length) };
    if (heures !== null && heures !== undefined) maj["heures_avant"] = Math.max(0, Math.round((Number(heures) - minutesImportees / 60) * 10) / 10);
    await supabase.from("profiles").update(maj).eq("id", user.id);
    try {
      localStorage.removeItem("palanote-entete");
    } catch {
      /* stockage indisponible */
    }
  }
  viderCacheCarnet();
}

export async function plongeesDAvant(): Promise<number> {
  const user = await utilisateurConnecte();
  if (!user) return 0;
  const { data } = await supabase.from("profiles").select("numero_depart").eq("id", user.id).maybeSingle();
  return Number((data as { numero_depart?: number } | null)?.numero_depart ?? 0);
}
