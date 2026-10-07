import { useEffect, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { Share2, X } from "lucide-react";
import { Meduse } from "@/components/numerisation/Ui";

// Question de satisfaction (parcours 10, écrans 51 à 53).
// Une seule question, deux réponses de même poids :
//   « Oui »          → merci, et une façon publique d'aider : en parler à ses binômes (note sur les stores plus tard)
//   « Pas vraiment » → retour privé, directement à l'auteur (écran « Dis-moi ce qui manque »)
// Posée une fois, après quelques plongées ; « Plus tard » la repousse d'un mois.

const CLE = "palanote-satisfaction";
const PLONGEES_MINIMUM = 3;
const UN_MOIS = 30 * 24 * 3600 * 1000;

type Etat = { reponse?: "oui" | "non"; repousse_le?: number };

function lire(): Etat {
  try {
    return JSON.parse(localStorage.getItem(CLE) ?? "{}") as Etat;
  } catch {
    return {};
  }
}
function ecrire(e: Etat) {
  try {
    localStorage.setItem(CLE, JSON.stringify(e));
  } catch {
    /* stockage indisponible */
  }
}

export function QuestionSatisfaction({ nbPlongees }: { nbPlongees: number }) {
  const navigate = useNavigate();
  const [ouvert, setOuvert] = useState(false);
  const [etape, setEtape] = useState<"question" | "merci">("question");
  const [copie, setCopie] = useState(false);

  useEffect(() => {
    if (nbPlongees < PLONGEES_MINIMUM) return;
    const e = lire();
    if (e.reponse) return;
    if (e.repousse_le && Date.now() - e.repousse_le < UN_MOIS) return;
    const t = window.setTimeout(() => setOuvert(true), 1500); // laisse le carnet s'afficher d'abord
    return () => window.clearTimeout(t);
  }, [nbPlongees]);

  if (!ouvert) return null;

  const fermer = () => {
    if (etape === "question") ecrire({ ...lire(), repousse_le: Date.now() });
    setOuvert(false);
  };

  const oui = () => {
    ecrire({ reponse: "oui" });
    setEtape("merci");
  };

  const pasVraiment = () => {
    ecrire({ reponse: "non" });
    setOuvert(false);
    navigate({ to: "/moi/avis" });
  };

  const partager = async () => {
    const url = window.location.origin;
    const texte = "Je note mes plongées sur Palanote : le carnet se remplit à deux et lit même les vieux carnets papier.";
    try {
      if (navigator.share) {
        await navigator.share({ title: "Palanote", text: texte, url });
      } else {
        await navigator.clipboard.writeText(`${texte} ${url}`);
        setCopie(true);
      }
    } catch {
      /* partage annulé */
    }
  };

  return (
    <div className="fixed inset-0 z-40 flex items-end justify-center" role="dialog" aria-modal="true" aria-labelledby="titre-satisfaction">
      <button type="button" aria-label="Fermer" onClick={fermer} className="absolute inset-0 bg-[#06203F]/45" />
      <div className="relative w-full max-w-[430px] rounded-t-[34px] bg-white px-[24px] pb-[max(26px,env(safe-area-inset-bottom))] pt-[14px] text-[#123A63] shadow-[0_-10px_30px_rgba(6,32,63,.18)]">
        <Meduse className="left-[28px] -top-[22px]" />
        <div className="mx-auto mb-[16px] h-[5px] w-[44px] rounded-full bg-[#DCE7F0]" aria-hidden="true" />
        <button type="button" onClick={fermer} aria-label="Plus tard" className="absolute right-[18px] top-[18px] flex h-9 w-9 items-center justify-center goutte bg-[#EEF4F9]">
          <X className="h-[16px] w-[16px] text-[#5B7189]" strokeWidth={2.4} />
        </button>

        {etape === "question" ? (
          <>
            <h2 id="titre-satisfaction" className="pr-[40px] text-[22px] font-bold leading-tight">
              Palanote te rend service ?
            </h2>
            <p className="pt-[8px] text-[14px] leading-normal text-[#5B7189]">Une seule question, et on ne te la repose pas. Les deux réponses nous aident autant.</p>
            <div className="flex gap-[12px] pt-[22px]">
              <button type="button" onClick={oui} className="flex h-[56px] flex-1 items-center justify-center galet-moyen bg-[#3DEFBE] text-[15px] font-bold text-[#0B3B63]">
                Oui
              </button>
              <button
                type="button"
                onClick={pasVraiment}
                className="flex h-[56px] flex-1 items-center justify-center galet-moyen border-[1.5px] border-[#C9D9E6] bg-white text-[15px] font-bold text-[#123A63]"
              >
                Pas vraiment
              </button>
            </div>
            <p className="pt-[14px] text-center text-[12px] leading-snug text-[#9DB0C0]">« Pas vraiment » t'emmène vers un message privé pour l'auteur, jamais public.</p>
          </>
        ) : (
          <>
            <h2 id="titre-satisfaction" className="pr-[40px] text-[22px] font-bold leading-tight">
              Merci, ça compte vraiment.
            </h2>
            <p className="pt-[8px] text-[14px] leading-normal text-[#5B7189]">
              Le meilleur coup de pouce pour Palanote : en parler à tes binômes. La note publique sur l'App Store arrivera avec l'app installable.
            </p>
            <button
              type="button"
              onClick={() => void partager()}
              className="mt-[22px] flex h-[56px] w-full items-center justify-center gap-[10px] galet-moyen bg-[#3DEFBE] text-[14px] font-bold tracking-wide text-[#0B3B63]"
            >
              <Share2 className="h-[18px] w-[18px]" strokeWidth={2.2} aria-hidden="true" />
              {copie ? "LIEN COPIÉ" : "PARTAGER PALANOTE"}
            </button>
            <button type="button" onClick={() => setOuvert(false)} className="mx-auto mt-[12px] block px-[8px] py-[8px] text-[14px] font-semibold text-[#5B7189]">
              Revenir à mon carnet
            </button>
          </>
        )}
      </div>
    </div>
  );
}
