import { useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { ChevronDown, MessageCircle } from "lucide-react";
import logoCorail from "@/assets/palanote-logo-cigle.png";
import { PageClub, Titre } from "@/components/club/Ui";
import { QUESTIONS } from "@/lib/aide";
import { EDITEUR } from "@/lib/legal";

// Moi › Aide et à propos
export const Route = createFileRoute("/moi_/aide")({
  head: () => ({ meta: [{ title: "Palanote — Aide et à propos" }] }),
  component: Aide,
});

function Aide() {
  const navigate = useNavigate();
  const [ouverte, setOuverte] = useState<number | null>(0);

  return (
    <PageClub titre="Aide et à propos" onRetour={() => navigate({ to: "/moi" })}>
      <Titre>Questions fréquentes</Titre>
      <div className="flex flex-col gap-[8px]">
        {QUESTIONS.map((x, i) => {
          const ouvert = ouverte === i;
          return (
            <div key={x.q} className="galet-b border border-[#E4EBF1] bg-white">
              <button
                type="button"
                aria-expanded={ouvert}
                onClick={() => setOuverte(ouvert ? null : i)}
                className="flex w-full items-center gap-[10px] px-[15px] py-[13px] text-left"
              >
                <span className="flex-1 text-[14.5px] font-bold leading-snug">{x.q}</span>
                <ChevronDown className={`h-[17px] w-[17px] shrink-0 text-[#9DB0C0] transition-transform ${ouvert ? "rotate-180" : ""}`} aria-hidden="true" />
              </button>
              {ouvert && <p className="px-[15px] pb-[14px] text-[13.5px] leading-normal text-[#5B7189]">{x.r}</p>}
            </div>
          );
        })}
      </div>

      <button
        type="button"
        onClick={() => navigate({ to: "/moi/avis" })}
        className="mt-[18px] flex w-full items-center gap-[12px] galet-c border border-[#B8E4D8] bg-[#E2F8EF] px-[15px] py-[14px] text-left"
      >
        <MessageCircle className="h-[20px] w-[20px] shrink-0 text-[#14805F]" strokeWidth={2.2} aria-hidden="true" />
        <span className="text-[13.5px] leading-snug text-[#3F5B76]">
          <b className="text-[#123A63]">Pas trouvé ta réponse ?</b> Écris-moi dans « Dis-moi ce qui manque » : je lis chaque message.
        </span>
      </button>

      <Titre>À propos</Titre>
      <div className="flex items-center gap-[14px] galet border border-[#E4EBF1] bg-white p-[16px]">
        <span className="flex h-[52px] w-[52px] shrink-0 items-center justify-center goutte bg-[#0F3D70] p-[10px]">
          <img src={logoCorail} alt="" className="h-full w-auto" />
        </span>
        <span className="text-[13px] leading-normal text-[#5B7189]">
          <b className="block text-[15px] text-[#123A63]">Palanote</b>
          Le carnet de plongée dans la poche. Conçu par {EDITEUR.nom}, designer UX/UI et plongeur. Gratuit, sans publicité.
        </span>
      </div>
      <div className="flex flex-wrap gap-x-[16px] gap-y-[6px] px-[4px] pt-[14px] text-[13px] font-semibold text-[#1176A8]">
        <button type="button" onClick={() => navigate({ to: "/conditions-utilisation" })} className="underline underline-offset-4">
          Conditions d'utilisation
        </button>
        <button type="button" onClick={() => navigate({ to: "/politique-de-confidentialite" })} className="underline underline-offset-4">
          Tes données
        </button>
        <button type="button" onClick={() => navigate({ to: "/mentions-legales" })} className="underline underline-offset-4">
          Mentions légales
        </button>
      </div>
      <p className="px-[4px] pt-[14px] text-[11.5px] text-[#9DB0C0]">Palanote V2 · octobre 2026</p>
    </PageClub>
  );
}
