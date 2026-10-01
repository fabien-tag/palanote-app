import { MapPin, Star, CameraOff } from "lucide-react";
import { minutesEnTexte, type CartePlongee } from "@/lib/plongees";

const MOIS = ["JANVIER", "FÉVRIER", "MARS", "AVRIL", "MAI", "JUIN", "JUILLET", "AOÛT", "SEPTEMBRE", "OCTOBRE", "NOVEMBRE", "DÉCEMBRE"];
const AVATARS = ["#3DEFBE", "#FF8A75", "#57D4F5", "#FFC65C"];

function initiales(nom: string) {
  const m = nom.trim().split(/\s+/);
  return ((m[0]?.[0] ?? "") + (m[1]?.[0] ?? m[0]?.[1] ?? "")).toUpperCase();
}

export function CarteDePlongee({ p }: { p: CartePlongee }) {
  const d = p.date ? new Date(p.date) : null;
  const valide = d && !isNaN(d.getTime());
  const infos = [
    p.duree && minutesEnTexte(p.duree),
    p.tempFond && `${p.tempFond} °C`,
    p.melange && p.melange.toLowerCase(),
  ].filter(Boolean);
  const visibles = p.binomes.slice(0, 2);
  const reste = p.binomes.length - visibles.length;

  return (
    <div className="rounded-[22px] border border-[#DCE7F0] bg-white p-[7px] shadow-[0_4px_14px_#123A6308]">
      <div
        className="relative flex h-[182px] flex-col justify-between overflow-hidden rounded-[17px] bg-cover bg-center px-[15px] py-[14px]"
        style={p.photo ? { backgroundImage: `url(${p.photo})` } : { background: "linear-gradient(150deg,#3E7BA8,#16385C)" }}
      >
        <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(6,30,60,.34)_0%,rgba(6,26,52,.06)_42%,rgba(5,22,46,.80)_100%)]" />
        <div className="relative z-[2] flex items-start justify-between">
          <div className="leading-none">
            <div className="text-[27px] font-bold text-white">{valide ? d.getDate() : "—"}</div>
            <div className="pt-[3px] text-[11px] font-semibold tracking-[.12em] text-white/85">
              {valide ? MOIS[d.getMonth()] : "SANS DATE"}
            </div>
          </div>
          {p.profMax && (
            <div className="flex h-[22px] items-center rounded-[11px] bg-[#3DEFBE] px-[9px] text-[11px] font-bold text-[#0B3B63]">
              {p.profMax.replace(".", ",")} m
            </div>
          )}
        </div>
        {!p.photo && (
          <div className="absolute inset-x-0 top-1/2 z-[1] flex -translate-y-1/2 flex-col items-center gap-[7px]">
            <CameraOff className="h-[26px] w-[26px] text-white/60" strokeWidth={1.8} />
            <div className="text-[12px] font-medium text-white/70">Pas de photo</div>
          </div>
        )}
        <div className="relative z-[2]">
          {p.note > 0 && (
            <div className="flex pb-[9px]">
              <div className="flex h-[26px] items-center gap-[5px] rounded-[13px] bg-white px-[10px] shadow-[0_2px_7px_rgba(9,38,74,.20)]">
                <Star className="h-[13px] w-[13px] fill-[#FFC65C] text-[#FFC65C]" />
                <span className="text-[12.5px] font-bold leading-none text-[#123A63]">
                  {p.note}<span className="font-semibold text-[#9DB0C0]">/5</span>
                </span>
              </div>
            </div>
          )}
          <div className="text-[21px] font-bold leading-[1.15] text-white">{p.siteNom || "Site sans nom"}</div>
          {p.siteLieu && (
            <div className="flex items-center gap-[5px] pt-[7px]">
              <MapPin className="h-[14px] w-[14px] text-white" strokeWidth={2.2} />
              <span className="text-[13px] font-semibold text-white/90">{p.siteLieu}</span>
            </div>
          )}
        </div>
      </div>
      <div className="flex items-center justify-between gap-[10px] px-[9px] pb-[5px] pt-[13px]">
        <div className="text-[12.5px] text-[#5B7189]">{infos.join(" · ") || "\u00a0"}</div>
        <div className="flex">
          {visibles.map((b, i) => (
            <div
              key={b + i}
              className="-ml-[9px] flex h-7 w-7 items-center justify-center rounded-full border-2 border-white text-[9.5px] font-bold text-[#0F3D70] first:ml-0"
              style={{ background: AVATARS[i % AVATARS.length] }}
            >
              {initiales(b)}
            </div>
          ))}
          {reste > 0 && (
            <div className="-ml-[9px] flex h-7 w-7 items-center justify-center rounded-full border-2 border-white bg-[#DCE4EC] text-[9.5px] font-bold text-[#0F3D70]">
              +{reste}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
