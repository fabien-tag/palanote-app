import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useRef, useState } from "react";
import { MapPin, Crosshair, Plus, X, Star, Camera } from "lucide-react";

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
  component: NouvellePlongee,
});

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

function Champ({
  label,
  valeur,
  unite,
  placeholder,
  edition,
  onChange,
  type = "text",
}: {
  label: string;
  valeur: string;
  unite?: string;
  placeholder?: string;
  edition: boolean;
  onChange: (v: string) => void;
  type?: string;
}) {
  return (
    <div className="flex min-w-0 flex-grow basis-0 flex-col gap-[7px]">
      <Label>{label}</Label>
      <div className="flex min-h-[50px] items-center gap-1.5 rounded-[14px] border-[1.5px] border-[#E4EBF1] bg-white px-[15px]">
        {edition ? (
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
  const [plongee, setPlongee] = useState<Plongee>(plongeeVide);
  const [edition, setEdition] = useState(true);
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

  const enregistrer = () => setEdition(false);

  return (
    <div className="min-h-screen bg-[#F5F9FC]">
      <div className="mx-auto flex min-h-screen w-full max-w-[430px] flex-col">
        {/* Barre du haut */}
        <div className="sticky top-0 z-10 flex items-center justify-between border-b-[1.5px] border-[#E4EBF1] bg-[#F5F9FC]/95 px-[22px] py-4">
          <button
            type="button"
            onClick={() => navigate({ to: "/carnet" })}
            className="text-[14.5px] font-medium text-[#5B7189]"
          >
            {edition ? "Annuler" : "Retour"}
          </button>
          <div className="text-[16px] font-bold text-[#123A63]">Nouvelle plongée</div>
          <button
            type="button"
            onClick={() => (edition ? enregistrer() : setEdition(true))}
            className="text-[14.5px] font-bold text-[#1176A8]"
          >
            {edition ? "Enregistrer" : "Modifier"}
          </button>
        </div>

        <div className="px-[22px] pb-[30px]">
          {/* ESSENTIEL */}
          <Section titre="ESSENTIEL">
            <div className="flex gap-3">
              <Champ label="Date" valeur={plongee.date} placeholder="14/07/2026" edition={edition} onChange={(v) => set("date", v)} type="date" />
              <Champ label="Immersion" valeur={plongee.immersion} placeholder="10:35" edition={edition} onChange={(v) => set("immersion", v)} type="time" />
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
              <Champ label="Durée" valeur={plongee.duree} unite="min" edition={edition} onChange={(v) => set("duree", v)} type="number" />
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
                onClick={enregistrer}
                className="flex min-h-[52px] w-full items-center justify-center rounded-[14px] bg-[#3DEFBE] text-sm font-bold tracking-wide text-[#0B2A4A]"
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
            <button
              type="button"
              onClick={() => setEdition(true)}
              className="flex min-h-[52px] w-full items-center justify-center rounded-[14px] border-2 border-[#1176A8] text-sm font-bold tracking-wide text-[#1176A8]"
            >
              MODIFIER CETTE PLONGÉE
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
