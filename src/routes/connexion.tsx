import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { signInWithEmail, signInWithGoogle } from "@/lib/auth";
import { BoutonRetour } from "@/components/BoutonRetour";
import { FondAuth } from "@/components/FondAuth";
import { ChampMotDePasse } from "@/components/ChampMotDePasse";
import { LogoGoogle } from "@/components/LogoGoogle";
import logoAsset from "@/assets/logo.png";
const logoImg = logoAsset;

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

function Connexion() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
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
        <img
          src={logoImg}
          alt="Palanote"
          className="mx-auto mt-6 mb-8 h-20 w-auto"
        />
        <h1 className="text-2xl font-bold text-blanc">Content de te revoir</h1>
        <p className="mt-2 text-base text-blanc/70">
          Retrouve ton carnet et tes plongées.
        </p>

        <form onSubmit={onSubmit} className="mt-8 space-y-5">
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
              className="mt-2 min-h-[52px] w-full rounded-[14px] border-0 bg-blanc px-4 text-base text-foreground outline-none focus:border-lagon"
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
            />
          </div>

          <div className="text-right">
            <Link
              to="/mot-de-passe-oublie"
              className="inline-flex min-h-[44px] items-center text-sm font-medium text-blanc"
            >
              Mot de passe oublié ?
            </Link>
          </div>

          {error && (
            <p role="alert" className="text-sm font-medium text-corail">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="min-h-[52px] w-full rounded-[14px] bg-menthe text-sm font-bold tracking-wide text-abyss disabled:opacity-60"
          >
            SE CONNECTER
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
          className="flex min-h-[52px] w-full items-center justify-center gap-3 rounded-[14px] border-0 bg-blanc text-sm font-bold tracking-wide text-encre"
        >
          <LogoGoogle />
          CONTINUER AVEC GOOGLE
        </button>

        <p className="mt-6 text-xs leading-relaxed text-blanc/70">
          En continuant, tu acceptes nos conditions d'utilisation et notre
          politique de confidentialité.
        </p>

        <p className="mt-auto pt-8 text-center text-sm text-blanc/70">
          Pas encore de compte ?{" "}
          <Link to="/creer-un-compte" className="font-semibold text-blanc">
            Créer un compte
          </Link>
        </p>
      </div>
    </div>
  );
}
