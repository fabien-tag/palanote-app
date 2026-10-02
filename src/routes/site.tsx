import { useMemo } from "react";
import { createFileRoute, Navigate, useNavigate } from "@tanstack/react-router";
import { ArrowDown, BookOpen, ChevronLeft, ChevronRight, Eye, Star } from "lucide-react";
import { Carte } from "@/components/carte/Carte";
import { coordsVersTexte } from "@/lib/carte";
import { pluriel, regrouperEnSpots, trouverSpot } from "@/lib/spots";
import { usePlongees } from "@/lib/usePlongees";

export const Route = createFileRoute("/site")({
  head: () => ({ meta: [{ title: "Palanote — Site de plongée" }] }),
  validateSearch: (s: Record<string, unknown>): { cle?: string } =>
    typeof s["cle"] === "string" && s["cle"] ? { cle: s["cle"] } : {},
  component: PageSite,
});

const MOIS = ["JANVIER", "FÉVRIER", "MARS", "AVRIL", "MAI", "JUIN", "JUILLET", "AOÛT", "SEPTEMBRE", "OCTOBRE", "NOVEMBRE", "DÉCEMBRE"];
const INITIALES_MOIS = ["J", "F", "M", "A", "M", "J", "J", "A", "S", "O", "N", "D"];
const CHIFFRES = ["zéro", "une", "deux", "trois", "quatre", "cinq", "six", "sept", "huit", "neuf", "dix"];

function Etoiles({ note }: { note: number }) {
  return (
    <span className="flex gap-[2px]" aria-label={`Note ${note} sur 5`}>
      {[1, 2, 3, 4, 5].map((i) => (
        <Star key={i} className={`h-[13px] w-[13px] ${i <= note ? "fill-[#FFC65C] text-[#FFC65C]" : "fill-transparent text-[#D5DFE8]"}`} />
      ))}
    </span>
  );
}

function PageSite() {
  const navigate = useNavigate();
  const { cle } = Route.useSearch();
  const plongees = usePlongees();
  const spot = useMemo(() => (plongees && cle ? trouverSpot(regrouperEnSpots(plongees), cle) : null), [plongees, cle]);

  if (!cle) return <Navigate to="/carte" />;
  if (plongees === null) return <div className="min-h-screen bg-[#F1F6FC]" />;
  if (!spot)
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-[#F1F6FC] px-8 text-center">
        <p className="text-[15px] text-[#5B7189]">Ce site n'est plus dans ton carnet.</p>
        <button type="button" onClick={() => navigate({ to: "/carte" })} className="font-bold text-[#1176A8] underline">
          Revenir à la carte
        </button>
      </div>
    );

  const nb = spot.plongees.length;
  const parMois = Array.from({ length: 12 }, () => 0);
  spot.plongees.forEach((p) => {
    const d = p.date ? new Date(p.date) : null;
    if (d && !isNaN(d.getTime())) parMois[d.getMonth()]! += 1;
  });
  const maxMois = Math.max(1, ...parMois);
  const avecDate = parMois.reduce((a, b) => a + b, 0);

  const faune = new Map<string, number>();
  spot.plongees.forEach((p) => (p.faune ?? []).forEach((f) => faune.set(f, (faune.get(f) ?? 0) + 1)));
  const especes = [...faune.entries()].sort((a, b) => b[1] - a[1]);

  const clubs = new Map<string, number>();
  spot.plongees.forEach((p) => p.club && clubs.set(p.club, (clubs.get(p.club) ?? 0) + 1));
  const club = [...clubs.entries()].sort((a, b) => b[1] - a[1])[0];

  const sousTitre = [spot.ville, spot.pays].filter(Boolean).join(" · ") || "Lieu inconnu";

  return (
    <div className="min-h-screen bg-[#F1F6FC] text-[#123A63]">
      <div className="mx-auto w-full max-w-[430px] pb-[28px]">
        {/* En-tête : la carte du site */}
        <div className="relative h-[230px] overflow-hidden rounded-b-[30px]">
          <Carte centre={spot.coords} zoom={11} interactive={false} className="pointer-events-none absolute inset-0 [&_.leaflet-control-attribution]:text-[9px]" />
          <div className="pointer-events-none absolute inset-0 z-[450] bg-[linear-gradient(180deg,rgba(6,28,58,.45)_0%,rgba(6,28,58,.05)_40%,rgba(7,32,64,.80)_100%)]" />
          <button
            type="button"
            aria-label="Retour"
            onClick={() => (window.history.length > 1 ? window.history.back() : navigate({ to: "/carte" }))}
            className="absolute left-[18px] top-[max(16px,env(safe-area-inset-top))] z-[500] flex h-10 w-10 items-center justify-center goutte bg-white/25 text-white backdrop-blur-sm"
          >
            <ChevronLeft className="h-[19px] w-[19px]" strokeWidth={2.4} />
          </button>
          <div className="absolute inset-x-[22px] bottom-[20px] z-[500] text-white">
            <h1 className="text-[25px] font-bold leading-tight">{spot.nom}</h1>
            <p className="pt-[2px] text-[14px] text-white/85">{sousTitre}</p>
          </div>
        </div>

        {/* Chiffres */}
        <div className="mx-[16px] mt-[16px] flex galet-b border border-[#DCE7F0] bg-white py-[14px] shadow-[0_4px_14px_#123A6308]">
          {[
            { Icone: BookOpen, fond: "bg-[#DDF8EF]", couleur: "text-[#14B88A]", valeur: String(nb), label: nb > 1 ? "plongées" : "plongée" },
            {
              Icone: ArrowDown,
              fond: "bg-[#DFF3FB]",
              couleur: "text-[#1176A8]",
              valeur: spot.profMax === null ? "—" : `${String(spot.profMax).replace(".", ",")} m`,
              label: "ta plus profonde",
            },
            {
              Icone: Star,
              fond: "bg-[#FFF1D9]",
              couleur: "text-[#E3A21A]",
              valeur: spot.noteMoyenne === null ? "—" : spot.noteMoyenne.toFixed(1).replace(".0", "").replace(".", ","),
              label: "ta note",
            },
          ].map(({ Icone, fond, couleur, valeur, label }, i) => (
            <div key={label} className={`flex flex-1 flex-col items-center gap-[4px] ${i > 0 ? "border-l border-[#EDF2F7]" : ""}`}>
              <span className={`flex h-[30px] w-[30px] items-center justify-center goutte ${fond}`}>
                <Icone className={`h-[16px] w-[16px] ${couleur}`} strokeWidth={2.2} aria-hidden="true" />
              </span>
              <span className="text-[19px] font-bold">{valeur}</span>
              <span className="text-[11px] text-[#7D93A8]">{label}</span>
            </div>
          ))}
        </div>

        {/* Plongées */}
        <h2 className="px-[22px] pb-[10px] pt-[22px] text-[16px] font-bold">Tes plongées ici</h2>
        <div className="mx-[16px] overflow-hidden galet-c border border-[#DCE7F0] bg-white shadow-[0_4px_14px_#123A6308]">
          {spot.plongees.map((p) => {
            const d = p.date ? new Date(p.date) : null;
            const ok = d && !isNaN(d.getTime());
            return (
              <button
                key={p.id}
                type="button"
                onClick={() => navigate({ to: "/nouvelle-plongee", search: { id: p.id } })}
                className="flex w-full items-center gap-[14px] border-t border-[#EDF2F7] px-[14px] py-[12px] text-left first:border-t-0"
              >
                <span className="w-[54px] shrink-0 text-center leading-none">
                  <span className="block text-[20px] font-bold">{ok ? d.getDate() : "—"}</span>
                  <span className="block pt-[3px] text-[9.5px] font-semibold tracking-[.06em] text-[#7D93A8]">{ok ? MOIS[d.getMonth()] : "SANS DATE"}</span>
                  {ok && <span className="block pt-[1px] text-[9.5px] text-[#9DB0C0]">{d.getFullYear()}</span>}
                </span>
                <span className="flex flex-1 items-center gap-[10px]">
                  {p.profMax && (
                    <span className="flex h-[22px] items-center rounded-[11px] bg-[#3DEFBE] px-[9px] text-[12px] font-bold text-[#0B3B63]">
                      {p.profMax.replace(".", ",")} m
                    </span>
                  )}
                  {p.note > 0 && <Etoiles note={p.note} />}
                </span>
                <ChevronRight className="h-[17px] w-[17px] shrink-0 text-[#9DB0C0]" strokeWidth={2.2} aria-hidden="true" />
              </button>
            );
          })}
        </div>

        {/* Faune */}
        {especes.length > 0 && (
          <>
            <h2 className="px-[22px] pb-[10px] pt-[22px] text-[16px] font-bold">Ce que tu y as vu</h2>
            <div className="flex flex-wrap gap-[8px] px-[22px]">
              {especes.map(([e, n]) => (
                <span key={e} className="flex h-[32px] items-center gap-[6px] rounded-[16px] border border-[#D8E5EE] bg-white px-[12px] text-[13px] text-[#123A63]">
                  <Eye className="h-[14px] w-[14px] text-[#1176A8]" strokeWidth={2} aria-hidden="true" />
                  {e}
                  <span className="text-[#9DB0C0]">{n}</span>
                </span>
              ))}
            </div>
          </>
        )}

        {/* Mois */}
        {avecDate > 0 && (
          <div className="mx-[16px] mt-[22px] galet border border-[#DCE7F0] bg-white p-[16px] shadow-[0_4px_14px_#123A6308]">
            <h2 className="text-[16px] font-bold">Quand tu y vas</h2>
            <div className="flex h-[86px] items-end gap-[6px] pt-[14px]" aria-hidden="true">
              {parMois.map((n, i) => {
                const fort = n === maxMois && n > 0;
                return (
                  <div key={i} className="flex flex-1 flex-col items-center gap-[6px]">
                    <div
                      className={`w-full rounded-[5px] ${n === 0 ? "" : fort ? "bg-[#0F3D70]" : "bg-[#9FD6EE]"}`}
                      style={{ height: n === 0 ? 0 : `${Math.max(14, (n / maxMois) * 60)}px` }}
                    />
                    <span className="text-[10px] text-[#9DB0C0]">{INITIALES_MOIS[i]}</span>
                  </div>
                );
              })}
            </div>
            <p className="pt-[12px] text-[12.5px] leading-snug text-[#5B7189]">
              {avecDate === 1 ? "Ta visite" : `Tes ${avecDate <= 10 ? CHIFFRES[avecDate] : avecDate} visites`}, mois par mois. C'est ton historique, pas une
              recommandation — l'app ne te dira jamais quand plonger.
            </p>
          </div>
        )}

        {/* Club */}
        {club && (
          <div className="mx-[16px] mt-[14px] flex items-center gap-[12px] galet-b border border-[#DCE7F0] bg-white p-[14px] shadow-[0_4px_14px_#123A6308]">
            <span className="flex h-[38px] w-[38px] shrink-0 items-center justify-center goutte border-[1.5px] border-[#FF8A75] text-[#FF8A75]">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
                <path d="M8 9h8a3 3 0 0 1 0 6H8a3 3 0 0 1 0-6Z" />
                <path d="M12 9v6" />
              </svg>
            </span>
            <span className="min-w-0">
              <span className="block truncate text-[15px] font-bold">{club[0]}</span>
              <span className="block text-[12.5px] text-[#5B7189]">
                {club[1] === nb ? (nb > 1 ? `Tes ${nb} plongées ici étaient avec eux` : "Ta plongée ici était avec eux") : `${club[1]} de tes ${nb} plongées ici étaient avec eux`}
              </span>
            </span>
          </div>
        )}

        <div className="px-[16px] pt-[24px]">
          <button
            type="button"
            onClick={() =>
              navigate({
                to: "/nouvelle-plongee",
                search: { site: spot.nom === "Site sans nom" ? "" : spot.nom, lieu: spot.lieu, coords: coordsVersTexte(spot.coords) },
              })
            }
            className="flex h-[54px] w-full items-center justify-center galet-moyen bg-[#3DEFBE] text-[14px] font-bold text-[#0B3B63]"
          >
            AJOUTER UNE PLONGÉE ICI
          </button>
          <p className="pt-[12px] text-center text-[12px] text-[#9DB0C0]">{pluriel(nb, "plongée")} · position décalée de 100 à 150 m</p>
        </div>
      </div>
    </div>
  );
}
