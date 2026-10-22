import type { ReactNode } from "react";
import { ArrowUpRight } from "lucide-react";

// Briques du tableau de bord : blocs « bento », voyants, grands chiffres.

export const carte = "rounded-[22px] border border-[#E9EEF3] bg-white";
export const nombre = (n: number | undefined) => (n === undefined ? "—" : n.toLocaleString("fr-FR"));

// ---------- Voyants ----------

export type Couleur = "vert" | "orange" | "rouge" | "gris";
export const VOYANT: Record<Couleur, string> = {
  vert: "bg-[#14B88A] shadow-[0_0_0_4px_rgba(20,184,138,.15)]",
  orange: "bg-[#F59E0B] shadow-[0_0_0_4px_rgba(245,158,11,.18)]",
  rouge: "bg-[#E5484D] shadow-[0_0_0_4px_rgba(229,72,77,.16)]",
  gris: "bg-[#C5D1DC]",
};
export function Voyant({ couleur, pulse }: { couleur: Couleur; pulse?: boolean }) {
  return <span className={`inline-block h-[8px] w-[8px] shrink-0 rounded-full ${VOYANT[couleur]} ${pulse ? "animate-pulse" : ""}`} aria-hidden="true" />;
}

// ---------- Bento ----------

export function Bloc({
  titre,
  fond,
  voyant,
  onOuvrir,
  className = "",
  sombre,
  children,
}: {
  titre: string;
  fond: string;
  voyant?: Couleur | undefined;
  onOuvrir?: (() => void) | undefined;
  className?: string;
  sombre?: boolean;
  children: ReactNode;
}) {
  return (
    <div className={`relative flex min-h-[188px] flex-col overflow-hidden rounded-[22px] p-[20px] ${fond} ${className}`}>
      <div className="relative z-[1] flex items-start justify-between gap-2">
        <span className={`flex items-center gap-[8px] text-[13px] font-medium ${sombre ? "text-white/80" : "text-[#123A63]/70"}`}>
          {voyant && <Voyant couleur={voyant} pulse={voyant !== "gris" && voyant !== "vert"} />}
          {titre}
        </span>
        {onOuvrir && (
          <button
            type="button"
            onClick={onOuvrir}
            aria-label={`Ouvrir : ${titre}`}
            className={`-mr-[6px] -mt-[6px] flex h-[30px] w-[30px] items-center justify-center rounded-full transition ${sombre ? "text-white/80 hover:bg-white/15" : "text-[#566B82] hover:bg-white/60"}`}
          >
            <ArrowUpRight className="h-[16px] w-[16px]" />
          </button>
        )}
      </div>
      <div className="relative z-[1] flex flex-1 flex-col">{children}</div>
    </div>
  );
}

export function GrandNombre({ valeur, unite, sombre }: { valeur: string; unite?: string; sombre?: boolean }) {
  return (
    <div className={`mt-auto flex items-baseline gap-[8px] ${sombre ? "text-white" : "text-[#0F2A4A]"}`}>
      <span className="text-[44px] font-light leading-none tracking-[-0.02em]">{valeur}</span>
      {unite && <span className={`text-[13px] ${sombre ? "text-white/75" : "text-[#566B82]"}`}>{unite}</span>}
    </div>
  );
}

// Arc fin (jauge) dessiné en SVG
export function Arc({ part, couleur }: { part: number; couleur: string }) {
  const p = Math.max(0, Math.min(1, part));
  const r = 52;
  const long = Math.PI * r;
  return (
    <svg viewBox="0 0 120 64" className="h-[64px] w-[120px]" aria-hidden="true">
      <path d={`M8 60 A${r} ${r} 0 0 1 112 60`} fill="none" stroke="currentColor" strokeOpacity=".18" strokeWidth="2" strokeDasharray="2 5" strokeLinecap="round" />
      <path d={`M8 60 A${r} ${r} 0 0 1 112 60`} fill="none" stroke={couleur} strokeWidth="2.5" strokeLinecap="round" strokeDasharray={`${long * p} ${long}`} />
    </svg>
  );
}

