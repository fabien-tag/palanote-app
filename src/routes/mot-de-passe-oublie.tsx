import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { sendResetLink } from "@/lib/auth";
import { BoutonRetour } from "@/components/BoutonRetour";
import { FondAuth } from "@/components/FondAuth";

export const Route = createFileRoute("/mot-de-passe-oublie")({
  head: () => ({
    meta: [
      { title: "Palanote — Mot de passe oublié" },
      { name: "description", content: "Entre ton e-mail, on t'envoie un lien pour choisir un nouveau mot de passe." },
      { property: "og:title", content: "Palanote — Mot de passe oublié" },
      { property: "og:description", content: "Entre ton e-mail, on t'envoie un lien pour choisir un nouveau mot de passe." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: MotDePasseOublie,
});

const RESEND_DELAY = 60;

function MotDePasseOublie() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);
  const [countdown, setCountdown] = useState(0);

  useEffect(() => {
    if (countdown <= 0) return;
    const t = setTimeout(() => setCountdown((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [countdown]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      // Message identique que le compte existe ou non.
      await sendResetLink(email);
    } catch {
      // On ne révèle rien : même écran de confirmation dans tous les cas.
    } finally {
      setLoading(false);
      setSent(true);
      setCountdown(RESEND_DELAY);
    }
  }

  async function onResend() {
    if (countdown > 0) return;
    try {
      await sendResetLink(email);
    } catch {
      // silencieux, même règle
    }
    setCountdown(RESEND_DELAY);
  }

  return (
    <div className="relative flex min-h-screen justify-center bg-abyss">
      <FondAuth />
      <div className="relative flex min-h-screen w-full max-w-[430px] flex-col px-6 pt-[94px] pb-6">
        <BoutonRetour clair defaut="/connexion" />
        {sent ? (
          <>
            <h1 className="text-2xl font-bold text-blanc">Regarde tes e-mails</h1>
            <p className="mt-4 text-base leading-relaxed text-blanc/70">
              On vient d'envoyer un lien à{" "}
              <span className="font-semibold text-blanc">{email}</span>
            </p>
            <button
              type="button"
              onClick={onResend}
              disabled={countdown > 0}
              className="mt-8 flex min-h-[52px] w-full items-center justify-center galet-moyen border-0 bg-blanc text-sm font-bold tracking-wide text-encre disabled:opacity-60"
            >
              {countdown > 0 ? `Renvoyer le lien — ${countdown} s` : "Renvoyer le lien"}
            </button>
          </>
        ) : (
          <>
            <h1 className="text-2xl font-bold text-blanc">On te renvoie une clé</h1>
            <p className="mt-2 text-base text-blanc/70">
              Entre ton e-mail, on t'envoie un lien pour choisir un nouveau mot
              de passe.
            </p>

            <form onSubmit={onSubmit} className="mt-8 space-y-5">
              <div>
                <label htmlFor="email" className="text-sm font-medium text-blanc">
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
                  className="mt-2 min-h-[52px] w-full galet-moyen border-0 bg-blanc px-4 text-base text-foreground outline-none focus:border-lagon"
                />
              </div>
              <button
                type="submit"
                disabled={loading}
                className="min-h-[52px] w-full galet-moyen bg-menthe text-sm font-bold tracking-wide text-abyss disabled:opacity-60"
              >
                ENVOYER LE LIEN
              </button>
            </form>
          </>
        )}

        <p className="mt-auto pt-8 text-center">
          <Link
            to="/connexion"
            className="inline-flex min-h-[44px] items-center text-sm font-semibold text-blanc"
          >
            Revenir à la connexion
          </Link>
        </p>
      </div>
    </div>
  );
}
