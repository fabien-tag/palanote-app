import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { supabase } from "@/lib/supabase";
import fondAsset from "@/assets/BG.png";
import logoAsset from "@/assets/logo.png";

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
  // Déjà connecté (ou retour de Google) : on passe directement à l'accueil.
  const navigate = useNavigate();
  useEffect(() => {
    void supabase.auth.getSession().then(({ data }) => {
      if (data.session) navigate({ to: "/carnet", replace: true });
    });
  }, [navigate]);
  const [expanded, setExpanded] = useState(false);
  // Liste dépliée : on fait défiler la zone du milieu pour la montrer, les boutons ne bougent pas.
  const milieu = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!expanded) return;
    const t = setTimeout(() => milieu.current?.scrollTo({ top: milieu.current.scrollHeight, behavior: "smooth" }), 320);
    return () => clearTimeout(t);
  }, [expanded]);

  return (
    // Hauteur calée sur la partie visible de l'écran (100dvh = hors barres du navigateur) :
    // les boutons restent toujours visibles, le contenu du milieu s'adapte et défile si besoin.
    <div className="relative flex h-screen h-[100dvh] justify-center overflow-hidden bg-abyss">
      <img
        src={fondAsset}
        alt=""
        className="pointer-events-none absolute inset-0 h-full w-full object-cover"
      />
      <div className="pointer-events-none absolute inset-0 bg-abyss/40" />
      <div className="relative flex h-full w-full max-w-[430px] flex-col px-6 pt-[clamp(20px,7vh,64px)] pb-[clamp(14px,3vh,24px)]">
        <div ref={milieu} className={`flex min-h-0 flex-1 flex-col overflow-y-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden ${expanded ? "[mask-image:linear-gradient(to_bottom,black_88%,transparent)]" : ""}`}>
          <div className="my-auto flex flex-col items-center py-2 text-center">
          <img
            src={logoAsset}
            alt="Palanote"
            className={`w-auto transition-all duration-300 ${expanded ? "h-[clamp(48px,8vh,72px)]" : "h-[clamp(64px,12.5vh,112px)]"}`}
          />
          <h1 className="mt-[clamp(14px,3.6vh,32px)] text-[clamp(24px,4.3vh,30px)] leading-tight font-bold text-white">
            Ton carnet de plongée
            <br />
            dans la poche
          </h1>
          <p className="mt-[clamp(8px,1.9vh,16px)] text-[clamp(14px,2.3vh,16px)] leading-relaxed text-ciel">
            Photographie tes anciens carnets, retrouve tes binômes, organise
            tes sorties et équipe-toi d'occasion. Tout au même endroit.
          </p>

          <button
            type="button"
            onClick={() => setExpanded((v) => !v)}
            aria-expanded={expanded}
            className="mt-[clamp(6px,2.4vh,24px)] flex min-h-[44px] items-center gap-2 text-sm font-medium text-lagon"
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
        </div>

        <div className="shrink-0 space-y-3 pt-[clamp(10px,2vh,16px)]">
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
        <p className="mt-[clamp(8px,1.9vh,16px)] shrink-0 text-center text-xs leading-relaxed text-blanc/70">
          En continuant, tu acceptes nos conditions d'utilisation et notre
          politique de confidentialité.
        </p>
      </div>
    </div>
  );
}
