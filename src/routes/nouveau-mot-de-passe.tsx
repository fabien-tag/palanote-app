import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { updatePassword } from "@/lib/auth";
import { BoutonRetour } from "@/components/BoutonRetour";
import { FondAuth } from "@/components/FondAuth";
import { ChampMotDePasse } from "@/components/ChampMotDePasse";

export const Route = createFileRoute("/nouveau-mot-de-passe")({
  head: () => ({
    meta: [
      { title: "Palanote — Nouveau mot de passe" },
      { name: "description", content: "Choisis un nouveau mot de passe." },
      { property: "og:title", content: "Palanote — Nouveau mot de passe" },
      { property: "og:description", content: "Choisis un nouveau mot de passe." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: NouveauMotDePasse,
});

function NouveauMotDePasse() {
  const navigate = useNavigate();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const lengthOk = password.length >= 8;
  const matchOk = password.length > 0 && password === confirm;
  const canSubmit = lengthOk && matchOk && !loading;

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!canSubmit) return;
    setError(null);
    setLoading(true);
    try {
      await updatePassword(password);
      navigate({ to: "/carnet" });
    } catch {
      setError("L'enregistrement n'a pas abouti. Réessaie.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="relative flex min-h-screen justify-center bg-abyss">
      <FondAuth />
      <div className="relative flex min-h-screen w-full max-w-[430px] flex-col px-6 pt-[94px] pb-6">
        <BoutonRetour clair defaut="/connexion" />
        <h1 className="text-2xl font-bold text-blanc">
          Choisis un nouveau mot de passe
        </h1>
        <p className="mt-2 text-base text-blanc/70">
          Tu resteras connecté sur cet appareil.
        </p>

        <form onSubmit={onSubmit} className="mt-8 space-y-5">
          <div>
            <label htmlFor="password" className="text-sm font-medium text-blanc">
              Nouveau mot de passe
            </label>
            <ChampMotDePasse
              id="password"
              value={password}
              onChange={setPassword}
              autoComplete="new-password"
            />
          </div>
          <div>
            <label htmlFor="confirm" className="text-sm font-medium text-blanc">
              Confirme le mot de passe
            </label>
            <ChampMotDePasse
              id="confirm"
              value={confirm}
              onChange={setConfirm}
              autoComplete="new-password"
            />
          </div>

          <ul className="space-y-1 text-xs">
            <li className={lengthOk ? "font-medium text-menthe" : "text-blanc/70"}>
              8 caractères minimum
            </li>
            <li className={matchOk ? "font-medium text-menthe" : "text-blanc/70"}>
              Les deux saisies correspondent
            </li>
            <li className="text-blanc/70">Différent de ton ancien mot de passe</li>
          </ul>

          {error && (
            <p role="alert" className="text-sm font-medium text-corail">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={!canSubmit}
            className="min-h-[52px] w-full rounded-[14px] bg-menthe text-sm font-bold tracking-wide text-abyss disabled:opacity-60"
          >
            ENREGISTRER
          </button>
        </form>
      </div>
    </div>
  );
}
