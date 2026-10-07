import { useNavigate } from "@tanstack/react-router";
import { Bell, Camera, ChevronRight, Fish, Star, Users } from "lucide-react";
import logoCorail from "@/assets/palanote-logo-cigle.png";
import fondMarin from "@/assets/fond-marin.mp4";
import { dureeEnMinutes, type CartePlongee } from "@/lib/plongees";
import { GALETS, GOUTTE } from "@/lib/formes";
import { couleurAvatar, initiales, type PlongeeAConfirmer } from "@/lib/amis";

// Éléments de l'écran d'accueil une fois la première plongée enregistrée
// (maquette « Palanote-MainListe »).

function dateValide(v: string) {
  const d = v ? new Date(v) : null;
  return d && !isNaN(d.getTime()) ? d : null;
}

function derniereplongeeTexte(plongees: CartePlongee[]) {
  const dates = plongees.map((p) => dateValide(p.date)).filter((d): d is Date => d !== null);
  if (dates.length === 0) return null;
  const derniere = new Date(Math.max(...dates.map((d) => d.getTime())));
  const aujourdhui = new Date();
  aujourdhui.setHours(0, 0, 0, 0);
  derniere.setHours(0, 0, 0, 0);
  const jours = Math.round((aujourdhui.getTime() - derniere.getTime()) / 86_400_000);
  if (jours <= 0) return "dernière plongée aujourd'hui";
  if (jours === 1) return "dernière plongée hier";
  if (jours < 31) return `dernière plongée il y a ${jours} jours`;
  if (jours < 365) return `dernière plongée il y a ${Math.round(jours / 30)} mois`;
  const ans = Math.round(jours / 365);
  return `dernière plongée il y a ${ans} an${ans > 1 ? "s" : ""}`;
}

function statistiques(plongees: CartePlongee[], numeroDepart: number, profMaxAvant: number) {
  const profondeurs = [...plongees.map((p) => Number(p.profMax.replace(",", "."))), profMaxAvant].filter((n) => Number.isFinite(n) && n > 0);
  const minutes = plongees.reduce((t, p) => t + (dureeEnMinutes(p.duree) ?? 0), 0);
  return {
    total: numeroDepart + plongees.length,
    profMax: profondeurs.length ? `${String(Math.max(...profondeurs)).replace(".", ",")} m` : "—",
    sousLEau: minutes === 0 ? "—" : minutes < 60 ? `${minutes} min` : `${Math.round(minutes / 60)} h`,
  };
}

export function EnTeteStatistiques({
  plongees,
  numeroDepart,
  niveau,
  certifications = [],
  profMaxAvant = 0,
}: {
  plongees: CartePlongee[];
  numeroDepart: number;
  niveau?: string | undefined;
  certifications?: string[] | undefined;
  profMaxAvant?: number | undefined;
}) {
  const stats = statistiques(plongees, numeroDepart, profMaxAvant);
  // « N2 / Advanced » → « N2 » ; « Encadrant » reste tel quel
  const niveauCourt = niveau ? (niveau.split("/")[0] ?? niveau).trim() : "—";
  const sousTitre = derniereplongeeTexte(plongees);
  return (
    <div className="relative h-[300px] w-full shrink-0 overflow-hidden rounded-b-[34px] bg-[#0E3D72]">
      <video
        className="absolute inset-0 h-full w-full object-cover"
        src={fondMarin}
        autoPlay
        muted
        loop
        playsInline
        aria-hidden="true"
      />
      <div
        className="absolute inset-0 bg-[linear-gradient(180deg,rgba(6,28,58,.60)_0%,rgba(6,26,54,.30)_38%,rgba(7,30,60,.50)_70%,rgba(7,32,64,.88)_100%)]"
        aria-hidden="true"
      />
      <div className="relative mx-auto flex h-full w-full max-w-[430px] flex-col">
        <div className="flex items-center justify-between px-[22px] pt-[18px]">
          <img src={logoCorail} alt="Palanote" className="h-[30px] w-auto" />
          <button
            type="button"
            aria-label="Notifications"
            className="-mr-[9px] flex h-10 w-10 items-center justify-center rounded-full"
          >
            <Bell className="h-[21px] w-[21px] text-white" strokeWidth={2} aria-hidden="true" />
          </button>
        </div>
        <div className="mt-auto px-[22px] pb-[16px]">
          {certifications.length > 0 && (
            <div className="flex flex-wrap gap-[6px] pb-[10px]">
              {certifications.map((c) => (
                <span key={c} className="rounded-full bg-[#3DEFBE] px-[10px] py-[3px] text-[11px] font-bold tracking-[.02em] text-[#0B3B63]">
                  {c} Diver
                </span>
              ))}
            </div>
          )}
          <h1 className="text-[24px] font-bold leading-[1.2] text-white">Mes plongées</h1>
          {sousTitre && <p className="pt-1 text-[14px] leading-normal text-white/90">{sousTitre}</p>}
        </div>
        <div className="px-[22px] pb-[6px]">
          <div className="flex border-t border-white/20">
            {[
              { valeur: niveauCourt, label: "niveau" },
              { valeur: stats.total, label: stats.total > 1 ? "plongées" : "plongée" },
              { valeur: stats.profMax, label: "prof. max" },
              { valeur: stats.sousLEau, label: "sous l'eau" },
            ].map((s) => (
              <div key={s.label} className="flex flex-1 flex-col items-center gap-[2px] px-[6px] pb-[8px] pt-[12px]">
                <div className="max-w-full truncate whitespace-nowrap text-[20px] font-semibold leading-tight text-white">{s.valeur}</div>
                <div className="whitespace-nowrap text-[10px] text-white/70">{s.label}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

// ---------- Filtres ----------

export type Filtre = { id: string; label: string; teste: (p: CartePlongee) => boolean };

export function filtresDisponibles(plongees: CartePlongee[]): Filtre[] {
  const annees = [...new Set(plongees.map((p) => dateValide(p.date)?.getFullYear()).filter(Boolean))]
    .sort((a, b) => Number(b) - Number(a))
    .map(String);
  return [
    { id: "toutes", label: "Toutes", teste: () => true },
    ...annees.map((a) => ({
      id: `annee-${a}`,
      label: a,
      teste: (p: CartePlongee) => String(dateValide(p.date)?.getFullYear()) === a,
    })),
    { id: "epaves", label: "Épaves", teste: (p) => p.type === "Épave" },
    { id: "note4", label: "4 et +", teste: (p) => p.note >= 4 },
    { id: "formation", label: "Formation", teste: (p) => p.type === "Formation" },
  ];
}

function pastille(id: string) {
  if (id.startsWith("annee-")) return <span className="h-[7px] w-[7px] rounded-full bg-[#57D4F5]" />;
  if (id === "epaves") return <span className="h-[7px] w-[7px] rounded-full bg-[#FF8A75]" />;
  if (id === "formation") return <span className="h-[7px] w-[7px] rounded-full bg-[#FFC65C]" />;
  if (id === "note4") return <Star className="h-[13px] w-[13px] fill-[#FFC65C] text-[#FFC65C]" />;
  return null;
}

export function FiltresPlongees({
  filtres,
  actif,
  onChange,
  className = "px-[22px] pt-[18px]",
}: {
  filtres: Filtre[];
  actif: string;
  onChange: (id: string) => void;
  className?: string;
}) {
  return (
    <div
      role="group"
      aria-label="Filtrer les plongées"
      className={`flex shrink-0 gap-[7px] overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden ${className}`}
    >
      {filtres.map((f) => {
        const on = f.id === actif;
        return (
          <button
            key={f.id}
            type="button"
            aria-pressed={on}
            onClick={() => onChange(f.id)}
            className={`flex h-9 shrink-0 items-center gap-[6px] rounded-[18px] px-[14px] text-[13px] ${
              on
                ? "bg-[#0F3D70] font-semibold text-white"
                : "border-[1.5px] border-[#D8E5EE] bg-white font-medium text-[#5B7189]"
            }`}
          >
            {!on && pastille(f.id)}
            {f.label}
          </button>
        );
      })}
    </div>
  );
}

// ---------- Bandeau « X a noté votre plongée » (parcours 07, écran 38) ----------

export function BandeauProposition({ propositions }: { propositions: PlongeeAConfirmer[] }) {
  const navigate = useNavigate();
  const p = propositions[0];
  if (!p) return null;
  const autres = propositions.length - 1;
  const details = [
    p.site,
    p.duree ? `${p.duree} min` : null,
    p.temp_fond !== null && p.temp_fond !== undefined ? `${String(Number(p.temp_fond)).replace(".", ",")} °C` : null,
  ]
    .filter(Boolean)
    .join(" · ");
  return (
    <div className="px-[22px] pt-[22px]">
      <button
        type="button"
        onClick={() => navigate({ to: "/amis/proposition", search: { id: p.id, depuis: "carnet" } })}
        style={{ borderRadius: GALETS[0] }}
        className="flex w-full items-center gap-3 border border-[#BFE6F5] bg-[#E3F4FC] px-[15px] py-[13px] text-left shadow-[0_4px_14px_#123A6309]"
      >
        <span
          className="flex h-[44px] w-[44px] shrink-0 items-center justify-center rounded-full text-[15px] font-bold text-[#0F3D70]"
          style={{ background: couleurAvatar(p.de.id) }}
        >
          {initiales(p.de.prenom)}
        </span>
        <span className="flex min-w-0 flex-grow flex-col gap-px">
          <span className="text-[14.5px] font-bold text-[#123A63]">{p.de.prenom} a noté votre plongée</span>
          {details && <span className="truncate text-[12.5px] text-[#5B7189]">{details}</span>}
          {autres > 0 && (
            <span className="text-[12px] font-semibold text-[#1176A8]">
              + {autres} autre{autres > 1 ? "s" : ""} proposition{autres > 1 ? "s" : ""} dans Amis
            </span>
          )}
        </span>
        <ChevronRight className="h-[17px] w-[17px] shrink-0 text-[#123A63]" strokeWidth={2.4} aria-hidden="true" />
      </button>
    </div>
  );
}

// ---------- Bandeau « carnets papier » ----------

export function BandeauCarnetsPapier({ onClick }: { onClick: () => void }) {
  return (
    <div className="px-[22px] pt-[26px]">
      <button
        type="button"
        onClick={onClick}
        style={{ borderRadius: GALETS[1] }}
        className="relative flex w-full items-center gap-3 border border-[#B8E4D8] bg-[#E2F8EF] px-[15px] py-[14px] text-left shadow-[0_4px_14px_#123A6309]"
      >
        <span style={{ borderRadius: GOUTTE }} className="flex h-10 w-10 shrink-0 items-center justify-center bg-white/55">
          <Camera className="h-[21px] w-[21px] text-[#123A63]" strokeWidth={2.1} aria-hidden="true" />
        </span>
        <span className="flex min-w-0 flex-grow flex-col gap-px">
          <span className="text-[14.5px] font-bold text-[#123A63]">Tu as des carnets papier&nbsp;?</span>
          <span className="text-[12.5px] text-[#123A63]">Photographie-les, on remplit les fiches. 50 pages offertes.</span>
        </span>
        <ChevronRight className="h-[17px] w-[17px] shrink-0 text-[#123A63]" strokeWidth={2.4} aria-hidden="true" />
        <span aria-hidden="true" className="pointer-events-none absolute right-3 top-[-13px] h-[25px] w-[38px]">
          <svg viewBox="0 0 100 58" className="h-full w-full">
            <path
              fill="#FF8A75"
              fillRule="evenodd"
              d="M6 29C18 12 34 5 51 7C61 8 73 13 76 22L91 13Q100 31 91 47L76 37C65 49 46 53 28 47Q14 42 6 32L1 31ZM19 30C30 16 48 13 63 21L69 29L62 39C46 47 29 42 19 30ZM17 23a3 3 0 1 0 6 0a3 3 0 1 0-6 0"
            />
          </svg>
        </span>
      </button>
    </div>
  );
}

// ---------- Raccourcis ----------

export function RaccourcisAccueil() {
  const navigate = useNavigate();
  const raccourcis: { titre: string; texte: string; Icone: typeof Users; fond: string; ouvrir?: () => void }[] = [
    {
      titre: "Plonger ensemble",
      texte: "Un QR, les photos, des carnets préremplis.",
      Icone: Users,
      fond: "bg-white",
      // Ouvre directement le QR code d'invitation ; « retour » ramène sur l'accueil.
      ouvrir: () => navigate({ to: "/amis/ajouter", search: { depuis: "carnet" } }),
    },
    {
      titre: "Qui as-tu croisé sous l’eau ?",
      texte: "L’IA t’aide à identifier les espèces sur vos photos.",
      Icone: Fish,
      fond: "bg-[#E5F3FC]",
      ouvrir: () => navigate({ to: "/especes" }),
    },
  ];
  return (
    <div className="grid grid-cols-2 gap-[14px] px-[22px] pt-[16px]">
      {raccourcis.map(({ titre, texte, Icone, fond, ouvrir }, i) => (
        <button
          key={titre}
          type="button"
          onClick={ouvrir}
          aria-disabled={ouvrir ? undefined : "true"}
          aria-label={ouvrir ? titre : `${titre} — bientôt disponible`}
          style={{ borderRadius: GALETS[i === 0 ? 0 : 2] }}
          className={`relative flex h-[150px] ${ouvrir ? "" : "cursor-default"} flex-col items-start gap-[10px] border border-[#D9E6F0] p-[15px] text-left shadow-[0_3px_13px_#123A6306] ${fond}`}
        >
          <span style={{ borderRadius: GOUTTE }} className="flex h-[35px] w-[35px] shrink-0 items-center justify-center bg-[#DCEEF8]">
            <Icone className="h-[21px] w-[21px] text-[#5B7189]" strokeWidth={1.7} aria-hidden="true" />
          </span>
          <span className="min-w-0">
            <span className="block text-[14px] font-semibold leading-[1.35] text-[#123A63]">{titre}</span>
            <span className="mt-[6px] block text-[10px] leading-normal text-[#5B7189]">{texte}</span>
          </span>
          {ouvrir ? (
            <ChevronRight className="absolute right-[14px] top-[24px] h-[16px] w-[16px] text-[#6387A4]" strokeWidth={2.4} aria-hidden="true" />
          ) : (
            <span className="absolute right-[12px] top-[21px] flex h-[19px] items-center rounded-[10px] bg-[#FFE6CC] px-[8px] text-[10px] font-semibold text-[#C2570C]">
              Bientôt
            </span>
          )}
        </button>
      ))}
    </div>
  );
}

// ---------- Icônes du sélecteur de vue (maquette) ----------

export function IconeVueCartes({ actif }: { actif: boolean }) {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={actif ? "#0F3D70" : "#9DB0C0"} strokeWidth={actif ? 2.2 : 1.9} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="3.5" y="4" width="17" height="9.5" rx="2.6" />
      <path d="M3.5 17.2h17M3.5 20.6h10" />
    </svg>
  );
}

export function IconeVueListe({ actif }: { actif: boolean }) {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={actif ? "#0F3D70" : "#9DB0C0"} strokeWidth={actif ? 2.2 : 1.9} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="3.2" y="4.6" width="4" height="4" rx="1.2" />
      <rect x="3.2" y="10" width="4" height="4" rx="1.2" />
      <rect x="3.2" y="15.4" width="4" height="4" rx="1.2" />
      <path d="M10 6.6h10.8M10 12h10.8M10 17.4h10.8" />
    </svg>
  );
}
