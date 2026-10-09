import { useEffect, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { ChevronRight, Eye, Fish, Images, RefreshCw, ShieldCheck, Sparkles, X } from "lucide-react";
import { Meduse } from "@/components/numerisation/Ui";
import { PoissonOrange } from "@/components/AccueilCarnet";
import { accordAnalyse, changerAccordAnalyse, chargerEspeces, lancerAnalyse, statutAnalyse, type EspecePlongee, type StatutAnalyse } from "@/lib/especes";

// Bande d'analyse (écran 57) : une seule bande en haut de la fiche d'une plongée.
// Elle change de contenu, jamais de place. C'est le seul endroit où l'analyse parle.
//   1 accord jamais donné · 2 en attente de réseau · 3 en cours · 4 espèces trouvées
//   5 aucune espèce reconnue · 6 analyse impossible

type Etat = "chargement" | "proposer" | "reseau" | "en_cours" | "trouvees" | "aucune" | "erreur" | "rien";

export function BandeAnalyse({ diveId, nbPhotos }: { diveId: string; nbPhotos: number }) {
  const navigate = useNavigate();
  const [etat, setEtat] = useState<Etat>("chargement");
  const [accord, setAccord] = useState(false);
  const [especes, setEspeces] = useState<EspecePlongee[]>([]);
  const [feuille, setFeuille] = useState(false);
  const [attente, setAttente] = useState(false); // accepté mais hors ligne

  const calculer = (statut: StatutAnalyse, liste: EspecePlongee[]): Etat => {
    if (statut === "en_cours") return "en_cours";
    if (statut === "erreur") return "erreur";
    if (liste.some((e) => e.statut === "proposee")) return "trouvees";
    if (statut === "aucune") return "aucune";
    if (statut === "terminee") return "rien"; // tout est déjà validé : la faune de la fiche suffit
    return "proposer";
  };

  const rafraichir = async () => {
    try {
      const [statut, liste, oui] = await Promise.all([statutAnalyse(diveId), chargerEspeces(diveId), accordAnalyse()]);
      setAccord(oui);
      setEspeces(liste);
      setEtat(calculer(statut, liste));
    } catch {
      setEtat("rien"); // script SQL pas encore lancé : pas de bande
    }
  };

  useEffect(() => {
    if (nbPhotos > 0) void rafraichir();
  }, [diveId, nbPhotos]); // eslint-disable-line react-hooks/exhaustive-deps

  // Pendant l'analyse, on regarde toutes les 3 secondes si elle est finie.
  useEffect(() => {
    if (etat !== "en_cours") return;
    const t = window.setInterval(() => void rafraichir(), 3000);
    return () => window.clearInterval(t);
  }, [etat]); // eslint-disable-line react-hooks/exhaustive-deps

  // Accepté hors ligne : on repart dès que le réseau revient.
  useEffect(() => {
    if (!attente) return;
    const reprendre = () => {
      setAttente(false);
      void demarrer();
    };
    window.addEventListener("online", reprendre);
    return () => window.removeEventListener("online", reprendre);
  }, [attente]); // eslint-disable-line react-hooks/exhaustive-deps

  if (nbPhotos === 0 || etat === "chargement" || etat === "rien") return null;

  async function demarrer() {
    if (!navigator.onLine) {
      setAttente(true);
      return;
    }
    setEtat("en_cours");
    try {
      await lancerAnalyse(diveId);
      void rafraichir();
    } catch (e) {
      console.error(e);
      setEtat("erreur");
    }
  }

  const accepter = async () => {
    setFeuille(false);
    try {
      await changerAccordAnalyse(true);
      setAccord(true);
      await demarrer();
    } catch (e) {
      console.error(e);
      setEtat("erreur");
    }
  };

  const proposees = especes.filter((e) => e.statut === "proposee").length;
  const base = "relative mt-[14px] flex w-full items-center gap-[12px] galet-b border px-[15px] py-[13px] text-left";
  const pastille = "flex h-[36px] w-[36px] shrink-0 items-center justify-center rounded-full";
  const points = (
    <span className={`${pastille} bg-white/80`} aria-hidden="true">
      <span className="flex gap-[3px]">
        {[0, 1, 2].map((i) => (
          <span key={i} className="h-[5px] w-[5px] animate-pulse rounded-full bg-[#1176A8]" style={{ animationDelay: `${i * 0.2}s` }} />
        ))}
      </span>
    </span>
  );

  let contenu: React.ReactNode;
  if (attente) {
    contenu = (
      <div className={`${base} border-[#DCE7F0] bg-white`}>
        {points}
        <span className="flex-1 text-[14px] leading-snug">Analyse en attente — elle repartira dès que tu auras du réseau</span>
      </div>
    );
  } else if (etat === "proposer") {
    contenu = (
      <button type="button" onClick={() => (accord ? void demarrer() : setFeuille(true))} className={`${base} border-[#BFE6F5] bg-[#E3F4FC] text-[#123A63]`}>
        <PoissonOrange className="right-[18px] -top-[13px]" />
        <span className={`${pastille} bg-white/70`}>
          <Fish className="h-[18px] w-[18px] text-[#1176A8]" strokeWidth={2} aria-hidden="true" />
        </span>
        <span className="flex-1 text-[14px] font-semibold leading-snug">
          Identifier les espèces sur {nbPhotos > 1 ? `ces ${nbPhotos} photos` : "cette photo"}
        </span>
        <ChevronRight className="h-[17px] w-[17px] text-[#1176A8]" strokeWidth={2.4} aria-hidden="true" />
      </button>
    );
  } else if (etat === "en_cours") {
    contenu = (
      <div className={`${base} border-[#BFE6F5] bg-[#E3F4FC]`}>
        {points}
        <span className="flex-1 text-[14px]">Analyse en cours…</span>
      </div>
    );
  } else if (etat === "trouvees") {
    contenu = (
      <button type="button" onClick={() => navigate({ to: "/plongee/especes", search: { id: diveId } })} className={`${base} border-[#BFE6F5] bg-[#E3F4FC]`}>
        <Meduse className="-right-[4px] -top-[14px]" />
        <span className={`${pastille} bg-[#3DEFBE] text-[15px] font-bold text-[#0B3B63]`}>{proposees}</span>
        <span className="flex-1 text-[14px] leading-snug">
          <b>
            {proposees} espèce{proposees > 1 ? "s" : ""} détectée{proposees > 1 ? "s" : ""}
          </b>{" "}
          sur tes photos — à valider.
        </span>
        <ChevronRight className="h-[17px] w-[17px] text-[#1176A8]" aria-hidden="true" />
      </button>
    );
  } else if (etat === "aucune") {
    contenu = (
      <div className={`${base} border-[#DCE7F0] bg-white`}>
        <span className={`${pastille} bg-[#EEF4F9]`}>
          <Eye className="h-[17px] w-[17px] text-[#9DB0C0]" strokeWidth={2.2} aria-hidden="true" />
        </span>
        <span className="flex-1 text-[14px] leading-snug">Aucune espèce reconnue sur ces photos</span>
        <button type="button" onClick={() => navigate({ to: "/plongee/especes", search: { id: diveId } })} className="shrink-0 py-[6px] text-[14px] font-bold text-[#1176A8]">
          Nommer
        </button>
      </div>
    );
  } else {
    contenu = (
      <div className={`${base} border-[#DCE7F0] bg-white`}>
        <span className={`${pastille} bg-[#EEF4F9]`}>
          <RefreshCw className="h-[16px] w-[16px] text-[#5B7189]" strokeWidth={2.2} aria-hidden="true" />
        </span>
        <span className="flex-1 text-[14px] leading-snug">Analyse impossible pour le moment</span>
        <button type="button" onClick={() => void demarrer()} className="shrink-0 py-[6px] text-[14px] font-bold text-[#1176A8]">
          Réessayer
        </button>
      </div>
    );
  }

  return (
    <>
      {contenu}
      {feuille && <FeuilleAccord nbPhotos={nbPhotos} onAccepter={() => void accepter()} onFermer={() => setFeuille(false)} />}
    </>
  );
}

// Écran 45 : consentement à l'analyse, demandé une seule fois.
function FeuilleAccord({ nbPhotos, onAccepter, onFermer }: { nbPhotos: number; onAccepter: () => void; onFermer: () => void }) {
  const point = (Icone: typeof Eye, titre: string, texte: string) => (
    <div className="flex gap-[12px] py-[8px]">
      <span className="flex h-[34px] w-[34px] shrink-0 items-center justify-center goutte bg-[#E3F4FC]">
        <Icone className="h-[16px] w-[16px] text-[#1176A8]" strokeWidth={2.2} aria-hidden="true" />
      </span>
      <div>
        <div className="text-[14.5px] font-bold">{titre}</div>
        <div className="text-[12.5px] leading-snug text-[#5B7189]">{texte}</div>
      </div>
    </div>
  );
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center" role="dialog" aria-modal="true" aria-labelledby="titre-accord">
      <button type="button" aria-label="Fermer" onClick={onFermer} className="absolute inset-0 bg-[#06203F]/45" />
      <div className="relative w-full max-w-[430px] rounded-t-[34px] bg-white px-[24px] pb-[max(26px,env(safe-area-inset-bottom))] pt-[14px] text-[#123A63] shadow-[0_-10px_30px_rgba(6,32,63,.18)]">
        <Meduse className="left-[28px] -top-[22px]" />
        <div className="mx-auto mb-[16px] h-[5px] w-[44px] rounded-full bg-[#DCE7F0]" aria-hidden="true" />
        <button type="button" onClick={onFermer} aria-label="Pas maintenant" className="absolute right-[18px] top-[18px] flex h-9 w-9 items-center justify-center goutte bg-[#EEF4F9]">
          <X className="h-[16px] w-[16px] text-[#5B7189]" strokeWidth={2.4} />
        </button>
        <h2 id="titre-accord" className="pr-[40px] text-[21px] font-bold leading-tight">
          Qui as-tu croisé sous l'eau ?
        </h2>
        <p className="pb-[8px] pt-[6px] text-[14px] leading-normal text-[#5B7189]">
          L'IA regarde {nbPhotos > 1 ? `tes ${nbPhotos} photos` : "ta photo"} et te propose les espèces qu'elle reconnaît.
        </p>
        {point(Images, "Seulement tes photos", "Celles que tu as ajoutées à cette plongée, envoyées à l'IA (Claude) le temps de l'analyse. Pas celles de tes binômes.")}
        {point(Sparkles, "Elle propose, tu valides", "Rien n'est ajouté à ta plongée sans ton accord, espèce par espèce.")}
        {point(ShieldCheck, "Tu peux changer d'avis", "Retire ton accord quand tu veux dans Moi › Confidentialité.")}
        <button type="button" onClick={onAccepter} className="mt-[16px] flex h-[56px] w-full items-center justify-center galet-moyen bg-[#3DEFBE] text-[14px] font-bold tracking-wide text-[#0B3B63]">
          ACCEPTER ET ANALYSER
        </button>
        <button type="button" onClick={onFermer} className="mx-auto mt-[10px] block px-[8px] py-[8px] text-[14px] font-semibold text-[#5B7189]">
          Pas maintenant
        </button>
      </div>
    </div>
  );
}
