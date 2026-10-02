import { useEffect, useRef, useState } from "react";
import { X } from "lucide-react";

// Carrousel des photos d'une plongée (haut de la fiche), avec agrandissement plein écran.
// Glisser d'une photo à l'autre ; un appui ouvre la photo en grand.

type Photo = { url: string };

// Indice de la photo visible, d'après la position de défilement de la piste.
function useIndexDefilement() {
  const [index, setIndex] = useState(0);
  const surDefilement = (e: React.UIEvent<HTMLDivElement>) => {
    const el = e.currentTarget;
    setIndex(Math.round(el.scrollLeft / Math.max(1, el.clientWidth)));
  };
  return [index, surDefilement] as const;
}

function Points({ total, actif, clair }: { total: number; actif: number; clair?: boolean }) {
  if (total < 2) return null;
  return (
    <div className="flex items-center justify-center gap-[6px]" aria-hidden="true">
      {Array.from({ length: total }, (_, i) => (
        <span
          key={i}
          className={`h-[6px] rounded-full transition-all ${i === actif ? "w-[18px] bg-white" : `w-[6px] ${clair ? "bg-white/45" : "bg-white/55"}`}`}
        />
      ))}
    </div>
  );
}

export function CarrouselPhotos({ photos }: { photos: Photo[] }) {
  const piste = useRef<HTMLDivElement>(null);
  const [index, surDefilement] = useIndexDefilement();
  const [grand, setGrand] = useState<number | null>(null);

  if (photos.length === 0) return null;
  return (
    <>
      <div className="relative mx-[22px] mt-4 overflow-hidden galet bg-[#0E3D72] shadow-[0_6px_18px_#123A6314]">
        <div ref={piste} onScroll={surDefilement} className="flex h-[260px] snap-x snap-mandatory overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {photos.map((p, i) => (
            <button
              key={p.url}
              type="button"
              onClick={() => setGrand(i)}
              aria-label={`Agrandir la photo ${i + 1} sur ${photos.length}`}
              className="h-full w-full shrink-0 snap-center"
            >
              <img src={p.url} alt="" className="h-full w-full object-cover" loading={i === 0 ? "eager" : "lazy"} draggable={false} />
            </button>
          ))}
        </div>
        <div className="pointer-events-none absolute inset-x-0 bottom-0 h-[70px] bg-[linear-gradient(180deg,transparent,rgba(5,22,46,.55))]" />
        {photos.length > 1 && (
          <span className="pointer-events-none absolute right-[12px] top-[12px] rounded-full bg-[#0A2A50]/60 px-[10px] py-[3px] text-[12px] font-semibold text-white">
            {Math.min(index + 1, photos.length)} / {photos.length}
          </span>
        )}
        <div className="pointer-events-none absolute inset-x-0 bottom-[12px]">
          <Points total={photos.length} actif={index} />
        </div>
      </div>
      {grand !== null && <PleinEcran photos={photos} depart={grand} onFermer={() => setGrand(null)} />}
    </>
  );
}

function PleinEcran({ photos, depart, onFermer }: { photos: Photo[]; depart: number; onFermer: () => void }) {
  const piste = useRef<HTMLDivElement>(null);
  const [index, surDefilement] = useIndexDefilement();

  useEffect(() => {
    const el = piste.current;
    if (el) el.scrollLeft = depart * el.clientWidth;
    const echap = (e: KeyboardEvent) => e.key === "Escape" && onFermer();
    window.addEventListener("keydown", echap);
    const ancien = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", echap);
      document.body.style.overflow = ancien;
    };
  }, [depart, onFermer]);

  return (
    <div role="dialog" aria-modal="true" aria-label="Photos de la plongée" className="fixed inset-0 z-50 flex flex-col bg-[#04142A]">
      <div className="flex items-center justify-between px-[18px] pb-[10px] pt-[max(16px,env(safe-area-inset-top))]">
        <span className="text-[14px] font-semibold text-white/85">
          {Math.min(index + 1, photos.length)} / {photos.length}
        </span>
        <button type="button" onClick={onFermer} aria-label="Fermer" className="flex h-10 w-10 items-center justify-center goutte bg-white/15">
          <X className="h-5 w-5 text-white" strokeWidth={2.2} aria-hidden="true" />
        </button>
      </div>
      <div ref={piste} onScroll={surDefilement} className="flex flex-1 snap-x snap-mandatory overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {photos.map((p, i) => (
          <div key={p.url} className="flex h-full w-full shrink-0 snap-center items-center justify-center px-[8px]">
            <img src={p.url} alt={`Photo ${i + 1} sur ${photos.length}`} className="max-h-full max-w-full object-contain" draggable={false} />
          </div>
        ))}
      </div>
      <div className="pb-[max(22px,env(safe-area-inset-bottom))] pt-[14px]">
        <Points total={photos.length} actif={index} clair />
      </div>
    </div>
  );
}
