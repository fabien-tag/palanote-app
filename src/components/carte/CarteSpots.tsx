import { useEffect, useRef, useState } from "react";
import type { LayerGroup, Map as CarteLeaflet, TileLayer } from "leaflet";
import "leaflet/dist/leaflet.css";
import { chargerLeaflet, FONDS, type FondDeCarte } from "@/lib/carte";
import type { Spot } from "@/lib/spots";

// Carte de tous les spots (onglet Carte).
// - Au chargement, elle se cadre pour montrer tous les spots : très dézoomée si les spots
//   sont loin les uns des autres, très zoomée s'ils sont proches.
// - Les spots trop proches à l'écran pour un niveau de zoom sont regroupés en une bulle
//   (nombre total de plongées) ; toucher la bulle zoome dessus pour les séparer.

export type ApiCarteSpots = {
  toutVoir: () => void;
  allerA: (lat: number, lng: number, zoom?: number) => void;
};

const ECART_PX = 46; // en dessous, deux spots sont regroupés

function bulle(nb: number, mode: "spot" | "groupe" | "choisi") {
  const taille = mode === "groupe" ? (nb >= 10 ? 46 : 40) : nb >= 10 ? 40 : nb >= 3 ? 34 : 28;
  const fond = mode === "groupe" ? "#0F3D70" : "#3DEFBE";
  const texte = mode === "groupe" ? "#FFFFFF" : "#0B3B63";
  const halo = mode === "choisi" ? "0 0 0 9px rgba(61,239,190,.35)," : "";
  const html = `<div style="width:${taille}px;height:${taille}px;border-radius:50%;background:${fond};color:${texte};
    border:3px solid #fff;box-shadow:${halo}0 3px 10px rgba(7,26,48,.30);display:flex;align-items:center;justify-content:center;
    font:700 ${taille >= 40 ? 15 : 13}px/1 system-ui,sans-serif">${nb}</div>`;
  return { html, taille };
}

export function CarteSpots({
  spots,
  choisi,
  onChoisir,
  onPrete,
  className = "",
}: {
  spots: Spot[];
  choisi: string | null;
  onChoisir: (id: string | null) => void;
  onPrete?: (api: ApiCarteSpots) => void;
  className?: string;
}) {
  const conteneur = useRef<HTMLDivElement>(null);
  const carte = useRef<CarteLeaflet | null>(null);
  const couches = useRef<TileLayer[]>([]);
  const reperes = useRef<LayerGroup | null>(null);
  const [prete, setPrete] = useState(false);
  const [zoom, setZoom] = useState(0);
  const [fond, setFond] = useState<"ocean" | "osm">("ocean");
  const etat = useRef({ spots, onChoisir });
  etat.current = { spots, onChoisir };

  // Cadre la carte sur tous les spots
  const toutVoir = () => {
    const c = carte.current;
    const liste = etat.current.spots;
    if (!c || liste.length === 0) return;
    void chargerLeaflet().then((L) => {
      if (liste.length === 1) c.setView([liste[0]!.coords.lat, liste[0]!.coords.lng], 12);
      else c.fitBounds(L.latLngBounds(liste.map((s) => [s.coords.lat, s.coords.lng])), { padding: [48, 48], maxZoom: 13 });
    });
  };

  // Création
  useEffect(() => {
    let annule = false;
    void chargerLeaflet().then((L) => {
      if (annule || !conteneur.current || carte.current) return;
      const c = L.map(conteneur.current, { center: [46.6, 2.4], zoom: 5, zoomControl: false, maxZoom: 19, worldCopyJump: true });
      c.attributionControl.setPrefix(false);
      reperes.current = L.layerGroup().addTo(c);
      c.on("zoomend", () => setZoom(c.getZoom()));
      c.on("click", () => etat.current.onChoisir(null));
      carte.current = c;
      setPrete(true);
      onPrete?.({ toutVoir, allerA: (lat, lng, z = 13) => c.flyTo([lat, lng], z, { duration: 0.8 }) });
      setTimeout(() => {
        c.invalidateSize();
        toutVoir();
      }, 200);
    });
    return () => {
      annule = true;
      carte.current?.remove();
      carte.current = null;
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Fond de carte (océan ou plan détaillé)
  useEffect(() => {
    const c = carte.current;
    if (!c) return;
    void chargerLeaflet().then((L) => {
      couches.current.forEach((x) => x.remove());
      const f: FondDeCarte = FONDS[fond];
      const ajout = (x: NonNullable<FondDeCarte["relais"]>, attribution?: string) =>
        L.tileLayer(x.url, {
          maxNativeZoom: x.maxNativeZoom,
          minZoom: x.minZoom ?? 0,
          maxZoom: x.maxZoom ?? f.zoomMax,
          referrerPolicy: "strict-origin-when-cross-origin",
          ...(attribution ? { attribution } : {}),
        }).addTo(c);
      couches.current = [ajout(f.fond, f.attribution), ...(f.relais ? [ajout(f.relais)] : []), ...(f.noms ? [ajout(f.noms)] : [])];
    });
  }, [fond, prete]);

  // Nouveaux spots (filtre changé…) : on recadre
  useEffect(() => {
    if (prete) toutVoir();
  }, [spots, prete]); // eslint-disable-line react-hooks/exhaustive-deps

  // Repères, regroupés selon le zoom
  useEffect(() => {
    const c = carte.current;
    const groupe = reperes.current;
    if (!c || !groupe) return;
    void chargerLeaflet().then((L) => {
      groupe.clearLayers();
      const amas: { pt: { x: number; y: number }; spots: Spot[] }[] = [];
      for (const s of [...spots].sort((a, b) => b.plongees.length - a.plongees.length)) {
        const pt = c.latLngToLayerPoint([s.coords.lat, s.coords.lng]);
        const proche = amas.find((a) => Math.hypot(a.pt.x - pt.x, a.pt.y - pt.y) < ECART_PX);
        if (proche) proche.spots.push(s);
        else amas.push({ pt, spots: [s] });
      }
      for (const a of amas) {
        const total = a.spots.reduce((t, s) => t + s.plongees.length, 0);
        if (a.spots.length === 1) {
          const s = a.spots[0]!;
          const { html, taille } = bulle(total, s.id === choisi ? "choisi" : "spot");
          const m = L.marker([s.coords.lat, s.coords.lng], {
            icon: L.divIcon({ html, className: "", iconSize: [taille, taille], iconAnchor: [taille / 2, taille / 2] }),
            title: `${s.nom} — ${total} plongée${total > 1 ? "s" : ""}`,
            zIndexOffset: s.id === choisi ? 1000 : total,
          });
          m.on("click", (e) => {
            L.DomEvent.stopPropagation(e);
            etat.current.onChoisir(s.id);
            c.panTo([s.coords.lat, s.coords.lng], { animate: true });
          });
          groupe.addLayer(m);
        } else {
          const lat = a.spots.reduce((t, s) => t + s.coords.lat, 0) / a.spots.length;
          const lng = a.spots.reduce((t, s) => t + s.coords.lng, 0) / a.spots.length;
          const { html, taille } = bulle(total, "groupe");
          const m = L.marker([lat, lng], {
            icon: L.divIcon({ html, className: "", iconSize: [taille, taille], iconAnchor: [taille / 2, taille / 2] }),
            title: `${a.spots.length} sites — ${total} plongées`,
            zIndexOffset: 2000,
          });
          m.on("click", (e) => {
            L.DomEvent.stopPropagation(e);
            c.fitBounds(L.latLngBounds(a.spots.map((s) => [s.coords.lat, s.coords.lng])), { padding: [60, 60], maxZoom: 16 });
          });
          groupe.addLayer(m);
        }
      }
    });
  }, [spots, choisi, zoom, prete]);

  return (
    <div className={`relative isolate overflow-hidden ${className}`}>
      <div ref={conteneur} className="absolute inset-0 bg-[#CFE4F2]" />
      <button
        type="button"
        aria-label={fond === "ocean" ? "Passer au plan détaillé" : "Passer à la carte océan"}
        onClick={() => setFond((f) => (f === "ocean" ? "osm" : "ocean"))}
        className="absolute right-[12px] top-[12px] z-[500] flex h-[40px] w-[40px] items-center justify-center goutte bg-white text-[#123A63] shadow-[0_3px_10px_rgba(7,26,48,.18)]"
      >
        <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="m12 3 9 5-9 5-9-5 9-5Z" />
          <path d="m3 13 9 5 9-5" />
        </svg>
      </button>
    </div>
  );
}
