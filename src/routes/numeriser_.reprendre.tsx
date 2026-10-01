import { createFileRoute, Navigate, useNavigate } from "@tanstack/react-router";
import { CameraOff, Check, RefreshCw } from "lucide-react";
import { resumeLot, type Page } from "@/lib/numerisation";
import {
  BoutonPrincipal,
  BoutonRetourCarre,
  FondNumerisation,
  Meduse,
  rechercheLot,
  useConnexionRequise,
  useLot,
} from "@/components/numerisation/Ui";

export const Route = createFileRoute("/numeriser_/reprendre")({
  head: () => ({ meta: [{ title: "Palanote — Reprendre une numérisation" }] }),
  validateSearch: rechercheLot,
  component: Reprendre,
});

const JOURS = ["dimanche", "lundi", "mardi", "mercredi", "jeudi", "vendredi", "samedi"];

function commence(iso: string) {
  const d = new Date(iso);
  const jours = Math.floor((Date.now() - d.getTime()) / 86_400_000);
  if (jours < 1) return "commencé aujourd'hui";
  if (jours < 2) return "commencé hier";
  if (jours < 7) return `commencé ${JOURS[d.getDay()]}`;
  return `commencé le ${d.toLocaleDateString("fr-FR", { day: "numeric", month: "long" })}`;
}

type Etat = "relue" | "a_relire" | "reprendre" | "pas_lue";

function etatPage(p: Page): Etat {
  if (p.statut === "illisible" || p.statut === "erreur") return "reprendre";
  if (p.statut === "lue") return p.relue ? "relue" : "a_relire";
  return "pas_lue";
}

const STYLES: Record<Etat, string> = {
  relue: "border border-[#3DEFBE] bg-[#D2F6EC] text-[#8FA9C0]",
  a_relire: "border-2 border-[#F5A524] bg-[#FFF5E5] text-[#6B4A14]",
  reprendre: "border border-[#D9E3EC] bg-[#F1F5F9] text-[#8FA9C0]",
  pas_lue: "border border-dashed border-[#BFD0DE] bg-white text-[#8FA9C0]",
};

function Reprendre() {
  const navigate = useNavigate();
  const { lot } = Route.useSearch();
  const { ecran } = useConnexionRequise();
  const { donnees } = useLot(lot);

  if (ecran) return ecran;
  if (!lot) return <Navigate to="/numeriser" />;
  if (!donnees) return <FondNumerisation>{null}</FondNumerisation>;

  const { lot: l, pages, extractions } = donnees;
  const r = resumeLot(pages, extractions);
  const etats = pages.map((p) => ({ p, e: etatPage(p) }));
  const aRelire = etats.filter((x) => x.e === "a_relire");
  const aReprendre = etats.filter((x) => x.e === "reprendre");
  const pasLues = etats.filter((x) => x.e === "pas_lue");
  const derniere = [...etats].reverse().find((x) => x.e === "relue")?.p.ordre ?? 0;
  const premiereARelire = aRelire[0]?.p;

  return (
    <FondNumerisation>
      <div className="flex items-center justify-between px-[22px] pt-[18px]">
        <BoutonRetourCarre onClick={() => navigate({ to: "/numeriser" })} />
        <button type="button" onClick={() => navigate({ to: "/carnet" })} className="text-[14.5px] font-bold text-[#1176A8]">
          Revenir à l'accueil
        </button>
      </div>

      <div className="px-[22px] pt-[22px]">
        <h1 className="text-[28px] font-bold leading-tight">Reprendre</h1>
        <p className="pt-[4px] text-[14px] text-[#5B7189]">
          {l.libelle ?? "Ton carnet"} · {commence(l.created_at)}
        </p>
        <p className="pt-[20px] text-[18px] font-bold leading-snug">
          {derniere > 0 ? `Tu t'es arrêté à la page ${Math.min(derniere + 1, pages.length)}.` : "Tu n'as pas encore relu de page."}
          <br />
          {aRelire.length > 0 ? (
            <>
              Il te reste{" "}
              <span className="text-[#B4740A]">
                {aRelire.length} page{aRelire.length > 1 ? "s" : ""} à relire
              </span>
              .
            </>
          ) : pasLues.length > 0 ? (
            "La lecture des pages continue."
          ) : (
            "Tout est relu."
          )}
        </p>
      </div>

      <div className="grid grid-cols-4 gap-[11px] px-[22px] pt-[22px]">
        {etats.map(({ p, e }) => (
          <button
            key={p.id}
            type="button"
            disabled={e === "relue" || e === "pas_lue"}
            onClick={() =>
              e === "reprendre"
                ? navigate({ to: "/numeriser/capture", search: { lot, ordre: p.ordre } })
                : navigate({ to: "/numeriser/relecture", search: { lot } })
            }
            className={`relative flex aspect-[3/4] items-center justify-center rounded-[16px] text-[15px] font-bold ${STYLES[e]}`}
          >
            p.{p.ordre}
            {e === "relue" && (
              <span className="absolute right-[8px] top-[8px] flex h-[22px] w-[22px] items-center justify-center rounded-full bg-[#3DEFBE]">
                <Check className="h-[12px] w-[12px] text-[#0B3B63]" strokeWidth={3} />
              </span>
            )}
            {e === "a_relire" && (
              <span className="absolute right-[8px] top-[8px] flex h-[22px] w-[22px] items-center justify-center rounded-full bg-[#FFC65C] text-[12px] font-bold text-[#6B4A14]">!</span>
            )}
            {e === "reprendre" && (
              <span className="absolute right-[8px] top-[8px] flex h-[22px] w-[22px] items-center justify-center rounded-full bg-[#E3EDF6]">
                <RefreshCw className="h-[11px] w-[11px] text-[#5B7189]" strokeWidth={2.6} />
              </span>
            )}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-2 gap-x-3 gap-y-[6px] px-[22px] pt-[14px] text-[12.5px] text-[#5B7189]">
        <span className="flex items-center gap-2">
          <span className="h-[12px] w-[12px] rounded-[4px] border border-[#3DEFBE] bg-[#D2F6EC]" />
          {r.relues.length} relue{r.relues.length > 1 ? "s" : ""}, dans ton carnet
        </span>
        <span className="flex items-center gap-2">
          <span className="h-[12px] w-[12px] rounded-[4px] border-2 border-[#F5A524]" />
          {aRelire.length} à relire
        </span>
        <span className="flex items-center gap-2">
          <span className="h-[12px] w-[12px] rounded-[4px] border border-[#D9E3EC] bg-[#F1F5F9]" />
          {aReprendre.length} à reprendre en photo
        </span>
        <span className="flex items-center gap-2">
          <span className="h-[12px] w-[12px] rounded-[4px] border border-dashed border-[#BFD0DE]" />
          {pasLues.length} pas encore lue{pasLues.length > 1 ? "s" : ""}
        </span>
      </div>

      {r.validees.length > 0 && (
        <div className="relative mx-[22px] mt-[22px] flex items-center gap-[14px] rounded-[20px] border border-[#C9EFE3] bg-[#DCF5EF] p-[14px]">
          <span className="flex h-[44px] w-[44px] shrink-0 items-center justify-center rounded-[14px] bg-[#3DEFBE] text-[17px] font-bold text-[#0B3B63]">
            {r.validees.length}
          </span>
          <p className="text-[14px] leading-snug text-[#123A63]">
            <b>
              {r.validees.length} plongée{r.validees.length > 1 ? "s sont" : " est"} déjà dans ton carnet.
            </b>
            <br />
            Elle{r.validees.length > 1 ? "s y restent" : " y reste"} quoi qu'il arrive.
          </p>
          <Meduse className="-right-[8px] -top-[14px]" />
        </div>
      )}

      {aReprendre.map(({ p }) => (
        <div key={p.id} className="mx-[22px] mt-[12px] flex items-center gap-3 rounded-[20px] border border-[#E4EBF1] bg-white p-[14px]">
          <CameraOff className="h-[20px] w-[20px] shrink-0 text-[#8FA9C0]" strokeWidth={1.8} aria-hidden="true" />
          <div className="flex-grow">
            <div className="text-[14px] font-bold">
              La page {p.ordre} {p.statut === "erreur" ? "n'a pas pu être lue" : "est trop floue"}
            </div>
            <div className="text-[12.5px] text-[#5B7189]">Rephotographie-la quand tu veux.</div>
          </div>
          <button
            type="button"
            onClick={() => navigate({ to: "/numeriser/capture", search: { lot, ordre: p.ordre } })}
            className="h-[38px] shrink-0 rounded-[19px] bg-[#E3EDF6] px-[16px] text-[13.5px] font-bold text-[#1176A8]"
          >
            Reprendre
          </button>
        </div>
      ))}

      <div className="min-h-6 flex-grow" />
      <div className="px-[22px] pb-[24px] pt-[22px]">
        {premiereARelire ? (
          <BoutonPrincipal onClick={() => navigate({ to: "/numeriser/relecture", search: { lot } })}>
            Relire la page {premiereARelire.ordre}
          </BoutonPrincipal>
        ) : pasLues.length > 0 ? (
          <BoutonPrincipal onClick={() => navigate({ to: "/numeriser/lecture", search: { lot } })}>Voir la lecture</BoutonPrincipal>
        ) : (
          <BoutonPrincipal onClick={() => navigate({ to: "/numeriser/capture", search: { lot } })}>Photographier la suite</BoutonPrincipal>
        )}
      </div>
    </FondNumerisation>
  );
}
