import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { annoncerSurAccueil } from "@/lib/message-accueil";
import { MapPin, Crosshair, Plus, X, Star, Camera } from "lucide-react";
import {
  chargerPlongee,
  dureeEnMinutes,
  enregistrerPlongee,
  lirePlongees,
  minutesEnTexte,
  supprimerPlongee,
  VISIBILITE_DEPUIS_BASE,
  entier,
  nombre,
  sauverPlongee,
  texte,
  utilisateurConnecte,
  VISIBILITE_VERS_BASE,
  type LignePlongee,
} from "@/lib/plongees";

export const Route = createFileRoute("/nouvelle-plongee")({
  head: () => ({
    meta: [
      { title: "Palanote — Nouvelle plongée" },
      { name: "description", content: "Saisis une nouvelle plongée dans ton carnet." },
      { property: "og:title", content: "Palanote — Nouvelle plongée" },
      { property: "og:description", content: "Saisis une nouvelle plongée dans ton carnet." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  // ?id=… : ouvre une plongée existante en lecture (page détail), sinon nouvelle fiche.
  validateSearch: (search: Record<string, unknown>): { id?: string } =>
    typeof search["id"] === "string" && search["id"] ? { id: search["id"] } : {},
  component: NouvellePlongee,
});

const texteOuVide = (v: unknown) => (v === null || v === undefined ? "" : String(v));

// Ligne de la base → champs du formulaire.
function depuisLigne(l: LignePlongee): Plongee {
  return {
    ...plongeeVide,
    date: texteOuVide(l.dive_date),
    immersion: texteOuVide(l.start_time).slice(0, 5),
    siteNom: texteOuVide(l.site_name),
    siteLieu: texteOuVide(l.site_location),
    siteCoords: texteOuVide(l.site_coords),
    profMax: texteOuVide(l.max_depth_m),
    duree: minutesEnTexte(l.duration_min),
    profMoyenne: texteOuVide(l.avg_depth_m),
    sortie: texteOuVide(l.end_time).slice(0, 5),
    tempsTotal: texteOuVide(l.total_time_min),
    intervalleSurface: texteOuVide(l.surface_interval_min),
    paliers: (l.stops ?? []).map((x) => ({ profondeur: texteOuVide(x.profondeur), duree: texteOuVide(x.duree) })),
    methode: l.method ?? plongeeVide.methode,
    ordinateur: texteOuVide(l.computer),
    melange: l.gas_mix ?? plongeeVide.melange,
    o2: texteOuVide(l.o2_pct),
    he: texteOuVide(l.he_pct),
    configuration: l.tank_config ?? plongeeVide.configuration,
    volumeBloc: texteOuVide(l.tank_volume_l),
    lestage: texteOuVide(l.weight_kg),
    pressionDepart: texteOuVide(l.pressure_start_bar),
    pressionSortie: texteOuVide(l.pressure_end_bar),
    combinaison: l.suit_type ?? plongeeVide.combinaison,
    epaisseur: texteOuVide(l.suit_thickness_mm),
    tempSurface: texteOuVide(l.temp_surface_c),
    tempFond: texteOuVide(l.temp_bottom_c),
    tempAir: texteOuVide(l.temp_air_c),
    visibilite: texteOuVide(l.visibility_m),
    courant: l.current_strength ?? plongeeVide.courant,
    etatMer: texteOuVide(l.sea_state),
    meteo: texteOuVide(l.weather),
    binomes: l.buddies ?? [],
    encadrant: texteOuVide(l.guide_name),
    directeur: texteOuVide(l.dive_leader),
    club: texteOuVide(l.club_name),
    bateau: texteOuVide(l.boat_name),
    typePlongee: l.dive_type ?? plongeeVide.typePlongee,
    milieu: l.environment ?? plongeeVide.milieu,
    miseALEau: l.entry_type ?? plongeeVide.miseALEau,
    note: l.rating ?? 0,
    noteLieu: l.rating_place ?? 0,
    noteConditions: l.rating_conditions ?? 0,
    noteFaune: l.rating_wildlife ?? 0,
    commentaire: texteOuVide(l.comment),
    faune: l.wildlife ?? [],
    visibiliteFiche: VISIBILITE_DEPUIS_BASE[l.visibility] ?? plongeeVide.visibiliteFiche,
  };
}

type Palier = { profondeur: string; duree: string };

type Plongee = {
  date: string;
  immersion: string;
  siteNom: string;
  siteLieu: string;
  siteCoords: string;
  profMax: string;
  duree: string;
  profMoyenne: string;
  sortie: string;
  tempsTotal: string;
  intervalleSurface: string;
  paliers: Palier[];
  methode: string;
  ordinateur: string;
  melange: string;
  o2: string;
  he: string;
  configuration: string;
  volumeBloc: string;
  lestage: string;
  pressionDepart: string;
  pressionSortie: string;
  combinaison: string;
  epaisseur: string;
  tempSurface: string;
  tempFond: string;
  tempAir: string;
  visibilite: string;
  courant: string;
  etatMer: string;
  meteo: string;
  binomes: string[];
  encadrant: string;
  directeur: string;
  club: string;
  bateau: string;
  typePlongee: string;
  milieu: string;
  miseALEau: string;
  note: number;
  noteLieu: number;
  noteConditions: number;
  noteFaune: number;
  commentaire: string;
  faune: string[];
  visibiliteFiche: string;
};

const plongeeVide: Plongee = {
  date: "",
  immersion: "",
  siteNom: "",
  siteLieu: "",
  siteCoords: "",
  profMax: "",
  duree: "",
  profMoyenne: "",
  sortie: "",
  tempsTotal: "",
  intervalleSurface: "",
  paliers: [],
  methode: "Ordinateur",
  ordinateur: "",
  melange: "Air",
  o2: "21",
  he: "",
  configuration: "Mono",
  volumeBloc: "",
  lestage: "",
  pressionDepart: "",
  pressionSortie: "",
  combinaison: "Humide",
  epaisseur: "",
  tempSurface: "",
  tempFond: "",
  tempAir: "",
  visibilite: "",
  courant: "Nul",
  etatMer: "",
  meteo: "",
  binomes: [],
  encadrant: "",
  directeur: "",
  club: "",
  bateau: "",
  typePlongee: "Exploration",
  milieu: "Mer",
  miseALEau: "Bateau",
  note: 0,
  noteLieu: 0,
  noteConditions: 0,
  noteFaune: 0,
  commentaire: "",
  faune: [],
  visibiliteFiche: "Moi seul",
};

const NOTES_TEXTE = ["", "Décevant", "Moyen", "Bien", "Très bien", "Exceptionnel"];

function Section({ titre, children }: { titre: string; children: React.ReactNode }) {
  return (
    <>
      <div className="flex items-center gap-3 pb-[14px] pt-[28px]">
        <div className="text-[11.5px] font-bold tracking-[0.10em] text-[#0F3D70]">{titre}</div>
        <div className="h-[1.5px] flex-grow bg-[#E4EBF1]" />
      </div>
      <div className="flex flex-col gap-4">{children}</div>
    </>
  );
}

function Label({ children }: { children: React.ReactNode }) {
  return <div className="text-[12px] font-bold tracking-[0.06em] text-[#5B7189]">{children}</div>;
}

const HEURES_10_MIN = Array.from({ length: 144 }, (_, i) => {
  const h = String(Math.floor(i / 6)).padStart(2, "0");
  const m = String((i % 6) * 10).padStart(2, "0");
  return `${h}:${m}`;
});

const DUREES_10_MIN = Array.from({ length: 13 }, (_, i) => {
  const total = i * 10;
  const h = Math.floor(total / 60);
  const m = total % 60;
  if (h === 0) return `${m} min`;
  return m === 0 ? `${h} h` : `${h} h ${m}`;
});

function Champ({
  label,
  valeur,
  unite,
  placeholder,
  edition,
  onChange,
  type = "text",
  options,
}: {
  label: string;
  valeur: string;
  unite?: string;
  placeholder?: string;
  edition: boolean;
  onChange: (v: string) => void;
  type?: string;
  options?: string[];
}) {
  const choix = options && valeur && !options.includes(valeur) ? [valeur, ...options] : options;
  return (
    <div className="flex min-w-0 flex-grow basis-0 flex-col gap-[7px]">
      <Label>{label}</Label>
      <div className="flex min-h-[50px] items-center gap-1.5 rounded-[14px] border-[1.5px] border-[#E4EBF1] bg-white px-[15px]">
        {edition && choix ? (
          <select
            value={valeur}
            onChange={(e) => onChange(e.target.value)}
            className={`w-full min-w-0 cursor-pointer bg-transparent text-[14.5px] outline-none ${valeur ? "text-[#123A63]" : "text-[#9AAAB9]"}`}
          >
            <option value="">{placeholder ?? "—"}</option>
            {choix.map((opt) => (
              <option key={opt} value={opt} className="text-[#123A63]">
                {opt}
              </option>
            ))}
          </select>
        ) : edition ? (
          <input
            type={type}
            value={valeur}
            placeholder={placeholder ?? "—"}
            onChange={(e) => onChange(e.target.value)}
            className="w-full min-w-0 bg-transparent text-[14.5px] text-[#123A63] outline-none placeholder:text-[#9AAAB9]"
          />
        ) : (
          <span className={`text-[14.5px] ${valeur ? "text-[#123A63]" : "text-[#9AAAB9]"}`}>
            {valeur || "—"}
          </span>
        )}
        {unite && <span className="shrink-0 text-[13px] text-[#9DB0C0]">{unite}</span>}
      </div>
    </div>
  );
}

function Puces({
  label,
  options,
  valeur,
  edition,
  onChange,
}: {
  label: string;
  options: string[];
  valeur: string;
  edition: boolean;
  onChange: (v: string) => void;
}) {
  return (
    <div className="flex flex-col gap-[9px]">
      <Label>{label}</Label>
      <div className="flex flex-wrap gap-2">
        {options.map((opt) => {
          const actif = opt === valeur;
          if (!edition && !actif) return null;
          return (
            <button
              key={opt}
              type="button"
              disabled={!edition}
              onClick={() => onChange(opt)}
              className={`h-9 rounded-full px-4 text-[13.5px] font-semibold ${
                actif
                  ? "bg-[#3DEFBE] text-[#0F3D70]"
                  : "border-[1.5px] border-[#E4EBF1] bg-white text-[#5B7189]"
              }`}
            >
              {opt}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function Etoiles({
  valeur,
  edition,
  onChange,
  taille = 36,
}: {
  valeur: number;
  edition: boolean;
  onChange: (v: number) => void;
  taille?: number;
}) {
  return (
    <div className="flex gap-[2px]">
      {[1, 2, 3, 4, 5].map((n) => (
        <button
          key={n}
          type="button"
          disabled={!edition}
          onClick={() => onChange(n === valeur ? 0 : n)}
          aria-label={`${n} étoile${n > 1 ? "s" : ""}`}
        >
          <Star
            style={{ width: taille, height: taille }}
            className={n <= valeur ? "fill-[#FFC65C] text-[#FFC65C]" : "fill-transparent text-[#FFC65C]/55"}
            strokeWidth={1.8}
          />
        </button>
      ))}
    </div>
  );
}

function initiales(nom: string) {
  return nom
    .split(/\s+/)
    .map((m) => m[0] ?? "")
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

const COULEURS_BINOMES = [
  { fond: "#3DEFBE", texte: "#0F3D70" },
  { fond: "#FF8A75", texte: "#6B1F14" },
  { fond: "#57D4F5", texte: "#0F3D70" },
  { fond: "#FFC65C", texte: "#6B4A14" },
];

function NouvellePlongee() {
  const navigate = useNavigate();
  const { id: idExistant } = Route.useSearch();
  const existante = Boolean(idExistant);
  const [plongee, setPlongee] = useState<Plongee>(plongeeVide);
  const [edition, setEdition] = useState(!existante);
  const [chargement, setChargement] = useState(existante);
  const original = useRef<Plongee>(plongeeVide);
  const [photos, setPhotos] = useState<string[]>([]);
  const [ajoutBinome, setAjoutBinome] = useState(false);
  const [nomBinome, setNomBinome] = useState("");
  const [ajoutFaune, setAjoutFaune] = useState(false);
  const [nomFaune, setNomFaune] = useState("");
  const [ajoutPalier, setAjoutPalier] = useState(false);
  const [palierProf, setPalierProf] = useState("");
  const [palierDuree, setPalierDuree] = useState("");
  const fichierPhotos = useRef<HTMLInputElement>(null);

  const set = <K extends keyof Plongee>(cle: K, valeur: Plongee[K]) =>
    setPlongee((p) => ({ ...p, [cle]: valeur }));

  const [idPlongee] = useState(() => idExistant ?? crypto.randomUUID());

  // Page détail : charge la plongée enregistrée.
  useEffect(() => {
    if (!idExistant) return;
    let actif = true;
    (async () => {
      try {
        let fiche: Plongee | null = null;
        if (await utilisateurConnecte()) {
          const ligne = await chargerPlongee(idExistant);
          if (ligne) fiche = depuisLigne(ligne);
        } else {
          const c = lirePlongees().find((x) => x.id === idExistant);
          if (c)
            fiche = {
              ...plongeeVide,
              date: c.date,
              siteNom: c.siteNom,
              siteLieu: c.siteLieu,
              profMax: c.profMax,
              duree: minutesEnTexte(c.duree),
              tempFond: c.tempFond,
              melange: c.melange || plongeeVide.melange,
              note: c.note,
              binomes: c.binomes,
              typePlongee: c.type || plongeeVide.typePlongee,
            };
        }
        if (!actif) return;
        if (fiche) {
          original.current = fiche;
          setPlongee(fiche);
        } else {
          setMessage({ type: "erreur", texte: "Cette plongée est introuvable." });
        }
      } catch (e) {
        console.error(e);
        if (actif) setMessage({ type: "erreur", texte: "La plongée n'a pas pu être chargée." });
      } finally {
        if (actif) setChargement(false);
      }
    })();
    return () => {
      actif = false;
    };
  }, [idExistant]);
  const [enCours, setEnCours] = useState(false);
  const [confirmerSuppression, setConfirmerSuppression] = useState(false);
  const [suppressionEnCours, setSuppressionEnCours] = useState(false);
  const supprimer = async () => {
    setSuppressionEnCours(true);
    try {
      await supprimerPlongee(idPlongee);
      annoncerSurAccueil("Ta plongée a bien été supprimée");
      navigate({ to: "/carnet" });
    } catch (e) {
      console.error(e);
      setConfirmerSuppression(false);
      setMessage({
        type: "erreur",
        texte: `La plongée n'a pas pu être supprimée.${e && typeof e === "object" && "message" in e ? ` (détail : ${String(e.message)})` : ""}`,
      });
    } finally {
      setSuppressionEnCours(false);
    }
  };
  const [message, setMessage] = useState<{ type: "erreur" | "info"; texte: string } | null>(null);

  const versLigne = (p: Plongee): LignePlongee => ({
    id: idPlongee,
    dive_date: texte(p.date),
    start_time: texte(p.immersion),
    site_name: texte(p.siteNom),
    site_location: texte(p.siteLieu),
    site_coords: texte(p.siteCoords),
    max_depth_m: nombre(p.profMax),
    avg_depth_m: nombre(p.profMoyenne),
    duration_min: dureeEnMinutes(p.duree),
    end_time: texte(p.sortie),
    total_time_min: entier(p.tempsTotal),
    surface_interval_min: entier(p.intervalleSurface),
    stops: p.paliers.map((x) => ({ profondeur: nombre(x.profondeur), duree: entier(x.duree) })),
    method: texte(p.methode),
    computer: texte(p.ordinateur),
    gas_mix: texte(p.melange),
    o2_pct: entier(p.o2),
    he_pct: entier(p.he),
    tank_config: texte(p.configuration),
    tank_volume_l: nombre(p.volumeBloc),
    weight_kg: nombre(p.lestage),
    pressure_start_bar: entier(p.pressionDepart),
    pressure_end_bar: entier(p.pressionSortie),
    suit_type: texte(p.combinaison),
    suit_thickness_mm: entier(p.epaisseur),
    temp_surface_c: nombre(p.tempSurface),
    temp_bottom_c: nombre(p.tempFond),
    temp_air_c: nombre(p.tempAir),
    visibility_m: entier(p.visibilite),
    current_strength: texte(p.courant),
    sea_state: texte(p.etatMer),
    weather: texte(p.meteo),
    buddies: p.binomes,
    guide_name: texte(p.encadrant),
    dive_leader: texte(p.directeur),
    club_name: texte(p.club),
    boat_name: texte(p.bateau),
    dive_type: texte(p.typePlongee),
    environment: texte(p.milieu),
    entry_type: texte(p.miseALEau),
    rating: p.note || null,
    rating_place: p.noteLieu || null,
    rating_conditions: p.noteConditions || null,
    rating_wildlife: p.noteFaune || null,
    comment: texte(p.commentaire),
    wildlife: p.faune,
    visibility: VISIBILITE_VERS_BASE[p.visibiliteFiche] ?? "private",
  });

  const enregistrer = async () => {
    if (enCours) return;
    setEnCours(true);
    setMessage(null);
    try {
      if (await utilisateurConnecte()) {
        await sauverPlongee(versLigne(plongee));
      } else {
        // Mode maquette : pas de compte connecté, la plongée reste sur cet appareil.
        enregistrerPlongee({
          id: idPlongee,
          date: plongee.date,
          siteNom: plongee.siteNom,
          siteLieu: plongee.siteLieu,
          profMax: plongee.profMax,
          duree: String(dureeEnMinutes(plongee.duree) ?? ""),
          tempFond: plongee.tempFond,
          melange: plongee.melange,
          note: plongee.note,
          binomes: plongee.binomes,
          type: plongee.typePlongee,
          photo: photos[0],
        });
      }
      // Enregistrée : retour automatique à l'écran d'accueil, avec un bandeau de confirmation.
      annoncerSurAccueil(existante ? "Ta plongée a bien été mise à jour" : "Ta plongée a bien été enregistrée");
      navigate({ to: "/carnet" });
    } catch (e) {
      console.error(e);
      setMessage({
        type: "erreur",
        texte: `La plongée n'a pas pu être enregistrée. Vérifie ta connexion et réessaie.${
          e && typeof e === "object" && "message" in e && e.message ? ` (détail : ${String(e.message)})` : ""
        }`,
      });
    } finally {
      setEnCours(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#F5F9FC]">
      <div className="mx-auto flex min-h-screen w-full max-w-[430px] flex-col">
        {/* Barre du haut */}
        <div className="sticky top-0 z-10 flex items-center justify-between border-b-[1.5px] border-[#E4EBF1] bg-[#F5F9FC]/95 px-[22px] py-4">
          <button
            type="button"
            onClick={() => {
              // Plongée existante en cours de modification : on annule les changements.
              if (existante && edition) {
                setPlongee(original.current);
                setEdition(false);
                setMessage(null);
              } else navigate({ to: "/carnet" });
            }}
            className="text-[14.5px] font-medium text-[#5B7189]"
          >
            {edition ? "Annuler" : "Retour"}
          </button>
          <div className="text-[16px] font-bold text-[#123A63]">{existante ? "Ma plongée" : "Nouvelle plongée"}</div>
          <button
            type="button"
            onClick={() => (edition ? void enregistrer() : setEdition(true))}
            disabled={enCours || chargement}
            className="text-[14.5px] font-bold text-[#1176A8] disabled:opacity-50"
          >
            {edition ? (enCours ? "Enregistrement…" : "Enregistrer") : "Modifier"}
          </button>
        </div>

        {message && (
          <div
            role={message.type === "erreur" ? "alert" : "status"}
            className={`mx-[22px] mt-4 rounded-[14px] px-[15px] py-3 text-[13.5px] font-medium ${
              message.type === "erreur" ? "bg-[#FFE4DE] text-[#8A2A1A]" : "bg-[#E1F3FB] text-[#0F3D70]"
            }`}
          >
            {message.texte}
          </div>
        )}

        <div className="px-[22px] pb-[30px]">
          {/* ESSENTIEL */}
          <Section titre="ESSENTIEL">
            <div className="flex gap-3">
              <Champ label="Date" valeur={plongee.date} placeholder="14/07/2026" edition={edition} onChange={(v) => set("date", v)} type="date" />
              <Champ label="Heure de la plongée" valeur={plongee.immersion} placeholder="Heure" edition={edition} onChange={(v) => set("immersion", v)} options={HEURES_10_MIN} />
            </div>

            <div className="flex flex-col gap-[7px]">
              <Label>Site</Label>
              <div className="overflow-hidden rounded-[14px] border-[1.5px] border-[#57D4F5]/75 bg-white">
                <div className="flex gap-[13px] p-[14px]">
                  <div className="relative h-[82px] w-[82px] shrink-0 overflow-hidden rounded-[14px] bg-gradient-to-br from-[#BFEBFA] via-[#7FD3F0] to-[#2E9FCB]">
                    <div className="absolute inset-0 flex items-center justify-center">
                      <div className="flex h-[30px] w-[30px] items-center justify-center rounded-full border-[2.5px] border-white bg-[#FF8A75] shadow-md">
                        <MapPin className="h-3.5 w-3.5 text-white" strokeWidth={2.6} aria-hidden="true" />
                      </div>
                    </div>
                  </div>
                  <div className="flex min-w-0 flex-grow flex-col justify-center gap-1">
                    {edition ? (
                      <>
                        <input
                          value={plongee.siteNom}
                          placeholder="Nom du site"
                          onChange={(e) => set("siteNom", e.target.value)}
                          className="w-full min-w-0 bg-transparent text-[17.5px] font-bold leading-tight text-[#123A63] outline-none placeholder:font-normal placeholder:text-[#9AAAB9]"
                        />
                        <input
                          value={plongee.siteLieu}
                          placeholder="Ville, pays"
                          onChange={(e) => set("siteLieu", e.target.value)}
                          className="w-full min-w-0 bg-transparent text-[13px] text-[#5B7189] outline-none placeholder:text-[#9AAAB9]"
                        />
                      </>
                    ) : (
                      <>
                        <div className={`text-[17.5px] font-bold leading-tight ${plongee.siteNom ? "text-[#123A63]" : "text-[#9AAAB9]"}`}>
                          {plongee.siteNom || "—"}
                        </div>
                        <div className="text-[13px] text-[#5B7189]">{plongee.siteLieu || "—"}</div>
                      </>
                    )}
                    {plongee.siteCoords && (
                      <div className="flex items-center gap-1.5 pt-[2px]">
                        <div className="h-1.5 w-1.5 rounded-full bg-[#3DEFBE]" />
                        <div className="text-[11.5px] text-[#9DB0C0]">{plongee.siteCoords}</div>
                      </div>
                    )}
                  </div>
                </div>
                {edition && (
                  <div className="flex border-t-[1.5px] border-[#EDF2F7]">
                    <button type="button" className="flex h-[50px] flex-grow items-center justify-center gap-2 text-[13.5px] font-bold text-[#1176A8]">
                      <MapPin className="h-[17px] w-[17px]" strokeWidth={2.1} aria-hidden="true" />
                      Changer le site
                    </button>
                    <div className="w-[1.5px] bg-[#EDF2F7]" />
                    <button type="button" className="flex h-[50px] flex-grow items-center justify-center gap-2 text-[13.5px] font-bold text-[#1176A8]">
                      <Crosshair className="h-[17px] w-[17px]" strokeWidth={2.1} aria-hidden="true" />
                      Ajuster la position
                    </button>
                  </div>
                )}
              </div>
            </div>

            <div className="flex gap-3">
              <Champ label="Profondeur max" valeur={plongee.profMax} unite="m" edition={edition} onChange={(v) => set("profMax", v)} type="number" />
              <Champ label="Durée" valeur={plongee.duree} placeholder="Durée" edition={edition} onChange={(v) => set("duree", v)} options={DUREES_10_MIN} />
            </div>
          </Section>

          {/* PROFIL */}
          <Section titre="PROFIL">
            <div className="flex gap-3">
              <Champ label="Profondeur moyenne" valeur={plongee.profMoyenne} unite="m" edition={edition} onChange={(v) => set("profMoyenne", v)} type="number" />
              <Champ label="Sortie" valeur={plongee.sortie} placeholder="11:17" edition={edition} onChange={(v) => set("sortie", v)} type="time" />
            </div>
            <div className="flex gap-3">
              <Champ label="Temps total" valeur={plongee.tempsTotal} unite="min" edition={edition} onChange={(v) => set("tempsTotal", v)} type="number" />
              <Champ label="Intervalle surface" valeur={plongee.intervalleSurface} unite="min" edition={edition} onChange={(v) => set("intervalleSurface", v)} type="number" />
            </div>

            <div className="flex flex-col gap-[7px]">
              <Label>Paliers</Label>
              <div className="flex flex-col gap-[10px] rounded-[14px] border-[1.5px] border-[#E4EBF1] bg-white px-[14px] py-3">
                {plongee.paliers.length === 0 && !edition && (
                  <div className="text-[14.5px] text-[#9AAAB9]">—</div>
                )}
                {plongee.paliers.map((p, i) => (
                  <div key={i}>
                    {i > 0 && <div className="mb-[10px] h-[1.5px] bg-[#EDF2F7]" />}
                    <div className="flex items-center">
                      <div className="flex-grow text-[14.5px] text-[#123A63]">
                        {p.profondeur} m — {p.duree} min
                      </div>
                      {edition && (
                        <button
                          type="button"
                          aria-label="Retirer ce palier"
                          onClick={() => set("paliers", plongee.paliers.filter((_, j) => j !== i))}
                        >
                          <X className="h-4 w-4 text-[#9DB0C0]" strokeWidth={2.2} aria-hidden="true" />
                        </button>
                      )}
                    </div>
                  </div>
                ))}
                {edition && !ajoutPalier && (
                  <>
                    {plongee.paliers.length > 0 && <div className="h-[1.5px] bg-[#EDF2F7]" />}
                    <button
                      type="button"
                      onClick={() => setAjoutPalier(true)}
                      className="flex items-center gap-2 text-[#1176A8]"
                    >
                      <Plus className="h-[15px] w-[15px]" strokeWidth={2.6} aria-hidden="true" />
                      <span className="text-[14.5px] font-semibold">Ajouter un palier</span>
                    </button>
                  </>
                )}
                {edition && ajoutPalier && (
                  <div className="flex items-center gap-2">
                    <input
                      value={palierProf}
                      onChange={(e) => setPalierProf(e.target.value)}
                      placeholder="m"
                      type="number"
                      className="w-16 rounded-lg border-[1.5px] border-[#E4EBF1] px-2 py-1.5 text-[14px] outline-none"
                    />
                    <input
                      value={palierDuree}
                      onChange={(e) => setPalierDuree(e.target.value)}
                      placeholder="min"
                      type="number"
                      className="w-16 rounded-lg border-[1.5px] border-[#E4EBF1] px-2 py-1.5 text-[14px] outline-none"
                    />
                    <button
                      type="button"
                      onClick={() => {
                        if (palierProf && palierDuree) {
                          set("paliers", [...plongee.paliers, { profondeur: palierProf, duree: palierDuree }]);
                          setPalierProf("");
                          setPalierDuree("");
                          setAjoutPalier(false);
                        }
                      }}
                      className="rounded-lg bg-[#3DEFBE] px-3 py-1.5 text-[13px] font-bold text-[#0F3D70]"
                    >
                      OK
                    </button>
                    <button type="button" onClick={() => setAjoutPalier(false)} aria-label="Annuler">
                      <X className="h-4 w-4 text-[#9DB0C0]" aria-hidden="true" />
                    </button>
                  </div>
                )}
              </div>
            </div>

            <Puces label="Méthode" options={["Ordinateur", "Table MN90", "Autre"]} valeur={plongee.methode} edition={edition} onChange={(v) => set("methode", v)} />
            <div className="flex gap-3">
              <Champ label="Ordinateur" valeur={plongee.ordinateur} placeholder="Suunto Zoop Novo" edition={edition} onChange={(v) => set("ordinateur", v)} />
            </div>
          </Section>

          {/* GAZ ET ÉQUIPEMENT */}
          <Section titre="GAZ ET ÉQUIPEMENT">
            <Puces label="Mélange" options={["Air", "Nitrox", "Trimix"]} valeur={plongee.melange} edition={edition} onChange={(v) => set("melange", v)} />
            <div className="flex gap-3">
              <Champ label="% O₂" valeur={plongee.o2} unite="%" edition={edition} onChange={(v) => set("o2", v)} type="number" />
              <Champ label="% He" valeur={plongee.he} unite="%" edition={edition} onChange={(v) => set("he", v)} type="number" />
            </div>
            <Puces label="Configuration" options={["Mono", "Bi", "Sidemount"]} valeur={plongee.configuration} edition={edition} onChange={(v) => set("configuration", v)} />
            <div className="flex gap-3">
              <Champ label="Volume bloc" valeur={plongee.volumeBloc} unite="L" edition={edition} onChange={(v) => set("volumeBloc", v)} type="number" />
              <Champ label="Lestage" valeur={plongee.lestage} unite="kg" edition={edition} onChange={(v) => set("lestage", v)} type="number" />
            </div>
            <div className="flex gap-3">
              <Champ label="Pression départ" valeur={plongee.pressionDepart} unite="bar" edition={edition} onChange={(v) => set("pressionDepart", v)} type="number" />
              <Champ label="Pression sortie" valeur={plongee.pressionSortie} unite="bar" edition={edition} onChange={(v) => set("pressionSortie", v)} type="number" />
            </div>
            <Puces label="Combinaison" options={["Shorty", "Humide", "Semi-étanche", "Étanche"]} valeur={plongee.combinaison} edition={edition} onChange={(v) => set("combinaison", v)} />
            <div className="flex gap-3">
              <Champ label="Épaisseur" valeur={plongee.epaisseur} unite="mm" edition={edition} onChange={(v) => set("epaisseur", v)} type="number" />
            </div>
          </Section>

          {/* CONDITIONS */}
          <Section titre="CONDITIONS">
            <div className="flex gap-3">
              <Champ label="T° surface" valeur={plongee.tempSurface} unite="°C" edition={edition} onChange={(v) => set("tempSurface", v)} type="number" />
              <Champ label="T° fond" valeur={plongee.tempFond} unite="°C" edition={edition} onChange={(v) => set("tempFond", v)} type="number" />
            </div>
            <div className="flex gap-3">
              <Champ label="T° air" valeur={plongee.tempAir} unite="°C" edition={edition} onChange={(v) => set("tempAir", v)} type="number" />
              <Champ label="Visibilité" valeur={plongee.visibilite} unite="m" edition={edition} onChange={(v) => set("visibilite", v)} type="number" />
            </div>
            <Puces label="Courant" options={["Nul", "Faible", "Modéré", "Fort"]} valeur={plongee.courant} edition={edition} onChange={(v) => set("courant", v)} />
            <div className="flex gap-3">
              <Champ label="État de la mer" valeur={plongee.etatMer} placeholder="Belle (2)" edition={edition} onChange={(v) => set("etatMer", v)} />
              <Champ label="Météo" valeur={plongee.meteo} placeholder="Ensoleillé" edition={edition} onChange={(v) => set("meteo", v)} />
            </div>
          </Section>

          {/* PALANQUÉE */}
          <Section titre="PALANQUÉE">
            <div className="flex flex-col gap-[9px]">
              <Label>Binômes</Label>
              <div className="flex flex-wrap gap-2">
                {plongee.binomes.map((b, i) => {
                  const c = COULEURS_BINOMES[i % COULEURS_BINOMES.length] ?? COULEURS_BINOMES[0]!;
                  return (
                    <div
                      key={b + i}
                      className="flex h-10 items-center gap-2 rounded-full py-0 pl-1 pr-[13px]"
                      style={{ background: c.fond }}
                    >
                      <div
                        className="flex h-8 w-8 items-center justify-center rounded-full bg-white/70 text-[11px] font-bold"
                        style={{ color: c.texte }}
                      >
                        {initiales(b)}
                      </div>
                      <span className="text-[13.5px] font-bold" style={{ color: c.texte }}>
                        {b}
                      </span>
                      {edition && (
                        <button
                          type="button"
                          aria-label={`Retirer ${b}`}
                          onClick={() => set("binomes", plongee.binomes.filter((_, j) => j !== i))}
                        >
                          <X className="h-3.5 w-3.5" style={{ color: c.texte }} aria-hidden="true" />
                        </button>
                      )}
                    </div>
                  );
                })}
                {edition && !ajoutBinome && (
                  <button
                    type="button"
                    onClick={() => setAjoutBinome(true)}
                    className="flex h-10 items-center gap-1.5 rounded-full border-[1.5px] border-dashed border-[#9DB0C0] bg-white px-[15px]"
                  >
                    <Plus className="h-3.5 w-3.5 text-[#1176A8]" strokeWidth={2.6} aria-hidden="true" />
                    <span className="text-[13.5px] font-semibold text-[#1176A8]">Ajouter</span>
                  </button>
                )}
                {edition && ajoutBinome && (
                  <div className="flex h-10 items-center gap-2 rounded-full border-[1.5px] border-[#E4EBF1] bg-white px-3">
                    <input
                      value={nomBinome}
                      onChange={(e) => setNomBinome(e.target.value)}
                      placeholder="Prénom N."
                      autoFocus
                      className="w-28 bg-transparent text-[13.5px] outline-none"
                      onKeyDown={(e) => {
                        if (e.key === "Enter" && nomBinome.trim()) {
                          set("binomes", [...plongee.binomes, nomBinome.trim()]);
                          setNomBinome("");
                          setAjoutBinome(false);
                        }
                      }}
                    />
                    <button
                      type="button"
                      onClick={() => {
                        if (nomBinome.trim()) {
                          set("binomes", [...plongee.binomes, nomBinome.trim()]);
                          setNomBinome("");
                          setAjoutBinome(false);
                        }
                      }}
                      className="text-[13px] font-bold text-[#1176A8]"
                    >
                      OK
                    </button>
                  </div>
                )}
              </div>
              {edition && (
                <div className="text-[11.5px] text-[#9DB0C0]">Chacun recevra sa fiche pré-remplie.</div>
              )}
            </div>
            <div className="flex gap-3">
              <Champ label="Encadrant / guide" valeur={plongee.encadrant} placeholder="Nom" edition={edition} onChange={(v) => set("encadrant", v)} />
              <Champ label="Directeur de plongée" valeur={plongee.directeur} placeholder="Nom" edition={edition} onChange={(v) => set("directeur", v)} />
            </div>
            <div className="flex gap-3">
              <Champ label="Club / centre" valeur={plongee.club} placeholder="Nom" edition={edition} onChange={(v) => set("club", v)} />
              <Champ label="Bateau" valeur={plongee.bateau} placeholder="Nom" edition={edition} onChange={(v) => set("bateau", v)} />
            </div>
          </Section>

          {/* CONTEXTE */}
          <Section titre="CONTEXTE">
            <Puces label="Type de plongée" options={["Exploration", "Formation", "Épave", "Nuit", "Dérivante", "Grotte", "Technique"]} valeur={plongee.typePlongee} edition={edition} onChange={(v) => set("typePlongee", v)} />
            <Puces label="Milieu" options={["Mer", "Lac", "Carrière", "Rivière", "Fosse"]} valeur={plongee.milieu} edition={edition} onChange={(v) => set("milieu", v)} />
            <Puces label="Mise à l'eau" options={["Bateau", "Du bord"]} valeur={plongee.miseALEau} edition={edition} onChange={(v) => set("miseALEau", v)} />
          </Section>

          {/* RESSENTI */}
          <Section titre="RESSENTI">
            <div className="flex flex-col gap-3">
              <Label>Ta note</Label>
              <div className="flex items-center gap-[14px]">
                <Etoiles valeur={plongee.note} edition={edition} onChange={(v) => set("note", v)} />
                {plongee.note > 0 && (
                  <div className="text-[14px] font-semibold text-[#5B7189]">{NOTES_TEXTE[plongee.note]}</div>
                )}
              </div>

              <div className="rounded-2xl border-[1.5px] border-[#E4EBF1] bg-white px-[15px] py-1">
                <div className="pb-1 pt-3 text-[12px] font-bold tracking-[0.06em] text-[#9DB0C0]">
                  LE DÉTAIL — FACULTATIF
                </div>
                <div className="h-[1.5px] bg-[#EDF2F7]" />
                {(
                  [
                    ["Le lieu", "noteLieu"],
                    ["Les conditions", "noteConditions"],
                    ["La faune", "noteFaune"],
                  ] as const
                ).map(([titre, cle], i) => (
                  <div key={cle}>
                    {i > 0 && <div className="h-[1.5px] bg-[#EDF2F7]" />}
                    <div className="flex items-center justify-between gap-3 py-[11px]">
                      <div className="text-[14px] text-[#123A63]">{titre}</div>
                      <Etoiles valeur={plongee[cle]} edition={edition} onChange={(v) => set(cle, v)} taille={22} />
                    </div>
                  </div>
                ))}
                <div className="pb-[13px] pt-1 text-[11.5px] leading-snug text-[#9DB0C0]">
                  Ces trois notes ne changent pas ta note globale. Elles alimentent la fiche du site et la saisonnalité.
                </div>
              </div>
            </div>

            <div className="flex flex-col gap-[7px]">
              <Label>Commentaire</Label>
              {edition ? (
                <textarea
                  value={plongee.commentaire}
                  onChange={(e) => set("commentaire", e.target.value)}
                  placeholder="Ce que tu as vu, ce que tu retiens…"
                  rows={4}
                  className="min-h-[100px] w-full resize-y rounded-[14px] border-[1.5px] border-[#E4EBF1] bg-white px-[15px] py-[14px] text-[14.5px] leading-relaxed text-[#123A63] outline-none placeholder:text-[#9AAAB9]"
                />
              ) : (
                <div className="min-h-[100px] rounded-[14px] border-[1.5px] border-[#E4EBF1] bg-white px-[15px] py-[14px] text-[14.5px] leading-relaxed text-[#123A63]">
                  {plongee.commentaire || <span className="text-[#9AAAB9]">—</span>}
                </div>
              )}
            </div>

            <div className="flex flex-col gap-[9px]">
              <Label>Faune observée</Label>
              <div className="flex flex-wrap gap-2">
                {plongee.faune.map((f, i) => (
                  <div
                    key={f + i}
                    className="flex h-9 items-center gap-1.5 rounded-full bg-[#FF8A75] px-[14px] text-[13px] font-semibold text-[#6B1F14]"
                  >
                    {f}
                    {edition && (
                      <button
                        type="button"
                        aria-label={`Retirer ${f}`}
                        onClick={() => set("faune", plongee.faune.filter((_, j) => j !== i))}
                      >
                        <X className="h-3.5 w-3.5" aria-hidden="true" />
                      </button>
                    )}
                  </div>
                ))}
                {edition && !ajoutFaune && (
                  <button
                    type="button"
                    onClick={() => setAjoutFaune(true)}
                    className="flex h-9 items-center gap-1.5 rounded-full border-[1.5px] border-dashed border-[#9DB0C0] bg-white px-[14px] text-[13px] font-semibold text-[#1176A8]"
                  >
                    <Plus className="h-3.5 w-3.5" strokeWidth={2.6} aria-hidden="true" />
                    Ajouter
                  </button>
                )}
                {edition && ajoutFaune && (
                  <div className="flex h-9 items-center gap-2 rounded-full border-[1.5px] border-[#E4EBF1] bg-white px-3">
                    <input
                      value={nomFaune}
                      onChange={(e) => setNomFaune(e.target.value)}
                      placeholder="Espèce"
                      autoFocus
                      className="w-24 bg-transparent text-[13px] outline-none"
                      onKeyDown={(e) => {
                        if (e.key === "Enter" && nomFaune.trim()) {
                          set("faune", [...plongee.faune, nomFaune.trim()]);
                          setNomFaune("");
                          setAjoutFaune(false);
                        }
                      }}
                    />
                    <button
                      type="button"
                      onClick={() => {
                        if (nomFaune.trim()) {
                          set("faune", [...plongee.faune, nomFaune.trim()]);
                          setNomFaune("");
                          setAjoutFaune(false);
                        }
                      }}
                      className="text-[13px] font-bold text-[#1176A8]"
                    >
                      OK
                    </button>
                  </div>
                )}
              </div>
            </div>
          </Section>

          {/* PHOTOS */}
          <Section titre="PHOTOS">
            <div className="grid grid-cols-4 gap-2">
              {photos.map((src, i) => (
                <div key={i} className="relative h-[82px] overflow-hidden rounded-[14px]">
                  <img src={src} alt={`Photo ${i + 1}`} className="h-full w-full object-cover" />
                  {edition && (
                    <button
                      type="button"
                      aria-label="Retirer cette photo"
                      onClick={() => setPhotos(photos.filter((_, j) => j !== i))}
                      className="absolute right-1 top-1 flex h-5 w-5 items-center justify-center rounded-full bg-black/50"
                    >
                      <X className="h-3 w-3 text-white" aria-hidden="true" />
                    </button>
                  )}
                </div>
              ))}
              {edition && (
                <button
                  type="button"
                  onClick={() => fichierPhotos.current?.click()}
                  aria-label="Ajouter une photo"
                  className="flex h-[82px] items-center justify-center rounded-[14px] border-[1.5px] border-dashed border-[#FF8A75] bg-white"
                >
                  <Camera className="h-5 w-5 text-[#FF8A75]" strokeWidth={2} aria-hidden="true" />
                </button>
              )}
              {photos.length === 0 && !edition && (
                <div className="col-span-4 text-[14.5px] text-[#9AAAB9]">—</div>
              )}
            </div>
            <input
              ref={fichierPhotos}
              type="file"
              accept="image/*"
              multiple
              className="hidden"
              onChange={(e) => {
                const fichiers = Array.from(e.target.files ?? []);
                setPhotos((p) => [...p, ...fichiers.map((f) => URL.createObjectURL(f))]);
                e.target.value = "";
              }}
            />
          </Section>

          {/* QUI PEUT LA VOIR */}
          <Section titre="QUI PEUT LA VOIR">
            <Puces label="" options={["Moi seul", "Mes amis", "Public"]} valeur={plongee.visibiliteFiche} edition={edition} onChange={(v) => set("visibiliteFiche", v)} />
            <div className="text-[11.5px] leading-snug text-[#9DB0C0]">
              La position précise du site n'est jamais partagée, même sur une plongée publique.
            </div>
          </Section>

          {/* Bas de page */}
          <div className="h-[30px]" />
          {edition ? (
            <>
              <button
                type="button"
                onClick={() => void enregistrer()}
                disabled={enCours || chargement}
                className="flex min-h-[52px] w-full items-center justify-center rounded-[14px] bg-[#3DEFBE] disabled:opacity-50 text-sm font-bold tracking-wide text-[#0B2A4A]"
              >
                ENREGISTRER LA PLONGÉE
              </button>
              <div className="h-4" />
              <div className="flex justify-center">
                <button
                  type="button"
                  onClick={() => navigate({ to: "/carnet" })}
                  className="text-[13.5px] font-semibold text-[#9DB0C0] underline underline-offset-4"
                >
                  Supprimer ce brouillon
                </button>
              </div>
            </>
          ) : (
            <>
              <button
                type="button"
                onClick={() => setEdition(true)}
                className="flex min-h-[52px] w-full items-center justify-center rounded-[14px] border-2 border-[#1176A8] text-sm font-bold tracking-wide text-[#1176A8]"
              >
                MODIFIER CETTE PLONGÉE
              </button>
              {existante && (
                <div className="flex justify-center pt-5">
                  <button
                    type="button"
                    onClick={() => setConfirmerSuppression(true)}
                    className="min-h-[44px] text-[14px] font-semibold text-[#D6402A] underline underline-offset-4"
                  >
                    Supprimer cette plongée
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* Confirmation avant de supprimer */}
      {confirmerSuppression && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-[#071A30]/55 p-4 sm:items-center"
          onClick={() => !suppressionEnCours && setConfirmerSuppression(false)}
        >
          <div
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="titre-suppression"
            aria-describedby="texte-suppression"
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-[398px] rounded-[22px] bg-white p-[22px] shadow-[0_12px_40px_rgba(7,26,48,.35)]"
          >
            <h2 id="titre-suppression" className="text-[18px] font-bold text-[#123A63]">
              Supprimer cette plongée ?
            </h2>
            <p id="texte-suppression" className="pt-2 text-[14px] leading-normal text-[#5B7189]">
              {plongee.siteNom ? `« ${plongee.siteNom} » sera retirée de ton carnet.` : "Elle sera retirée de ton carnet."} Cette action ne peut pas être annulée.
            </p>
            <div className="flex flex-col gap-[10px] pt-[20px]">
              <button
                type="button"
                autoFocus
                disabled={suppressionEnCours}
                onClick={() => void supprimer()}
                className="flex min-h-[50px] w-full items-center justify-center rounded-[14px] bg-[#D6402A] text-sm font-bold tracking-wide text-white disabled:opacity-60"
              >
                {suppressionEnCours ? "Suppression…" : "SUPPRIMER"}
              </button>
              <button
                type="button"
                disabled={suppressionEnCours}
                onClick={() => setConfirmerSuppression(false)}
                className="flex min-h-[50px] w-full items-center justify-center rounded-[14px] border border-[#D8E5EE] text-sm font-bold tracking-wide text-[#123A63]"
              >
                ANNULER
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
