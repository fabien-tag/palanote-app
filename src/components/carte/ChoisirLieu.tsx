import { useEffect, useRef, useState } from "react";
import type { Map as CarteLeaflet } from "leaflet";
import { LocateFixed, Search, X } from "lucide-react";
import { Carte, HTML_REPERE } from "@/components/carte/Carte";
import {
  coordsLisibles,
  DECALAGE_MAX_M,
  DECALAGE_MIN_M,
  flouterPosition,
  lieuDepuisCoords,
  messageErreurPosition,
  positionActuelle,
  rechercherLieux,
  VUE_FRANCE,
  type Coords,
  type Lieu,
} from "@/lib/carte";

// Plein écran pour choisir le lieu d'une plongée :
// on déplace la carte sous le repère central, ou on cherche une ville / un site,
// ou on prend la position du téléphone.
export function ChoisirLieu({
  depart,
  lieuDepart = null,
  geolocaliser = false,
  onValider,
  onFermer,
}: {
  depart: Coords | null;
  lieuDepart?: string | null;
  /** Lance tout de suite la recherche de la position du téléphone. */
  geolocaliser?: boolean;
  onValider: (choix: { coords: Coords; lieu: string | null; nom: string | null }) => void;
  onFermer: () => void;
}) {
  const [vue, setVue] = useState(depart ? { centre: depart, zoom: 13 } : VUE_FRANCE);
  const [centre, setCentre] = useState<Coords>(depart ?? VUE_FRANCE.centre);
  const [libelle, setLibelle] = useState<string | null>(lieuDepart);
  const [nomChoisi, setNomChoisi] = useState<string | null>(null);
  const [recherche, setRecherche] = useState("");
  const [resultats, setResultats] = useState<Lieu[]>([]);
  const [chercheEnCours, setChercheEnCours] = useState(false);
  const [localisation, setLocalisation] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [aBouge, setABouge] = useState(Boolean(depart));
  const carte = useRef<CarteLeaflet | null>(null);
  const ignorerProchainNom = useRef(Boolean(depart && lieuDepart));
  const deplacementProgramme = useRef(false);

  const allerA = (c: Coords, zoom = 14) => {
    setCentre(c);
    setABouge(true);
    if (carte.current) {
      deplacementProgramme.current = true;
      carte.current.setView([c.lat, c.lng], zoom);
    } else setVue({ centre: c, zoom });
  };

  const maPosition = async () => {
    setLocalisation(true);
    setMessage(null);
    try {
      const c = await positionActuelle();
      setNomChoisi(null);
      allerA(c, 15);
    } catch (e) {
      setMessage(messageErreurPosition(e));
    } finally {
      setLocalisation(false);
    }
  };

  useEffect(() => {
    if (geolocaliser) void maPosition();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Nom du lieu sous le repère, après chaque déplacement (temporisé : 1 requête / s max).
  useEffect(() => {
    if (!aBouge) return;
    if (ignorerProchainNom.current) {
      ignorerProchainNom.current = false;
      return;
    }
    const ctrl = new AbortController();
    const t = setTimeout(() => {
      void lieuDepuisCoords(centre, ctrl.signal)
        .then(setLibelle)
        .catch(() => undefined);
    }, 900);
    return () => {
      clearTimeout(t);
      ctrl.abort();
    };
  }, [centre.lat, centre.lng, aBouge]); // eslint-disable-line react-hooks/exhaustive-deps

  // Recherche temporisée
  useEffect(() => {
    const q = recherche.trim();
    if (q.length < 3) {
      setResultats([]);
      return;
    }
    const ctrl = new AbortController();
    const t = setTimeout(() => {
      setChercheEnCours(true);
      void rechercherLieux(q, ctrl.signal)
        .then(setResultats)
        .catch(() => undefined)
        .finally(() => setChercheEnCours(false));
    }, 700);
    return () => {
      clearTimeout(t);
      ctrl.abort();
    };
  }, [recherche]);

  const choisirResultat = (r: Lieu) => {
    setRecherche("");
    setResultats([]);
    setNomChoisi(r.nom);
    setLibelle(r.lieu);
    ignorerProchainNom.current = true;
    allerA(r.coords, 13);
  };

  return (
    <div role="dialog" aria-modal="true" aria-label="Choisir le lieu de la plongée" className="fixed inset-0 z-[2000] flex justify-center bg-[#071A30]/60">
      <div className="relative flex h-full w-full max-w-[430px] flex-col bg-[#F5F9FC]">
        {/* Haut */}
        <div className="z-[1000] flex shrink-0 items-center justify-between gap-3 bg-[#F5F9FC] px-[18px] pb-[10px] pt-[max(14px,env(safe-area-inset-top))]">
          <button type="button" onClick={onFermer} className="text-[14.5px] font-medium text-[#566B82]">
            Annuler
          </button>
          <div className="text-[16px] font-bold text-[#123A63]">Lieu de la plongée</div>
          <span className="w-[52px]" />
        </div>

        {/* Recherche */}
        <div className="relative z-[1000] shrink-0 px-[18px] pb-[12px]">
          <div className="flex h-[48px] items-center gap-2 galet-moyen border-[1.5px] border-[#7B8FA3] bg-white px-[14px]">
            <Search className="h-[18px] w-[18px] shrink-0 text-[#566B82]" strokeWidth={2.2} aria-hidden="true" />
            <input
              value={recherche}
              onChange={(e) => setRecherche(e.target.value)}
              placeholder="Ville, île, site de plongée…"
              enterKeyHint="search"
              aria-label="Rechercher un lieu"
              className="w-full min-w-0 bg-transparent text-[15px] text-[#123A63] outline-none placeholder:text-[#9AAAB9]"
            />
            {recherche && (
              <button type="button" aria-label="Effacer" onClick={() => setRecherche("")} className="text-[#566B82]">
                <X className="h-[17px] w-[17px]" />
              </button>
            )}
          </div>
          {(resultats.length > 0 || (chercheEnCours && recherche.trim().length >= 3)) && (
            <ul className="absolute inset-x-[18px] top-[54px] overflow-hidden galet-moyen border border-[#E4EBF1] bg-white shadow-[0_10px_28px_rgba(7,26,48,.18)]">
              {chercheEnCours && resultats.length === 0 && <li className="px-[14px] py-[12px] text-[13.5px] text-[#566B82]">Recherche…</li>}
              {resultats.map((r, i) => (
                <li key={`${r.coords.lat}-${r.coords.lng}-${i}`} className="border-t border-[#EDF2F7] first:border-t-0">
                  <button type="button" onClick={() => choisirResultat(r)} className="flex w-full flex-col items-start px-[14px] py-[10px] text-left">
                    <span className="text-[14.5px] font-semibold text-[#123A63]">{r.nom}</span>
                    <span className="text-[12.5px] text-[#566B82]">{r.lieu}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Carte avec repère fixe au centre */}
        <div className="relative min-h-0 flex-1">
          <Carte
            centre={vue.centre}
            zoom={vue.zoom}
            onPrete={(c) => (carte.current = c)}
            onDeplacement={(c) => {
              // Déplacement à la main : le nom choisi dans la recherche ne s'applique plus.
              if (deplacementProgramme.current) deplacementProgramme.current = false;
              else setNomChoisi(null);
              setCentre(c);
              setABouge(true);
            }}
            className="absolute inset-0"
          />
          <div aria-hidden="true" className="pointer-events-none absolute left-1/2 top-1/2 z-[500] -translate-x-1/2 -translate-y-1/2" dangerouslySetInnerHTML={{ __html: HTML_REPERE }} />
          <button
            type="button"
            onClick={() => void maPosition()}
            disabled={localisation}
            className="absolute bottom-[14px] right-[14px] z-[500] flex h-[46px] items-center gap-2 rounded-[23px] bg-white px-[16px] text-[13.5px] font-bold text-[#106F9F] shadow-[0_4px_14px_rgba(7,26,48,.22)] disabled:opacity-70"
          >
            <LocateFixed className={`h-[18px] w-[18px] ${localisation ? "animate-pulse" : ""}`} strokeWidth={2.2} aria-hidden="true" />
            {localisation ? "Localisation…" : "Ma position"}
          </button>
          {!aBouge && (
            <div className="pointer-events-none absolute inset-x-0 top-[14px] z-[500] flex justify-center px-4">
              <span className="galet-petit bg-white/95 px-[12px] py-[7px] text-[12.5px] font-semibold text-[#123A63] shadow-sm">
                Déplace la carte pour placer le repère sur le spot
              </span>
            </div>
          )}
        </div>

        {/* Bas : lieu choisi */}
        <div className="z-[1000] shrink-0 border-t border-[#E4EBF1] bg-white px-[18px] pb-[max(16px,env(safe-area-inset-bottom))] pt-[14px]">
          {message && <p className="pb-[10px] text-[13px] text-[#8A5A10]">{message}</p>}
          <div className="pb-[12px]">
            <div className="text-[15.5px] font-bold text-[#123A63]">{nomChoisi ?? libelle ?? (aBouge ? "Lieu sélectionné" : "Aucun lieu choisi")}</div>
            <div className="text-[12.5px] text-[#566B82]">
              {nomChoisi && libelle ? `${libelle} · ` : ""}
              {aBouge ? coordsLisibles(centre) : "Cherche un lieu ou déplace la carte"}
            </div>
          </div>
          <p className="pb-[10px] text-[11.5px] leading-snug text-[#566B82]">
            Pour respecter les spots des clubs, le point enregistré est volontairement décalé de {DECALAGE_MIN_M} à {DECALAGE_MAX_M} m.
          </p>
          <button
            type="button"
            disabled={!aBouge}
            onClick={() =>
              onValider({
                // Lieu inchangé : on garde la position déjà décalée (sinon elle dériverait à chaque validation).
                coords: depart && centre.lat === depart.lat && centre.lng === depart.lng ? depart : flouterPosition(centre),
                lieu: libelle,
                nom: nomChoisi,
              })
            }
            className="flex h-[52px] w-full items-center justify-center galet-moyen bg-[#3DEFBE] text-[14px] font-bold tracking-wide text-[#0B2A4A] disabled:opacity-50"
          >
            VALIDER CE LIEU
          </button>
        </div>
      </div>
    </div>
  );
}
