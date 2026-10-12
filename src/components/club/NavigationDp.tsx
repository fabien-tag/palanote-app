import { useEffect, useState } from "react";
import { Link, useRouterState } from "@tanstack/react-router";
import { CalendarDays, LayoutDashboard, LifeBuoy, Map as IconeCarte, Settings, UsersRound, Waves } from "lucide-react";
import logoSigle from "@/assets/palanote-logo-cigle.png";
import { accueilDp, centreChoisi, mesCentres, type Centre } from "@/lib/club";
import { adherentsCentre, ajouterJours, alertesSortie, aujourdhui, controleProche, planningCentre } from "@/lib/planning";

// Colonne de navigation du directeur de plongée sur ordinateur.
// Elle reste en place quand on change d'écran (seul le contenu change) et porte des voyants :
// actions en attente, points à régler sur les 14 prochains jours, matériel à contrôler.

type Cible = "/club" | "/club/planning" | "/club/equipe" | "/club/materiel" | "/club/carte" | "/club/membres" | "/club/parametres";

const ENTREES: { to: Cible; label: string; Icone: typeof LayoutDashboard; voyant?: "faire" | "planning" | "materiel" | "membres" }[] = [
  { to: "/club", label: "Tableau de bord", Icone: LayoutDashboard, voyant: "faire" },
  { to: "/club/planning", label: "Planning", Icone: CalendarDays, voyant: "planning" },
  { to: "/club/equipe", label: "Équipe", Icone: UsersRound },
  { to: "/club/materiel", label: "Matériel", Icone: LifeBuoy, voyant: "materiel" },
  { to: "/club/carte", label: "Carte du club", Icone: IconeCarte },
  { to: "/club/membres", label: "Membres du club", Icone: Waves, voyant: "membres" },
];

export type Voyants = { faire: number; planning: number; materiel: number; materielDepasse: boolean; membres: number; membresDepasse: boolean };

// Les voyants du centre, recalculés à chaque changement d'écran
export function useVoyants(centre: string | null, cle: string) {
  const [v, setV] = useState<Voyants | null>(null);
  useEffect(() => {
    if (!centre) return;
    let actif = true;
    const auj = aujourdhui();
    void Promise.allSettled([planningCentre(centre, auj, ajouterJours(auj, 13)), accueilDp(centre), adherentsCentre(centre)]).then(([p, a, m]) => {
      if (!actif) return;
      const plan = p.status === "fulfilled" ? p.value : null;
      const acc = a.status === "fulfilled" ? a.value : null;
      const controles = (plan?.materiel ?? []).map((m) => controleProche(m.prochain_controle)).filter(Boolean);
      const certificats = (m.status === "fulfilled" ? m.value : []).map((x) => controleProche(x.certificat_fin)).filter(Boolean);
      setV({
        faire: acc?.a_faire.length ?? 0,
        planning: plan ? plan.sorties.reduce((t, s) => t + alertesSortie(s, plan.sorties, plan.materiel).length, 0) : 0,
        materiel: controles.length,
        materielDepasse: controles.includes("depasse"),
        membres: certificats.length,
        membresDepasse: certificats.includes("depasse"),
      });
    });
    return () => {
      actif = false;
    };
  }, [centre, cle]);
  return v;
}

export function NavigationDp() {
  const chemin = useRouterState({ select: (s) => s.location.pathname });
  const [centres, setCentres] = useState<Centre[] | null>(null);
  useEffect(() => {
    void mesCentres()
      .then(setCentres)
      .catch(() => setCentres([]));
  }, []);
  const centre = centres?.find((c) => c.id === centreChoisi()) ?? centres?.[0] ?? null;
  const voyants = useVoyants(centre?.id ?? null, chemin);
  const actif = (to: Cible) => (to === "/club" ? chemin === "/club" || chemin === "/club/" : chemin.startsWith(to));

  const entree = (to: Cible, label: string, Icone: typeof LayoutDashboard, voyant?: "faire" | "planning" | "materiel" | "membres") => {
    const nb = voyant && voyants ? voyants[voyant] : 0;
    const rouge = voyant === "planning" || (voyant === "materiel" && voyants?.materielDepasse) || (voyant === "membres" && voyants?.membresDepasse);
    return (
      <Link
        key={to}
        to={to}
        aria-current={actif(to) ? "page" : undefined}
        className={`flex h-[44px] items-center gap-[12px] rounded-[10px] px-[12px] text-[14.5px] transition-colors ${
          actif(to) ? "bg-[#D5FAF0] font-bold text-[#123A63]" : "font-medium text-[#63809A] hover:bg-[#F1F6FC]"
        }`}
      >
        <Icone className="h-[20px] w-[20px] shrink-0" strokeWidth={2} />
        <span className="flex-1 whitespace-nowrap">{label}</span>
        {nb > 0 && (
          <span
            className={`min-w-[22px] rounded-[10px] px-[6px] py-[1px] text-center text-[11.5px] font-bold ${
              rouge ? "bg-[#FF8A75] text-white" : voyant === "materiel" || voyant === "membres" ? "bg-[#F5B544] text-[#4A3000]" : "bg-[#0F3D70] text-white"
            }`}
            aria-label={`${nb} point${nb > 1 ? "s" : ""} à voir`}
          >
            {nb}
          </span>
        )}
      </Link>
    );
  };

  return (
    <nav
      aria-label="Navigation du club"
      className="fixed inset-y-0 left-0 z-20 hidden w-[232px] flex-col overflow-y-auto border-r border-[#DFEAF2] bg-white px-[16px] pb-[18px] pt-[24px] lg:flex"
    >
      <span className="flex items-center gap-[10px] px-[10px] pb-[22px]">
        <span className="flex h-[38px] w-[38px] items-center justify-center rounded-[10px] bg-[#0F3D70]">
          <img src={logoSigle} alt="" className="h-[24px] w-[24px] object-contain" />
        </span>
        <span>
          <span className="block text-[19px] font-bold leading-tight tracking-[-.01em] text-[#123A63]">Palanote</span>
          <span className="block text-[11px] font-bold uppercase tracking-[.1em] text-[#1176A8]">Club</span>
        </span>
      </span>
      <div className="flex flex-col gap-[2px]">{ENTREES.map((e) => entree(e.to, e.label, e.Icone, e.voyant))}</div>
      <div className="mt-auto flex flex-col gap-[10px] pt-[20px]">
        {entree("/club/parametres", "Paramètres", Settings)}
        {centre && (
          <div className="flex items-center gap-[10px] rounded-[10px] border border-[#E4EBF1] px-[10px] py-[9px]">
            <span className="flex h-[32px] w-[32px] shrink-0 items-center justify-center rounded-[10px] bg-[#E3F2FB] text-[12px] font-bold text-[#1176A8]">
              {centre.nom
                .split(/\s+/)
                .slice(0, 2)
                .map((m) => m[0])
                .join("")
                .toUpperCase()}
            </span>
            <span className="min-w-0">
              <span className="block truncate text-[13px] font-bold">{centre.nom}</span>
              <span className="block truncate text-[11.5px] text-[#7D93A8]">{centre.ville ?? "Centre de plongée"}</span>
            </span>
          </div>
        )}
      </div>
    </nav>
  );
}
