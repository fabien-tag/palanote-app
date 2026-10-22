import { CameraOff, Star } from "lucide-react";
import { minutesEnTexte, type CartePlongee } from "@/lib/plongees";
import { GOUTTE } from "@/lib/formes";

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
  return (
    <div style={{ borderRadius: "22px 14px 24px 12px / 16px 20px 14px 22px" }} className="flex items-center gap-[11px] border border-[#DCE7F0] bg-white p-[9px] shadow-[0_4px_14px_#123A6308]">
      <div
        className="flex h-[58px] w-[58px] shrink-0 items-center justify-center overflow-hidden bg-cover bg-center"
        style={{ borderRadius: GOUTTE, ...(p.photo ? { backgroundImage: `url(${p.photo})` } : { background: "#E8F4FB" }) }}
      >
        {!p.photo && <CameraOff className="h-[20px] w-[20px] text-[#8FBAD4]" strokeWidth={1.8} aria-label="Pas de photo" />}
      </div>

      <div className="flex min-w-0 flex-grow flex-col gap-[2px]">
        <div className="flex items-center justify-between gap-2">
          <span className="truncate text-[11px] text-[#566B82]">
            Nº {numero} · {date}
          </span>
          {p.profMax && (
            <span
              className="flex h-[19px] shrink-0 items-center rounded-[10px] bg-[#3DEFBE] px-[8px] text-[10px] font-bold text-[#0B3B63]"
            >
              {p.profMax.replace(".", ",")} m
            </span>
          )}
        </div>
        <div className="truncate text-[14.5px] font-semibold leading-snug text-[#123A63]">
          {p.siteNom || "Site sans nom"}
        </div>
        <div className="flex min-w-0 items-center gap-[8px]">
          {p.note > 0 && (
            <span className="flex h-[21px] shrink-0 items-center gap-[4px] rounded-[11px] bg-[#FFC65C]/[0.22] px-[8px]">
              <Star className="h-[11px] w-[11px] fill-[#FFC65C] text-[#FFC65C]" aria-hidden="true" />
              <span className="text-[11px] font-bold leading-none text-[#123A63]">
                {p.note}
                <span className="font-semibold text-[#566B82]">/5</span>
              </span>
            </span>
          )}
          <span className="truncate text-[11.5px] text-[#566B82]">{infos.join(" · ")}</span>
        </div>
      </div>
    </div>
  );
}
