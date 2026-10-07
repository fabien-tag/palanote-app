import { useEffect, useMemo, useRef, useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { Camera, Check, ChevronLeft, ChevronRight, MapPin, Plus, Star } from "lucide-react";
import { Meduse, useConnexionRequise } from "@/components/numerisation/Ui";
import { compterPlongeesEnsemble, couleurAvatar, identifierBinomes, initiales, mesBinomes, type Plongeur } from "@/lib/amis";
import { garderBrouillon } from "@/lib/brouillon-plongee";
import { annoncerSurAccueil } from "@/lib/message-accueil";
import { enregistrerPhotosPlongee, type PhotoPlongee } from "@/lib/photos-plongee";
import { cacheCarnetEnMemoire, chargerPlongees, minutesEnTexte, nombre, sauverPlongee, type CartePlongee, type LignePlongee } from "@/lib/plongees";

// Saisie express (parcours 06, écrans 35 et 36) : l'essentiel en moins d'une minute sur le bateau.
// Site et heure préremplis, profondeur, durée, note, binômes en un tap, photos.
// « Ajouter les détails » ouvre la fiche complète avec ce qui a déjà été saisi.
export const Route = createFileRoute("/plongee-express")({
  validateSearch: (search: Record<string, unknown>): { site?: string | undefined; lieu?: string | undefined; coords?: string | undefined } => ({
    site: typeof search["site"] === "string" ? search["site"] : undefined,
    lieu: typeof search["lieu"] === "string" ? search["lieu"] : undefined,
    coords: typeof search["coords"] === "string" ? search["coords"] : undefined,
  }),
  head: () => ({ meta: [{ title: "Palanote — Nouvelle plongée" }] }),
  component: SaisieExpress,
});

const pad = (n: number) => String(n).padStart(2, "0");
function aujourdhui() {
  const d = new Date();
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}
// Heure actuelle arrondie à 10 minutes (comme le menu de la fiche complète)
function heureActuelle() {
  const d = new Date();
  return `${pad(d.getHours())}:${pad(Math.floor(d.getMinutes() / 10) * 10)}`;
}
const HEURES_10_MIN = Array.from({ length: 144 }, (_, i) => `${pad(Math.floor(i / 6))}:${pad((i % 6) * 10)}`);
const MOIS = ["janvier", "février", "mars", "avril", "mai", "juin", "juillet", "août", "septembre", "octobre", "novembre", "décembre"];
function libelleJour(iso: string) {
  if (iso === aujourdhui()) return "Aujourd'hui";
  const hier = new Date();
  hier.setDate(hier.getDate() - 1);
  if (iso === `${hier.getFullYear()}-${pad(hier.getMonth() + 1)}-${pad(hier.getDate())}`) return "Hier";
  const [a, m, j] = iso.split("-").map(Number);
  return a && m && j ? `${j} ${MOIS[m - 1]}` : iso;
}

function Puce({ actif, onClick, children }: { actif: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      aria-pressed={actif}
      onClick={onClick}
      className={`flex h-[44px] items-center gap-[8px] rounded-full border-[1.5px] pl-[5px] pr-[14px] text-[14px] transition-colors ${
        actif ? "border-[#3DEFBE] bg-[#3DEFBE] font-bold text-[#0B3B63]" : "border-[#E4EBF1] bg-white text-[#123A63]"
      }`}
    >
      {children}
    </button>
  );
}

function GrosChamp({ label, unite, valeur, onChange, decimal }: { label: string; unite: string; valeur: string; onChange: (v: string) => void; decimal?: boolean }) {
  return (
    <label className="block min-w-0 flex-1">
      <span className="block pb-[8px] text-[13px] font-semibold text-[#5B7189]">{label}</span>
      <span
        className={`flex h-[74px] items-baseline justify-center gap-[6px] galet-moyen border-[1.5px] bg-white px-[12px] pt-[16px] ${valeur ? "border-[#C9D9E6]" : "border-[#E4EBF1]"} focus-within:border-[#57D4F5]`}
      >
        <input
          value={valeur}
          onChange={(e) => onChange(e.target.value.replace(decimal ? /[^\d.,]/g : /\D/g, "").slice(0, decimal ? 5 : 3))}
          inputMode={decimal ? "decimal" : "numeric"}
          placeholder="—"
          aria-label={label}
          size={4}
          className="w-[86px] bg-transparent text-right text-[32px] font-bold leading-none text-[#123A63] outline-none placeholder:text-[#C2CFDB]"
        />
        <span className="w-[34px] text-[14px] text-[#9DB0C0]">{unite}</span>
      </span>
    </label>
  );
}

function SaisieExpress() {
  const navigate = useNavigate();
  const { site: siteDepart, lieu: lieuDepart, coords: coordsDepart } = Route.useSearch();
  const { pret, ecran } = useConnexionRequise();
  const [idPlongee] = useState(() => crypto.randomUUID());

  const [siteNom, setSiteNom] = useState(siteDepart ?? "");
  const [siteLieu, setSiteLieu] = useState(lieuDepart ?? "");
  const [siteCoords, setSiteCoords] = useState(coordsDepart ?? "");
  const [date, setDate] = useState(aujourdhui);
  const [heure, setHeure] = useState(heureActuelle);
  const [modifSite, setModifSite] = useState(false);
  const [profMax, setProfMax] = useState("");
  const [duree, setDuree] = useState("");
  const [note, setNote] = useState(0);

  const [binomes, setBinomes] = useState<Plongeur[]>([]);
  const [identifies, setIdentifies] = useState<string[]>([]);
  const [nomsLibres, setNomsLibres] = useState<string[]>([]);
  const [ajoutNom, setAjoutNom] = useState(false);
  const [nom, setNom] = useState("");

  const [photos, setPhotos] = useState<PhotoPlongee[]>([]);
  const fichiers = useRef<HTMLInputElement>(null);
  const [enCours, setEnCours] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);
  const [passees, setPassees] = useState<CartePlongee[]>(() => cacheCarnetEnMemoire()?.plongees ?? []);

  // Mes plongées (pour proposer le dernier site) et mes binômes, du plus fréquent au moins fréquent.
  useEffect(() => {
    if (!pret) return;
    void chargerPlongees()
      .then(setPassees)
      .catch(() => undefined);
    void Promise.all([mesBinomes(), compterPlongeesEnsemble().catch(() => ({}) as Record<string, number>)])
      .then(([liste, comptes]) => setBinomes([...liste].sort((a, b) => (comptes[b.id] ?? 0) - (comptes[a.id] ?? 0))))
      .catch(() => undefined);
  }, [pret]);

  // Site par défaut : celui de ta dernière plongée
  const derniere = useMemo(() => [...passees].filter((p) => p.siteNom).sort((a, b) => (b.date || "").localeCompare(a.date || ""))[0], [passees]);
  useEffect(() => {
    if (!siteDepart && !siteNom && derniere) {
      setSiteNom(derniere.siteNom);
      setSiteLieu(derniere.siteLieu ?? "");
    }
  }, [derniere]); // eslint-disable-line react-hooks/exhaustive-deps
  const sitesConnus = useMemo(() => [...new Set(passees.map((p) => p.siteNom).filter(Boolean))].slice(0, 30), [passees]);

  useEffect(() => () => photos.forEach((p) => p.fichier && URL.revokeObjectURL(p.url)), []); // eslint-disable-line react-hooks/exhaustive-deps

  if (ecran) return ecran;

  const pretAEnregistrer = siteNom.trim() !== "" && (profMax.trim() !== "" || duree.trim() !== "");
  const prenomDe = (id: string) => binomes.find((b) => b.id === id)?.prenom ?? "";
  const binomesAffiches = binomes.slice(0, Math.max(3, identifies.length));

  const ajouterNom = () => {
    const n = nom.trim();
    if (n && !nomsLibres.includes(n)) setNomsLibres((l) => [...l, n]);
    setNom("");
    setAjoutNom(false);
  };

  const versDetails = () => {
    garderBrouillon({
      siteNom: siteNom.trim(),
      siteLieu: siteLieu.trim(),
      siteCoords,
      date,
      immersion: heure,
      profMax,
      duree: duree ? minutesEnTexte(Number(duree)) : "",
      note,
      binomes: nomsLibres,
      identifies,
      photos,
    });
    navigate({ to: "/nouvelle-plongee", search: { brouillon: "1" } });
  };

  const enregistrer = async () => {
    if (!pretAEnregistrer || enCours) return;
    setEnCours(true);
    setErreur(null);
    const ligne: LignePlongee = {
      id: idPlongee,
      dive_date: date || null,
      start_time: heure || null,
      site_name: siteNom.trim() || null,
      site_location: siteLieu.trim() || null,
      site_coords: siteCoords || null,
      max_depth_m: nombre(profMax),
      avg_depth_m: null,
      duration_min: duree ? Number(duree) : null,
      end_time: null,
      total_time_min: null,
      surface_interval_min: null,
      stops: [],
      method: "Ordinateur",
      computer: null,
      gas_mix: "Air",
      o2_pct: 21,
      he_pct: null,
      tank_config: null,
      tank_volume_l: null,
      weight_kg: null,
      pressure_start_bar: null,
      pressure_end_bar: null,
      suit_type: null,
      suit_thickness_mm: null,
      temp_surface_c: null,
      temp_bottom_c: null,
      temp_air_c: null,
      visibility_m: null,
      current_strength: null,
      sea_state: null,
      weather: null,
      buddies: [...identifies.map(prenomDe).filter(Boolean), ...nomsLibres],
      guide_name: null,
      dive_leader: null,
      club_name: null,
      boat_name: null,
      dive_type: null,
      environment: null,
      entry_type: null,
      rating: note || null,
      rating_place: null,
      rating_conditions: null,
      rating_wildlife: null,
      comment: null,
      wildlife: [],
      visibility: "private",
    };
    try {
      await sauverPlongee(ligne);
      if (identifies.length > 0) await identifierBinomes(idPlongee, identifies).catch((e) => console.error("Identification des binômes impossible", e));
      if (photos.length > 0) {
        try {
          await enregistrerPhotosPlongee(idPlongee, photos, []);
        } catch (e) {
          console.error(e);
          annoncerSurAccueil("Plongée enregistrée, mais les photos n'ont pas pu être envoyées");
          navigate({ to: "/carnet" });
          return;
        }
      }
      annoncerSurAccueil("Plongée enregistrée");
      navigate({ to: "/carnet" });
    } catch (e) {
      console.error(e);
      setErreur(`La plongée n'a pas pu être enregistrée.${e && typeof e === "object" && "message" in e ? ` (détail : ${String(e.message)})` : ""}`);
      setEnCours(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#F1F6FC] text-[#123A63]">
      {/* En-tête des pages internes : pas de bandeau, comme les autres écrans */}
      <div className="mx-auto w-full max-w-[430px] px-[22px] pt-[clamp(14px,2.6svh,22px)]">
        <div className="flex items-center justify-between">
          <button type="button" aria-label="Retour" onClick={() => navigate({ to: "/carnet" })} className="flex h-10 w-10 items-center justify-center goutte bg-[#E3EDF6]">
            <ChevronLeft className="h-[18px] w-[18px]" strokeWidth={2.4} />
          </button>
          <button type="button" onClick={() => navigate({ to: "/carnet" })} className="px-[4px] py-[8px] text-[15px] font-medium text-[#5B7189]">
            Annuler
          </button>
        </div>
        <h1 className="pt-[12px] text-[26px] font-bold leading-tight">Nouvelle plongée</h1>
      </div>

      <div className="cascade mx-auto flex w-full max-w-[430px] flex-col px-[22px] pb-[max(24px,env(safe-area-inset-bottom))]">
        {/* Site, date et heure */}
        <div className="relative mt-[18px] galet border border-[#BFE6F5] bg-[#E3F4FC] px-[16px] py-[14px]">
          <Meduse className="-right-[4px] -top-[14px]" />
          <div className="flex items-center gap-[12px]">
            <MapPin className="h-[19px] w-[19px] shrink-0 text-[#1176A8]" strokeWidth={2.2} aria-hidden="true" />
            <div className="min-w-0 flex-1">
              <div className="truncate text-[16px] font-bold">{siteNom.trim() || "Quel site ?"}</div>
              <div className="text-[12.5px] text-[#5B7189]">
                {libelleJour(date)} · {heure}
              </div>
            </div>
            <button type="button" onClick={() => setModifSite((v) => !v)} className="shrink-0 px-[2px] py-[6px] text-[13.5px] font-bold text-[#1176A8]">
              {modifSite ? "OK" : "Changer"}
            </button>
          </div>
          {modifSite && (
            <div className="mt-[12px] flex flex-col gap-[10px] border-t border-[#BFE6F5] pt-[12px]">
              <input
                value={siteNom}
                onChange={(e) => {
                  setSiteNom(e.target.value);
                  setSiteCoords("");
                  const connu = passees.find((p) => p.siteNom === e.target.value);
                  setSiteLieu(connu?.siteLieu ?? "");
                }}
                list="sites-connus"
                placeholder="Nom du site"
                aria-label="Nom du site"
                className="h-[46px] w-full galet-petit border-[1.5px] border-[#CFE3EF] bg-white px-[14px] text-[15px] outline-none focus:border-[#57D4F5]"
              />
              <datalist id="sites-connus">
                {sitesConnus.map((s) => (
                  <option key={s} value={s} />
                ))}
              </datalist>
              <div className="flex gap-[10px]">
                <input
                  type="date"
                  value={date}
                  max={aujourdhui()}
                  onChange={(e) => setDate(e.target.value || aujourdhui())}
                  aria-label="Date"
                  className="h-[46px] min-w-0 flex-1 galet-petit border-[1.5px] border-[#CFE3EF] bg-white px-[12px] text-[15px] outline-none"
                />
                <select
                  value={heure}
                  onChange={(e) => setHeure(e.target.value)}
                  aria-label="Heure de mise à l'eau"
                  className="h-[46px] w-[110px] galet-petit border-[1.5px] border-[#CFE3EF] bg-white px-[12px] text-[15px] outline-none"
                >
                  {HEURES_10_MIN.map((h) => (
                    <option key={h} value={h}>
                      {h}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          )}
        </div>

        {/* Profondeur et durée */}
        <div className="flex gap-[12px] pt-[18px]">
          <GrosChamp label="Profondeur max" unite="m" valeur={profMax} onChange={setProfMax} decimal />
          <GrosChamp label="Durée" unite="min" valeur={duree} onChange={setDuree} />
        </div>

        {/* Note */}
        <div className="flex items-center justify-between pt-[18px]">
          <span className="text-[13px] font-semibold text-[#5B7189]">Ta note</span>
          <div className="flex gap-[4px]">
            {[1, 2, 3, 4, 5].map((n) => (
              <button key={n} type="button" aria-label={`${n} sur 5`} aria-pressed={note === n} onClick={() => setNote(note === n ? 0 : n)} className="p-[2px]">
                <Star className={`h-[28px] w-[28px] ${n <= note ? "fill-[#FFC65C] text-[#FFC65C]" : "text-[#FFC65C]/60"}`} strokeWidth={1.7} />
              </button>
            ))}
          </div>
        </div>
        {note === 0 && <p className="text-right text-[12px] text-[#9DB0C0]">Pas encore notée</p>}

        {/* Avec qui ? */}
        <span className="block pb-[10px] pt-[16px] text-[13px] font-semibold text-[#5B7189]">Avec qui ?</span>
        <div className="flex flex-wrap gap-[8px]">
          {binomesAffiches.map((b) => {
            const actif = identifies.includes(b.id);
            return (
              <Puce key={b.id} actif={actif} onClick={() => setIdentifies((l) => (actif ? l.filter((x) => x !== b.id) : [...l, b.id]))}>
                <span className="flex h-[34px] w-[34px] items-center justify-center rounded-full text-[12px] font-bold text-[#0F3D70]" style={{ background: actif ? "#ffffff99" : couleurAvatar(b.id) }}>
                  {initiales(b.prenom)}
                </span>
                {b.prenom}
              </Puce>
            );
          })}
          {nomsLibres.map((n) => (
            <Puce key={n} actif onClick={() => setNomsLibres((l) => l.filter((x) => x !== n))}>
              <span className="flex h-[34px] w-[34px] items-center justify-center rounded-full bg-white/60 text-[12px] font-bold text-[#0F3D70]">{initiales(n)}</span>
              {n}
            </Puce>
          ))}
          {ajoutNom ? (
            <span className="flex h-[44px] items-center gap-[6px] rounded-full border-[1.5px] border-[#57D4F5] bg-white pl-[14px] pr-[5px]">
              <input
                autoFocus
                value={nom}
                onChange={(e) => setNom(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && ajouterNom()}
                placeholder="Prénom"
                aria-label="Prénom du binôme"
                className="w-[110px] bg-transparent text-[14px] outline-none"
              />
              <button type="button" onClick={ajouterNom} aria-label="Ajouter ce binôme" className="flex h-[34px] w-[34px] items-center justify-center rounded-full bg-[#3DEFBE]">
                <Check className="h-[16px] w-[16px] text-[#0B3B63]" strokeWidth={2.8} />
              </button>
            </span>
          ) : (
            <button
              type="button"
              onClick={() => setAjoutNom(true)}
              className="flex h-[44px] items-center gap-[6px] rounded-full border-[1.5px] border-dashed border-[#BFD3E2] bg-white px-[16px] text-[14px] font-bold text-[#1176A8]"
            >
              <Plus className="h-[15px] w-[15px]" strokeWidth={2.6} aria-hidden="true" />
              Autre
            </button>
          )}
        </div>

        {/* Photos */}
        <div className="flex items-baseline justify-between pb-[10px] pt-[18px]">
          <span className="text-[13px] font-semibold text-[#5B7189]">Photos</span>
          <span className={`text-[12.5px] ${photos.length ? "font-semibold text-[#FF8A75]" : "text-[#9DB0C0]"}`}>
            {photos.length ? `${photos.length} sélectionnée${photos.length > 1 ? "s" : ""}` : "aucune"}
          </span>
        </div>
        <div className="flex items-center gap-[10px] overflow-x-auto pb-[2px]">
          <button
            type="button"
            onClick={() => fichiers.current?.click()}
            className="flex h-[76px] w-[76px] shrink-0 flex-col items-center justify-center gap-[4px] galet-petit border-[1.5px] border-dashed border-[#FF8A75] bg-[#FFF3F0] text-[12px] font-bold text-[#E0654F]"
          >
            <Camera className="h-[18px] w-[18px]" strokeWidth={2} aria-hidden="true" />
            Ajouter
          </button>
          {photos.length === 0 && <span className="text-[13px] text-[#9DB0C0]">Ajoute les photos de la plongée, la première sera la couverture.</span>}
          {photos.map((ph, i) => (
            <button
              key={ph.url}
              type="button"
              aria-label={`Retirer la photo ${i + 1}`}
              onClick={() => setPhotos((l) => l.filter((x) => x !== ph))}
              className="relative h-[76px] w-[76px] shrink-0 overflow-hidden galet-petit"
            >
              <img src={ph.url} alt="" className="h-full w-full object-cover" />
              <span className="absolute right-[5px] top-[5px] flex h-[20px] w-[20px] items-center justify-center rounded-full bg-[#3DEFBE]">
                <Check className="h-[12px] w-[12px] text-[#0B3B63]" strokeWidth={3} />
              </span>
            </button>
          ))}
        </div>
        <input
          ref={fichiers}
          type="file"
          accept="image/*"
          multiple
          hidden
          onChange={(e) => {
            const liste = Array.from(e.target.files ?? []);
            setPhotos((p) => [...p, ...liste.map((f) => ({ url: URL.createObjectURL(f), fichier: f }))]);
            e.target.value = "";
          }}
        />

        <div className="min-h-[24px] flex-grow" />

        {/* Vers la fiche complète */}
        <button
          type="button"
          onClick={versDetails}
          className="mt-[22px] flex items-center gap-[12px] galet-b border border-[#DCE7F0] bg-white px-[16px] py-[14px] text-left shadow-[0_4px_14px_#123A6308]"
        >
          <span className="min-w-0 flex-1">
            <span className="block text-[15px] font-bold">Ajouter les détails</span>
            <span className="block text-[12.5px] text-[#7D93A8]">Gaz, lestage, paliers, conditions…</span>
          </span>
          <ChevronRight className="h-[18px] w-[18px] text-[#9DB0C0]" aria-hidden="true" />
        </button>

        {erreur && <p className="pt-[10px] text-center text-[13px] text-[#8A2A1A]">{erreur}</p>}
        <button
          type="button"
          disabled={!pretAEnregistrer || enCours}
          onClick={() => void enregistrer()}
          className={`mt-[12px] flex h-[56px] w-full items-center justify-center galet-moyen text-[14px] font-bold tracking-wide transition-colors ${
            pretAEnregistrer ? "bg-[#3DEFBE] text-[#0B3B63] shadow-[0_6px_16px_#3DEFBE40]" : "bg-[#E4EBF1] text-[#9DB0C0]"
          }`}
        >
          {enCours ? (photos.length ? "ENVOI DES PHOTOS…" : "ENREGISTREMENT…") : "ENREGISTRER"}
        </button>
        {!pretAEnregistrer && <p className="pt-[8px] text-center text-[12px] text-[#9DB0C0]">Un site et une profondeur ou une durée suffisent.</p>}
      </div>
    </div>
  );
}
