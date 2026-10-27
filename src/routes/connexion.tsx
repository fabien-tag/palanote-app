import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { choisirSeSouvenir, seSouvenirDeMoi } from "@/lib/supabase";
import { signInWithEmail, signInWithGoogle } from "@/lib/auth";
import { BoutonRetour } from "@/components/BoutonRetour";
import { FondAuth } from "@/components/FondAuth";
import { ChampMotDePasse } from "@/components/ChampMotDePasse";
import { LogoGoogle } from "@/components/LogoGoogle";
import logoAsset from "@/assets/logo.png";
const logoImg = logoAsset;

// Comptes fermés après la soutenance : un message clair au lieu de « mot de passe incorrect »
const COMPTES_SUPPRIMES = ["fabien.tagliareni+jury@gmail.com"];

export const Route = createFileRoute("/connexion")({
  head: () => ({
    meta: [
      { title: "Palanote — Connexion" },
      { name: "description", content: "Retrouve ton carnet et tes plongées." },
      { property: "og:title", content: "Palanote — Connexion" },
      { property: "og:description", content: "Retrouve ton carnet et tes plongées." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Connexion,
});

const CLE_EMAIL = "palanote-email-memorise";

function memoriserChoix(souvenir: boolean, email: string) {
  choisirSeSouvenir(souvenir);
  try {
    if (souvenir && email.trim()) localStorage.setItem(CLE_EMAIL, email.trim());
    else localStorage.removeItem(CLE_EMAIL);
  } catch {
    /* stockage indisponible */
  }
}

function Connexion() {
  const navigate = useNavigate();
  // La session est toujours gardée (comme une app mobile) ; l'adresse e-mail est préremplie la prochaine fois.
  const souvenir = true;
  const [email, setEmail] = useState(() => {
    try {
      return (seSouvenirDeMoi() && localStorage.getItem(CLE_EMAIL)) || "";
    } catch {
      return "";
    }
  });
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    // Compte de démonstration de la soutenance, supprimé depuis
    if (COMPTES_SUPPRIMES.includes(email.trim().toLowerCase())) {
      setError(
        "Ce compte a été supprimé pour des raisons de sécurité. Si vous souhaitez revoir le projet, veuillez contacter fabien.tagliareni@gmail.com.",
      );
      setLoading(false);
      return;
    }
    try {
      memoriserChoix(souvenir, email);
      await signInWithEmail(email, password);
      navigate({ to: "/carnet" });
    } catch (err) {
      const code = (err as { code?: string })?.code;
      setError(
        code === "email_not_confirmed"
          ? "Vérifie d'abord ton compte avec le lien reçu par e-mail."
          : "Identifiant ou mot de passe incorrect."
      );
    } finally {
      setLoading(false);
    }
  }

  async function onGoogle() {
    setError(null);
    try {
      memoriserChoix(souvenir, "");
      await signInWithGoogle();
    } catch {
      setError("La connexion avec Google n'a pas abouti. Réessaie.");
    }
  }

  return (
    // Hauteur calée sur la partie visible de l'écran (dvh) : tout tient sans défiler,
    // jusqu'au lien « Créer un compte ». Défilement seulement en dernier recours.
    <div className="relative flex h-screen supports-[height:100dvh]:h-[100dvh] justify-center overflow-hidden bg-abyss">
      <FondAuth />
      <div className="relative flex h-full w-full max-w-[430px] flex-col overflow-y-auto px-6 pt-[clamp(56px,8.6svh,94px)] pb-[max(clamp(12px,2.6svh,24px),env(safe-area-inset-bottom))]">
        <BoutonRetour clair />
        <img
          src={logoImg}
          alt="Palanote"
          className="mx-auto mt-[clamp(0px,1.5svh,24px)] mb-[clamp(8px,2.6svh,32px)] h-[clamp(40px,7.6svh,80px)] w-auto"
        />
        <h1 className="text-[clamp(20px,3.4svh,24px)] font-bold text-blanc">Content de te revoir</h1>
        <p className="mt-[clamp(2px,0.9svh,8px)] text-[clamp(14px,2.3svh,16px)] text-blanc/70">
          Retrouve ton carnet et tes plongées.
        </p>

        <form onSubmit={onSubmit} className="mt-[clamp(12px,3svh,32px)] space-y-[clamp(6px,1.7svh,20px)]">
          <div>
            <label
              htmlFor="email"
              className="text-sm font-medium text-blanc"
            >
              Ton adresse e-mail
            </label>
            <input
              id="email"
              type="email"
              required
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="prenom@exemple.fr"
              aria-invalid={error ? true : undefined}
              aria-describedby={error ? "erreur-connexion" : undefined}
              className="mt-[clamp(4px,0.9svh,8px)] min-h-[clamp(46px,6.6svh,52px)] w-full galet-moyen border-0 bg-blanc px-4 text-base text-foreground outline-none focus:border-lagon"
            />
          </div>
          <div>
            <label
              htmlFor="password"
              className="text-sm font-medium text-blanc"
            >
              Ton mot de passe
            </label>
            <ChampMotDePasse
              id="password"
              value={password}
              onChange={setPassword}
              placeholder="Mot de passe"
              erreurId={error ? "erreur-connexion" : undefined}
            />
            <div className="flex justify-end">
              <Link
                to="/mot-de-passe-oublie"
                className="-mb-[6px] inline-flex min-h-[36px] items-center text-[13px] font-medium text-blanc/80 underline-offset-4 hover:underline"
              >
                Mot de passe oublié ?
              </Link>
            </div>
          </div>

          {error && (
            <p id="erreur-connexion" role="alert" className="text-sm font-medium text-corail">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="min-h-[clamp(46px,6.6svh,52px)] w-full galet-moyen bg-menthe text-sm font-bold tracking-wide text-abyss disabled:opacity-60"
          >
            SE CONNECTER
          </button>
        </form>

        <div className="my-[clamp(8px,2.1svh,24px)] flex items-center gap-4">
          <span className="h-px flex-1 bg-blanc/30" />
          <span className="text-xs font-medium text-blanc/70">OU</span>
          <span className="h-px flex-1 bg-blanc/30" />
        </div>

        <button
          type="button"
          onClick={onGoogle}
          className="flex min-h-[clamp(46px,6.6svh,52px)] w-full items-center justify-center gap-3 galet-moyen border-0 bg-blanc text-sm font-bold tracking-wide text-encre"
        >
          <LogoGoogle />
          CONTINUER AVEC GOOGLE
        </button>

        <p className="mt-[clamp(8px,2.2svh,24px)] text-xs leading-relaxed text-blanc/70">
          En continuant, tu acceptes nos{" "}
          <Link to="/conditions-utilisation" className="underline underline-offset-2">
            conditions d'utilisation
          </Link>{" "}
          et notre{" "}
          <Link to="/politique-de-confidentialite" className="underline underline-offset-2">
            politique de confidentialité
          </Link>
          .
        </p>

        <p className="mt-auto pt-[clamp(8px,2.4svh,32px)] text-center text-sm text-blanc/70">
          Pas encore de compte ?{" "}
          <Link to="/creer-un-compte" className="font-semibold text-blanc">
            Créer un compte
          </Link>
        </p>
      </div>
    </div>
  );
}
