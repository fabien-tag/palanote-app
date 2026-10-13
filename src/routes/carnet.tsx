import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { Camera, ChevronDown, ChevronRight, ChevronUp, Plus, Watch } from "lucide-react";
import { supabase } from "@/lib/supabase";
import logoCorail from "@/assets/palanote-logo-cigle.png";
import fondMarin from "@/assets/fond-marin.mp4";
import {
  cacheCarnetEnMemoire,
  chargerNumeroDepart,
  chargerPlongees,
  ecrireCacheCarnet,
  lireCacheCarnet,
  lirePlongees,
  utilisateurConnecte,
  type CartePlongee,
} from "@/lib/plongees";
import { CarteDePlongee } from "@/components/CarteDePlongee";
import { LigneDePlongee } from "@/components/LigneDePlongee";
import { BandeauConfirmation } from "@/components/BandeauConfirmation";
import { BandeauHorsLigne } from "@/components/BandeauHorsLigne";
import { BandeauHistoriqueClub } from "@/components/club/BandeauHistoriqueClub";
import { EVENEMENT_ATTENTE } from "@/lib/hors-ligne";
import { BarreNavigation } from "@/components/BarreNavigation";
import { effacerMessageAccueil, lireMessageAccueil } from "@/lib/message-accueil";
import { QuestionSatisfaction } from "@/components/QuestionSatisfaction";
import { accepterInvitationGardee, plongeesAConfirmer, type PlongeeAConfirmer } from "@/lib/amis";
import { chargerProfil } from "@/lib/moi";
import { mesSorties, rejoindreSortieGardee, type SortieResume, estDirecteurDePlongee } from "@/lib/club";
import { genererRappelsPlongeur, nombreNonLues } from "@/lib/notifications";
import {
  BandeauCarnetsPapier,
  EnTeteStatistiques,
  filtresDisponibles,
  FiltresPlongees,
  IconeVueCartes,
  IconeVueListe,
  BandeauProposition,
  BandeauSortie,
  BoutonCloche,
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
const PAR_ANNEE = 5;

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


function Carnet() {
  // Mode maquette temporaire : la page est visible sans connexion
  // pour pouvoir la relire et la corriger. Remettre la vérification avant lancement.
  const navigate = useNavigate();
  void supabase;
  // null = pas encore chargé : on n'affiche surtout pas l'accueil vide en attendant.
  const [chargees, setPlongees] = useState<CartePlongee[] | null>(() => cacheCarnetEnMemoire()?.plongees ?? null);
  const [numeroDepart, setNumeroDepart] = useState(() => cacheCarnetEnMemoire()?.depart ?? 0);
  const plongees = chargees ?? [];
  const chargement = chargees === null;
  const [vue, setVue] = useState<Vue>("liste");
  const [filtre, setFiltre] = useState("toutes");
  // Directeur de plongée : son app, c'est le tableau de bord du club (téléphone comme ordinateur)
  useEffect(() => {
    void estDirecteurDePlongee().then((oui) => {
      if (oui) navigate({ to: "/club", replace: true });
    });
  }, [navigate]);
  // Plongées notées par un binôme, à ajouter à mon carnet (parcours 07)
  const [propositions, setPropositions] = useState<PlongeeAConfirmer[]>([]);
  useEffect(() => {
    void plongeesAConfirmer()
      .then(setPropositions)
      .catch(() => undefined); // script pas encore lancé ou hors connexion : pas de bandeau
  }, []);
  // Sorties club (parcours 15) et pastille de la cloche
  const [sorties, setSorties] = useState<SortieResume[]>([]);
  const [nonLues, setNonLues] = useState(0);
  useEffect(() => {
    let actif = true;
    void (async () => {
      if (!(await utilisateurConnecte())) return;
      // Sortie scannée avant la connexion : inscription faite dès le retour sur l'accueil
      const m = await rejoindreSortieGardee().catch(() => null);
      if (m && actif) setConfirmation(m);
      await genererRappelsPlongeur().catch(() => 0); // rappel de la veille d'une sortie
      const [s, n] = await Promise.all([mesSorties().catch(() => []), nombreNonLues()]);
      if (!actif) return;
      setSorties(s);
      setNonLues(n);
    })();
    return () => {
      actif = false;
    };
  }, []);
  // Niveau et certifications du plongeur, affichés dans l'en-tête (gardés pour la session).
  const [profilEntete, setProfilEntete] = useState<{ niveau: string; certifications: string[]; profMaxAvant?: string; heuresAvant?: string } | null>(null);
  useEffect(() => {
    try {
      const t = localStorage.getItem("palanote-entete");
      if (t) setProfilEntete(JSON.parse(t));
    } catch {
      /* stockage indisponible */
    }
    void chargerProfil()
      .then((p) => {
        if (!p) return;
        const e = { niveau: p.niveau, certifications: p.certifications, profMaxAvant: p.profMaxAvant, heuresAvant: p.heuresAvant };
        setProfilEntete(e);
        try {
          localStorage.setItem("palanote-entete", JSON.stringify(e));
        } catch {
          /* stockage indisponible */
        }
      })
      .catch(() => undefined);
  }, []);
  // En faisant défiler, le bouton « + Plongée » se réduit à un simple « + » pour moins masquer les cartes.
  const [boutonCompact, setBoutonCompact] = useState(false);
  useEffect(() => {
    const suivre = () => setBoutonCompact(window.scrollY > 160);
    suivre();
    window.addEventListener("scroll", suivre, { passive: true });
    return () => window.removeEventListener("scroll", suivre);
  }, []);
  // Au plus 5 plongées par année ; « Voir plus » déplie l'année entière.
  const [anneesDepliees, setAnneesDepliees] = useState<string[]>([]);
  // Chaque année est une pile (comme les notifications de l'iPhone) : un toucher la déplie.
  // null = réglage de départ : seule l'année la plus récente est dépliée.
  const [pilesOuvertes, setPilesOuvertes] = useState<string[] | null>(null);
  const vide = !chargement && plongees.length === 0;
  const filtres = filtresDisponibles(plongees);
  const filtreActif = filtres.find((f) => f.id === filtre) ?? filtres[0]!;
  const groupes = grouperParAnnee(numeroter(plongees, numeroDepart).filter(({ p }) => filtreActif.teste(p)));
  const filtresListe = (
    <FiltresPlongees
      filtres={filtres}
      actif={filtreActif.id}
      onChange={setFiltre}
      className="-mx-[22px] px-[22px] pb-[14px]"
    />
  );
  useEffect(() => setVue(lireVue()), []);
  // Message laissé par l'écran précédent (ex. plongée enregistrée).
  const [confirmation, setConfirmation] = useState<string | null>(null);
  useEffect(() => {
    setConfirmation(lireMessageAccueil());
    // Invitation de binôme scannée avant la connexion : acceptée dès le retour sur l'accueil.
    let actif = true;
    void accepterInvitationGardee().then((m) => {
      if (m && actif) setConfirmation(m);
    });
    return () => {
      actif = false;
    };
  }, []);
  const finConfirmation = useCallback(() => {
    effacerMessageAccueil();
    setConfirmation(null);
  }, []);
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
    const charger = async () => {
      // Connecté : plongées du compte (Supabase). Sinon : celles gardées sur l'appareil.
      // Copie de la session (après un rechargement de page) : affichée tout de suite.
      const copie = lireCacheCarnet();
      if (copie) {
        setPlongees((p) => p ?? copie.plongees);
        setNumeroDepart(copie.depart);
      }
      try {
        const user = await utilisateurConnecte();
        const [liste, depart] = await Promise.all([
          user ? chargerPlongees() : Promise.resolve([...lirePlongees()]),
          user ? chargerNumeroDepart(user.id) : Promise.resolve(0),
        ]);
        if (!actif) return;
        setPlongees(liste);
        setNumeroDepart(depart);
        ecrireCacheCarnet({ plongees: liste, depart });
      } catch (e) {
        console.error(e);
        // Sans réseau : on garde la dernière copie du carnet gardée sur le téléphone.
        if (actif) setPlongees((p) => p ?? copie?.plongees ?? [...lirePlongees()]);
      }
    };
    void charger();
    // Des plongées en attente viennent de partir : on recharge le carnet.
    const apresEnvoi = () => {
      if (navigator.onLine !== false) void charger();
    };
    window.addEventListener(EVENEMENT_ATTENTE, apresEnvoi);
    return () => {
      actif = false;
      window.removeEventListener(EVENEMENT_ATTENTE, apresEnvoi);
    };
  }, []);

  // Premier chargement (aucune copie en mémoire) : squelette neutre, jamais l'accueil vide.
  if (chargement)
    return (
      <div className="flex min-h-screen flex-col bg-[#F5F9FC]" aria-busy="true">
        <div className="h-[300px] w-full shrink-0 rounded-b-[34px] bg-[#0E3D72]" />
        <div className="mx-auto flex w-full max-w-[430px] flex-grow flex-col">
          <div className="flex flex-col gap-[12px] p-[22px]">
            {[0, 1, 2].map((i) => (
              <div key={i} className="h-[86px] animate-pulse galet-b bg-white shadow-[0_4px_14px_#123A6306]" />
            ))}
          </div>
          <div className="flex-grow" />
          <BarreNavigation actif="carnet" />
        </div>
      </div>
    );

  return (
    <div ref={racine} className={`flex min-h-screen flex-col ${vide ? "bg-[#E7F1FA]" : "bg-[#F5F9FC]"}`} style={{ overflowAnchor: "none" }}>
      {confirmation && <BandeauConfirmation texte={confirmation} onFin={finConfirmation} />}
      {vide ? (
        <>
      {/* Haut : vidéo marine, pleine largeur de l'écran */}
      <div className="relative flex h-[382px] w-full shrink-0 flex-col overflow-hidden rounded-b-[34px]">
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
            <img src={logoCorail} alt="Palanote" className="h-[30px] w-auto" />
            <BoutonCloche nonLues={nonLues} onClick={() => navigate({ to: "/notifications" })} className="h-11 w-11 bg-white/15" />
          </div>
          <div className="mt-auto flex flex-col items-center pb-6">
            <div className="mb-4 flex h-14 w-14 items-center justify-center goutte bg-white/15">
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
            className="flex min-h-[52px] w-full items-center justify-center galet-moyen bg-[#3DEFBE] text-sm font-bold tracking-wide text-[#0B2A4A]"
          >
            NUMÉRISER MES CARNETS AVEC L'IA
          </button>
        </div>
      </div>
        </>
      ) : (
        <EnTeteStatistiques plongees={plongees} numeroDepart={numeroDepart} niveau={profilEntete?.niveau} certifications={profilEntete?.certifications} profMaxAvant={Number((profilEntete?.profMaxAvant ?? "").replace(",", ".")) || 0} heuresAvant={profilEntete?.heuresAvant ? Number(profilEntete.heuresAvant.replace(",", ".")) : null} nonLues={nonLues} />
      )}

      <div className="mx-auto flex w-full max-w-[430px] flex-grow flex-col">
      <BandeauHorsLigne />
      <BandeauSortie sorties={sorties} />
      <BandeauHistoriqueClub onAjoute={() => window.location.reload()} />
      {vide ? (
        /* Avant la première plongée : écran d'accueil d'origine */
        <div className="flex shrink-0 flex-col gap-[13px] p-[22px]">
          {/* Le plus simple d'abord : noter la plongée qu'on vient de faire */}
          <button
            type="button"
            onClick={() => navigate({ to: "/plongee-express" })}
            className="relative flex items-center gap-[13px] galet-moyen border border-[#B8E4D8] bg-[#E2F8EF] p-[13px] text-left shadow-sm"
          >
            <div className="flex h-14 w-14 shrink-0 items-center justify-center goutte bg-[#3DEFBE]">
              <Plus className="h-[28px] w-[28px] text-[#0B3B63]" strokeWidth={2.4} aria-hidden="true" />
            </div>
            <div className="flex min-w-0 flex-grow flex-col gap-0.5">
              <span className="text-[15px] font-semibold text-[#123A63]">Tu rentres de plongée&nbsp;?</span>
              <span className="text-[12.5px] leading-snug text-[#3F5B76]">Note-la en 30 secondes : le site, la profondeur, la durée.</span>
            </div>
            <ChevronRight className="h-[17px] w-[17px] shrink-0 text-[#123A63]" strokeWidth={2.4} aria-hidden="true" />
          </button>
          <button
            type="button"
            onClick={() => navigate({ to: "/importer" })}
            className="relative flex items-center gap-[13px] galet-moyen bg-white p-[13px] text-left shadow-sm"
          >
            <div className="flex h-14 w-14 shrink-0 items-center justify-center goutte bg-[#57D4F5]/[0.18]">
              <Watch className="h-[30px] w-[30px] text-[#1176A8]" strokeWidth={1.9} aria-hidden="true" />
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

        </div>
      ) : (
        /* Dès la première plongée : statistiques, filtres, raccourcis et liste */
        <>
          <BandeauProposition propositions={propositions} />
          <QuestionSatisfaction nbPlongees={plongees.length} />
          <BandeauCarnetsPapier onClick={() => navigate({ to: "/numeriser" })} />
          <RaccourcisAccueil />

          <div className="flex shrink-0 flex-col px-[22px] pb-[22px]">
            {groupes.map((g, gi) => {
              const ouverte = g.plongees.length <= 1 || (pilesOuvertes === null ? gi === 0 : pilesOuvertes.includes(g.annee));
              const basculer = (ouvrir: boolean) =>
                setPilesOuvertes((x) => {
                  const base = x ?? (groupes[0] ? [groupes[0].annee] : []);
                  return ouvrir ? [...base.filter((a) => a !== g.annee), g.annee] : base.filter((a) => a !== g.annee);
                });
              const premiere = g.plongees[0]!;
              return (
              <div key={g.annee} className="flex flex-col">
                <div className="flex items-center justify-between gap-3 pb-4 pt-[34px]">
                  <div className="flex min-w-0 items-baseline gap-2">
                    <span className="text-[15px] font-bold text-[#123A63]">{g.annee}</span>
                    <span className="text-[12px] text-[#9DB0C0]">
                      {g.plongees.length} plongée{g.plongees.length > 1 ? "s" : ""}
                    </span>
                  </div>
                  {gi !== 0 && ouverte && g.plongees.length > 1 && (
                    <button
                      type="button"
                      onClick={() => basculer(false)}
                      className="flex shrink-0 items-center gap-[4px] rounded-full bg-[#E7EFF6] px-[11px] py-[5px] text-[12.5px] font-semibold text-[#5B7189]"
                    >
                      Réduire
                      <ChevronUp className="h-[14px] w-[14px]" strokeWidth={2.4} aria-hidden="true" />
                    </button>
                  )}
                  {gi === 0 && (
                    <div role="group" aria-label="Affichage" className="flex shrink-0 gap-[3px] galet-petit bg-[#E7EFF6] p-[3px]">
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
                          className={`flex h-8 w-[38px] items-center justify-center galet-petit transition ${
                            vue === v ? "bg-white shadow-[0_2px_6px_rgba(15,61,112,.14)]" : ""
                          }`}
                        >
                          <Icone actif={vue === v} />
                        </button>
                      ))}
                    </div>
                  )}
                </div>
                {/* Filtres : sous le titre des plongées, juste avant les cartes */}
                {gi === 0 && filtresListe}
                {!ouverte ? (
                  /* Pile repliée : la plongée la plus récente, et le bord des autres dessous */
                  <button
                    type="button"
                    onClick={() => basculer(true)}
                    aria-expanded={false}
                    aria-label={`Déplier les ${g.plongees.length} plongées de ${g.annee}`}
                    className="relative block w-full pb-[18px] text-left transition active:scale-[0.99]"
                  >
                    <span aria-hidden="true" className="absolute inset-x-[22px] bottom-0 top-[18px] galet-c border border-[#E4EBF1] bg-white/55 shadow-[0_4px_10px_#123A6306]" />
                    <span aria-hidden="true" className="absolute inset-x-[11px] bottom-[9px] top-[9px] galet-c border border-[#E4EBF1] bg-white/80 shadow-[0_4px_10px_#123A6308]" />
                    <span className="relative block">
                      {vue === "liste" ? <LigneDePlongee p={premiere.p} numero={premiere.numero} /> : <CarteDePlongee p={premiere.p} />}
                    </span>
                    <span className="absolute bottom-[-4px] right-[30px] flex translate-y-full items-center gap-[4px] pt-[6px] text-[12px] font-semibold text-[#1176A8]">
                      + {g.plongees.length - 1} plongée{g.plongees.length - 1 > 1 ? "s" : ""}
                      <ChevronDown className="h-[13px] w-[13px]" strokeWidth={2.6} aria-hidden="true" />
                    </span>
                  </button>
                ) : (
                <div className={`flex flex-col ${vue === "liste" ? "gap-[10px]" : "gap-[18px]"}`}>
                  {(anneesDepliees.includes(g.annee) ? g.plongees : g.plongees.slice(0, PAR_ANNEE)).map(({ p, numero }, i) => (
                    <button
                      key={p.id}
                      type="button"
                      aria-label={`Voir la plongée Nº ${numero}${p.siteNom ? ` — ${p.siteNom}` : ""}`}
                      onClick={() => navigate({ to: "/nouvelle-plongee", search: { id: p.id } })}
                      style={pilesOuvertes !== null ? { animationDelay: `${Math.min(i, 8) * 45}ms` } : undefined}
                      className={`block w-full galet-c text-left transition active:scale-[0.99] ${pilesOuvertes !== null ? "sortie-de-pile" : ""}`}
                    >
                      {vue === "liste" ? <LigneDePlongee p={p} numero={numero} /> : <CarteDePlongee p={p} />}
                    </button>
                  ))}
                  {!anneesDepliees.includes(g.annee) && g.plongees.length > PAR_ANNEE && (
                    <button
                      type="button"
                      onClick={() => setAnneesDepliees((a) => [...a, g.annee])}
                      style={{ borderRadius: "30px 18px 32px 16px / 20px 28px 18px 30px" }}
                      className={`flex w-full items-center justify-center gap-[8px] border-[1.5px] border-[#57D4F5] bg-white text-[14px] font-bold text-[#1176A8] shadow-[0_4px_14px_#123A6308] ${
                        vue === "liste" ? "h-[56px]" : "h-[64px]"
                      }`}
                    >
                      Voir plus de plongées ({g.plongees.length - PAR_ANNEE})
                      <ChevronDown className="h-[17px] w-[17px]" strokeWidth={2.4} aria-hidden="true" />
                    </button>
                  )}
                </div>
                )}
                {!ouverte && <div className="h-[22px]" aria-hidden="true" />}
              </div>
              );
            })}
            {groupes.length === 0 && <div className="pt-[18px]">{filtresListe}</div>}
            {groupes.length === 0 && (
              <p className="pt-8 text-center text-[13px] text-[#5B7189]">Aucune plongée pour ce filtre.</p>
            )}
            <div className="h-[120px]" aria-hidden="true" />
          </div>
        </>
      )}

        {/* Bouton flottant : dès la première plongée (carnet vide : la carte « Tu rentres de plongée ? » fait la même chose, sans rien cacher) */}
        {!vide && <button
          type="button"
          onClick={() => navigate({ to: "/plongee-express" })}
          aria-label="Nouvelle plongée"
          className={`fixed bottom-[calc(90px+env(safe-area-inset-bottom))] right-[max(20px,calc(50vw-215px+20px))] z-20 flex h-[52px] items-center justify-center overflow-hidden rounded-[26px] bg-[#3DEFBE] text-[14px] font-semibold text-[#123A63] shadow-[0_6px_18px_#123A6322] transition-all duration-300 ${
            boutonCompact ? "w-[52px] gap-0 px-0" : "w-[128px] gap-[9px] px-[19px]"
          }`}
        >
          <Plus className="h-[20px] w-[20px] shrink-0" strokeWidth={2} aria-hidden="true" />
          <span className={`whitespace-nowrap transition-all duration-300 ${boutonCompact ? "w-0 opacity-0" : "opacity-100"}`}>Plongée</span>
        </button>}

        <div className="flex-grow" />

        {/* Navigation du bas */}
        <BarreNavigation actif="carnet" />
      </div>
    </div>
  );
}
