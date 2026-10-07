import { useEffect } from "react";
import { PAGES_OFFERTES } from "@/lib/legal";
import { createFileRoute, Navigate, useNavigate } from "@tanstack/react-router";
import { BookOpen, Check, ChevronRight } from "lucide-react";
import { CHAMPS_RELECTURE, resumeLot, terminerLot } from "@/lib/numerisation";
import { annoncerSurAccueil } from "@/lib/message-accueil";
import {
  BoutonPrincipal,
  BoutonSecondaire,
  FondNumerisation,
  LienDiscret,
  Meduse,
  rechercheLot,
  useConnexionRequise,
  useLot,
} from "@/components/numerisation/Ui";

export const Route = createFileRoute("/numeriser_/fin")({
  head: () => ({ meta: [{ title: "Palanote — Carnet terminé" }] }),
  validateSearch: rechercheLot,
  component: Fin,
});

function Fin() {
  const navigate = useNavigate();
  const { lot } = Route.useSearch();
  const { ecran } = useConnexionRequise();
  const { donnees, recharger } = useLot(lot, false);

  const pages = donnees?.pages ?? [];
  const extractions = donnees?.extractions ?? [];
  const r = resumeLot(pages, extractions);
  const fini = donnees && r.restantes.length === 0 && r.enAttente + r.enCours === 0;

  // Le carnet est entièrement relu : on le marque terminé.
  useEffect(() => {
    if (lot && fini && donnees?.lot.statut !== "termine") void terminerLot(lot).then(recharger);
  }, [lot, fini]); // eslint-disable-line react-hooks/exhaustive-deps

  if (ecran) return ecran;
  if (!lot) return <Navigate to="/numeriser" />;
  if (!donnees) return <FondNumerisation>{null}</FondNumerisation>;

  const nb = r.validees.length;
  const annees = r.validees
    .map((e) => Number(String(e.champs["date"] ?? "").slice(0, 4)))
    .filter((a) => a > 1900)
    .sort((a, b) => a - b);
  const periode =
    annees.length === 0 ? "" : annees[0] === annees[annees.length - 1] ? ` de ${annees[0]}` : ` de ${annees[0]} à ${annees[annees.length - 1]}`;
  const vides = r.validees.reduce((t, e) => t + CHAMPS_RELECTURE.filter((c) => !e.champs[c]).length, 0);
  const fin = donnees.lot.termine_le ? new Date(donnees.lot.termine_le).getTime() : Date.now();
  const minutes = Math.max(1, Math.round((fin - new Date(donnees.lot.created_at).getTime()) / 60_000));
  const duree = minutes < 120 ? `${minutes} minute${minutes > 1 ? "s" : ""}` : `${Math.round(minutes / 60)} heures`;

  const lignes = [
    { n: nb, texte: `plongée${nb > 1 ? "s" : ""} ajoutée${nb > 1 ? "s" : ""}, relue${nb > 1 ? "s" : ""} une par une`, fond: "bg-[#DCF7EE]" },
    {
      n: r.illisibles.length,
      texte: `page${r.illisibles.length > 1 ? "s" : ""} illisible${r.illisibles.length > 1 ? "s" : ""} à reprendre quand tu veux`,
      fond: "bg-[#E3F0FA]",
    },
    { n: vides, texte: `champ${vides > 1 ? "s" : ""} laissé${vides > 1 ? "s" : ""} vide${vides > 1 ? "s" : ""} — tu les rempliras plus tard`, fond: "bg-[#E3F0FA]" },
  ].filter((l, i) => i === 0 || l.n > 0);

  const voirPlongees = () => {
    if (nb > 0) annoncerSurAccueil(`${nb} plongée${nb > 1 ? "s ajoutées" : " ajoutée"} à ton carnet`);
    navigate({ to: "/carnet" });
  };

  return (
    <FondNumerisation>
      <div className="rounded-b-[34px] bg-[linear-gradient(180deg,#0E3D72,#0A2A50)] px-[22px] pb-[30px] pt-[52px] text-white">
        <span className="flex h-[46px] w-[46px] items-center justify-center rounded-full bg-[#3DEFBE]">
          <Check className="h-[22px] w-[22px] text-[#0B3B63]" strokeWidth={3} />
        </span>
        <h1 className="pt-[20px] text-[24px] font-bold leading-tight">{donnees.lot.libelle ?? "Ton carnet"} terminé</h1>
        <p className="pt-[6px] text-[14px] text-white/85">
          {nb > 0 ? `${nb} plongée${nb > 1 ? "s" : ""}${periode} ${nb > 1 ? "sont" : "est"} dans ton carnet.` : "Aucune plongée n'a été ajoutée depuis ce carnet."}
        </p>
      </div>

      <div className="relative mx-[22px] mt-[18px] flex flex-col gap-[12px] galet-c border border-[#DCE7F0] bg-white p-[16px]">
        {lignes.map((l) => (
          <div key={l.texte} className="flex items-center gap-[14px]">
            <span className={`flex h-[42px] w-[42px] shrink-0 items-center justify-center goutte text-[17px] font-bold ${l.fond}`}>{l.n}</span>
            <span className="text-[14.5px] leading-snug">{l.texte}</span>
          </div>
        ))}
        <Meduse className="-right-[8px] -top-[14px]" />
      </div>

      <div className="min-h-6 flex-grow" />

      <div className="px-[22px]">
        <button
          type="button"
          onClick={() => navigate({ to: "/numeriser/capture" })}
          className="flex w-full items-center gap-3 galet border border-[#CFE6F3] bg-[#E3F2FB] p-[16px] text-left"
        >
          <BookOpen className="h-[20px] w-[20px] shrink-0 text-[#1176A8]" strokeWidth={1.9} aria-hidden="true" />
          <span className="flex-grow">
            <span className="block text-[15px] font-bold">Un autre carnet&nbsp;?</span>
            <span className="block text-[13px] text-[#5B7189]">Celui-ci t'a pris {duree}.</span>
          </span>
          <ChevronRight className="h-[17px] w-[17px] text-[#8FA9C0]" strokeWidth={2.4} aria-hidden="true" />
        </button>
        <p className="px-1 pt-[14px] text-[13px] leading-normal text-[#5B7189]">
          <b className="text-[#123A63]">Ton carnet est gratuit, et le restera.</b> L'app est faite par un plongeur, sur son temps libre. La lecture par l'IA, elle, coûte à
          chaque page : les {PAGES_OFFERTES} premières sont offertes, ensuite il y a{" "}
          <button type="button" onClick={() => navigate({ to: "/forfait" })} className="font-bold text-[#1176A8] underline underline-offset-2">
            les forfaits
          </button>
          . Et si l'app t'a fait gagner une soirée, tu peux aussi <b className="text-[#1176A8]">rejoindre le Récif</b>.
        </p>
      </div>

      <div className="flex flex-col gap-[11px] px-[22px] pb-[24px] pt-[20px]">
        <BoutonPrincipal onClick={voirPlongees}>{nb > 0 ? `Voir mes ${nb > 1 ? `${nb} plongées` : "plongée"}` : "Voir mon carnet"}</BoutonPrincipal>
        <BoutonSecondaire onClick={() => navigate({ to: "/numeriser/capture" })}>Numériser le carnet suivant</BoutonSecondaire>
        <div className="pt-2">
          <LienDiscret onClick={() => navigate({ to: "/carnet" })}>Revenir à l'accueil</LienDiscret>
        </div>
      </div>
    </FondNumerisation>
  );
}
