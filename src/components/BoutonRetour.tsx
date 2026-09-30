import { useNavigate } from "@tanstack/react-router";
import { ChevronLeft } from "lucide-react";

/** Flèche retour : tout le carré 44 × 44 px est cliquable et mène à l'écran précédent du parcours. */
export function BoutonRetour({ clair = false, defaut = "/" }: { clair?: boolean; defaut?: string }) {
  const navigate = useNavigate();
  return (
    <button
      type="button"
      onClick={() => navigate({ to: defaut })}
      aria-label="Retour"
      className={
        (clair ? "bg-blanc/20 text-blanc " : "text-encre ") +
        "fixed left-5 top-5 z-50 flex h-11 w-11 cursor-pointer touch-manipulation items-center justify-center rounded-[5px]"
      }
    >
      <ChevronLeft className="pointer-events-none h-6 w-6" aria-hidden />
    </button>
  );
}
