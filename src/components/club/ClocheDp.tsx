import { useEffect, useState } from "react";
import { Link, useRouterState } from "@tanstack/react-router";
import { Bell } from "lucide-react";
import { EVENEMENT_NOTIFICATIONS, nombreNonLues } from "@/lib/notifications";

// La cloche du directeur de plongée : rappels (matériel, certificats, sorties) et inscriptions
export function ClocheDp({ className = "" }: { className?: string }) {
  const chemin = useRouterState({ select: (s) => s.location.pathname });
  const [nb, setNb] = useState(0);
  useEffect(() => {
    let actif = true;
    const maj = () => void nombreNonLues().then((n) => actif && setNb(n));
    maj();
    window.addEventListener(EVENEMENT_NOTIFICATIONS, maj);
    return () => {
      actif = false;
      window.removeEventListener(EVENEMENT_NOTIFICATIONS, maj);
    };
  }, [chemin]);
  return (
    <Link
      to="/club/notifications"
      aria-label={nb > 0 ? `Notifications, ${nb} nouvelle${nb > 1 ? "s" : ""}` : "Notifications"}
      className={`relative flex h-[40px] w-[40px] shrink-0 items-center justify-center rounded-[10px] border border-[#E4EBF1] bg-white text-[#123A63] hover:bg-[#F1F6FC] ${className}`}
    >
      <Bell className="h-[19px] w-[19px]" strokeWidth={2} />
      {nb > 0 && (
        <span className="absolute -right-[6px] -top-[6px] min-w-[19px] rounded-[10px] bg-[#FF8A75] px-[5px] text-center text-[10.5px] font-bold leading-[19px] text-white">
          {nb > 99 ? "99+" : nb}
        </span>
      )}
    </Link>
  );
}
