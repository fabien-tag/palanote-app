import { useEffect, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { IconeAmis, IconeCarnet, IconeCarte, IconeMoi, IconeSorties } from "@/components/IconesOnglets";
import { estDirecteurDePlongee, ongletSortiesGarde } from "@/lib/club";

// Barre de navigation du bas, commune aux pages internes.
// 5e onglet « Sorties » : seulement pour les directeurs de plongée (ou encadrants, clubs).
type Onglet = "carnet" | "carte" | "amis" | "club" | "moi";

const onglets: { id: Onglet; label: string; icone: typeof IconeCarnet; to?: "/carnet" | "/carte" | "/amis" | "/club" | "/moi" }[] = [
  { id: "carnet", label: "Carnet", icone: IconeCarnet, to: "/carnet" },
  { id: "carte", label: "Carte", icone: IconeCarte, to: "/carte" },
  { id: "amis", label: "Amis", icone: IconeAmis, to: "/amis" },
  { id: "club", label: "Sorties", icone: IconeSorties, to: "/club" },
  { id: "moi", label: "Moi", icone: IconeMoi, to: "/moi" },
];

export function BarreNavigation({ actif }: { actif: Onglet }) {
  const navigate = useNavigate();
  // Gardé sur le téléphone pour que l'onglet ne « saute » pas à chaque écran, puis vérifié en fond.
  const [dp, setDp] = useState(() => actif === "club" || ongletSortiesGarde());
  useEffect(() => {
    let actif_ = true;
    void estDirecteurDePlongee().then((oui) => actif_ && oui !== null && setDp(oui || actif === "club"));
    return () => {
      actif_ = false;
    };
  }, [actif]);
  const visibles = onglets.filter((o) => o.id !== "club" || dp);
  return (
    <nav
      aria-label="Navigation principale"
      className={`sticky bottom-0 z-10 flex items-stretch border-t border-[#DFEAF2] bg-white pt-[10px] pb-[calc(10px+env(safe-area-inset-bottom))] ${dp ? "pl-[26px] pr-[8px]" : "px-[28px]"}`}
    >
      <span
        aria-hidden="true"
        className="pointer-events-none absolute bottom-[calc(4px+env(safe-area-inset-bottom))] left-[3px] h-[49px] w-[27px] -rotate-[8deg]"
      >
        <svg viewBox="0 0 58 108" className="h-full w-full" fill="none">
          <g stroke="#FF8A75" strokeWidth={6} strokeLinecap="round" strokeLinejoin="round">
            <path d="M30 108C24 85 30 71 26 57S14 32 20 12" />
            <path d="M27 73C13 71 10 62 9 50L4 40" />
            <path d="M27 57C38 55 42 45 39 30L46 17" />
            <path d="M23 40C11 36 8 25 8 16" />
            <path d="M28 90C41 84 46 71 47 58L54 47" />
            <path d="M39 42L51 37" />
          </g>
        </svg>
      </span>
      {visibles.map(({ id, label, icone: Icone, to }) => {
        const estActif = id === actif;
        return (
        <button
          key={id}
          type="button"
          onClick={() => to && !estActif && navigate({ to })}
          aria-current={estActif ? "page" : undefined}
          className={`flex flex-1 flex-col items-center justify-start gap-[3px] text-[11px] leading-[17px] ${
            estActif ? "font-semibold text-[#123A63]" : "font-medium text-[#63809A]"
          }`}
        >
          <span
            className={`flex h-[33px] ${dp ? "w-[50px]" : "w-[58px]"} items-center justify-center galet-petit ${
              estActif ? "bg-[#D5FAF0]" : ""
            }`}
          >
            <Icone className="h-[25px] w-[25px]" />
          </span>
          {label}
        </button>
        );
      })}
    </nav>
  );
}
