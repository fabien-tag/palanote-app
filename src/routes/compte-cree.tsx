import { createFileRoute, Link } from "@tanstack/react-router";
import { Mail } from "lucide-react";
import { FondAuth } from "@/components/FondAuth";

export const Route = createFileRoute("/compte-cree")({
  head: () => ({
    meta: [
      { title: "Palanote — Compte créé" },
      { name: "description", content: "Ton compte a bien été créé. Va sur ta boîte e-mail pour vérifier ton compte." },
      { property: "og:title", content: "Palanote — Compte créé" },
      { property: "og:description", content: "Ton compte a bien été créé. Va sur ta boîte e-mail pour vérifier ton compte." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: CompteCree,
});

function CompteCree() {
  return (
    <div className="relative flex min-h-screen justify-center bg-abyss">
      <FondAuth />
      <div className="relative flex min-h-screen w-full max-w-[430px] flex-col justify-center px-6 py-6">
        <div className="flex flex-col items-center galet-b border border-blanc/25 bg-blanc/10 px-6 py-10 text-center">
          <div className="flex h-14 w-14 items-center justify-center goutte border border-blanc/30 bg-blanc/15">
            <Mail className="h-7 w-7 text-blanc" strokeWidth={2} />
          </div>
          <h1 className="mt-6 text-2xl font-bold text-blanc">
            Ton compte a bien été créé.
          </h1>
          <p className="mt-3 text-base leading-relaxed text-blanc/70">
            Vérifie ta boîte mail pour l'activer : clique sur le lien reçu,
            puis connecte-toi.
          </p>
        </div>
        <Link
          to="/connexion"
          className="mt-6 flex min-h-[52px] w-full items-center justify-center galet-moyen bg-menthe text-sm font-bold tracking-wide text-abyss"
        >
          SE CONNECTER
        </Link>
      </div>
    </div>
  );
}
