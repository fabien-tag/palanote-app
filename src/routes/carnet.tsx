import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { Camera, ChevronRight, Plus, BookOpen, MapPin, Users, User, Bell } from "lucide-react";
import { supabase } from "@/lib/supabase";
import logoHorizontal from "@/assets/logo-horizontal.png";
import fondMarin from "@/assets/fond-marin.mp4";
import {
  chargerNumeroDepart,
  chargerPlongees,
  lirePlongees,
  utilisateurConnecte,
  type CartePlongee,
} from "@/lib/plongees";
import { CarteDePlongee } from "@/components/CarteDePlongee";
import { LigneDePlongee } from "@/components/LigneDePlongee";
import {
  BandeauCarnetsPapier,
  EnTeteStatistiques,
  filtresDisponibles,
  FiltresPlongees,
  IconeVueCartes,
  IconeVueListe,
  RaccourcisAccueil,
} from "@/components/AccueilCarnet";

type Vue = "cartes" | "liste";
const CLE_VUE = "palanote-vue-carnet";

function lireVue(): Vue {
  try {
    return localStorage.getItem(CLE_VUE) === "cartes" ? "cartes" : "liste";
  } catch {
    return "liste";
  }
}

// Numéro de chaque plongée : plongées déjà faites avant l'app + rang chronologique.
// Calculé sur la liste complète, pour qu'un filtre ne change pas les numéros.
function numeroter(plongees: CartePlongee[], numeroDepart: number) {
  return plongees.map((p, i) => ({ p, numero: numeroDepart + plongees.length - i }));
}

// Regroupe les plongées par année (de la plus récente à la plus ancienne).
function grouperParAnnee(liste: { p: CartePlongee; numero: number }[]) {
  const groupes: { annee: string; plongees: { p: CartePlongee; numero: number }[] }[] = [];
  liste.forEach((x) => {
    const d = x.p.date ? new Date(x.p.date) : null;
    const annee = d && !isNaN(d.getTime()) ? String(d.getFullYear()) : "Sans date";
    let g = groupes.find((y) => y.annee === annee);
    if (!g) groupes.push((g = { annee, plongees: [] }));
    g.plongees.push(x);
  });
  return groupes;
}

export const Route = createFileRoute("/carnet")({
  head: () => ({
    meta: [
      { title: "Palanote — Carnet" },
      { name: "description", content: "Ton carnet de plongée." },
      { property: "og:title", content: "Palanote — Carnet" },
      { property: "og:description", content: "Ton carnet de plongée." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Carnet,
});

const onglets = [
  { label: "Carnet", icone: BookOpen, actif: true },
  { label: "Carte", icone: MapPin, actif: false },
  { label: "Amis", icone: Users, actif: false },
  { label: "Moi", icone: User, actif: false },
];

function Carnet() {
  // Mode maquette temporaire : la page est visible sans connexion
  // pour pouvoir la relire et la corriger. Remettre la vérification avant lancement.
  const navigate = useNavigate();
  void supabase;
  const [plongees, setPlongees] = useState<CartePlongee[]>([]);
  const [numeroDepart, setNumeroDepart] = useState(0);
  const [vue, setVue] = useState<Vue>("liste");
  const [filtre, setFiltre] = useState("toutes");
  const vide = plongees.length === 0;
  const filtres = filtresDisponibles(plongees);
  const filtreActif = filtres.find((f) => f.id === filtre) ?? filtres[0]!;
  const groupes = grouperParAnnee(numeroter(plongees, numeroDepart).filter(({ p }) => filtreActif.teste(p)));
  useEffect(() => setVue(lireVue()), []);
  // Changement de vue sans que l'écran bouge : le bouton cliqué reste exactement
  // à la même hauteur à l'écran, quelle que soit la position de défilement.
  const racine = useRef<HTMLDivElement>(null);
  const ancre = useRef<{ el: HTMLElement; haut: number } | null>(null);
  const changerVue = (v: Vue, bouton: HTMLElement) => {
    if (v === vue) return;
    ancre.current = { el: bouton, haut: bouton.getBoundingClientRect().top };
    // Garde la hauteur de page le temps du changement, pour que le navigateur
    // ne remonte pas tout seul quand la nouvelle vue est plus courte.
    if (racine.current) racine.current.style.minHeight = `${document.documentElement.scrollHeight}px`;
    setVue(v);
    try {
      localStorage.setItem(CLE_VUE, v);
    } catch {
      /* stockage indisponible */
    }
  };
  useLayoutEffect(() => {
    const a = ancre.current;
    const el = racine.current;
    if (!a || !el) return;
    ancre.current = null;
    const ecart = a.el.getBoundingClientRect().top - a.haut;
    if (ecart !== 0) window.scrollBy(0, ecart);
    // Ne garde que la hauteur nécessaire pour rester à cette position…
    el.style.minHeight = `${window.scrollY + window.innerHeight}px`;
    // …puis la relâche au fur et à mesure que l'utilisateur remonte.
    const relacher = () => {
      const besoin = window.scrollY + window.innerHeight;
      if (besoin < parseFloat(el.style.minHeight || "0")) el.style.minHeight = `${besoin}px`;
    };
    window.addEventListener("scroll", relacher, { passive: true });
    return () => window.removeEventListener("scroll", relacher);
  }, [vue]);

  useEffect(() => {
    let actif = true;
    (async () => {
      // Connecté : plongées du compte (Supabase). Sinon : celles gardées sur l'appareil.
      try {
        const user = await utilisateurConnecte();
        const liste = user ? await chargerPlongees() : [...lirePlongees()];
        const depart = user ? await chargerNumeroDepart(user.id) : 0;
        if (!actif) return;
        setPlongees(liste);
        setNumeroDepart(depart);
      } catch (e) {
        console.error(e);
        if (actif) setPlongees([...lirePlongees()]);
      }
    })();
    return () => {
      actif = false;
    };
  }, []);

  return (
    <div ref={racine} className={`flex min-h-screen flex-col ${vide ? "bg-[#E7F1FA]" : "bg-[#F5F9FC]"}`} style={{ overflowAnchor: "none" }}>
      {vide ? (
        <>
      {/* Haut : vidéo marine, pleine largeur de l'écran */}
      <div className="relative flex h-[412px] w-full shrink-0 flex-col overflow-hidden rounded-b-[34px]">
        <video
          className="absolute inset-0 h-full w-full object-cover"
          src={fondMarin}
          autoPlay
          muted
          loop
          playsInline
          aria-hidden="true"
        />
        <div className="absolute inset-0 bg-gradient-to-b from-black/35 via-black/25 to-black/55" aria-hidden="true" />
        <div className="relative mx-auto flex w-full max-w-[430px] flex-1 flex-col px-6 pt-5">
          <div className="flex items-center justify-between">
            <img src={logoHorizontal} alt="Palanote" className="h-auto w-[142px]" />
            <button
              type="button"
              aria-label="Notifications"
              className="flex h-11 w-11 items-center justify-center rounded-full bg-white/15"
            >
              <Bell className="h-6 w-6 text-white" strokeWidth={1.7} aria-hidden="true" />
            </button>
          </div>
          <div className="mt-auto flex flex-col items-center pb-6">
            <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-white/15">
              <Camera className="h-8 w-8 text-white" strokeWidth={1.7} aria-hidden="true" />
            </div>
            <h1 className="text-center text-[22px] font-bold text-white">
              Tu as des carnets papier&nbsp;?
            </h1>
            <p className="mt-2 text-center text-[14px] leading-snug text-white/85">
              Photographie les pages, l'app remplit les fiches.
              <br />
              Même ton écriture de 1812.
            </p>
          </div>
        </div>
        <div className="relative mx-auto w-full max-w-[430px] px-[26px] pb-[26px]">
          <button
            type="button"
            onClick={() => navigate({ to: "/numeriser" })}
            className="flex min-h-[52px] w-full items-center justify-center rounded-[14px] bg-[#3DEFBE] text-sm font-bold tracking-wide text-[#0B2A4A]"
          >
            NUMÉRISER MES CARNETS AVEC L'IA
          </button>
        </div>
      </div>
        </>
      ) : (
        <EnTeteStatistiques plongees={plongees} numeroDepart={numeroDepart} />
      )}

      <div className="mx-auto flex w-full max-w-[430px] flex-grow flex-col">
      {vide ? (
        /* Avant la première plongée : écran d'accueil d'origine */
        <div className="flex shrink-0 flex-col gap-[13px] p-[22px]">
          <button
            type="button"
            className="relative flex items-center gap-[13px] rounded-2xl bg-white p-[13px] text-left shadow-sm"
          >
            <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-[#57D4F5]/[0.18]">
              <BookOpen className="h-[30px] w-[30px] text-[#1176A8]" strokeWidth={1.9} aria-hidden="true" />
            </div>
            <div className="flex min-w-0 flex-grow flex-col gap-0.5">
              <span className="text-[15px] font-semibold text-[#123A63]">
                Tes plongées sont ailleurs&nbsp;?
              </span>
              <span className="text-[12.5px] leading-snug text-[#5B7189]">
                Importe le fichier exporté par Subsurface, MacDive, Shearwater…
              </span>
            </div>
            <ChevronRight className="h-[17px] w-[17px] shrink-0 text-[#9DB0C0]" strokeWidth={2.4} aria-hidden="true" />
            <span
              aria-hidden="true"
              className="pointer-events-none absolute right-[-10px] top-[-13px] h-[44px] w-[24px]"
            >
              <svg viewBox="0 0 48 87" className="h-full w-full">
                <path
                  d="M5 26C5 11 13 4 24 4S43 12 43 26Q39 29 35 26Q30 31 25 26Q20 30 15 26Q9 30 5 26"
                  fill="#6FD7BF"
                />
                <g fill="none" stroke="#6FD7BF" strokeWidth={3.6} strokeLinecap="round">
                  <path d="M12 27C12 44 3 44 8 59S11 69 6 79" />
                  <path d="M20 28C23 45 12 48 17 64S17 76 15 84" />
                  <path d="M28 28C33 44 22 47 28 62S34 72 30 80" />
                  <path d="M36 28C42 38 31 47 38 55S42 65 40 69" />
                </g>
              </svg>
            </span>
          </button>

          <button
            type="button"
            onClick={() => navigate({ to: "/nouvelle-plongee" })}
            className="flex min-h-[52px] items-center justify-center gap-2 rounded-[14px] border-2 border-dashed border-[#1176A8]/40 text-sm font-bold tracking-wide text-[#1176A8]"
          >
            <Plus className="h-[17px] w-[17px]" strokeWidth={2.8} aria-hidden="true" />
            AJOUTER MA PREMIÈRE PLONGÉE
          </button>
        </div>
      ) : (
        /* Dès la première plongée : statistiques, filtres, raccourcis et liste */
        <>
          <FiltresPlongees filtres={filtres} actif={filtreActif.id} onChange={setFiltre} />
          <BandeauCarnetsPapier onClick={() => navigate({ to: "/numeriser" })} />
          <RaccourcisAccueil />

          <div className="flex shrink-0 flex-col px-[22px] pb-[22px]">
            {groupes.map((g, gi) => (
              <div key={g.annee} className="flex flex-col">
                <div className="flex items-center justify-between gap-3 pb-3 pt-[18px]">
                  <div className="flex min-w-0 items-baseline gap-2">
                    <span className="text-[15px] font-bold text-[#123A63]">{g.annee}</span>
                    <span className="text-[12px] text-[#9DB0C0]">
                      {g.plongees.length} plongée{g.plongees.length > 1 ? "s" : ""}
                    </span>
                  </div>
                  {gi === 0 && (
                    <div role="group" aria-label="Affichage" className="flex shrink-0 gap-[3px] rounded-[13px] bg-[#E7EFF6] p-[3px]">
                      {(
                        [
                          { v: "cartes", label: "Vue en cartes", Icone: IconeVueCartes },
                          { v: "liste", label: "Vue en liste", Icone: IconeVueListe },
                        ] as const
                      ).map(({ v, label, Icone }) => (
                        <button
                          key={v}
                          type="button"
                          aria-label={label}
                          aria-pressed={vue === v}
                          onClick={(e) => changerVue(v, e.currentTarget)}
                          className={`flex h-8 w-[38px] items-center justify-center rounded-[10px] transition ${
                            vue === v ? "bg-white shadow-[0_2px_6px_rgba(15,61,112,.14)]" : ""
                          }`}
                        >
                          <Icone actif={vue === v} />
                        </button>
                      ))}
                    </div>
                  )}
                </div>
                <div className={`flex flex-col ${vue === "liste" ? "gap-2" : "gap-[13px]"}`}>
                  {g.plongees.map(({ p, numero }) =>
                    vue === "liste" ? (
                      <LigneDePlongee key={p.id} p={p} numero={numero} />
                    ) : (
                      <CarteDePlongee key={p.id} p={p} />
                    ),
                  )}
                </div>
              </div>
            ))}
            {groupes.length === 0 && (
              <p className="pt-8 text-center text-[13px] text-[#5B7189]">Aucune plongée pour ce filtre.</p>
            )}
            <div className="h-[70px]" aria-hidden="true" />
          </div>
        </>
      )}

        {/* Bouton flottant : visible dès la première plongée enregistrée */}
        {!vide && (
          <button
            type="button"
            onClick={() => navigate({ to: "/nouvelle-plongee" })}
            className="fixed bottom-[112px] right-[max(24px,calc(50vw-215px+24px))] z-20 flex h-[52px] items-center gap-[9px] rounded-[26px] bg-[#3DEFBE] px-[19px] text-[14px] font-semibold text-[#123A63] shadow-[0_6px_18px_#123A6322]"
          >
            <Plus className="h-[20px] w-[20px]" strokeWidth={2} aria-hidden="true" />
            Plongée
          </button>
        )}

        <div className="flex-grow" />

        {/* Navigation du bas */}
        <nav
          aria-label="Navigation principale"
          className="sticky bottom-0 z-10 flex items-stretch border-t border-[#DFEAF2] bg-white px-[28px] pb-[24px] pt-[10px] min-h-[96px]"
        >
          <span
            aria-hidden="true"
            className="pointer-events-none absolute left-[3px] top-[48%] h-[49px] w-[27px] -rotate-[8deg]"
          >
            <svg viewBox="0 0 58 108" className="h-full w-full" fill="none">
              <g stroke="#FF8A75" strokeWidth={6} strokeLinecap="round" strokeLinejoin="round">
                <path d="M30 108C24 85 30 71 26 57S14 32 20 12" />
                <path d="M27 73C13 71 10 62 9 50L4 40" />
                <path d="M27 57C38 55 42 45 39 30L46 17" />
                <path d="M23 40C11 36 8 25 8 16" />
                <path d="M28 90C41 84 46 71 47 58L54 47" />
                <path d="M39 42L51 37" />
              </g>
            </svg>
          </span>
          {onglets.map(({ label, icone: Icone, actif }) => (
            <button
              key={label}
              type="button"
              aria-current={actif ? "page" : undefined}
              className={`flex flex-1 flex-col items-center justify-start gap-[3px] text-[11px] leading-[17px] ${
                actif ? "font-semibold text-[#123A63]" : "font-medium text-[#63809A]"
              }`}
            >
              <span
                className={`flex h-[33px] w-[58px] items-center justify-center rounded-[13px] ${
                  actif ? "bg-[#D5FAF0]" : ""
                }`}
              >
                <Icone className="h-[23px] w-[23px]" strokeWidth={1.7} aria-hidden="true" />
              </span>
              {label}
            </button>
          ))}
        </nav>
      </div>
    </div>
  );
}
