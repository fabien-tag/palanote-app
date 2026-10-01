import { useEffect, useRef, useState } from "react";
import type { Map as CarteLeaflet, Marker } from "leaflet";
import "leaflet/dist/leaflet.css";
import { chargerLeaflet, FOND_DE_CARTE, type Coords } from "@/lib/carte";

// Carte réutilisable (fiche plongée, choix du lieu, et plus tard l'onglet Carte).
// Leaflet est chargé seulement dans le navigateur.

export type Repere = { id: string; coords: Coords; titre?: string };

// Repère corail, dessiné en HTML (pas d'image à charger).
export const HTML_REPERE = `
  <div style="width:30px;height:30px;border-radius:50%;background:#FF8A75;border:2.5px solid #fff;
    box-shadow:0 3px 8px rgba(7,26,48,.35);display:flex;align-items:center;justify-content:center">
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round">
      <path d="M20 10c0 4.99-5.54 10.19-7.4 11.8a1 1 0 0 1-1.2 0C9.54 20.19 4 14.99 4 10a8 8 0 0 1 16 0"/><circle cx="12" cy="10" r="3"/>
    </svg>
  </div>`;

export function Carte({
  centre,
  zoom,
  reperes = [],
  interactive = true,
  onDeplacement,
  onPrete,
  onRepere,
  className = "",
}: {
  centre: Coords;
  zoom: number;
  reperes?: Repere[];
  interactive?: boolean;
  /** Appelé à la fin de chaque déplacement, avec le nouveau centre. */
  onDeplacement?: (centre: Coords) => void;
  /** Donne accès à la carte (pour la recentrer depuis l'extérieur). */
  onPrete?: (carte: CarteLeaflet) => void;
  onRepere?: (id: string) => void;
  className?: string;
}) {
  const conteneur = useRef<HTMLDivElement>(null);
  const carte = useRef<CarteLeaflet | null>(null);
  const marqueurs = useRef<Marker[]>([]);
  const [prete, setPrete] = useState(false);
  const vueActuelle = useRef({ centre, zoom });
  vueActuelle.current = { centre, zoom };
  const rappels = useRef({ onDeplacement, onPrete, onRepere });
  rappels.current = { onDeplacement, onPrete, onRepere };

  // Création de la carte (une seule fois)
  useEffect(() => {
    let annule = false;
    void chargerLeaflet().then((L) => {
      if (annule || !conteneur.current || carte.current) return;
      // Vue la plus récente demandée (elle a pu changer pendant le chargement de Leaflet).
      const v = vueActuelle.current;
      const c = L.map(conteneur.current, {
        center: [v.centre.lat, v.centre.lng],
        zoom: v.zoom,
        zoomControl: false,
        attributionControl: true,
        dragging: interactive,
        touchZoom: interactive,
        doubleClickZoom: interactive,
        scrollWheelZoom: interactive,
        boxZoom: interactive,
        keyboard: interactive,
      });
      L.tileLayer(FOND_DE_CARTE.url, {
        attribution: FOND_DE_CARTE.attribution,
        subdomains: FOND_DE_CARTE.sousDomaines,
        maxZoom: FOND_DE_CARTE.zoomMax,
      }).addTo(c);
      c.attributionControl.setPrefix(false);
      c.on("moveend", () => {
        const m = c.getCenter();
        rappels.current.onDeplacement?.({ lat: m.lat, lng: m.lng });
      });
      carte.current = c;
      setPrete(true);
      rappels.current.onPrete?.(c);
      // La carte peut naître dans un conteneur en cours d'animation : on recalcule sa taille.
      setTimeout(() => c.invalidateSize(), 250);
    });
    return () => {
      annule = true;
      carte.current?.remove();
      carte.current = null;
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Vue : suit les changements de centre / zoom demandés par le parent
  useEffect(() => {
    carte.current?.setView([centre.lat, centre.lng], zoom, { animate: false });
  }, [centre.lat, centre.lng, zoom]);

  // Repères
  useEffect(() => {
    let annule = false;
    void chargerLeaflet().then((L) => {
      const c = carte.current;
      if (annule || !c) return;
      marqueurs.current.forEach((m) => m.remove());
      const icone = L.divIcon({ html: HTML_REPERE, className: "", iconSize: [30, 30], iconAnchor: [15, 15] });
      marqueurs.current = reperes.map((r) => {
        const m = L.marker([r.coords.lat, r.coords.lng], { icon: icone, title: r.titre, keyboard: false }).addTo(c);
        m.on("click", () => rappels.current.onRepere?.(r.id));
        return m;
      });
    });
    return () => {
      annule = true;
    };
  }, [reperes, prete]);

  return <div ref={conteneur} className={`isolate bg-[#DCEBF5] ${className}`} />;
}
