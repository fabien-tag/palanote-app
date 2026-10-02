import { supabase } from "@/lib/supabase";
import { signOut } from "@/lib/auth";
import type { LignePlongee } from "@/lib/plongees";

// ============================================================
// Onglet Moi : profil, réglages, export et suppression du compte
// ============================================================

export type Profil = {
  prenom: string;
  niveau: string;
  certifications: string[]; // « Nitrox », « Trimix »
  role: string; // plongeur, encadrant, directeur, centre (vide si non renseigné)
  club: string;
  premiereAnnee: string; // « 1987 »
  plongeesAvant: string; // plongées faites avant Palanote (numéro de départ)
  profMaxAvant: string; // profondeur max atteinte avant Palanote, en mètres (« 42 »)
  notifLecture: boolean;
  notifBinome: boolean;
  lettreAnnuelle: boolean;
  lettreAnnuelleLe: string | null;
};

export type Compte = { id: string; email: string; avecGoogle: boolean; avecMotDePasse: boolean };

const texte = (v: unknown) => (typeof v === "string" ? v.trim() : "");

export async function compteConnecte(): Promise<Compte | null> {
  const { data } = await supabase.auth.getSession();
  const u = data.session?.user;
  if (!u) return null;
  const fournisseurs = (u.identities ?? []).map((i) => i.provider);
  const meta = (u.app_metadata ?? {}) as { providers?: string[] };
  const tous = new Set([...fournisseurs, ...(meta.providers ?? [])]);
  return {
    id: u.id,
    email: u.email ?? "",
    avecGoogle: tous.has("google"),
    avecMotDePasse: tous.has("email") || tous.size === 0,
  };
}

export async function chargerProfil(): Promise<Profil | null> {
  const { data: s } = await supabase.auth.getSession();
  const u = s.session?.user;
  if (!u) return null;
  const meta = (u.user_metadata ?? {}) as Record<string, unknown>;
  const { data } = await supabase.from("profiles").select("*").eq("id", u.id).maybeSingle();
  const p = (data ?? {}) as Record<string, unknown>;
  const prenom =
    texte(p["first_name"]) ||
    texte(p["prenom"]) ||
    texte(meta["first_name"]) ||
    texte(meta["full_name"]).split(" ")[0] ||
    texte(meta["name"]).split(" ")[0] ||
    (u.email ?? "").split("@")[0] ||
    "";
  const premiere = texte(p["premiere_plongee_le"]);
  const depart = p["numero_depart"];
  const profAvant = Number(p["prof_max_avant"]);
  return {
    prenom,
    niveau: texte(p["niveau"]),
    role: texte(p["role_plongee"]),
    certifications: Array.isArray(p["certifications"]) ? (p["certifications"] as string[]) : [],
    club: texte(p["club"]),
    premiereAnnee: premiere ? premiere.slice(0, 4) : "",
    plongeesAvant: typeof depart === "number" && depart > 0 ? String(depart) : "",
    profMaxAvant: Number.isFinite(profAvant) && profAvant > 0 ? String(profAvant).replace(".", ",") : "",
    notifLecture: p["notif_lecture"] !== false,
    notifBinome: p["notif_binome"] !== false,
    lettreAnnuelle: p["lettre_annuelle"] === true,
    lettreAnnuelleLe: texte(p["lettre_annuelle_le"]) || null,
  };
}

function profondeurOuNull(v: string) {
  const n = Number(v.trim().replace(",", "."));
  return v.trim() && Number.isFinite(n) && n > 0 ? n : null;
}

async function majProfil(champs: Record<string, unknown>) {
  const { data: s } = await supabase.auth.getSession();
  const u = s.session?.user;
  if (!u) throw new Error("non_connecte");
  const { data, error } = await supabase.from("profiles").update(champs).eq("id", u.id).select("id");
  if (error) throw error;
  if (!data || data.length === 0) {
    // Pas encore de ligne de profil (ex. compte Google) : on la crée.
    const r = await supabase.from("profiles").insert({ id: u.id, ...champs });
    if (r.error) throw r.error;
  }
}

export async function sauverProfil(p: Pick<Profil, "prenom" | "niveau" | "club" | "premiereAnnee" | "plongeesAvant"> & { certifications?: string[]; role?: string; profMaxAvant?: string }) {
  const annee = p.premiereAnnee.trim();
  const avant = p.plongeesAvant.trim();
  await majProfil({
    first_name: p.prenom.trim() || null,
    niveau: p.niveau.trim() || null,
    club: p.club.trim() || null,
    premiere_plongee_le: /^\d{4}$/.test(annee) ? `${annee}-01-01` : null,
    numero_depart: /^\d+$/.test(avant) ? Number(avant) : null,
    ...(p.certifications ? { certifications: p.certifications } : {}),
    ...(p.profMaxAvant !== undefined ? { prof_max_avant: profondeurOuNull(p.profMaxAvant) } : {}),
    ...(p.role !== undefined ? { role_plongee: p.role || null } : {}),
  });
  try {
    sessionStorage.removeItem("palanote-entete"); // l'en-tête du carnet se mettra à jour
  } catch {
    /* stockage indisponible */
  }
  // Le prénom sert aussi dans les e-mails et pour les binômes.
  await supabase.auth.updateUser({ data: { first_name: p.prenom.trim() } });
}

export async function sauverReglage(cle: "notif_lecture" | "notif_binome", valeur: boolean) {
  await majProfil({ [cle]: valeur });
}

export async function sauverLettreAnnuelle(accepte: boolean) {
  const le = accepte ? new Date().toISOString() : null;
  await majProfil({ lettre_annuelle: accepte, lettre_annuelle_le: le });
  return le;
}

export async function changerEmail(email: string) {
  const { error } = await supabase.auth.updateUser(
    { email: email.trim() },
    { emailRedirectTo: `${window.location.origin}/moi/reglages` },
  );
  if (error) throw error;
}

export async function changerMotDePasse(motDePasse: string) {
  const { error } = await supabase.auth.updateUser({ password: motDePasse });
  if (error) throw error;
}

// ---------- Export ----------

async function toutesMesPlongees(): Promise<LignePlongee[]> {
  const { data, error } = await supabase
    .from("dives")
    .select("*")
    .is("deleted_at", null)
    .order("dive_date", { ascending: true, nullsFirst: true });
  if (error) throw error;
  return (data ?? []) as LignePlongee[];
}

function telecharger(nom: string, contenu: string, type: string) {
  const url = URL.createObjectURL(new Blob([contenu], { type }));
  const a = document.createElement("a");
  a.href = url;
  a.download = nom;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

const xml = (v: unknown) =>
  String(v ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");

const aujourdhui = () => new Date().toISOString().slice(0, 10);

// UDDF 3.2 : format d'échange lu par la plupart des logiciels de plongée (Subsurface, MacDive, Diving Log…).
export function versUDDF(plongees: LignePlongee[], plongeur: string) {
  const sites = new Map<string, { id: string; nom: string; lieu: string; coords: string }>();
  const gaz = new Map<string, { id: string; o2: number; he: number; nom: string }>();
  for (const d of plongees) {
    const cle = `${d.site_name ?? ""}|${d.site_location ?? ""}`;
    if ((d.site_name || d.site_location) && !sites.has(cle))
      sites.set(cle, { id: `site${sites.size + 1}`, nom: d.site_name ?? "", lieu: d.site_location ?? "", coords: d.site_coords ?? "" });
    const o2 = d.o2_pct ?? (d.gas_mix?.toLowerCase() === "air" || !d.gas_mix ? 21 : 32);
    const he = d.he_pct ?? 0;
    const g = `${o2}/${he}`;
    if (!gaz.has(g)) gaz.set(g, { id: `mix${gaz.size + 1}`, o2, he, nom: d.gas_mix ?? "Air" });
  }
  const kelvin = (c: number | null) => (c === null || c === undefined ? null : (Number(c) + 273.15).toFixed(2));
  const l: string[] = [];
  l.push('<?xml version="1.0" encoding="UTF-8"?>');
  l.push('<uddf version="3.2.0">');
  l.push(`  <generator><name>Palanote</name><type>logbook</type><datetime>${new Date().toISOString()}</datetime></generator>`);
  l.push(`  <diver><owner id="moi"><personal><firstname>${xml(plongeur)}</firstname></personal></owner></diver>`);
  l.push("  <gasdefinitions>");
  for (const g of gaz.values())
    l.push(`    <mix id="${g.id}"><name>${xml(g.nom)}</name><o2>${(g.o2 / 100).toFixed(2)}</o2><he>${(g.he / 100).toFixed(2)}</he></mix>`);
  l.push("  </gasdefinitions>");
  l.push("  <divesite>");
  for (const s of sites.values()) {
    const [lat, lon] = s.coords.split(",").map((x) => Number(x.trim()));
    const geo = Number.isFinite(lat) && Number.isFinite(lon) ? `<geography><location>${xml(s.lieu)}</location><latitude>${lat}</latitude><longitude>${lon}</longitude></geography>` : `<geography><location>${xml(s.lieu)}</location></geography>`;
    l.push(`    <site id="${s.id}"><name>${xml(s.nom || s.lieu)}</name>${geo}</site>`);
  }
  l.push("  </divesite>");
  l.push('  <profiledata><repetitiongroup id="rg1">');
  plongees.forEach((d, i) => {
    const site = sites.get(`${d.site_name ?? ""}|${d.site_location ?? ""}`);
    const o2 = d.o2_pct ?? (d.gas_mix?.toLowerCase() === "air" || !d.gas_mix ? 21 : 32);
    const mix = gaz.get(`${o2}/${d.he_pct ?? 0}`);
    const quand = d.dive_date ? `${d.dive_date}T${(d.start_time ?? "00:00").slice(0, 5)}:00` : "";
    l.push(`    <dive id="d${i + 1}">`);
    l.push("      <informationbeforedive>");
    if (quand) l.push(`        <datetime>${quand}</datetime>`);
    if (site) l.push(`        <link ref="${site.id}"/>`);
    for (const b of d.buddies ?? []) l.push(`        <buddyname>${xml(b)}</buddyname>`);
    l.push("      </informationbeforedive>");
    if (mix) l.push(`      <tankdata><link ref="${mix.id}"/>${d.tank_volume_l ? `<tankvolume>${(Number(d.tank_volume_l) / 1000).toFixed(4)}</tankvolume>` : ""}${d.pressure_start_bar ? `<tankpressurebegin>${d.pressure_start_bar * 100000}</tankpressurebegin>` : ""}${d.pressure_end_bar ? `<tankpressureend>${d.pressure_end_bar * 100000}</tankpressureend>` : ""}</tankdata>`);
    l.push("      <informationafterdive>");
    if (d.max_depth_m !== null && d.max_depth_m !== undefined) l.push(`        <greatestdepth>${Number(d.max_depth_m)}</greatestdepth>`);
    if (d.avg_depth_m) l.push(`        <averagedepth>${Number(d.avg_depth_m)}</averagedepth>`);
    if (d.duration_min) l.push(`        <diveduration>${d.duration_min * 60}</diveduration>`);
    const t = kelvin(d.temp_bottom_c);
    if (t) l.push(`        <lowesttemperature>${t}</lowesttemperature>`);
    if (d.visibility_m) l.push(`        <visibility>${d.visibility_m}</visibility>`);
    if (d.rating) l.push(`        <rating><ratingvalue>${d.rating * 2}</ratingvalue></rating>`);
    const notes = [d.comment, (d.wildlife ?? []).length ? `Faune : ${(d.wildlife ?? []).join(", ")}` : "", d.club_name ? `Club : ${d.club_name}` : ""].filter(Boolean);
    if (notes.length) l.push(`        <notes>${notes.map((n) => `<para>${xml(n)}</para>`).join("")}</notes>`);
    l.push("      </informationafterdive>");
    l.push("    </dive>");
  });
  l.push("  </repetitiongroup></profiledata>");
  l.push("</uddf>");
  return l.join("\n");
}

export async function exporterUDDF(prenom: string) {
  const plongees = await toutesMesPlongees();
  telecharger(`palanote-carnet-${aujourdhui()}.uddf`, versUDDF(plongees, prenom), "application/xml");
  return plongees.length;
}

// Tout ce qu'on a sur toi, dans un seul fichier lisible.
export async function exporterToutesMesDonnees() {
  const { data: s } = await supabase.auth.getSession();
  const u = s.session?.user;
  if (!u) throw new Error("non_connecte");
  const [profil, plongees, binomes, identifications] = await Promise.all([
    supabase.from("profiles").select("*").eq("id", u.id).maybeSingle(),
    toutesMesPlongees(),
    supabase.rpc("mes_binomes"),
    supabase.from("dive_buddies").select("*"),
  ]);
  const contenu = {
    exporte_le: new Date().toISOString(),
    compte: { id: u.id, email: u.email, cree_le: u.created_at },
    profil: profil.data ?? null,
    plongees,
    binomes: binomes.data ?? [],
    identifications: identifications.data ?? [],
  };
  telecharger(`palanote-mes-donnees-${aujourdhui()}.json`, JSON.stringify(contenu, null, 2), "application/json");
}

// ---------- Suppression du compte ----------

async function supprimerMesPhotos(uid: string) {
  const seau = supabase.storage.from("photos");
  const fichiers: string[] = [];
  const parcourir = async (dossier: string, profondeur: number) => {
    const { data } = await seau.list(dossier, { limit: 1000 });
    for (const e of data ?? []) {
      const chemin = `${dossier}/${e.name}`;
      if (e.id) fichiers.push(chemin);
      else if (profondeur < 3) await parcourir(chemin, profondeur + 1);
    }
  };
  await parcourir(uid, 0);
  for (let i = 0; i < fichiers.length; i += 100) await seau.remove(fichiers.slice(i, i + 100));
}

export async function supprimerMonCompte() {
  const { data: s } = await supabase.auth.getSession();
  const u = s.session?.user;
  if (!u) throw new Error("non_connecte");
  try {
    await supprimerMesPhotos(u.id);
  } catch (e) {
    console.error("Photos non supprimées", e);
  }
  const { error } = await supabase.rpc("supprimer_mon_compte");
  if (error) throw error;
  try {
    localStorage.removeItem("palanote-plongees");
  } catch {
    /* stockage indisponible */
  }
  await signOut().catch(() => undefined);
}

export function dateLongue(iso: string | null) {
  if (!iso) return "";
  const d = new Date(iso);
  const jour = d.getDate() === 1 ? "1er" : String(d.getDate());
  return `${jour} ${d.toLocaleDateString("fr-FR", { month: "long", year: "numeric" })}`;
}
