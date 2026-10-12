import { useNavigate } from "@tanstack/react-router";
import { IconeAmis, IconeCarnet, IconeCarte, IconeMoi } from "@/components/IconesOnglets";

// Barre de navigation du bas, commune aux pages internes de l'app du plongeur.
// Le directeur de plongée n'a pas d'onglet ici : son espace club se travaille sur ordinateur
// (colonne de gauche, components/club/NavigationDp).
type Onglet = "carnet" | "carte" | "amis" | "club" | "moi";

const onglets: { id: Onglet; label: string; icone: typeof IconeCarnet; to?: "/carnet" | "/carte" | "/amis" | "/club" | "/moi" }[] = [
  { id: "carnet", label: "Carnet", icone: IconeCarnet, to: "/carnet" },
  { id: "carte", label: "Carte", icone: IconeCarte, to: "/carte" },
  { id: "amis", label: "Amis", icone: IconeAmis, to: "/amis" },
  { id: "moi", label: "Moi", icone: IconeMoi, to: "/moi" },
];

// cote : écrans du club, où la navigation passe dans la colonne de gauche sur ordinateur
// (components/club/NavigationDp) ; la barre du bas n'y apparaît que sur téléphone.
export function BarreNavigation({ actif, cote = false }: { actif: Onglet; cote?: boolean }) {
  const navigate = useNavigate();
  const visibles = onglets;
  return (
    <nav
      aria-label="Navigation principale"
      className={`${cote ? "lg:hidden" : ""} sticky bottom-0 z-10 flex items-stretch border-t border-[#DFEAF2] bg-white pt-[10px] pb-[calc(10px+env(safe-area-inset-bottom))] px-[28px]`}
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
            className={`flex h-[33px] w-[58px] items-center justify-center galet-petit ${
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
