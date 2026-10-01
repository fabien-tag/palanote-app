import { useEffect, useState } from "react";
import { CheckCircle2 } from "lucide-react";

// Bandeau qui descend du haut de l'écran, reste quelques secondes, puis disparaît.
export function BandeauConfirmation({ texte, onFin }: { texte: string; onFin: () => void }) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const entree = requestAnimationFrame(() => setVisible(true));
    const sortie = setTimeout(() => setVisible(false), 3000);
    const fin = setTimeout(onFin, 3400);
    return () => {
      cancelAnimationFrame(entree);
      clearTimeout(sortie);
      clearTimeout(fin);
    };
  }, [onFin]);

  return (
    <div className="pointer-events-none fixed inset-x-0 top-0 z-50 flex justify-center px-4 pt-[max(12px,env(safe-area-inset-top))]">
      <div
        role="status"
        aria-live="polite"
        className={`flex w-full max-w-[398px] items-center gap-[10px] rounded-[14px] border border-[#B8E4D8] bg-white px-[16px] py-[13px] text-[14px] font-semibold text-[#123A63] shadow-[0_8px_24px_rgba(15,61,112,.28)] transition-all duration-300 ${
          visible ? "translate-y-0 opacity-100" : "-translate-y-6 opacity-0"
        }`}
      >
        <CheckCircle2 className="h-[20px] w-[20px] shrink-0 text-[#14B88A]" strokeWidth={2.2} aria-hidden="true" />
        {texte}
      </div>
    </div>
  );
}
