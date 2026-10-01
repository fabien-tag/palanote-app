import { CameraOff, Star } from "lucide-react";
import { minutesEnTexte, type CartePlongee } from "@/lib/plongees";

const MOIS = ["janvier", "février", "mars", "avril", "mai", "juin", "juillet", "août", "septembre", "octobre", "novembre", "décembre"];

// Vue liste du carnet : une plongée par ligne, vignette à gauche.
export function LigneDePlongee({ p, numero }: { p: CartePlongee; numero: number }) {
  const d = p.date ? new Date(p.date) : null;
  const date = d && !isNaN(d.getTime()) ? `${d.getDate()} ${MOIS[d.getMonth()]}` : "Sans date";
  const infos = [
    p.duree && minutesEnTexte(p.duree),
    p.tempFond && `${p.tempFond.replace(".", ",")} °C`,
    p.melange && p.melange.toLowerCase(),
  ].filter(Boolean);
  const profondeur = p.profMax ? Number(p.profMax.replace(",", ".")) : null;
  const profonde = profondeur !== null && profondeur >= 40;

  return (
    <div className="flex items-center gap-[14px] rounded-[20px] border-[1.5px] border-[#DCE7F0] bg-white p-[10px] pr-[12px] shadow-[0_4px_14px_#123A6308]">
      <div
        className="flex h-[58px] w-[58px] shrink-0 items-center justify-center overflow-hidden rounded-[13px] bg-cover bg-center"
        style={p.photo ? { backgroundImage: `url(${p.photo})` } : { background: "#E6F0F8" }}
      >
        {!p.photo && <CameraOff className="h-[20px] w-[20px] text-[#9DB9CF]" strokeWidth={1.8} aria-label="Pas de photo" />}
      </div>

      <div className="flex min-w-0 flex-grow flex-col gap-[3px]">
        <div className="flex items-start justify-between gap-2">
          <span className="truncate pt-[1px] text-[11.5px] text-[#9DB0C0]">
            Nº {numero} · {date}
          </span>
          {p.profMax && (
            <span
              className={`flex h-[20px] shrink-0 items-center rounded-[10px] px-[8px] text-[11px] font-bold ${
                profonde ? "bg-[#FF8A75] text-[#6B1F14]" : "bg-[#78EAC6] text-[#0B3B63]"
              }`}
            >
              {p.profMax.replace(".", ",")} m
            </span>
          )}
        </div>
        <div className="truncate text-[15.5px] font-bold leading-tight text-[#123A63]">
          {p.siteNom || "Site sans nom"}
        </div>
        <div className="flex min-w-0 items-center gap-[8px] pt-[2px]">
          {p.note > 0 && (
            <span className="flex h-[22px] shrink-0 items-center gap-[4px] rounded-[11px] bg-[#FFF1D9] px-[8px]">
              <Star className="h-[11px] w-[11px] fill-[#FFC65C] text-[#FFC65C]" aria-hidden="true" />
              <span className="text-[11.5px] font-bold leading-none text-[#123A63]">
                {p.note}
                <span className="font-semibold text-[#9DB0C0]">/5</span>
              </span>
            </span>
          )}
          <span className="truncate text-[12px] text-[#5B7189]">{infos.join(" · ")}</span>
        </div>
      </div>
    </div>
  );
}
