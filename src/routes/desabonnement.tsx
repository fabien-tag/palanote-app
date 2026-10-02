import { useEffect, useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import logoCorail from "@/assets/palanote-logo-cigle.png";
import { supabase } from "@/lib/supabase";

// Lien « Ne plus recevoir ce bilan » de la lettre annuelle (pas besoin d'être connecté).
export const Route = createFileRoute("/desabonnement")({
  validateSearch: (search: Record<string, unknown>): { jeton?: string | undefined } => ({
    jeton: typeof search["jeton"] === "string" ? search["jeton"] : undefined,
  }),
  head: () => ({ meta: [{ title: "Palanote — Lettre annuelle" }, { name: "robots", content: "noindex" }] }),
  component: Desabonnement,
});

function Desabonnement() {
  const navigate = useNavigate();
  const { jeton } = Route.useSearch();
  const [etat, setEtat] = useState<"en_cours" | "fait" | "inconnu" | "erreur">("en_cours");

  useEffect(() => {
    if (!jeton || !/^[0-9a-f-]{36}$/i.test(jeton)) {
      setEtat("inconnu");
      return;
    }
    void supabase.rpc("se_desabonner", { p_jeton: jeton }).then(({ data, error }) => {
      if (error) {
        console.error("Désabonnement impossible", error);
        setEtat("erreur");
      } else setEtat(data ? "fait" : "inconnu");
    });
  }, [jeton]);

  const textes = {
    en_cours: ["Un instant…", ""],
    fait: ["C'est noté.", "Tu ne recevras plus le bilan de ton année. Tu peux le réactiver quand tu veux dans Moi › Confidentialité."],
    inconnu: ["Lien inconnu", "Ce lien n'est plus valable. Tu peux régler la lettre annuelle dans Moi › Confidentialité."],
    erreur: ["Ça n'a pas marché", "Réessaie dans un moment, ou règle la lettre annuelle dans Moi › Confidentialité."],
  }[etat];

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#F1F6FC] px-[24px] text-center text-[#123A63]">
      <div className="w-full max-w-[400px]">
        <span className="mx-auto flex h-[52px] w-[52px] items-center justify-center rounded-[16px] bg-[#0F3D70] p-[10px]">
          <img src={logoCorail} alt="Palanote" className="h-full w-auto" />
        </span>
        <h1 className="pt-[18px] text-[24px] font-bold">{textes[0]}</h1>
        {textes[1] && <p className="pt-[8px] text-[14.5px] leading-normal text-[#5B7189]">{textes[1]}</p>}
        <button type="button" onClick={() => navigate({ to: "/" })} className="mt-[24px] text-[14px] font-bold text-[#1176A8] underline underline-offset-4">
          Ouvrir Palanote
        </button>
      </div>
    </div>
  );
}
