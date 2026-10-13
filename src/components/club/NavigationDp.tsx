import { useEffect, useState } from "react";
import { Link, useRouterState } from "@tanstack/react-router";
import { CalendarDays, CircleHelp, GraduationCap, Plus, LayoutDashboard, LifeBuoy, Map as IconeCarte, MoreHorizontal, Settings, Star, UsersRound, Waves, X } from "lucide-react";
import logoSigle from "@/assets/palanote-logo-cigle.png";
import { useNouvelleSortie } from "@/components/club/PanneauNouvelleSortie";
import { accueilDp, centreChoisi, EVENEMENT_CENTRE, mesCentres, type Centre } from "@/lib/club";
import { adherentsCentre, ajouterJours, alertesSortie, aujourdhui, controleProche, planningCentre } from "@/lib/planning";

// Colonne de navigation du directeur de plongée sur ordinateur.
// Elle reste en place quand on change d'écran (seul le contenu change) et porte des voyants :
// actions en attente, points à régler sur les 14 prochains jours, matériel à contrôler.

type Cible =
  | "/club"
  | "/club/planning"
  | "/club/equipe"
  | "/club/materiel"
  | "/club/carte"
  | "/club/membres"
  | "/club/privilegies"
  | "/club/parametres"
  | "/club/notifications"
  | "/club/formations";
type Entree = { to: Cible; label: string; Icone: typeof LayoutDashboard; voyant?: "faire" | "planning" | "materiel" | "membres" };

// La colonne est rangée en sections : le quotidien du DP, puis les ressources du club ;
// les réglages et l'aide restent en bas, à part.
const SECTIONS: { titre: string; entrees: Entree[] }[] = [
  {
    titre: "Mes sorties",
    entrees: [
      { to: "/club", label: "Tableau de bord", Icone: LayoutDashboard, voyant: "faire" },
      { to: "/club/planning", label: "Planning", Icone: CalendarDays, voyant: "planning" },
      { to: "/club/carte", label: "Carte du club", Icone: IconeCarte },
    ],
  },
  {
    titre: "Le club",
    entrees: [
      { to: "/club/membres", label: "Membres du club", Icone: Waves, voyant: "membres" },
      { to: "/club/privilegies", label: "Privilégiés", Icone: Star },
      { to: "/club/formations", label: "Formations", Icone: GraduationCap },
      { to: "/club/equipe", label: "Équipe", Icone: UsersRound },
      { to: "/club/materiel", label: "Matériel", Icone: LifeBuoy, voyant: "materiel" },
    ],
  },
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
  const nouvelleSortie = useNouvelleSortie();
  const chemin = useRouterState({ select: (s) => s.location.pathname });
  const [centres, setCentres] = useState<Centre[] | null>(null);
  useEffect(() => {
    const charger = () =>
      void mesCentres()
        .then(setCentres)
        .catch(() => setCentres([]));
    charger();
    window.addEventListener(EVENEMENT_CENTRE, charger);
    return () => window.removeEventListener(EVENEMENT_CENTRE, charger);
  }, []);
  const centre = centres?.find((c) => c.id === centreChoisi()) ?? centres?.[0] ?? null;
  const voyants = useVoyants(centre?.id ?? null, chemin);
  const aide = useRouterState({ select: (st) => (st.location.search as { onglet?: string }).onglet === "aide" });
  const actif = (to: Cible) =>
    to === "/club" ? chemin === "/club" || chemin === "/club/" : to === "/club/parametres" ? chemin.startsWith(to) && !aide : chemin.startsWith(to);

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
      <div className="flex flex-col gap-[18px]">
        {SECTIONS.map((sec) => (
          <div key={sec.titre}>
            <p className="px-[12px] pb-[6px] text-[11px] font-bold uppercase tracking-[.14em] text-[#9DB0C0]">{sec.titre}</p>
            <div className="flex flex-col gap-[2px]">{sec.entrees.map((e) => entree(e.to, e.label, e.Icone, e.voyant))}</div>
          </div>
        ))}
      </div>
      <div className="mt-auto flex flex-col gap-[10px] pt-[20px]">
        {/* Encart « Nouvelle sortie » : l'action principale du DP, toujours à portée de main */}
        {centre && (
          <div className="rounded-[10px] bg-gradient-to-br from-[#0F3D70] to-[#1176A8] p-[14px] text-white">
            <p className="text-[14px] font-bold leading-tight">Nouvelle sortie</p>
            <p className="pb-[10px] pt-[3px] text-[12px] leading-snug text-white/75">Date, site, bateau : les plongeurs s'inscrivent ensuite par QR code.</p>
            <button
              type="button"
              onClick={() => nouvelleSortie(centre.id)}
              className="flex h-[40px] w-full items-center justify-center gap-[6px] rounded-[10px] bg-[#3DEFBE] text-[12.5px] font-bold text-[#0B3B63] hover:bg-[#34E0B1]"
            >
              <Plus className="h-[16px] w-[16px]" strokeWidth={2.6} aria-hidden="true" />
              CRÉER UNE SORTIE
            </button>
          </div>
        )}
        <div className="border-t border-[#E9F0F6] pt-[10px]">
          {entree("/club/parametres", "Paramètres", Settings)}
          <Link
            to="/club/parametres"
            search={{ onglet: "aide" }}
            aria-current={aide ? "page" : undefined}
            className={`flex h-[40px] items-center gap-[12px] rounded-[10px] px-[12px] text-[14px] ${aide ? "bg-[#D5FAF0] font-bold text-[#123A63]" : "font-medium text-[#63809A] hover:bg-[#F1F6FC]"}`}
          >
            <CircleHelp className="h-[20px] w-[20px] shrink-0" strokeWidth={2} />
            Aide
          </Link>
        </div>
      </div>
    </nav>
  );
}

// Sur téléphone : la barre du bas du directeur de plongée (à la place de celle du plongeur).
// 4 écrans principaux + « Plus » (matériel, carte du club, paramètres).
const PRINCIPAUX: { to: Cible; label: string; Icone: typeof LayoutDashboard; voyant?: "faire" | "planning" | "membres" }[] = [
  { to: "/club", label: "Accueil", Icone: LayoutDashboard, voyant: "faire" },
  { to: "/club/planning", label: "Planning", Icone: CalendarDays, voyant: "planning" },
  { to: "/club/equipe", label: "Équipe", Icone: UsersRound },
  { to: "/club/membres", label: "Membres", Icone: Waves, voyant: "membres" },
];
const SECONDAIRES: { to: Cible; label: string; Icone: typeof LayoutDashboard; texte: string }[] = [
  { to: "/club/formations", label: "Formations", Icone: GraduationCap, texte: "Niveaux, tarifs, élèves et moniteurs" },
  { to: "/club/privilegies", label: "Membres privilégiés", Icone: Star, texte: "La communauté, les plongées réservées" },
  { to: "/club/materiel", label: "Matériel", Icone: LifeBuoy, texte: "Bateaux, blocs, gilets, contrôles" },
  { to: "/club/carte", label: "Carte du club", Icone: IconeCarte, texte: "Les sites plongés par le centre" },
  { to: "/club/parametres", label: "Paramètres", Icone: Settings, texte: "Le centre, ses DP, mon compte" },
];

export function NavigationDpMobile() {
  const chemin = useRouterState({ select: (s) => s.location.pathname });
  const [centre, setCentre] = useState<string | null>(null);
  const [plus, setPlus] = useState(false);
  useEffect(() => {
    void mesCentres()
      .then((l) => setCentre(l.find((c) => c.id === centreChoisi())?.id ?? l[0]?.id ?? null))
      .catch(() => undefined);
  }, []);
  const voyants = useVoyants(centre, chemin);
  const actif = (to: Cible) => (to === "/club" ? chemin === "/club" || chemin === "/club/" : chemin.startsWith(to));
  const secondaireActif = SECONDAIRES.some((e) => actif(e.to));
  const pastille = (nb: number, rouge: boolean) =>
    nb > 0 ? (
      <span className={`absolute -right-[7px] -top-[4px] min-w-[17px] rounded-[9px] px-[4px] text-center text-[10px] font-bold leading-[17px] ${rouge ? "bg-[#FF8A75] text-white" : "bg-[#0F3D70] text-white"}`}>
        {nb}
      </span>
    ) : null;

  return (
    <>
      <nav
        aria-label="Navigation du club"
        className="sticky bottom-0 z-10 flex items-stretch border-t border-[#DFEAF2] bg-white px-[10px] pb-[calc(10px+env(safe-area-inset-bottom))] pt-[10px] lg:hidden"
      >
        {PRINCIPAUX.map(({ to, label, Icone, voyant }) => {
          const nb = voyant && voyants ? voyants[voyant] : 0;
          return (
            <Link
              key={to}
              to={to}
              aria-current={actif(to) ? "page" : undefined}
              className={`flex flex-1 flex-col items-center gap-[3px] text-[11px] leading-[17px] ${actif(to) ? "font-semibold text-[#123A63]" : "font-medium text-[#63809A]"}`}
            >
              <span className={`relative flex h-[33px] w-[52px] items-center justify-center galet-petit ${actif(to) ? "bg-[#D5FAF0]" : ""}`}>
                <Icone className="h-[22px] w-[22px]" strokeWidth={1.9} />
                {pastille(nb, voyant === "planning" || (voyant === "membres" && Boolean(voyants?.membresDepasse)))}
              </span>
              {label}
            </Link>
          );
        })}
        <button
          type="button"
          onClick={() => setPlus(true)}
          aria-current={secondaireActif ? "page" : undefined}
          className={`flex flex-1 flex-col items-center gap-[3px] text-[11px] leading-[17px] ${secondaireActif ? "font-semibold text-[#123A63]" : "font-medium text-[#63809A]"}`}
        >
          <span className={`relative flex h-[33px] w-[52px] items-center justify-center galet-petit ${secondaireActif ? "bg-[#D5FAF0]" : ""}`}>
            <MoreHorizontal className="h-[22px] w-[22px]" strokeWidth={1.9} />
            {pastille(voyants?.materiel ?? 0, Boolean(voyants?.materielDepasse))}
          </span>
          Plus
        </button>
      </nav>
      {plus && (
        <div className="fixed inset-0 z-50 flex items-end lg:hidden" role="dialog" aria-modal="true" aria-label="Plus">
          <button type="button" aria-label="Fermer" onClick={() => setPlus(false)} className="absolute inset-0 bg-[#06203F]/45" />
          <div className="relative w-full rounded-t-[30px] bg-white px-[20px] pb-[max(20px,env(safe-area-inset-bottom))] pt-[14px] text-[#123A63]">
            <div className="flex items-center justify-between pb-[8px]">
              <span className="text-[18px] font-bold">Plus</span>
              <button type="button" aria-label="Fermer" onClick={() => setPlus(false)} className="flex h-9 w-9 items-center justify-center goutte bg-[#EEF3F8]">
                <X className="h-[17px] w-[17px]" />
              </button>
            </div>
            <div className="flex flex-col gap-[8px]">
              {SECONDAIRES.map(({ to, label, Icone, texte }) => {
                const nb = to === "/club/materiel" ? (voyants?.materiel ?? 0) : 0;
                return (
                  <Link
                    key={to}
                    to={to}
                    onClick={() => setPlus(false)}
                    className={`flex items-center gap-[12px] galet-b border px-[14px] py-[12px] ${actif(to) ? "border-[#3DEFBE] bg-[#F2FDF9]" : "border-[#E4EBF1] bg-white"}`}
                  >
                    <span className="flex h-[40px] w-[40px] shrink-0 items-center justify-center goutte bg-[#E3F2FB]">
                      <Icone className="h-[20px] w-[20px] text-[#1176A8]" strokeWidth={2} />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-[15px] font-bold">{label}</span>
                      <span className="block text-[12.5px] text-[#5B7189]">{texte}</span>
                    </span>
                    {nb > 0 && (
                      <span className={`rounded-[10px] px-[7px] py-[1px] text-[11.5px] font-bold ${voyants?.materielDepasse ? "bg-[#FF8A75] text-white" : "bg-[#F5B544] text-[#4A3000]"}`}>{nb}</span>
                    )}
                  </Link>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
