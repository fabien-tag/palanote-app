import { useEffect, useState, type ReactNode } from "react";
import { CalendarDays, LayoutDashboard, LifeBuoy, UsersRound } from "lucide-react";
import { useNavigate } from "@tanstack/react-router";
import { IconeAmis, IconeCarnet, IconeCarte, IconeMoi, IconeSorties } from "@/components/IconesOnglets";
import logoSigle from "@/assets/palanote-logo-cigle.png";
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

export type PageClub = "accueil" | "planning" | "equipe" | "materiel";

const ENTREES_CLUB: { id: PageClub; label: string; Icone: typeof LayoutDashboard; to: "/club" | "/club/planning" | "/club/equipe" | "/club/materiel" }[] = [
  { id: "accueil", label: "Tableau de bord", Icone: LayoutDashboard, to: "/club" },
  { id: "planning", label: "Planning", Icone: CalendarDays, to: "/club/planning" },
  { id: "equipe", label: "Équipe", Icone: UsersRound, to: "/club/equipe" },
  { id: "materiel", label: "Matériel", Icone: LifeBuoy, to: "/club/materiel" },
];

function EntreeLaterale({ label, actif, onClick, children }: { label: string; actif: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-current={actif ? "page" : undefined}
      className={`flex h-[44px] items-center gap-[12px] galet-petit px-[12px] text-left text-[14.5px] ${
        actif ? "bg-[#D5FAF0] font-bold text-[#123A63]" : "font-medium text-[#63809A] hover:bg-[#F1F6FC]"
      }`}
    >
      {children}
      {label}
    </button>
  );
}

// cote : sur ordinateur (écran large), la barre du bas devient une colonne à gauche,
// avec la section Club du directeur de plongée (club = la page du club ouverte).
export function BarreNavigation({ actif, cote = false, club = "accueil" }: { actif: Onglet; cote?: boolean; club?: PageClub }) {
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
    <>
    {cote && (
      <nav
        aria-label="Navigation principale"
        className="fixed inset-y-0 left-0 z-20 hidden w-[232px] flex-col overflow-y-auto border-r border-[#DFEAF2] bg-white px-[16px] pb-[20px] pt-[24px] lg:flex"
      >
        <span className="flex items-center gap-[10px] px-[10px] pb-[24px]">
          <span className="flex h-[38px] w-[38px] items-center justify-center goutte bg-[#0F3D70]">
            <img src={logoSigle} alt="" className="h-[24px] w-[24px] object-contain" />
          </span>
          <span className="text-[21px] font-bold tracking-[-.01em] text-[#123A63]">Palanote</span>
        </span>
        {dp && (
          <>
            <span className="px-[12px] pb-[6px] text-[11px] font-bold uppercase tracking-[.1em] text-[#9DB0C0]">Club</span>
            <div className="flex flex-col gap-[2px] pb-[18px]">
              {ENTREES_CLUB.map(({ id, label, Icone, to }) => (
                <EntreeLaterale key={id} label={label} actif={actif === "club" && club === id} onClick={() => navigate({ to })}>
                  <Icone className="h-[21px] w-[21px] shrink-0" strokeWidth={2} />
                </EntreeLaterale>
              ))}
            </div>
            <span className="px-[12px] pb-[6px] text-[11px] font-bold uppercase tracking-[.1em] text-[#9DB0C0]">Mon carnet</span>
          </>
        )}
        <div className="flex flex-col gap-[2px]">
          {visibles
            .filter((o) => o.id !== "club")
            .map(({ id, label, icone: Icone, to }) => (
              <EntreeLaterale key={id} label={label} actif={id === actif} onClick={() => to && id !== actif && navigate({ to })}>
                <Icone className="h-[22px] w-[22px] shrink-0" />
              </EntreeLaterale>
            ))}
        </div>
        <span aria-hidden="true" className="pointer-events-none mt-auto block h-[96px] w-[52px] shrink-0 -rotate-[8deg] self-start pt-[16px] opacity-90">
          <svg viewBox="0 0 58 108" className="h-full w-full" fill="none">
            <g stroke="#FF8A75" strokeWidth={5} strokeLinecap="round" strokeLinejoin="round">
              <path d="M30 108C24 85 30 71 26 57S14 32 20 12" />
              <path d="M27 73C13 71 10 62 9 50L4 40" />
              <path d="M27 57C38 55 42 45 39 30L46 17" />
              <path d="M23 40C11 36 8 25 8 16" />
              <path d="M28 90C41 84 46 71 47 58L54 47" />
              <path d="M39 42L51 37" />
            </g>
          </svg>
        </span>
      </nav>
    )}
    <nav
      aria-label="Navigation principale"
      className={`${cote ? "lg:hidden" : ""} sticky bottom-0 z-10 flex items-stretch border-t border-[#DFEAF2] bg-white pt-[10px] pb-[calc(10px+env(safe-area-inset-bottom))] ${dp ? "pl-[26px] pr-[8px]" : "px-[28px]"}`}
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
    </>
  );
}
