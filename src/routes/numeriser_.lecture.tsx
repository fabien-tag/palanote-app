import { createFileRoute, Navigate, useNavigate } from "@tanstack/react-router";
import { Check, Cloud } from "lucide-react";
import { lancerLecture, resumeLot, type Page } from "@/lib/numerisation";
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

export const Route = createFileRoute("/numeriser_/lecture")({
  head: () => ({ meta: [{ title: "Palanote — Lecture des pages" }] }),
  validateSearch: rechercheLot,
  component: Lecture,
});

const SECONDES_PAR_PAGE = 15;

function CasePage({ p, onRelancer }: { p: Page; onRelancer: () => void }) {
  const probleme = p.statut === "illisible" || p.statut === "erreur";
  const styles =
    p.statut === "lue"
      ? "border-[1.5px] border-[#3DEFBE] bg-[#DDF8EF] text-[#123A63]"
      : probleme
        ? "border-[1.5px] border-[#F5A524] bg-[#FFF5E5] text-[#6B4A14]"
        : p.statut === "en_cours"
          ? "bg-white text-[#9DB9CF] shadow-[0_2px_10px_rgba(18,58,99,.10)]"
          : "border border-dashed border-[#D5E1EC] bg-white/40 text-[#9DB0C0]";
  return (
    <button
      type="button"
      disabled={!probleme}
      onClick={onRelancer}
      aria-label={probleme ? `Reprendre la page ${p.ordre} en photo` : undefined}
      className={`flex aspect-[5/6] flex-col items-center justify-center gap-[5px] rounded-[14px] text-[12.5px] font-bold ${styles}`}
    >
      {p.statut === "lue" ? (
        <span className="flex h-[22px] w-[22px] items-center justify-center rounded-full bg-[#3DEFBE]">
          <Check className="h-[13px] w-[13px] text-[#0B3B63]" strokeWidth={3} />
        </span>
      ) : probleme ? (
        <span className="flex h-[22px] w-[22px] items-center justify-center rounded-full bg-[#FFC65C] text-[12px] font-bold text-[#6B4A14]">!</span>
      ) : p.statut === "en_cours" ? (
        <span className="flex h-[22px] w-[22px] items-center justify-center rounded-full bg-[#57D4F5]/25">
          <span className="h-[10px] w-[10px] animate-pulse rounded-full bg-[#57D4F5]" />
        </span>
      ) : (
        <span className="h-[22px] w-[22px] rounded-full border-[1.5px] border-[#D5E1EC]" />
      )}
      p.{p.ordre}
    </button>
  );
}

function Lecture() {
  const navigate = useNavigate();
  const { lot } = Route.useSearch();
  const { ecran } = useConnexionRequise();
  const { donnees, erreur, recharger } = useLot(lot);

  if (ecran) return ecran;
  if (!lot) return <Navigate to="/numeriser" />;

  const pages = donnees?.pages ?? [];
  const r = resumeLot(pages, donnees?.extractions ?? []);
  const restantes = r.enAttente + r.enCours;
  const minutes = Math.max(1, Math.ceil((restantes * SECONDES_PAR_PAGE) / 60));
  const pretes = r.aRelire.length;

  // Touche une page en orange : on revient à l'appareil photo pour la reprendre.
  const reprendre = (p: Page) => navigate({ to: "/numeriser/capture", search: { lot, ordre: p.ordre } });
  // Lecture échouée côté serveur : on peut aussi simplement la relancer.
  const relancer = async (p: Page) => {
    await lancerLecture(p.id);
    await recharger();
  };

  return (
    <FondNumerisation>
      <div className="flex items-center justify-between px-[22px] pt-[22px]">
        <h1 className="text-[20px] font-bold">Lecture des pages</h1>
        {donnees?.lot.libelle && (
          <span className="rounded-[14px] bg-[#E3EDF6] px-3 py-[6px] text-[12.5px] font-bold text-[#5B7189]">{donnees.lot.libelle}</span>
        )}
      </div>

      <div className="px-[22px] pt-[22px]">
        <div className="flex items-baseline justify-between">
          <div className="flex items-baseline gap-2">
            <span className="text-[30px] font-bold leading-none">{r.lues}</span>
            <span className="text-[17px] font-bold text-[#5B7189]">pages sur {r.total}</span>
          </div>
          <span className="text-[13.5px] text-[#5B7189]">
            {restantes > 0 ? `encore ~${minutes} min` : r.total > 0 ? "lecture terminée" : ""}
          </span>
        </div>
        <div className="mt-[14px] h-[7px] overflow-hidden rounded-full bg-[#E3EDF6]">
          <div
            className="h-full rounded-full bg-[#3DEFBE] transition-all duration-500"
            style={{ width: `${r.total ? (r.lues / r.total) * 100 : 0}%` }}
          />
        </div>
      </div>

      <div className="grid grid-cols-6 gap-[8px] px-[22px] pt-[22px]">
        {pages.map((p) => (
          <CasePage key={p.id} p={p} onRelancer={() => reprendre(p)} />
        ))}
      </div>

      {pages.length > 0 && (
        <div className="flex flex-wrap gap-x-4 gap-y-1 px-[22px] pt-[12px] text-[12px] text-[#5B7189]">
          {[
            ["#3DEFBE", "lue"],
            ["#57D4F5", "en cours"],
            ["#C9D6E2", "en attente"],
            ["#F5A524", "trop floue"],
          ].map(([c, l]) => (
            <span key={l} className="flex items-center gap-[6px]">
              <span className="h-[9px] w-[9px] rounded-full" style={{ background: c }} />
              {l}
            </span>
          ))}
        </div>
      )}
      {r.illisibles.length > 0 && (
        <p className="px-[22px] pt-[10px] text-[12.5px] text-[#8A5A10]">Touche une page en orange pour la reprendre en photo.</p>
      )}
      {pages
        .filter((p) => p.statut === "erreur")
        .map((p) => (
          <div key={p.id} className="mx-[22px] mt-[10px] rounded-[14px] border border-[#F5C9A0] bg-[#FFF5E5] px-[12px] py-[10px] text-[12.5px] text-[#6B4A14]">
            <div className="flex items-center justify-between gap-3">
              <b>La lecture de la page {p.ordre} a échoué.</b>
              <button type="button" onClick={() => void relancer(p)} className="shrink-0 font-bold text-[#1176A8] underline underline-offset-2">
                Relancer
              </button>
            </div>
            {p.erreur && <p className="pt-1 break-words text-[11.5px] text-[#8A6A3A]">Détail : {p.erreur}</p>}
          </div>
        ))}
      {erreur && <p className="px-[22px] pt-3 text-[13px] text-[#8A2A1A]">{erreur}</p>}

      <div className="min-h-6 flex-grow" />

      <div className="relative mx-[22px] flex items-start gap-3 rounded-[18px] border border-[#CFE6F3] bg-[#E3F2FB]/80 p-[14px]">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[11px] bg-[#C7EAF8]">
          <Cloud className="h-[18px] w-[18px] text-[#1176A8]" strokeWidth={2} aria-hidden="true" />
        </span>
        <p className="text-[13px] leading-normal text-[#123A63]">
          <b>Tu peux fermer l'app.</b> La lecture ne tourne pas sur ton téléphone, elle tourne sur le serveur — elle continue sans toi et rien ne se perd.
        </p>
        <Meduse className="-right-[8px] -top-[14px]" />
      </div>

      <div className="flex flex-col gap-[11px] px-[22px] pb-[24px] pt-[22px]">
        <BoutonPrincipal disabled={pretes === 0} onClick={() => navigate({ to: "/numeriser/relecture", search: { lot } })}>
          {pretes > 0
            ? `Relire ${pretes > 1 ? `les ${pretes} pages déjà prêtes` : "la page déjà prête"}`
            : restantes > 0
              ? "Lecture en cours…"
              : "Rien à relire pour l'instant"}
        </BoutonPrincipal>
        <BoutonSecondaire onClick={() => navigate({ to: "/numeriser/capture", search: { lot } })}>Photographier la suite</BoutonSecondaire>
        <div className="pt-2">
          <LienDiscret onClick={() => navigate({ to: "/carnet" })}>Je reviendrai plus tard</LienDiscret>
        </div>
      </div>
    </FondNumerisation>
  );
}
