import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { signInWithGoogle } from "@/lib/auth";
import { setEtape1, getEtape1 } from "@/lib/inscription";
import { BoutonRetour } from "@/components/BoutonRetour";
import { FondAuth } from "@/components/FondAuth";
import { ChampMotDePasse } from "@/components/ChampMotDePasse";
import { Stepper } from "@/components/Stepper";
import { LogoGoogle } from "@/components/LogoGoogle";
import { CaseConditions } from "@/components/legal/CaseConditions";
import { memoriserCaseCochee } from "@/lib/legal";

export const Route = createFileRoute("/creer-un-compte")({
  head: () => ({
    meta: [
      { title: "Palanote — Créer un compte" },
      { name: "description", content: "Une minute, et tes plongées sont en sécurité." },
      { property: "og:title", content: "Palanote — Créer un compte" },
      { property: "og:description", content: "Une minute, et tes plongées sont en sécurité." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: CreerUnCompte,
});

function CreerUnCompte() {
  const navigate = useNavigate();
  const [firstName, setFirstName] = useState(() => getEtape1()?.firstName ?? "");
  const [email, setEmail] = useState(() => getEtape1()?.email ?? "");
  const [password, setPassword] = useState(() => getEtape1()?.password ?? "");
  const [error, setError] = useState<string | null>(null);
  const [emailError, setEmailError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  // Case non cochée par défaut : l'accord doit être un geste du plongeur
  const [conditions, setConditions] = useState(() => getEtape1()?.conditions ?? false);
  const [conditionsError, setConditionsError] = useState(false);

  const passwordOk = password.length >= 8 && password.length <= 72;
  const [prenomError, setPrenomError] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setEmailError(null);
    setPrenomError(null);
    const prenom = firstName.trim();
    const mail = email.trim().toLowerCase();
    let ok = true;
    if (!prenom || prenom.length > 50) {
      setPrenomError("Indique ton prénom.");
      ok = false;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(mail) || mail.length > 255) {
      setEmailError("Cette adresse e-mail n'est pas valide.");
      ok = false;
    }
    if (!conditions) {
      setConditionsError(true);
      ok = false;
    }
    if (!passwordOk || !ok) return;
    setLoading(true);
    try {
      // Le compte est créé à la fin de l'étape 2.
      setEtape1({ firstName: prenom, email: mail, password, conditions: true });
      navigate({ to: "/profil-plongeur" });
    } catch (err) {
      const code = (err as { code?: string })?.code;
      if (code === "user_already_exists") {
        setEmailError(
          "Cette adresse e-mail a déjà un compte. Connecte-toi directement."
        );
      } else if (code === "weak_password") {
        setError(
          "Ce mot de passe est trop simple et a déjà été compromis. Choisis-en un autre."
        );
      } else {
        setError("La création du compte n'a pas abouti. Réessaie.");
      }
    } finally {
      setLoading(false);
    }
  }

  async function onGoogle() {
    setError(null);
    if (!conditions) {
      setConditionsError(true);
      return;
    }
    memoriserCaseCochee();
    try {
      await signInWithGoogle();
    } catch {
      setError("La connexion avec Google n'a pas abouti. Réessaie.");
    }
  }

  return (
    <div className="relative flex min-h-screen justify-center bg-abyss">
      <FondAuth />
      <div className="relative flex min-h-screen w-full max-w-[430px] flex-col px-6 pt-[94px] pb-6">
        <BoutonRetour clair />
        <p className="mt-2 text-xs font-semibold tracking-wide text-blanc/70">
          Étape 1 sur 2
        </p>
        <Stepper etape={1} />
        <h1 className="mt-2 text-2xl font-bold text-blanc">Bienvenue à bord</h1>
        <p className="mt-2 text-base text-blanc/70">
          Une minute, et tes plongées sont en sécurité.
        </p>

        <form onSubmit={onSubmit} className="mt-8 space-y-5">
          <div>
            <label htmlFor="firstname" className="text-sm font-medium text-blanc">
              Ton prénom
            </label>
            <input
              id="firstname"
              type="text"
              autoComplete="given-name"
              maxLength={50}
              value={firstName}
              onChange={(e) => {
                setFirstName(e.target.value);
                setPrenomError(null);
              }}
              placeholder="Ex. : Camille"
              className="mt-2 min-h-[52px] w-full galet-moyen border-0 bg-blanc px-4 text-base text-foreground outline-none placeholder:text-foreground/40 focus:border-lagon"
            />
            {prenomError && (
              <p role="alert" className="mt-2 text-xs font-medium text-corail">
                {prenomError}
              </p>
            )}
          </div>
          <div>
            <label htmlFor="email" className="text-sm font-medium text-blanc">
              Ton adresse e-mail
            </label>
            <input
              id="email"
              type="email"
              autoComplete="email"
              maxLength={255}
              value={email}
              onChange={(e) => {
                setEmail(e.target.value);
                setEmailError(null);
              }}
              placeholder="prenom@exemple.fr"
              className="mt-2 min-h-[52px] w-full galet-moyen border-0 bg-blanc px-4 text-base text-foreground outline-none focus:border-lagon"
            />
            {emailError && (
              <p role="alert" className="mt-2 text-xs font-medium text-corail">
                {emailError}
              </p>
            )}
          </div>
          <div>
            <label htmlFor="password" className="text-sm font-medium text-blanc">
              Ton mot de passe
            </label>
            <ChampMotDePasse
              id="password"
              value={password}
              onChange={setPassword}
              placeholder="Mot de passe"
              autoComplete="new-password"
            />
            <p className={`mt-2 text-xs ${passwordOk ? "font-medium text-menthe" : "text-blanc/70"}`}>
              {passwordOk ? "Correct" : "8 caractères minimum"}
            </p>
          </div>

          <CaseConditions
            cochee={conditions}
            onChange={(v) => {
              setConditions(v);
              setConditionsError(false);
            }}
            erreur={conditionsError}
            // On garde la saisie en mémoire le temps de lire les conditions
            avantLien={() => setEtape1({ firstName, email, password, conditions })}
          />

          {error && (
            <p role="alert" className="text-sm font-medium text-corail">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={loading || !passwordOk}
            className="min-h-[52px] w-full galet-moyen bg-menthe text-sm font-bold tracking-wide text-abyss disabled:opacity-60"
          >
            ÉTAPE SUIVANTE
          </button>
        </form>

        <div className="my-6 flex items-center gap-4">
          <span className="h-px flex-1 bg-blanc/30" />
          <span className="text-xs font-medium text-blanc/70">OU</span>
          <span className="h-px flex-1 bg-blanc/30" />
        </div>

        <button
          type="button"
          onClick={onGoogle}
          className="flex min-h-[52px] w-full items-center justify-center gap-3 galet-moyen border-0 bg-blanc text-sm font-bold tracking-wide text-encre"
        >
          <LogoGoogle />
          CONTINUER AVEC GOOGLE
        </button>

        <p className="mt-6 text-center text-xs leading-relaxed text-blanc/60">
          <Link to="/mentions-legales" className="underline underline-offset-2">
            Mentions légales
          </Link>
        </p>

        <p className="mt-auto pt-8 text-center text-sm text-blanc/70">
          Déjà un compte ?{" "}
          <Link to="/connexion" className="font-semibold text-blanc">
            Se connecter
          </Link>
        </p>
      </div>
    </div>
  );
}
