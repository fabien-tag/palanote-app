import { useCallback, useEffect, useState } from "react";
import { ChevronDown, Timer, Undo2 } from "lucide-react";
import {
  corrigerHeurePalanquee,
  dureePrevuePalanquee,
  heureLocale,
  marquerPalanquee,
  minutesEntre,
  suiviPalanquees,
  type SuiviPalanquee,
} from "@/lib/planning";

// Suivi « À l'eau / Sortie de l'eau », palanquée par palanquée. Facultatif : sur le bateau,
// le DP conduit, aide à remonter le matériel… Si quelqu'un a le temps, un geste suffit,
// et les heures remplissent la fiche de sécurité.
const DUREE_DEFAUT = 50;

export function SuiviPalanquees({
  sortie,
  effectifs,
  dureeDefaut,
  onChange,
}: {
  sortie: string;
  effectifs: Record<string, number>; // palanquée → nombre de plongeurs
  dureeDefaut?: number | null | undefined;
  onChange?: (suivi: SuiviPalanquee[]) => void;
}) {
  const [suivi, setSuivi] = useState<SuiviPalanquee[] | null>(null);
  const [ouvert, setOuvert] = useState(false);
  const [correction, setCorrection] = useState<string | null>(null);
  const [, setTic] = useState(0);
  const [erreur, setErreur] = useState<string | null>(null);

  const charger = useCallback(async () => {
    try {
      const l = await suiviPalanquees(sortie);
      setSuivi(l);
      onChange?.(l);
      if (l.some((q) => q.immersion_le)) setOuvert(true);
    } catch {
      setSuivi(null); // script pas encore lancé : le suivi n'apparaît pas
    }
  }, [sortie]);

  useEffect(() => {
    void charger();
  }, [charger]);

  // Le chrono avance tant qu'une palanquée est à l'eau
  const aLEau = (suivi ?? []).some((q) => q.immersion_le && !q.sortie_le);
  useEffect(() => {
    if (!aLEau) return;
    const t = setInterval(() => setTic((x) => x + 1), 15000);
    return () => clearInterval(t);
  }, [aLEau]);

  if (!suivi) return null;
  const visibles = suivi.filter((q) => (effectifs[q.id] ?? 0) > 0);
  if (visibles.length === 0) return null;

  const agir = (f: () => Promise<unknown>) => {
    setErreur(null);
    void f()
      .then(charger)
      .catch((e) => setErreur(String((e as { message?: string })?.message ?? "Ça n'a pas marché.")));
  };
  const enCours = visibles.filter((q) => q.immersion_le && !q.sortie_le).length;
  const sorties = visibles.filter((q) => q.sortie_le).length;

  return (
    <div className="mt-[14px] rounded-[10px] border border-[#E4EBF1] bg-white">
      <button type="button" onClick={() => setOuvert(!ouvert)} className="flex w-full items-center gap-[10px] px-[14px] py-[11px] text-left">
        <Timer className="h-[18px] w-[18px] shrink-0 text-[#106F9F]" />
        <span className="min-w-0 flex-1">
          <span className="block text-[14px] font-bold">Suivi à l'eau</span>
          <span className="block text-[12px] text-[#566B82]">
            {enCours > 0
              ? `${enCours} palanquée${enCours > 1 ? "s" : ""} à l'eau${sorties ? ` · ${sorties} sortie${sorties > 1 ? "s" : ""}` : ""}`
              : sorties > 0
                ? `${sorties}/${visibles.length} palanquée${sorties > 1 ? "s" : ""} sortie${sorties > 1 ? "s" : ""} de l'eau`
                : "Facultatif : un geste par palanquée, si quelqu'un a le temps"}
          </span>
        </span>
        <ChevronDown className={`h-[17px] w-[17px] shrink-0 text-[#566B82] transition-transform ${ouvert ? "rotate-180" : ""}`} />
      </button>
      {ouvert && (
        <div className="flex flex-col gap-[8px] border-t border-[#EEF3F8] px-[12px] pb-[12px] pt-[10px]">
          {visibles.map((q) => {
            const prevue = q.duree_prevue ?? dureeDefaut ?? DUREE_DEFAUT;
            const minutes = q.immersion_le ? minutesEntre(q.immersion_le, q.sortie_le) : 0;
            const dansLEau = Boolean(q.immersion_le && !q.sortie_le);
            const retard = dansLEau ? (minutes >= prevue + 15 ? "rouge" : minutes >= prevue ? "orange" : null) : null;
            return (
              <div
                key={q.id}
                className={`rounded-[10px] border px-[12px] py-[10px] ${
                  retard === "rouge" ? "border-[#FF8A75] bg-[#FFF1EE]" : retard === "orange" ? "border-[#F5B544] bg-[#FFF8E8]" : dansLEau ? "border-[#57D4F5] bg-[#F0FAFF]" : "border-[#EEF3F8]"
                }`}
              >
                <div className="flex items-center gap-[10px]">
                  <span className="min-w-0 flex-1">
                    <span className="block text-[14px] font-bold">
                      P{q.numero} <span className="font-semibold text-[#566B82]">· {effectifs[q.id]} plongeur{(effectifs[q.id] ?? 0) > 1 ? "s" : ""}</span>
                    </span>
                    <span
                      className={`block text-[12.5px] ${retard === "rouge" ? "font-bold text-[#B8432F]" : retard === "orange" ? "font-bold text-[#8A5A10]" : "text-[#566B82]"}`}
                    >
                      {!q.immersion_le
                        ? `Pas encore à l'eau · ${prevue} min prévues`
                        : dansLEau
                          ? `À l'eau depuis ${minutes} min (${heureLocale(q.immersion_le)})${retard ? ` · ${prevue} min prévues` : ""}`
                          : `${heureLocale(q.immersion_le)} → ${heureLocale(q.sortie_le)} · ${minutes} min`}
                    </span>
                  </span>
                  {!q.immersion_le ? (
                    <button type="button" onClick={() => agir(() => marquerPalanquee(q.id, "eau"))} className="h-[40px] shrink-0 rounded-[10px] bg-[#0F3D70] px-[14px] text-[13px] font-bold text-white">
                      À L'EAU
                    </button>
                  ) : dansLEau ? (
                    <button type="button" onClick={() => agir(() => marquerPalanquee(q.id, "sortie"))} className="h-[40px] shrink-0 rounded-[10px] bg-[#3DEFBE] px-[14px] text-[13px] font-bold text-[#0B3B63]">
                      SORTIE DE L'EAU
                    </button>
                  ) : null}
                </div>
                <div className="flex flex-wrap items-center gap-x-[14px] gap-y-[4px] pt-[6px] text-[12px]">
                  {!q.immersion_le && (
                    <label className="flex items-center gap-[5px] text-[#566B82]">
                      Durée prévue
                      <select
                        value={prevue}
                        onChange={(e) => agir(() => dureePrevuePalanquee(q.id, Number(e.target.value)))}
                        className="h-[26px] rounded-[8px] border border-[#D8E5EE] px-[4px] text-[12px] font-bold text-[#123A63]"
                      >
                        {[30, 35, 40, 45, 50, 55, 60, 70, 80, 90].map((m) => (
                          <option key={m} value={m}>
                            {m} min
                          </option>
                        ))}
                      </select>
                    </label>
                  )}
                  {q.immersion_le && (
                    <button type="button" onClick={() => agir(() => marquerPalanquee(q.id, "annuler"))} className="flex items-center gap-[4px] font-semibold text-[#566B82]">
                      <Undo2 className="h-[12px] w-[12px]" /> Annuler
                    </button>
                  )}
                  <button type="button" onClick={() => setCorrection(correction === q.id ? null : q.id)} className="font-semibold text-[#106F9F]">
                    {correction === q.id ? "Fermer" : "Saisir les heures"}
                  </button>
                </div>
                {correction === q.id && (
                  <div className="flex flex-wrap items-center gap-[8px] pt-[8px] text-[12.5px]">
                    <label className="flex items-center gap-[5px]">
                      À l'eau
                      <input
                        type="time"
                        defaultValue={q.immersion_le ? heureLocale(q.immersion_le).replace("h", ":") : ""}
                        onBlur={(e) => e.target.value && agir(() => corrigerHeurePalanquee(q.id, "eau", e.target.value))}
                        className="h-[32px] rounded-[8px] border border-[#D8E5EE] px-[6px]"
                      />
                    </label>
                    <label className="flex items-center gap-[5px]">
                      Sortie
                      <input
                        type="time"
                        defaultValue={q.sortie_le ? heureLocale(q.sortie_le).replace("h", ":") : ""}
                        onBlur={(e) => e.target.value && agir(() => corrigerHeurePalanquee(q.id, "sortie", e.target.value))}
                        className="h-[32px] rounded-[8px] border border-[#D8E5EE] px-[6px]"
                      />
                    </label>
                  </div>
                )}
              </div>
            );
          })}
          {erreur && <p className="text-[12.5px] font-semibold text-[#B8432F]">{erreur}</p>}
          <p className="text-[11.5px] leading-snug text-[#566B82]">Les heures notées remplissent la fiche de sécurité. Rien n'est obligatoire.</p>
        </div>
      )}
    </div>
  );
}
