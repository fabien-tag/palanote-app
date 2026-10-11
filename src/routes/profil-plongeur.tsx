import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { Search } from "lucide-react";
import { signUpWithEmail, type ProfilInscription } from "@/lib/auth";
import { getEtape1, clearEtape1 } from "@/lib/inscription";
import { Stepper } from "@/components/Stepper";
import { BoutonRetour } from "@/components/BoutonRetour";
import { FondAuth } from "@/components/FondAuth";
import { AIDE_ROLE, DUREE_MOYENNE_DEFAUT, DUREES_MOYENNES, heuresEstimees, NIVEAUX, ROLES } from "@/lib/profil-plongeur";

export const Route = createFileRoute("/profil-plongeur")({
  head: () => ({
    meta: [
      { title: "Palanote — Parle-nous de ta plongée" },
      { name: "description", content: "Rien d'obligatoire. Ça sert à afficher tes stats justes dès la première plongée." },
      { property: "og:title", content: "Palanote — Parle-nous de ta plongée" },
      { property: "og:description", content: "Rien d'obligatoire. Ça sert à afficher tes stats justes dès la première plongée." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ProfilPlongeur,
});

const LEVELS = NIVEAUX;

function ProfilPlongeur() {
  const navigate = useNavigate();
  const [level, setLevel] = useState("");
  const [role, setRole] = useState("");
  const [club, setClub] = useState("");
  const [firstDiveYear, setFirstDiveYear] = useState("");
  const [diveCount, setDiveCount] = useState("");
  const [dureeMoyenne, setDureeMoyenne] = useState<number>(DUREE_MOYENNE_DEFAUT);
  const heures = heuresEstimees(Number(diveCount), dureeMoyenne);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function creer(avecProfil: boolean) {
    const etape1 = getEtape1();
    if (!etape1) {
      navigate({ to: "/creer-un-compte" });
      return;
    }
    const profil: ProfilInscription = {};
    if (avecProfil) {
      if (level) profil.niveau = level;
      if (role) profil.role_plongee = role;
      if (club) profil.club = club;
      if (firstDiveYear) profil.premiere_plongee_le = `${firstDiveYear}-01-01`;
      if (diveCount) {
        profil.numero_depart = Number(diveCount);
        profil.heures_avant = heures;
      }
    }
    setError(null);
    setLoading(true);
    try {
      await signUpWithEmail(etape1.email, etape1.password, etape1.firstName, profil);
      clearEtape1();
      navigate({ to: "/compte-cree" });
    } catch (err) {
      const code = (err as { code?: string })?.code;
      if (code === "user_already_exists") {
        setError("Cette adresse e-mail a déjà un compte. Connecte-toi directement.");
      } else if (code === "weak_password") {
        setError("Ce mot de passe est trop simple et a déjà été compromis. Choisis-en un autre.");
      } else {
        setError("La création du compte n'a pas abouti. Réessaie.");
      }
    } finally {
      setLoading(false);
    }
  }

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    void creer(true);
  }

  return (
    <div className="relative flex min-h-screen justify-center bg-abyss">
      <FondAuth />
      <div className="relative flex min-h-screen w-full max-w-[430px] flex-col px-6 pt-[94px] pb-6">
        <BoutonRetour clair defaut="/creer-un-compte" />
        <p className="mt-2 text-xs font-semibold tracking-wide text-blanc/70">
          Étape 2 sur 2
        </p>
        <Stepper etape={2} />
        <h1 className="mt-2 text-2xl font-bold text-blanc">
          Parle-nous de ta plongée
        </h1>
        <p className="mt-2 text-base text-blanc/70">
          Rien d'obligatoire. Ça sert à afficher tes stats justes dès la
          première plongée.
        </p>

        <form onSubmit={onSubmit} className="mt-8 space-y-5">
          <div>
            <div className="text-sm font-medium text-blanc">Ton niveau</div>
            <div className="mt-2 flex flex-wrap gap-2">
              {LEVELS.map((l) => {
                const actif = level === l;
                return (
                  <button
                    key={l}
                    type="button"
                    onClick={() => setLevel(actif ? "" : l)}
                    className={`flex min-h-[42px] items-center rounded-full px-[17px] text-sm transition-colors ${
                      actif
                        ? "bg-menthe font-bold text-abyss"
                        : "border-[1.5px] border-blanc/30 bg-blanc/15 text-blanc"
                    }`}
                  >
                    {l}
                  </button>
                );
              })}
            </div>
          </div>

          <div>
            <div className="text-sm font-medium text-blanc">Ton rôle</div>
            <div className="mt-2 flex flex-wrap gap-2">
              {ROLES.map((r) => {
                const actif = role === r.valeur;
                return (
                  <button
                    key={r.valeur}
                    type="button"
                    aria-pressed={actif}
                    onClick={() => setRole(actif ? "" : r.valeur)}
                    className={`flex min-h-[42px] items-center rounded-full px-[17px] text-sm transition-colors ${
                      actif
                        ? "bg-menthe font-bold text-abyss"
                        : "border-[1.5px] border-blanc/30 bg-blanc/15 text-blanc"
                    }`}
                  >
                    {r.label}
                  </button>
                );
              })}
            </div>
            <p className="mt-2 text-[11.5px] leading-snug text-blanc/70">{AIDE_ROLE}</p>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label htmlFor="firstDive" className="text-sm font-medium text-blanc">
                Première plongée
              </label>
              <input
                id="firstDive"
                type="number"
                inputMode="numeric"
                min={1950}
                max={new Date().getFullYear()}
                value={firstDiveYear}
                onChange={(e) => setFirstDiveYear(e.target.value)}
                placeholder="Année"
                className="mt-2 min-h-[52px] w-full galet-moyen border-0 bg-blanc px-4 text-base text-foreground outline-none focus:border-lagon"
              />
            </div>
            <div>
              <label htmlFor="count" className="text-sm font-medium text-blanc">
                Plongées environ
              </label>
              <input
                id="count"
                type="number"
                inputMode="numeric"
                min={0}
                value={diveCount}
                onChange={(e) => setDiveCount(e.target.value)}
                className="mt-2 min-h-[52px] w-full galet-moyen border-0 bg-blanc px-4 text-base text-foreground outline-none focus:border-lagon"
              />
            </div>
          </div>
          {/* Estimation du temps passé sous l'eau : nombre de plongées × durée moyenne */}
          {heures > 0 && (
            <div className="galet-moyen bg-white/10 px-[14px] py-[12px]">
              <div className="flex items-center justify-between gap-3">
                <span className="text-[13px] text-blanc/80">Soit environ</span>
                <span className="rounded-[12px] bg-[#3DEFBE] px-[11px] py-[4px] text-[14px] font-bold text-[#0B3B63]">
                  {heures.toLocaleString("fr-FR")} h sous l'eau
                </span>
              </div>
              <p className="pt-[10px] text-[11.5px] text-blanc/60">Une plongée dure en moyenne :</p>
              <div className="flex gap-[6px] pt-[6px]" role="radiogroup" aria-label="Durée moyenne d'une plongée">
                {DUREES_MOYENNES.map((d) => (
                  <button
                    key={d}
                    type="button"
                    role="radio"
                    aria-checked={dureeMoyenne === d}
                    onClick={() => setDureeMoyenne(d)}
                    className={`h-[32px] flex-1 whitespace-nowrap rounded-[16px] px-[10px] text-[13px] font-bold ${
                      dureeMoyenne === d ? "bg-blanc text-[#0B3B63]" : "border border-white/25 text-blanc/80"
                    }`}
                  >
                    {d === 60 ? "1 h" : `${d} min`}
                  </button>
                ))}
              </div>
            </div>
          )}
          <p className="text-[11.5px] leading-snug text-blanc/70">
            Ces chiffres s'ajusteront tout seuls quand tu importeras tes carnets. Tu peux les corriger dans Moi.
          </p>

          <div>
            <label htmlFor="club" className="text-sm font-medium text-blanc">
              Club ou centre{" "}
              <span className="font-normal text-blanc/60">— facultatif</span>
            </label>
            <div className="relative mt-2">
              <input
                id="club"
                type="text"
                value={club}
                onChange={(e) => setClub(e.target.value)}
                placeholder="Rechercher un club"
                className="min-h-[52px] w-full galet-moyen border-0 bg-blanc px-4 pr-12 text-base text-foreground outline-none placeholder:text-foreground/50 focus:border-lagon"
              />
              <Search
                className="pointer-events-none absolute right-4 top-1/2 h-[18px] w-[18px] -translate-y-1/2 text-foreground/40"
                aria-hidden
              />
            </div>
          </div>

          <p className="text-[11.5px] leading-snug text-blanc/70">
            Niveau et club sont visibles par tes binômes. Ton nombre de plongées
            et ton carnet ne le sont pas.
          </p>

          {error && (
            <p role="alert" className="text-sm font-medium text-corail">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="min-h-[52px] w-full galet-moyen bg-menthe text-sm font-bold tracking-wide text-abyss disabled:opacity-60"
          >
            CRÉER MON COMPTE
          </button>
        </form>

        <p className="mt-auto pt-8 text-center">
          <button
            type="button"
            disabled={loading}
            onClick={() => void creer(false)}
            className="inline-flex min-h-[44px] items-center text-sm font-semibold text-blanc"
          >
            Passer
          </button>
        </p>
      </div>
    </div>
  );
}
