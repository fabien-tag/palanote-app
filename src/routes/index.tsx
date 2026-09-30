import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import fondAsset from "@/assets/BG.png.asset.json";
import logoAsset from "@/assets/logo.png.asset.json";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Palanote — Ton carnet de plongée dans la poche" },
      {
        name: "description",
        content:
          "Photographie tes anciens carnets, retrouve tes binômes, organise tes sorties et équipe-toi d'occasion. Tout au même endroit.",
      },
      { property: "og:title", content: "Palanote — Ton carnet de plongée dans la poche" },
      {
        property: "og:description",
        content:
          "Photographie tes anciens carnets, retrouve tes binômes, organise tes sorties et équipe-toi d'occasion. Tout au même endroit.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Splash,
});

const BENEFITS = [
  {
    title: "Tes vieux carnets prennent la pose",
    body: "Photographie les pages, l'app remplit tout.",
  },
  {
    title: "Le groupe de ton club, en mieux rangé",
    body: "Sorties, palanquées, covoiturage. Et le carnet se remplit tout seul.",
  },
  {
    title: "Tes photos retrouvent leur spot toutes seules",
    body: "Chaque cliché rattaché à sa plongée, chaque plongée sur la carte.",
  },
  {
    title: "Ton matos a meilleure mémoire que toi",
    body: "Rappels de révision, annonces entre plongeurs.",
  },
];

function Splash() {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="relative flex min-h-screen justify-center bg-abyss">
      <img
        src={fondAsset.url}
        alt=""
        className="pointer-events-none absolute inset-0 h-full w-full object-cover"
      />
      <div className="pointer-events-none absolute inset-0 bg-abyss/40" />
      <div className="relative flex min-h-screen w-full max-w-[430px] flex-col px-6 pt-16 pb-6">
        <div className="flex flex-1 flex-col items-center justify-center text-center">
          <img
            src={logoAsset.url}
            alt="Palanote"
            className="h-28 w-auto"
          />
          <h1 className="mt-8 text-3xl leading-tight font-bold text-white">
            Ton carnet de plongée
            <br />
            dans la poche
          </h1>
          <p className="mt-4 text-base leading-relaxed text-ciel">
            Photographie tes anciens carnets, retrouve tes binômes, organise
            tes sorties et équipe-toi d'occasion. Tout au même endroit.
          </p>

          <button
            type="button"
            onClick={() => setExpanded((v) => !v)}
            aria-expanded={expanded}
            className="mt-6 flex min-h-[44px] items-center gap-2 text-sm font-medium text-lagon"
          >
            Voir tout ce que l'app fait
            <span
              aria-hidden
              className={`inline-block transition-transform duration-200 ${expanded ? "rotate-180" : ""}`}
            >
              ⌄
            </span>
          </button>

          <div
            className={`grid transition-all duration-300 ease-in-out ${
              expanded
                ? "mt-2 grid-rows-[1fr] opacity-100"
                : "grid-rows-[0fr] opacity-0"
            }`}
          >
            <div className="overflow-hidden">
              <ul className="space-y-5 pb-2 text-left">
                {BENEFITS.map((b) => (
                  <li key={b.title}>
                    <p className="text-base font-semibold text-white">
                      {b.title}
                    </p>
                    <p className="mt-1 text-sm leading-relaxed text-ciel/80">
                      {b.body}
                    </p>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>

        <div className="space-y-3">
          <Link
            to="/connexion"
            className="flex min-h-[52px] w-full items-center justify-center rounded-[14px] border border-ciel/40 text-sm font-bold tracking-wide text-white"
          >
            SE CONNECTER
          </Link>
          <Link
            to="/creer-un-compte"
            className="flex min-h-[52px] w-full items-center justify-center rounded-[14px] bg-menthe text-sm font-bold tracking-wide text-abyss"
          >
            CRÉER UN COMPTE
          </Link>
        </div>
        <p className="mt-4 text-center text-xs leading-relaxed text-blanc/70">
          En continuant, tu acceptes nos conditions d'utilisation et notre
          politique de confidentialité.
        </p>
      </div>
    </div>
  );
}
