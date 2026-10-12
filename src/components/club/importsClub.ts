import { ajouterNomsPrevus } from "@/lib/club";
import { importerAdherents, importerEquipe, importerHistorique, importerMateriel } from "@/lib/planning";
import { separerNomComplet, versRoleEquipe, versTypeMateriel, type Champ } from "@/lib/tableur";
import type { LigneImport } from "@/components/club/ImportTableur";

// Les imports Excel du club : colonnes reconnues, modèle à remplir, envoi vers la base.

const s = (v: string | number | null | undefined) => (v === null || v === undefined ? null : String(v));
const pluriel = (n: number, mot: string) => `${n} ${mot}${n > 1 ? "s" : ""}`;

const CHAMPS_PERSONNE: Champ[] = [
  { id: "prenom", libelle: "Prénom", synonymes: ["prenom", "prenoms", "first name", "firstname"] },
  { id: "nom", libelle: "Nom", synonymes: ["nom", "nom de famille", "last name", "lastname", "patronyme"] },
  { id: "nom_complet", libelle: "Nom complet", synonymes: ["nom complet", "nom et prenom", "nom prenom", "prenom nom", "identite", "plongeur", "adherent", "membre", "eleve"] },
  { id: "email", libelle: "E-mail", type: "email", synonymes: ["email", "e mail", "mail", "courriel", "adresse mail", "adresse email"] },
];

// Prénom et nom, même dans une seule colonne
function personne(l: LigneImport): LigneImport | string {
  let prenom = s(l["prenom"]);
  let nom = s(l["nom"]);
  const complet = s(l["nom_complet"]);
  if (!prenom && complet) ({ prenom, nom } = { ...separerNomComplet(complet), ...(nom ? { nom } : {}) });
  if (!prenom && nom && !l["prenom"]) ({ prenom, nom } = separerNomComplet(nom));
  if (!prenom && !l["email"]) return "prénom manquant";
  return { ...l, prenom, nom, nom_complet: null };
}

export const IMPORT_ADHERENTS = {
  titre: "Importer les adhérents",
  description: "Ta liste d'adhérents Excel : niveaux, licences, certificats médicaux. Un adhérent déjà connu (même e-mail, ou même prénom et nom) est mis à jour.",
  champs: [
    ...CHAMPS_PERSONNE,
    { id: "telephone", libelle: "Téléphone", synonymes: ["telephone", "tel", "portable", "mobile", "gsm", "numero de telephone"] },
    { id: "niveau", libelle: "Niveau", synonymes: ["niveau", "brevet", "level", "certification", "niveau ffessm", "niveau plongee"] },
    { id: "licence", libelle: "N° de licence", synonymes: ["licence", "n licence", "numero de licence", "no licence", "licence ffessm"] },
    { id: "certificat_fin", libelle: "Fin du certificat médical", type: "date", synonymes: ["certificat", "certificat medical", "caci", "cmnci", "fin certificat", "validite certificat", "date certificat"] },
    { id: "adhesion", libelle: "Date d'adhésion", type: "date", synonymes: ["adhesion", "date adhesion", "inscription", "date inscription", "membre depuis"] },
    { id: "note", libelle: "Note", synonymes: ["note", "notes", "remarque", "remarques", "commentaire", "commentaires", "observations"] },
  ] as Champ[],
  modele: {
    nom: "palanote-adherents.csv",
    lignes: [
      ["Prénom", "Nom", "E-mail", "Téléphone", "Niveau", "N° de licence", "Fin du certificat médical", "Date d'adhésion", "Note"],
      ["Léa", "Martin", "lea.martin@exemple.fr", "06 12 34 56 78", "N2", "A-12-345678", "15/03/2027", "01/09/2025", ""],
      ["Paul", "Durand", "paul.durand@exemple.fr", "", "N1", "", "02/11/2026", "", "Nitrox"],
    ],
  },
  transformer: personne,
  importer: async (centre: string, lignes: LigneImport[]) => {
    const r = await importerAdherents(centre, lignes);
    return `${pluriel(r.ajoutes, "adhérent")} ajouté${r.ajoutes > 1 ? "s" : ""}, ${pluriel(r.mis_a_jour, "fiche")} mise${r.mis_a_jour > 1 ? "s" : ""} à jour. Ceux qui ont déjà Palanote (même e-mail) sont reliés à leur compte.`;
  },
};

export const IMPORT_HISTORIQUE = {
  titre: "Importer l'historique des plongées",
  description: "Une ligne par plongée et par plongeur : date, site, profondeur, durée, palanquée. Les adhérents qui manquent sont créés. Quand ils arriveront sur Palanote, ils pourront ajouter ces plongées à leur carnet.",
  champs: [
    { id: "date", libelle: "Date", type: "date", requis: true, synonymes: ["date", "date plongee", "date de plongee", "jour", "date sortie"] },
    ...CHAMPS_PERSONNE,
    { id: "niveau", libelle: "Niveau", synonymes: ["niveau", "brevet", "level"] },
    { id: "heure", libelle: "Heure", type: "heure", synonymes: ["heure", "heure immersion", "heure de depart", "debut", "immersion"] },
    { id: "site", libelle: "Site", synonymes: ["site", "site de plongee", "spot", "lieu de plongee", "point de plongee"] },
    { id: "lieu", libelle: "Lieu", synonymes: ["lieu", "ville", "commune", "localite", "port", "region"] },
    { id: "profondeur", libelle: "Profondeur (m)", type: "nombre", synonymes: ["profondeur", "prof", "prof max", "profondeur max", "profondeur maxi", "depth"] },
    { id: "duree", libelle: "Durée (min)", type: "duree", synonymes: ["duree", "temps", "temps de plongee", "duree plongee", "duration", "minutes"] },
    { id: "palanquee", libelle: "Palanquée", synonymes: ["palanquee", "pal", "groupe", "n palanquee"] },
    { id: "role", libelle: "Rôle", synonymes: ["role", "fonction", "statut", "qualite"] },
    { id: "note", libelle: "Note", synonymes: ["note", "remarque", "commentaire", "observations"] },
  ] as Champ[],
  modele: {
    nom: "palanote-historique-plongees.csv",
    lignes: [
      ["Date", "Prénom", "Nom", "E-mail", "Niveau", "Heure", "Site", "Lieu", "Profondeur (m)", "Durée (min)", "Palanquée", "Rôle", "Note"],
      ["14/06/2026", "Léa", "Martin", "lea.martin@exemple.fr", "N2", "09:30", "La Gabinière", "Port-Cros", "24", "48", "P2", "Plongeur", "Mérous"],
      ["14/06/2026", "Paul", "Durand", "", "N1", "09:30", "La Gabinière", "Port-Cros", "18", "45", "P1", "Élève", ""],
    ],
  },
  transformer: (l: LigneImport) => {
    const r = personne(l);
    if (typeof r === "string") return r;
    if (typeof r["date"] === "string" && r["date"] > new Date().toISOString().slice(0, 10)) return "date dans le futur";
    return r;
  },
  importer: async (centre: string, lignes: LigneImport[]) => {
    let total = { plongees: 0, nouveaux_adherents: 0, doublons: 0, ignorees: 0 };
    for (let i = 0; i < lignes.length; i += 2000) {
      const r = await importerHistorique(centre, lignes.slice(i, i + 2000));
      total = {
        plongees: total.plongees + r.plongees,
        nouveaux_adherents: total.nouveaux_adherents + r.nouveaux_adherents,
        doublons: total.doublons + r.doublons,
        ignorees: total.ignorees + r.ignorees,
      };
    }
    return `${pluriel(total.plongees, "plongée")} importée${total.plongees > 1 ? "s" : ""}${total.nouveaux_adherents ? `, ${pluriel(total.nouveaux_adherents, "nouvel adhérent")}` : ""}${total.doublons ? ` (${total.doublons} déjà connue${total.doublons > 1 ? "s" : ""})` : ""}.`;
  },
};

export const IMPORT_EQUIPE = {
  titre: "Importer l'équipe",
  description: "Tes encadrants, pilotes et gonfleurs. Quelqu'un déjà dans l'équipe (même nom) est mis à jour.",
  champs: [
    { id: "nom", libelle: "Prénom et nom", requis: true, synonymes: ["nom", "nom complet", "prenom nom", "nom prenom", "encadrant", "moniteur", "identite", "personne"] },
    { id: "role", libelle: "Rôle", synonymes: ["role", "fonction", "poste", "qualite", "statut"] },
    { id: "niveau", libelle: "Niveau", synonymes: ["niveau", "brevet", "diplome", "qualification"] },
    { id: "telephone", libelle: "Téléphone", synonymes: ["telephone", "tel", "portable", "mobile", "gsm"] },
  ] as Champ[],
  modele: {
    nom: "palanote-equipe.csv",
    lignes: [
      ["Prénom et nom", "Rôle", "Niveau", "Téléphone"],
      ["Sophie Martin", "Guide de palanquée", "E2", "06 11 22 33 44"],
      ["Jo Lemoine", "Pilote", "Permis côtier", ""],
    ],
  },
  transformer: (l: LigneImport) => ({ ...l, role: versRoleEquipe(s(l["role"]) ?? s(l["niveau"])) }),
  importer: async (centre: string, lignes: LigneImport[]) => {
    const r = await importerEquipe(centre, lignes);
    return `${pluriel(r.ajoutes, "personne")} ajoutée${r.ajoutes > 1 ? "s" : ""}, ${pluriel(r.mis_a_jour, "fiche")} mise${r.mis_a_jour > 1 ? "s" : ""} à jour.`;
  },
};

export const IMPORT_MATERIEL = {
  titre: "Importer le matériel",
  description: "Ton inventaire : bateaux (places), blocs, gilets, détendeurs, combinaisons, avec la date du prochain contrôle.",
  champs: [
    { id: "libelle", libelle: "Désignation", requis: true, synonymes: ["designation", "libelle", "article", "materiel", "nom", "description", "equipement"] },
    { id: "type", libelle: "Type", synonymes: ["type", "categorie", "famille", "genre"] },
    { id: "quantite", libelle: "Quantité", type: "nombre", synonymes: ["quantite", "qte", "qt", "nombre", "nb", "stock"] },
    { id: "places", libelle: "Places (bateau)", type: "nombre", synonymes: ["places", "capacite", "passagers", "plongeurs a bord"] },
    { id: "controle", libelle: "Prochain contrôle", type: "date", synonymes: ["controle", "prochain controle", "revision", "tiv", "inspection", "requalification", "date controle", "echeance"] },
    { id: "note", libelle: "Note", synonymes: ["note", "remarque", "commentaire", "observations"] },
  ] as Champ[],
  modele: {
    nom: "palanote-materiel.csv",
    lignes: [
      ["Désignation", "Type", "Quantité", "Places (bateau)", "Prochain contrôle", "Note"],
      ["Le Poséidon", "Bateau", "1", "16", "01/03/2027", ""],
      ["Bloc 12 L", "Bloc", "20", "", "15/11/2026", "Requalification en mars"],
      ["Gilet taille M", "Gilet", "6", "", "", ""],
    ],
  },
  transformer: (l: LigneImport) => ({ ...l, type: versTypeMateriel(s(l["type"]) ?? s(l["libelle"])) }),
  importer: async (centre: string, lignes: LigneImport[]) => {
    const r = await importerMateriel(centre, lignes);
    return `${pluriel(r.ajoutes, "article")} ajouté${r.ajoutes > 1 ? "s" : ""}, ${pluriel(r.mis_a_jour, "article")} mis à jour.`;
  },
};

// Plongeurs d'une sortie : les prénoms rejoignent leur palanquée (en attente de leur scan du QR)
export const IMPORT_SORTIE = {
  titre: "Importer les plongeurs de la sortie",
  description: "La liste de la sortie, avec la palanquée de chacun. Chaque plongeur est rattaché à son compte quand il scanne le QR code.",
  champs: [...CHAMPS_PERSONNE.filter((c) => c.id !== "email"), { id: "palanquee", libelle: "Palanquée", synonymes: ["palanquee", "pal", "groupe", "n palanquee", "numero"] }] as Champ[],
  modele: {
    nom: "palanote-sortie.csv",
    lignes: [
      ["Prénom", "Nom", "Palanquée"],
      ["Léa", "Martin", "1"],
      ["Paul", "Durand", "1"],
      ["Sophie", "Bernard", "2"],
    ],
  },
  transformer: personne,
  importer: async (sortie: string, lignes: LigneImport[]) => {
    const groupes: string[][] = [];
    for (const l of lignes) {
      const n = Math.min(20, Math.max(1, Number(String(l["palanquee"] ?? "1").replace(/\D/g, "")) || 1));
      while (groupes.length < n) groupes.push([]);
      const nom = s(l["nom"]);
      groupes[n - 1]!.push(`${s(l["prenom"])}${nom ? ` ${nom.charAt(0).toUpperCase()}.` : ""}`);
    }
    const nb = await ajouterNomsPrevus(sortie, groupes);
    return `${pluriel(nb, "plongeur")} ajouté${nb > 1 ? "s" : ""} dans ${pluriel(groupes.filter((g) => g.length).length, "palanquée")}. Ils sont « en attente » jusqu'à leur scan du QR code.`;
  },
};
