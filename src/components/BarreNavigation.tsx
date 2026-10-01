import { useNavigate } from "@tanstack/react-router";
import { BookOpen, MapPin, User, Users } from "lucide-react";

// Barre de navigation du bas, commune aux pages internes.
type Onglet = "carnet" | "carte" | "amis" | "moi";

const onglets: { id: Onglet; label: string; icone: typeof BookOpen; to?: "/carnet" | "/carte" | "/moi" }[] = [
  { id: "carnet", label: "Carnet", icone: BookOpen, to: "/carnet" },
  { id: "carte", label: "Carte", icone: MapPin, to: "/carte" },
  { id: "amis", label: "Amis", icone: Users },
  { id: "moi", label: "Moi", icone: User, to: "/moi" },
];

export function BarreNavigation({ actif }: { actif: Onglet }) {
  const navigate = useNavigate();
  return (
    <nav
      aria-label="Navigation principale"
      className="sticky bottom-0 z-10 flex items-stretch border-t border-[#DFEAF2] bg-white px-[28px] pt-[10px] pb-[calc(10px+env(safe-area-inset-bottom))]"
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
      {onglets.map(({ id, label, icone: Icone, to }) => {
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
            className={`flex h-[33px] w-[58px] items-center justify-center rounded-[13px] ${
              estActif ? "bg-[#D5FAF0]" : ""
            }`}
          >
            <Icone className="h-[23px] w-[23px]" strokeWidth={1.7} aria-hidden="true" />
          </span>
          {label}
        </button>
        );
      })}
    </nav>
  );
}
