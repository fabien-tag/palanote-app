import { useEffect, useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { Check, X } from "lucide-react";
import fondAsset from "@/assets/BG.png";
import logoCorail from "@/assets/palanote-logo-cigle.png";
import { Meduse } from "@/components/numerisation/Ui";
import { compteConnecte } from "@/lib/moi";
import { COUTS_RECIF, FORMULES_RECIF, lienPaiement, type FormuleRecif } from "@/lib/recif";

// « Rejoins le Récif » : le don qui remplace le paywall (maquette 54).
export const Route = createFileRoute("/recif")({
  head: () => ({
    meta: [
      { title: "Palanote — Rejoins le Récif" },
      { name: "description", content: "Le carnet restera gratuit pour tout le monde. Le Récif, c'est ceux qui le font tenir." },
    ],
  }),
  component: Recif,
});

const RECU = [
  ["Un petit corail à côté de ton prénom", "Sur ton profil et dans les palanquées. Masquable en un geste — personne n'a à savoir."],
  ["Ton prénom sur « Ceux qui font le récif »", "Si tu le veux. Le prénom seul, jamais le nom."],
];

function Recif() {
  const navigate = useNavigate();
  const [choix, setChoix] = useState<FormuleRecif["id"]>("coup-de-main");
  const [compte, setCompte] = useState<{ id: string; email: string } | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  useEffect(() => {
    void compteConnecte().then((c) => setCompte(c ? { id: c.id, email: c.email } : null));
  }, []);

  const formule = FORMULES_RECIF.find((f) => f.id === choix) ?? FORMULES_RECIF[1]!;

  const rejoindre = () => {
    const lien = lienPaiement(formule, compte);
    if (!lien) {
      setInfo("Le paiement en ligne ouvre très bientôt. Merci de vouloir soutenir Palanote !");
      return;
    }
    window.location.href = lien;
  };

  return (
    <div className="min-h-screen bg-[#F1F6FC] text-[#123A63]">
      <div className="cascade mx-auto flex min-h-screen w-full max-w-[430px] flex-col pb-[max(24px,env(safe-area-inset-bottom))]">
        {/* En-tête */}
        <div
          className="relative flex h-[clamp(230px,32svh,268px)] shrink-0 flex-col overflow-hidden rounded-b-[28px] bg-[#0E3D72] bg-cover bg-center"
          style={{ backgroundImage: `url(${fondAsset})` }}
        >
          <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(6,28,58,.35)_0%,rgba(6,26,54,.15)_38%,rgba(7,32,64,.88)_100%)]" />
          <div className="relative flex justify-end px-[18px] pt-[18px]">
            <button
              type="button"
              aria-label="Fermer"
              onClick={() => navigate({ to: "/moi" })}
              className="flex h-[38px] w-[38px] items-center justify-center rounded-full bg-white/20 backdrop-blur-sm"
            >
              <X className="h-[18px] w-[18px] text-white" strokeWidth={2.4} />
            </button>
          </div>
          <div className="flex-grow" />
          <div className="relative px-[24px] pb-[24px]">
            <span className="flex h-[52px] w-[52px] items-center justify-center goutte border border-white/30 bg-[#1C8C8C]/70 p-[10px]">
              <img src={logoCorail} alt="" className="h-full w-auto" />
            </span>
            <h1 className="pt-[14px] text-[27px] font-bold leading-tight text-white">Rejoins le Récif</h1>
            <p className="pt-[6px] text-[14px] leading-normal text-white/85">
              Le carnet restera gratuit pour tout le monde.
              <br />
              Le Récif, c'est ceux qui le font tenir.
            </p>
          </div>
        </div>

        <div className="flex flex-col gap-[14px] px-[22px] pt-[20px]">
          {/* Ce que ça paye */}
          <div className="relative galet border border-[#DCE7F0] bg-white p-[16px] shadow-[0_4px_14px_#123A6308]">
            <h2 className="pb-[10px] text-[14px] font-bold">Ce que ça paye, en vrai</h2>
            {COUTS_RECIF.map(([quoi, combien]) => (
              <div key={quoi} className="flex items-center justify-between py-[6px] text-[13.5px]">
                <span className="text-[#566B82]">{quoi}</span>
                <b>{combien}</b>
              </div>
            ))}
            <p className="mt-[10px] border-t border-[#EDF2F7] pt-[12px] text-[13.5px] leading-normal">
              <b>660 € par an, payés par un plongeur.</b> Chaque membre du Récif en prend une petite part.
            </p>
            <Meduse className="-right-[8px] -top-[14px]" />
          </div>

          {/* Formules */}
          <div role="radiogroup" aria-label="Choisis ton soutien" className="flex flex-col gap-[10px]">
            {FORMULES_RECIF.map((f) => {
              const actif = f.id === choix;
              return (
                <button
                  key={f.id}
                  type="button"
                  role="radio"
                  aria-checked={actif}
                  onClick={() => {
                    setChoix(f.id);
                    setInfo(null);
                  }}
                  className={`flex items-center gap-[14px] galet-b border-[1.5px] px-[16px] py-[14px] text-left transition-colors ${
                    actif ? "border-[#3DEFBE] bg-[#E2F8EF]" : "border-[#DCE7F0] bg-white"
                  }`}
                >
                  <span
                    className={`flex h-[22px] w-[22px] shrink-0 items-center justify-center rounded-full border-2 ${
                      actif ? "border-[#3DEFBE] bg-[#3DEFBE]" : "border-[#C5D3DF] bg-white"
                    }`}
                  >
                    {actif && <span className="h-[8px] w-[8px] rounded-full bg-white" />}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-[15.5px] font-bold">{f.titre}</span>
                    <span className="block text-[12.5px] text-[#566B82]">{f.texte}</span>
                  </span>
                  <span className="text-[19px] font-bold">{f.montant} €</span>
                </button>
              );
            })}
          </div>

          {/* Ce que tu reçois */}
          <div className="galet-c border border-[#DCE7F0] bg-white p-[16px] shadow-[0_4px_14px_#123A6308]">
            <h2 className="pb-[12px] text-[14px] font-bold">Ce que tu reçois</h2>
            <div className="flex flex-col gap-[14px]">
              {RECU.map(([titre, texte]) => (
                <div key={titre} className="flex items-start gap-[11px]">
                  <span className="mt-[1px] flex h-[20px] w-[20px] shrink-0 items-center justify-center rounded-full bg-[#3DEFBE]">
                    <Check className="h-[12px] w-[12px] text-[#0B3B63]" strokeWidth={3.2} aria-hidden="true" />
                  </span>
                  <span>
                    <span className="block text-[14px] font-bold leading-snug">{titre}</span>
                    <span className="block pt-[2px] text-[12.5px] leading-normal text-[#566B82]">{texte}</span>
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Ce que tu ne reçois pas */}
          <div className="galet border border-[#BFE3F4] bg-[#E3F2FB] p-[16px] text-[13px] leading-normal text-[#3F5B76]">
            <h2 className="pb-[8px] text-[14px] font-bold text-[#123A63]">Ce que tu ne reçois pas</h2>
            <p>
              Aucune fonctionnalité. Le carnet, l'identification des espèces, la carte, les statistiques, l'export :{" "}
              <b className="text-[#123A63]">c'est gratuit, pour tout le monde, et ça le restera.</b> Seule la lecture des carnets papier par l'IA a un forfait au-delà des 50 premières pages, parce qu'elle coûte à chaque page.
            </p>
            <p className="pt-[8px]">Il n'y a rien de caché derrière ce bouton. C'est bien pour ça qu'il faut le dire avant, et pas après.</p>
          </div>

          {info && <p className="galet-moyen bg-[#FFF3E6] px-[14px] py-[10px] text-center text-[13px] font-semibold text-[#C2570C]">{info}</p>}
          <button
            type="button"
            onClick={rejoindre}
            className="mt-[4px] flex h-[56px] items-center justify-center galet-moyen bg-[#3DEFBE] text-[14px] font-bold text-[#0B3B63] shadow-[0_4px_12px_#123A630D]"
          >
            REJOINDRE LE RÉCIF — {formule.montant} €
          </button>
          <p className="px-[10px] text-center text-[11.5px] leading-normal text-[#566B82]">
            Paiement unique. Rien ne se renouvelle, il n'y a donc rien à résilier.
          </p>
        </div>
      </div>
    </div>
  );
}
