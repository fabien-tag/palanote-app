import { useCallback, useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { useNavigate } from "@tanstack/react-router";
import { CalendarPlus, X } from "lucide-react";
import { FormulaireNouvelleSortie } from "@/components/club/FormulaireSortie";
import { centreChoisi, mesCentres } from "@/lib/club";

// « Nouvelle sortie » : un panneau vertical qui glisse depuis la droite, par-dessus l'écran
// en cours (sur toute la largeur sur téléphone). La page /club/nouvelle-sortie reste pour les liens directs.
const EVENEMENT = "palanote-nouvelle-sortie";
type Options = { date?: string; retour?: "planning" };

export function useNouvelleSortie() {
  return useCallback((centre: string | null, o: Options = {}) => {
    if (!centre) return;
    window.dispatchEvent(new CustomEvent<Options>(EVENEMENT, { detail: o }));
  }, []);
}

export function PanneauNouvelleSortie() {
  const navigate = useNavigate();
  const [options, setOptions] = useState<Options | null>(null);
  const [entre, setEntre] = useState(false); // pour l'animation d'entrée et de sortie
  const [centre, setCentre] = useState<string | null>(null);
  const [cle, setCle] = useState(0); // formulaire neuf à chaque ouverture

  useEffect(() => {
    const ouvrir = (e: Event) => {
      setOptions((e as CustomEvent<Options>).detail ?? {});
      setCle((k) => k + 1);
      void mesCentres()
        .then((l) => setCentre(l.find((c) => c.id === centreChoisi())?.id ?? l[0]?.id ?? null))
        .catch(() => setCentre(null));
      requestAnimationFrame(() => requestAnimationFrame(() => setEntre(true)));
    };
    window.addEventListener(EVENEMENT, ouvrir);
    return () => window.removeEventListener(EVENEMENT, ouvrir);
  }, []);

  const fermer = useCallback(() => {
    setEntre(false);
    setTimeout(() => setOptions(null), 280);
  }, []);

  useEffect(() => {
    if (!options) return;
    const k = (e: KeyboardEvent) => e.key === "Escape" && fermer();
    window.addEventListener("keydown", k);
    return () => window.removeEventListener("keydown", k);
  }, [options, fermer]);

  if (!options || typeof document === "undefined") return null;
  return createPortal(
    <div className="bureau fixed inset-0 z-[60] flex justify-end" role="dialog" aria-modal="true" aria-label="Nouvelle sortie">
      <button
        type="button"
        aria-label="Fermer"
        onClick={fermer}
        className={`absolute inset-0 bg-[#0B2540]/35 transition-opacity duration-300 ${entre ? "opacity-100" : "opacity-0"}`}
      />
      <aside
        className={`relative flex h-full w-full max-w-[540px] flex-col bg-white text-[#123A63] shadow-[-16px_0_48px_#0B254033] transition-transform duration-300 ease-out ${
          entre ? "translate-x-0" : "translate-x-full"
        }`}
      >
        <header className="flex items-center gap-[12px] border-b border-[#DFEAF2] px-[24px] py-[16px]">
          <span className="flex h-[40px] w-[40px] items-center justify-center rounded-[10px] bg-[#E3F2FB] text-[#1176A8]">
            <CalendarPlus className="h-[20px] w-[20px]" />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-[19px] font-bold leading-tight">Nouvelle sortie</span>
            <span className="block text-[12.5px] text-[#7D93A8]">Les plongeurs s'inscrivent ensuite par QR code ou par lien.</span>
          </span>
          <button type="button" aria-label="Fermer" onClick={fermer} className="flex h-[38px] w-[38px] items-center justify-center rounded-[10px] bg-[#EEF3F8]">
            <X className="h-[18px] w-[18px]" />
          </button>
        </header>
        <div className="flex-1 overflow-y-auto px-[24px] pb-[20px]">
          {centre ? (
            <FormulaireNouvelleSortie
              key={cle}
              centre={centre}
              dateInitiale={options.date}
              onCree={(id, date) => {
                fermer();
                // La sortie créée s'ouvre dans le planning, à sa semaine (sur téléphone : sa page)
                if (window.matchMedia("(min-width: 1024px)").matches) navigate({ to: "/club/planning", search: { sortie: id, semaine: date } });
                else navigate({ to: "/club/sortie", search: { id } });
              }}
            />
          ) : (
            <p className="pt-[20px] text-[14px] text-[#5B7189]">Chargement…</p>
          )}
        </div>
      </aside>
    </div>,
    document.body,
  );
}
