import { supabase } from "@/lib/supabase";

// L'export Excel de la saison (sql/palanote-export-saison.sql) : 4 onglets
// Résumé, Sorties, Plongées (une ligne par plongeur et par plongée), Plongeurs (bilan de chacun).

type SortieExport = {
  date: string; heure: string | null; site: string; lieu: string | null; bateau: string | null; dp: string | null; statut: string;
  melange: string | null; reservee: boolean | null; motif: string | null; profondeur_prevue: number | null; duree: number | null; temperature: number | null;
  visibilite: number | null; plongeurs: number; palanquees: number; tampons: number;
};
type PlongeeExport = {
  date: string; site: string | null; plongeur: string | null; nom: string | null; niveau: string | null; palanquee: string | number | null;
  role: string | null; profondeur: number | null; duree: number | null; tamponnee: boolean | null; source: string;
};
type PlongeurExport = {
  prenom: string | null; nom: string | null; niveau: string | null; plongees: number; tampons: number; prof_max: number | null;
  premiere: string; derniere: string; compte: boolean; adherent: boolean; licence: string | null; certificat_fin: string | null; privilegie: boolean;
};
export type ExportSaison = { centre: string; sorties: SortieExport[]; plongees: PlongeeExport[]; plongeurs: PlongeurExport[] };

export type Periode = { id: string; libelle: string; debut: string; fin: string };

// Les périodes proposées : saison en cours et précédente (septembre → août), année civile en cours et précédente
export function periodesProposees(aujourdhui = new Date()): Periode[] {
  const a = aujourdhui.getFullYear();
  const debutSaison = aujourdhui.getMonth() >= 8 ? a : a - 1;
  return [
    { id: "saison", libelle: `Saison ${debutSaison}-${debutSaison + 1}`, debut: `${debutSaison}-09-01`, fin: `${debutSaison + 1}-08-31` },
    { id: "annee", libelle: `Année ${a}`, debut: `${a}-01-01`, fin: `${a}-12-31` },
    { id: "saison-1", libelle: `Saison ${debutSaison - 1}-${debutSaison}`, debut: `${debutSaison - 1}-09-01`, fin: `${debutSaison}-08-31` },
    { id: "annee-1", libelle: `Année ${a - 1}`, debut: `${a - 1}-01-01`, fin: `${a - 1}-12-31` },
  ];
}

export async function chargerExport(centre: string, debut: string, fin: string) {
  const { data, error } = await supabase.rpc("export_saison", { p_centre: centre, p_debut: debut, p_fin: fin });
  if (error) throw error;
  return data as ExportSaison;
}

// Date « pure » (minuit UTC) : Excel affiche le bon jour quel que soit le fuseau
const jour = (iso: string | null) => {
  if (!iso) return null;
  const [a, m, j] = iso.slice(0, 10).split("-").map(Number);
  return new Date(Date.UTC(a!, m! - 1, j!));
};
const nombre = (n: number | string | null | undefined) => (n === null || n === undefined || n === "" ? null : Number(n));

export async function telechargerExport(e: ExportSaison, p: Periode) {
  const { default: writeXlsxFile } = await import("write-excel-file/browser");
  const titre = { fontWeight: "bold" as const, backgroundColor: "#E3F2FB", textColor: "#123A63" };
  const entete = (cols: string[]) => cols.map((value) => ({ value, ...titre }));
  const d = (iso: string | null) => ({ value: jour(iso) ?? undefined, type: Date, format: "dd/mm/yyyy" });
  const ouiNon = (b: boolean | null) => (b === null ? null : b ? "Oui" : "Non");

  const totalPlongees = e.plongees.length;
  const sortiesFaites = e.sorties.filter((s) => s.statut !== "Annulée" && s.statut !== "Prévue").length;
  const resume = [
    [{ value: `${e.centre} · ${p.libelle}`, fontWeight: "bold" as const, fontSize: 14 }],
    [`Du ${jour(p.debut)!.toLocaleDateString("fr-FR", { timeZone: "UTC" })} au ${jour(p.fin)!.toLocaleDateString("fr-FR", { timeZone: "UTC" })} · exporté de Palanote le ${new Date().toLocaleDateString("fr-FR")}`],
    [],
    entete(["Indicateur", "Valeur"]),
    ["Sorties organisées", e.sorties.filter((s) => s.statut !== "Annulée").length],
    ["Sorties réalisées", sortiesFaites],
    ["Sorties annulées", e.sorties.filter((s) => s.statut === "Annulée").length],
    ["Plongées (toutes sources)", totalPlongees],
    ["Dont plongées importées d'Excel", e.plongees.filter((x) => x.source !== "Palanote").length],
    ["Carnets tamponnés", e.plongees.filter((x) => x.tamponnee).length],
    ["Plongeurs différents", e.plongeurs.length],
    ["Dont adhérents du club", e.plongeurs.filter((x) => x.adherent).length],
    ["Dont membres privilégiés", e.plongeurs.filter((x) => x.privilegie).length],
    ["Sorties au Nitrox ou Trimix", e.sorties.filter((s) => s.melange === "Nitrox" || s.melange === "Trimix").length],
  ];

  const sorties = [
    entete(["Date", "Heure", "Site", "Lieu", "Bateau", "DP", "Statut", "Mélange", "Réservée privilégiés", "Prof. prévue (m)", "Durée (min)", "Temp. fond (°C)", "Visibilité (m)", "Plongeurs", "Palanquées", "Tampons", "Annulation / report"]),
    ...e.sorties.map((s) => [
      d(s.date), s.heure, s.site, s.lieu, s.bateau, s.dp, s.statut, s.melange, ouiNon(s.reservee),
      nombre(s.profondeur_prevue), nombre(s.duree), nombre(s.temperature), nombre(s.visibilite), s.plongeurs, s.palanquees, s.tampons, s.motif,
    ]),
  ];

  const plongees = [
    entete(["Date", "Site", "Prénom", "Nom", "Niveau", "Palanquée", "Rôle", "Profondeur (m)", "Durée (min)", "Tamponnée", "Source"]),
    ...e.plongees.map((x) => [
      d(x.date), x.site, x.plongeur, x.nom, x.niveau, x.palanquee === null ? null : typeof x.palanquee === "number" ? `P${x.palanquee}` : x.palanquee,
      x.role, nombre(x.profondeur), nombre(x.duree), ouiNon(x.tamponnee), x.source,
    ]),
  ];

  const plongeurs = [
    entete(["Prénom", "Nom", "Niveau", "Plongées", "Tampons", "Prof. max (m)", "Première", "Dernière", "Compte Palanote", "Adhérent", "Licence", "Fin du certificat", "Privilégié"]),
    ...e.plongeurs.map((x) => [
      x.prenom, x.nom, x.niveau, x.plongees, x.tampons, nombre(x.prof_max), d(x.premiere), d(x.derniere),
      ouiNon(x.compte), ouiNon(x.adherent), x.licence, x.certificat_fin ? d(x.certificat_fin) : null, ouiNon(x.privilegie),
    ]),
  ];

  const largeurs = (l: number[]) => l.map((width) => ({ width }));
  const nomFichier = `Palanote - ${e.centre} - ${p.libelle}.xlsx`.replace(/[\\/:*?"<>|]/g, "-");
  await writeXlsxFile(
    [
      { sheet: "Résumé", data: resume, columns: largeurs([34, 14]) },
      { sheet: "Sorties", data: sorties, columns: largeurs([12, 7, 26, 18, 14, 12, 13, 10, 11, 10, 9, 10, 10, 10, 10, 9, 30]), stickyRowsCount: 1 },
      { sheet: "Plongées", data: plongees, columns: largeurs([12, 26, 14, 16, 10, 10, 10, 12, 10, 10, 13]), stickyRowsCount: 1 },
      { sheet: "Plongeurs", data: plongeurs, columns: largeurs([14, 16, 10, 9, 9, 11, 12, 12, 10, 10, 12, 13, 10]), stickyRowsCount: 1 },
    ] as never,
    { fontFamily: "Arial", fontSize: 11 },
  ).toFile(nomFichier);
}
