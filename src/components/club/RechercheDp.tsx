import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useNavigate } from "@tanstack/react-router";
import {
  Bell,
  CalendarDays,
  CornerDownLeft,
  FileSpreadsheet,
  LayoutDashboard,
  LifeBuoy,
  Map as IconeCarte,
  MapPin,
  Plus,
  Search,
  Settings,
  Ship,
  Star,
  UserRound,
  UsersRound,
  Waves,
  X,
} from "lucide-react";
import { centreChoisi, EVENEMENT_CENTRE, mesCentres } from "@/lib/club";
import { useNouvelleSortie } from "@/components/club/PanneauNouvelleSortie";
import { lundi, rechercheDp, type Recherche, type ResultatRecherche } from "@/lib/planning";

// La recherche de l'espace DP : plongeurs, équipe, matériel, sorties, sites, et les écrans
// de l'app. Sur ordinateur, dans la barre du haut (raccourci ⌘K / Ctrl K) ;
// sur téléphone, en plein écran depuis la loupe du tableau de bord.

type Ligne = { cle: string; groupe: string; Icone: typeof Search; titre: string; texte: string; aller: () => void };

const sansAccents = (t: string) => t.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

function useRecherche(q: string) {
  const [centre, setCentre] = useState<string | null>(null);
  const [r, setR] = useState<Recherche | null>(null);
  const [enCours, setEnCours] = useState(false);
  useEffect(() => {
    const charger = () =>
      void mesCentres()
        .then((l) => setCentre(l.find((c) => c.id === centreChoisi())?.id ?? l[0]?.id ?? null))
        .catch(() => undefined);
    charger();
    window.addEventListener(EVENEMENT_CENTRE, charger);
    return () => window.removeEventListener(EVENEMENT_CENTRE, charger);
  }, []);
  useEffect(() => {
    if (!centre || q.trim().length < 2) {
      setR(null);
      return;
    }
    let actif = true;
    setEnCours(true);
    const t = setTimeout(() => {
      void rechercheDp(centre, q.trim())
        .then((x) => actif && setR(x))
        .catch(() => actif && setR({}))
        .finally(() => actif && setEnCours(false));
    }, 200);
    return () => {
      actif = false;
      clearTimeout(t);
    };
  }, [centre, q]);
  return { centre, r, enCours };
}

function useLignes(q: string, centre: string | null, r: Recherche | null, fermer: () => void): Ligne[] {
  const navigate = useNavigate();
  const nouvelleSortie = useNouvelleSortie();
  return useMemo(() => {
    const go = (f: () => void) => () => {
      fermer();
      f();
    };
    const PAGES: { titre: string; mots: string; Icone: typeof Search; aller: () => void }[] = [
      { titre: "Nouvelle sortie", mots: "nouvelle sortie creer ajouter plongee", Icone: Plus, aller: () => nouvelleSortie(centre) },
      { titre: "Tableau de bord", mots: "tableau de bord accueil", Icone: LayoutDashboard, aller: () => navigate({ to: "/club" }) },
      { titre: "Planning", mots: "planning calendrier semaine mois kanban", Icone: CalendarDays, aller: () => navigate({ to: "/club/planning" }) },
      { titre: "Équipe", mots: "equipe guide pilote gonfleur encadrant personnel", Icone: UsersRound, aller: () => navigate({ to: "/club/equipe" }) },
      { titre: "Matériel", mots: "materiel bloc bateau gilet detendeur controle", Icone: LifeBuoy, aller: () => navigate({ to: "/club/materiel" }) },
      { titre: "Membres du club", mots: "membres adherents plongeurs certificat", Icone: Waves, aller: () => navigate({ to: "/club/membres" }) },
      { titre: "Membres privilégiés", mots: "privilegies vip etoile serie", Icone: Star, aller: () => navigate({ to: "/club/privilegies" }) },
      { titre: "Carte du club", mots: "carte sites plongees", Icone: IconeCarte, aller: () => navigate({ to: "/club/carte" }) },
      { titre: "Notifications", mots: "notifications cloche rappels", Icone: Bell, aller: () => navigate({ to: "/club/notifications" }) },
      { titre: "Exporter la saison (Excel)", mots: "export excel saison bilan", Icone: FileSpreadsheet, aller: () => navigate({ to: "/club/parametres" }) },
      { titre: "Paramètres", mots: "parametres centre compte deconnexion", Icone: Settings, aller: () => navigate({ to: "/club/parametres" }) },
    ];
    const s = sansAccents(q.trim());
    const lignes: Ligne[] = [];
    const ajouter = (groupe: string, Icone: typeof Search, liste: ResultatRecherche[] | undefined, aller: (x: ResultatRecherche) => void) => {
      for (const x of liste ?? []) lignes.push({ cle: `${groupe}-${x.id ?? x.titre}`, groupe, Icone, titre: x.titre, texte: x.texte, aller: go(() => aller(x)) });
    };
    ajouter("Plongeurs", UserRound, r?.plongeurs, (x) =>
      navigate({ to: "/club/membres", search: { onglet: x.type === "adherent" ? "adherents" : "sorties", q: x.titre.split(" ")[0] ?? x.titre } }),
    );
    ajouter("Équipe", UsersRound, r?.equipe, (x) => navigate({ to: "/club/equipe", search: x.id ? { ouvrir: x.id } : {} }));
    ajouter("Matériel", LifeBuoy, r?.materiel, (x) => navigate({ to: "/club/materiel", search: x.id ? { ouvrir: x.id } : {} }));
    ajouter("Sorties", Ship, r?.sorties, (x) => navigate({ to: "/club/planning", search: { ...(x.id ? { sortie: x.id } : {}), ...(x.date ? { semaine: lundi(x.date) } : {}) } }));
    ajouter("Sites", MapPin, r?.sites, () => navigate({ to: "/club/carte" }));
    // Les écrans de l'app, en dernier : un mot qui commence par le texte tapé (« mat » → Matériel)
    if (s.length >= 2) {
      const mots = (x: (typeof PAGES)[number]) => `${sansAccents(x.titre)} ${x.mots}`.split(/[\s()]+/);
      for (const p of PAGES.filter((x) => mots(x).some((m) => m.startsWith(s))).slice(0, 4)) {
        lignes.push({ cle: `page-${p.titre}`, groupe: "Écrans", Icone: p.Icone, titre: p.titre, texte: "Aller à l'écran", aller: go(p.aller) });
      }
    }
    return lignes;
  }, [q, centre, r, fermer, navigate, nouvelleSortie]);
}

// Liste des résultats (commune à la barre et au plein écran)
function Resultats({ lignes, actif, setActif, q, enCours }: { lignes: Ligne[]; actif: number; setActif: (i: number) => void; q: string; enCours: boolean }) {
  if (q.trim().length < 2 && lignes.length === 0) {
    return <p className="px-[16px] py-[14px] text-[13px] text-[#7D93A8]">Cherche un plongeur, un équipier, du matériel, une sortie ou un site.</p>;
  }
  if (lignes.length === 0) {
    return <p className="px-[16px] py-[14px] text-[13px] text-[#7D93A8]">{enCours ? "Recherche…" : `Rien trouvé pour « ${q.trim()} ».`}</p>;
  }
  return (
    <ul role="listbox" className="py-[6px]">
      {lignes.map((l, i) => (
        <li key={l.cle} role="option" aria-selected={i === actif}>
          {(i === 0 || lignes[i - 1]!.groupe !== l.groupe) && (
            <p className="px-[16px] pb-[4px] pt-[10px] text-[11px] font-bold uppercase tracking-[.08em] text-[#9DB0C0]">{l.groupe}</p>
          )}
          <button
            type="button"
            onMouseEnter={() => setActif(i)}
            onClick={l.aller}
            className={`flex w-full items-center gap-[12px] px-[16px] py-[8px] text-left ${i === actif ? "bg-[#EEF6FC]" : ""}`}
          >
            <span className="flex h-[32px] w-[32px] shrink-0 items-center justify-center rounded-[10px] bg-[#E3F2FB] text-[#1176A8]">
              <l.Icone className="h-[16px] w-[16px]" strokeWidth={2.2} />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-[14px] font-bold text-[#123A63]">{l.titre}</span>
              {l.texte && <span className="block truncate text-[12px] text-[#7D93A8]">{l.texte}</span>}
            </span>
            {i === actif && <CornerDownLeft className="h-[14px] w-[14px] shrink-0 text-[#9DB0C0]" />}
          </button>
        </li>
      ))}
    </ul>
  );
}

function useClavier(lignes: Ligne[], fermer: () => void) {
  const [actif, setActif] = useState(0);
  useEffect(() => setActif(0), [lignes.length]);
  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActif((a) => Math.min(lignes.length - 1, a + 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActif((a) => Math.max(0, a - 1));
    } else if (e.key === "Enter") {
      e.preventDefault();
      lignes[actif]?.aller();
    } else if (e.key === "Escape") {
      fermer();
    }
  };
  return { actif, setActif, onKeyDown };
}

// Ordinateur : le champ dans la barre du haut, résultats en menu déroulant
export function RechercheBarre() {
  const [q, setQ] = useState("");
  const [ouvert, setOuvert] = useState(false);
  const champ = useRef<HTMLInputElement>(null);
  const boite = useRef<HTMLDivElement>(null);
  const fermer = useMemo(
    () => () => {
      setOuvert(false);
      setQ("");
      champ.current?.blur();
    },
    [],
  );
  const { centre, r, enCours } = useRecherche(q);
  const lignes = useLignes(q, centre, r, fermer);
  const { actif, setActif, onKeyDown } = useClavier(lignes, fermer);
  const mac = typeof navigator !== "undefined" && /Mac|iPhone|iPad/.test(navigator.platform);

  // ⌘K / Ctrl K : aller à la recherche
  useEffect(() => {
    const k = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        champ.current?.focus();
        setOuvert(true);
      }
    };
    window.addEventListener("keydown", k);
    return () => window.removeEventListener("keydown", k);
  }, []);
  // Clic en dehors : on referme
  useEffect(() => {
    if (!ouvert) return;
    const c = (e: MouseEvent) => !boite.current?.contains(e.target as Node) && setOuvert(false);
    document.addEventListener("mousedown", c);
    return () => document.removeEventListener("mousedown", c);
  }, [ouvert]);

  return (
    <div ref={boite} className="relative w-full max-w-[520px]">
      <label className="flex h-[42px] items-center gap-[10px] rounded-[10px] border border-[#E4EBF1] bg-[#F7FAFD] px-[12px] focus-within:border-[#57D4F5] focus-within:bg-white">
        <Search className="h-[17px] w-[17px] shrink-0 text-[#7D93A8]" />
        <input
          ref={champ}
          value={q}
          onChange={(e) => {
            setQ(e.target.value);
            setOuvert(true);
          }}
          onFocus={() => setOuvert(true)}
          onKeyDown={onKeyDown}
          placeholder="Chercher un plongeur, du matériel, une sortie…"
          aria-label="Rechercher dans l'espace club"
          className="min-w-0 flex-1 bg-transparent text-[14px] text-[#123A63] outline-none placeholder:text-[#9DB0C0]"
        />
        {q ? (
          <button type="button" aria-label="Effacer" onClick={() => setQ("")} className="text-[#9DB0C0]">
            <X className="h-[15px] w-[15px]" />
          </button>
        ) : (
          <kbd className="rounded-[6px] border border-[#E4EBF1] bg-white px-[6px] py-[1px] text-[11px] font-semibold text-[#7D93A8]">{mac ? "⌘ K" : "Ctrl K"}</kbd>
        )}
      </label>
      {ouvert && (q.trim().length > 0 || lignes.length > 0) && (
        <div className="absolute left-0 right-0 top-[48px] z-40 max-h-[70vh] overflow-y-auto rounded-[10px] border border-[#DFEAF2] bg-white shadow-[0_16px_40px_#0B254026]">
          <Resultats lignes={lignes} actif={actif} setActif={setActif} q={q} enCours={enCours} />
        </div>
      )}
    </div>
  );
}

// Téléphone : la loupe ouvre la recherche en plein écran
export function BoutonRecherche({ className = "" }: { className?: string }) {
  const [ouvert, setOuvert] = useState(false);
  return (
    <>
      <button
        type="button"
        aria-label="Rechercher"
        onClick={() => setOuvert(true)}
        className={`flex h-[40px] w-[40px] shrink-0 items-center justify-center rounded-[10px] border border-[#E4EBF1] bg-white text-[#123A63] ${className}`}
      >
        <Search className="h-[19px] w-[19px]" strokeWidth={2} />
      </button>
      {ouvert && typeof document !== "undefined" && createPortal(<RecherchePleinEcran onFermer={() => setOuvert(false)} />, document.body)}
    </>
  );
}

function RecherchePleinEcran({ onFermer }: { onFermer: () => void }) {
  const [q, setQ] = useState("");
  const { centre, r, enCours } = useRecherche(q);
  const lignes = useLignes(q, centre, r, onFermer);
  const { actif, setActif, onKeyDown } = useClavier(lignes, onFermer);
  return (
    <div className="bureau fixed inset-0 z-[70] flex flex-col bg-white text-[#123A63]" role="dialog" aria-modal="true" aria-label="Recherche">
      <div className="flex items-center gap-[10px] border-b border-[#DFEAF2] px-[16px] pb-[12px] pt-[max(14px,env(safe-area-inset-top))]">
        <label className="flex h-[44px] flex-1 items-center gap-[10px] rounded-[10px] border border-[#57D4F5] px-[12px]">
          <Search className="h-[17px] w-[17px] shrink-0 text-[#7D93A8]" />
          <input
            autoFocus
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={onKeyDown}
            placeholder="Plongeur, matériel, sortie, site…"
            aria-label="Rechercher dans l'espace club"
            className="min-w-0 flex-1 bg-transparent text-[16px] outline-none"
          />
        </label>
        <button type="button" onClick={onFermer} className="text-[14px] font-semibold text-[#1176A8]">
          Fermer
        </button>
      </div>
      <div className="flex-1 overflow-y-auto">
        <Resultats lignes={lignes} actif={actif} setActif={setActif} q={q} enCours={enCours} />
      </div>
    </div>
  );
}
