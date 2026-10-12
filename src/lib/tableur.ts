// ============================================================
// Lecture de tableurs (Excel .xlsx et .csv) dans le navigateur, pour les imports du club.
// Le fichier n'est envoyé nulle part : il est lu sur l'appareil, puis seules les lignes
// retenues partent vers la base.
// ============================================================

export type Cellule = string | number | boolean | Date | null;
export type Feuillet = { nom: string; lignes: Cellule[][] };

export const EXTENSIONS_TABLEUR = ".xlsx,.csv,.txt";

// ---------- Lecture ----------
export async function lireTableur(fichier: File): Promise<Feuillet[]> {
  const nom = fichier.name.toLowerCase();
  if (nom.endsWith(".xls") || nom.endsWith(".ods") || nom.endsWith(".numbers")) {
    throw new Error("Ce format ne se lit pas encore : enregistre le fichier en .xlsx (Excel) ou en .csv, puis réessaie.");
  }
  if (nom.endsWith(".csv") || nom.endsWith(".txt") || fichier.type === "text/csv") {
    const texte = await lireTexte(fichier);
    return [{ nom: fichier.name.replace(/\.[^.]+$/, ""), lignes: lireCsv(texte) }];
  }
  const { default: lireXlsx } = await import("read-excel-file/browser");
  const feuilles = await lireXlsx(fichier);
  return feuilles
    .map((f) => ({ nom: f.sheet, lignes: (f.data as Cellule[][]).map((l) => l.map((c) => (c === undefined ? null : c))) }))
    .filter((f) => f.lignes.some((l) => l.some((c) => c !== null && String(c).trim() !== "")));
}

// Les CSV d'Excel en français sont souvent en Windows-1252 : on essaie l'UTF-8, puis on bascule.
async function lireTexte(f: File) {
  const octets = await f.arrayBuffer();
  const utf8 = new TextDecoder("utf-8").decode(octets);
  return utf8.includes("�") ? new TextDecoder("windows-1252").decode(octets) : utf8.replace(/^﻿/, "");
}

// CSV : séparateur deviné (; , ou tabulation), guillemets gérés
export function lireCsv(texte: string): Cellule[][] {
  const premiere = texte.split(/\r?\n/, 1)[0] ?? "";
  const sep = [";", "\t", ","].sort((a, b) => premiere.split(b).length - premiere.split(a).length)[0]!;
  const lignes: string[][] = [];
  let ligne: string[] = [];
  let champ = "";
  let guillemets = false;
  for (let i = 0; i < texte.length; i++) {
    const c = texte[i]!;
    if (guillemets) {
      if (c === '"' && texte[i + 1] === '"') {
        champ += '"';
        i++;
      } else if (c === '"') guillemets = false;
      else champ += c;
    } else if (c === '"') guillemets = true;
    else if (c === sep) {
      ligne.push(champ);
      champ = "";
    } else if (c === "\n" || c === "\r") {
      if (c === "\r" && texte[i + 1] === "\n") i++;
      ligne.push(champ);
      lignes.push(ligne);
      ligne = [];
      champ = "";
    } else champ += c;
  }
  if (champ || ligne.length) {
    ligne.push(champ);
    lignes.push(ligne);
  }
  return lignes.filter((l) => l.some((c) => c.trim() !== "")).map((l): Cellule[] => l.map((c) => (c.trim() === "" ? null : c.trim())));
}

// ---------- Colonnes ----------
export const normaliser = (t: string) =>
  t
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();

export type TypeChamp = "texte" | "nombre" | "date" | "heure" | "duree" | "email";
export type Champ = {
  id: string;
  libelle: string;
  type?: TypeChamp;
  requis?: boolean;
  synonymes: string[]; // mots qui reconnaissent la colonne dans l'en-tête (sans accents)
  aide?: string;
};

// La ligne d'en-tête : la première (parmi les 10 premières) qui reconnaît le plus de colonnes
export function trouverEntete(lignes: Cellule[][], champs: Champ[]) {
  let meilleure = 0;
  let score = -1;
  lignes.slice(0, 10).forEach((l, i) => {
    const s = l.filter((c) => typeof c === "string" && champs.some((ch) => reconnait(ch, c))).length;
    if (s > score) {
      score = s;
      meilleure = i;
    }
  });
  return score > 0 ? meilleure : 0;
}

function reconnait(ch: Champ, entete: string) {
  const e = normaliser(entete);
  return ch.synonymes.some((s) => e === s || e.startsWith(`${s} `) || e.endsWith(` ${s}`) || e.includes(` ${s} `) || (s.length > 4 && e.includes(s)));
}

// Associe chaque champ à une colonne du fichier (ou -1)
export function devinerColonnes(entete: Cellule[], champs: Champ[]): Record<string, number> {
  const pris = new Set<number>();
  const r: Record<string, number> = {};
  // Correspondances exactes d'abord, puis partielles
  for (const passe of [true, false]) {
    for (const ch of champs) {
      if (r[ch.id] !== undefined && r[ch.id]! >= 0) continue;
      const i = entete.findIndex(
        (c, j) => !pris.has(j) && typeof c === "string" && (passe ? ch.synonymes.includes(normaliser(c)) : reconnait(ch, c)),
      );
      r[ch.id] = i;
      if (i >= 0) pris.add(i);
    }
  }
  return r;
}

// ---------- Valeurs ----------
const iso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

export function enDate(v: Cellule): string | null {
  if (v === null || v === "") return null;
  if (v instanceof Date) return isNaN(v.getTime()) ? null : iso(new Date(v.getTime() + v.getTimezoneOffset() * 60000));
  if (typeof v === "number") {
    // Numéro de série Excel (jours depuis le 30/12/1899)
    if (v > 20000 && v < 80000) return iso(new Date(Date.UTC(1899, 11, 30) + Math.round(v) * 86400000 + new Date().getTimezoneOffset() * 60000));
    return null;
  }
  const t = String(v).trim();
  let m = t.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})/);
  if (m) return valide(+m[1]!, +m[2]!, +m[3]!);
  m = t.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{2,4})/);
  if (m) {
    const a = +m[3]! < 100 ? 2000 + +m[3]! - (+m[3]! > 50 ? 100 : 0) : +m[3]!;
    return valide(a, +m[2]!, +m[1]!);
  }
  const mois = ["janv", "fevr", "mars", "avr", "mai", "juin", "juil", "aout", "sept", "oct", "nov", "dec"];
  m = normaliser(t).match(/^(\d{1,2}) ([a-z]+) (\d{4})/);
  if (m) {
    const i = mois.findIndex((x) => m![2]!.startsWith(x.slice(0, 3)));
    if (i >= 0) return valide(+m[3]!, i + 1, +m[1]!);
  }
  return null;
}
function valide(a: number, mo: number, j: number) {
  const d = new Date(a, mo - 1, j, 12);
  return d.getFullYear() === a && d.getMonth() === mo - 1 && d.getDate() === j ? iso(d) : null;
}

export function enNombre(v: Cellule): number | null {
  if (v === null || v === "") return null;
  if (typeof v === "number") return v;
  const n = parseFloat(String(v).replace(",", ".").replace(/[^\d.-]/g, ""));
  return Number.isFinite(n) ? n : null;
}

export function enHeure(v: Cellule): string | null {
  if (v === null || v === "") return null;
  if (v instanceof Date) return `${String(v.getUTCHours()).padStart(2, "0")}:${String(v.getUTCMinutes()).padStart(2, "0")}`;
  if (typeof v === "number" && v >= 0 && v < 1) {
    const m = Math.round(v * 1440);
    return `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
  }
  const m = String(v).match(/(\d{1,2})\s*[h:]\s*(\d{2})?/i);
  if (!m || +m[1]! > 23) return null;
  return `${m[1]!.padStart(2, "0")}:${(m[2] ?? "00").padStart(2, "0")}`;
}

// « 45 », « 45 min », « 0:45 », « 1h05 » → minutes
export function enMinutes(v: Cellule): number | null {
  if (v === null || v === "") return null;
  if (typeof v === "number") return v > 0 && v < 1 ? Math.round(v * 1440) : Math.round(v);
  const t = String(v).toLowerCase();
  const hm = t.match(/(\d+)\s*[h:]\s*(\d{1,2})/);
  if (hm) return +hm[1]! * 60 + +hm[2]!;
  const n = enNombre(t);
  return n === null ? null : Math.round(n);
}

export function enEmail(v: Cellule): string | null {
  if (v === null) return null;
  const t = String(v).trim().toLowerCase();
  return /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(t) ? t : null;
}

export function enTexte(v: Cellule): string | null {
  if (v === null) return null;
  if (v instanceof Date) return iso(v);
  const t = String(v).trim();
  return t || null;
}

// Convertit une cellule selon le type du champ ; undefined = valeur présente mais illisible
export function convertir(v: Cellule, type: TypeChamp = "texte"): string | number | null | undefined {
  const vide = v === null || (typeof v === "string" && v.trim() === "");
  if (vide) return null;
  const r =
    type === "date" ? enDate(v) : type === "nombre" ? enNombre(v) : type === "heure" ? enHeure(v) : type === "duree" ? enMinutes(v) : type === "email" ? enEmail(v) : enTexte(v);
  return r === null ? undefined : r;
}

// ---------- Correspondances métier ----------
export function versRoleEquipe(t: string | null): string {
  const n = normaliser(t ?? "");
  if (/(^| )(dp|directeur)/.test(n)) return "dp";
  if (/pilote|capitaine|skipper|marin/.test(n)) return "pilote";
  if (/gonfl/.test(n)) return "gonfleur";
  if (!n || /guide|gp|moniteur|encadr|e[1-5]|mf|instruct|initiateur/.test(n)) return "guide";
  return "autre";
}

export function versTypeMateriel(t: string | null): string {
  const n = normaliser(t ?? "");
  if (/bateau|semi rigide|zodiac|navire|embarcation/.test(n)) return "bateau";
  if (/bloc|bouteille|tank|cylindre/.test(n)) return "bloc";
  if (/gilet|stab|bcd/.test(n)) return "gilet";
  if (/detendeur|regulateur|octopus/.test(n)) return "detendeur";
  if (/combi|combinaison|neoprene|shorty/.test(n)) return "combinaison";
  if (/ordinateur|ordi|computer/.test(n)) return "ordinateur";
  return "autre";
}

// Prénom et nom dans une seule colonne : « DURAND Paul » ou « Paul Durand »
export function separerNomComplet(t: string): { prenom: string; nom: string | null } {
  const mots = t.trim().split(/\s+/);
  if (mots.length === 1) return { prenom: mots[0]!, nom: null };
  const majuscules = mots.filter((m) => m.length > 1 && m === m.toUpperCase() && /[A-Z]/.test(m));
  if (majuscules.length > 0 && majuscules.length < mots.length) {
    return { prenom: mots.filter((m) => !majuscules.includes(m)).join(" "), nom: majuscules.join(" ") };
  }
  return { prenom: mots[0]!, nom: mots.slice(1).join(" ") };
}

// Un modèle à ouvrir dans Excel (CSV avec point-virgule, comme Excel en français)
export function telechargerModele(nom: string, lignes: string[][]) {
  const csv = "﻿" + lignes.map((l) => l.map((c) => (/[;"\n]/.test(c) ? `"${c.replace(/"/g, '""')}"` : c)).join(";")).join("\r\n");
  const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = nom;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
