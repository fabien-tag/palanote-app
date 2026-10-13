import { useCallback, useEffect, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";

// Un panneau vertical qui glisse depuis la droite, par-dessus l'écran en cours
// (pleine largeur sur téléphone). Échap ou clic à côté pour fermer.
export function PanneauLateral({
  titre,
  sousTitre,
  surTitre,
  onFermer,
  droite,
  pied,
  children,
  largeur = 560,
}: {
  titre: string;
  sousTitre?: string | undefined;
  surTitre?: string | undefined;
  onFermer: () => void;
  droite?: ReactNode;
  pied?: ReactNode;
  children: ReactNode;
  largeur?: number;
}) {
  const [entre, setEntre] = useState(false);
  useEffect(() => {
    requestAnimationFrame(() => requestAnimationFrame(() => setEntre(true)));
  }, []);
  const fermer = useCallback(() => {
    setEntre(false);
    setTimeout(onFermer, 260);
  }, [onFermer]);
  useEffect(() => {
    const k = (e: KeyboardEvent) => e.key === "Escape" && fermer();
    window.addEventListener("keydown", k);
    return () => window.removeEventListener("keydown", k);
  }, [fermer]);
  if (typeof document === "undefined") return null;
  return createPortal(
    <div className="bureau fixed inset-0 z-[60] flex justify-end" role="dialog" aria-modal="true" aria-label={titre}>
      <button type="button" aria-label="Fermer" onClick={fermer} className={`absolute inset-0 bg-[#0B2540]/30 transition-opacity duration-300 ${entre ? "opacity-100" : "opacity-0"}`} />
      <aside
        style={{ maxWidth: largeur }}
        className={`relative flex h-full w-full flex-col bg-white text-[#123A63] shadow-[-16px_0_48px_#0B254033] transition-transform duration-300 ease-out ${entre ? "translate-x-0" : "translate-x-full"}`}
      >
        <header className="flex items-start gap-[12px] border-b border-[#DFEAF2] px-[32px] py-[18px]">
          <span className="min-w-0 flex-1">
            {surTitre && <span className="block text-[12px] font-bold uppercase tracking-[.08em] text-[#1176A8]">{surTitre}</span>}
            <span className="block pt-[2px] text-[21px] font-bold leading-tight">{titre}</span>
            {sousTitre && <span className="block pt-[2px] text-[13px] text-[#5B7189]">{sousTitre}</span>}
          </span>
          {droite}
          <button type="button" aria-label="Fermer" onClick={fermer} className="flex h-[36px] w-[36px] shrink-0 items-center justify-center rounded-[10px] bg-[#EEF3F8]">
            <X className="h-[17px] w-[17px]" />
          </button>
        </header>
        <div className="flex-1 overflow-y-auto px-[32px] pb-[24px]">{children}</div>
        {pied && <div className="border-t border-[#DFEAF2] px-[32px] py-[14px]">{pied}</div>}
      </aside>
    </div>,
    document.body,
  );
}
