import { useEffect, useMemo, useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { ChevronLeft, ChevronRight, Eye, Fish } from "lucide-react";
import { Meduse, useConnexionRequise } from "@/components/numerisation/Ui";
import { estProtegee, mesEspeces } from "@/lib/especes";
import { cacheCarnetEnMemoire, chargerPlongees, type CartePlongee } from "@/lib/plongees";
import { supabase } from "@/lib/supabase";

// « Qui as-tu croisé sous l'eau ? » (raccourci de l'accueil) :
// toutes les espèces de ton carnet, et les plongées avec des photos pas encore analysées.
export const Route = createFileRoute("/especes")({
  head: () => ({ meta: [{ title: "Palanote — Qui as-tu croisé sous l'eau ?" }] }),
  component: MesEspeces,
});

type AAnalyser = { id: string; site: string; n: number };

function MesEspeces() {
  const navigate = useNavigate();
  const { pret, ecran } = useConnexionRequise();
  const [plongees, setPlongees] = useState<CartePlongee[]>(() => cacheCarnetEnMemoire()?.plongees ?? []);
  const [aAnalyser, setAAnalyser] = useState<AAnalyser[]>([]);

  useEffect(() => {
    if (!pret) return;
    let actif = true;
    void chargerPlongees()
      .then(async (p) => {
        if (!actif) return;
        setPlongees(p);
        // Plongées avec photos, jamais analysées
        const { data: s } = await supabase.auth.getSession();
        const uid = s.session?.user.id;
        if (!uid) return;
        const [{ data: medias }, { data: statuts, error }] = await Promise.all([
          supabase.from("media").select("dive_id").eq("user_id", uid).not("dive_id", "is", null).is("deleted_at", null),
          supabase.from("dives").select("id, analyse_statut").eq("user_id", uid).is("deleted_at", null),
        ]);
        if (error || !actif) return; // script SQL pas encore lancé
        const nb = new Map<string, number>();
        for (const m of (medias ?? []) as { dive_id: string }[]) nb.set(m.dive_id, (nb.get(m.dive_id) ?? 0) + 1);
        const jamais = new Set(((statuts ?? []) as { id: string; analyse_statut: string | null }[]).filter((d) => !d.analyse_statut).map((d) => d.id));
        setAAnalyser(
          p
            .filter((d) => nb.has(d.id) && jamais.has(d.id))
            .map((d) => ({ id: d.id, site: d.siteNom || "Plongée sans site", n: nb.get(d.id) ?? 0 })),
        );
      })
      .catch(() => undefined);
    return () => {
      actif = false;
    };
  }, [pret]);

  const especes = useMemo(() => mesEspeces(plongees), [plongees]);

  if (ecran) return ecran;

  return (
    <div className="min-h-screen bg-[#F1F6FC] text-[#123A63]">
      <div className="cascade mx-auto flex min-h-screen w-full max-w-[430px] flex-col px-[22px] pb-[max(24px,env(safe-area-inset-bottom))] pt-[clamp(14px,2.6svh,22px)]">
        <div className="flex items-center">
          <button type="button" aria-label="Retour" onClick={() => navigate({ to: "/carnet" })} className="flex h-10 w-10 items-center justify-center goutte bg-[#E3EDF6]">
            <ChevronLeft className="h-[18px] w-[18px]" strokeWidth={2.4} />
          </button>
        </div>
        <h1 className="pt-[12px] text-[26px] font-bold leading-tight">Qui as-tu croisé sous l'eau ?</h1>
        <p className="pt-[4px] text-[13.5px] leading-snug text-[#566B82]">
          {especes.length
            ? `${especes.length} espèce${especes.length > 1 ? "s" : ""} dans ton carnet.`
            : "Ajoute des photos à tes plongées : l'IA te propose les espèces, tu valides."}
        </p>

        {aAnalyser.length > 0 && (
          <button
            type="button"
            onClick={() => navigate({ to: "/especes/analyser" })}
            className="relative mt-[16px] flex items-center gap-[12px] galet border border-[#BFE6F5] bg-[#E3F4FC] px-[15px] py-[13px] text-left"
          >
            <Meduse className="-right-[4px] -top-[14px]" />
            <span className="flex h-[38px] w-[38px] shrink-0 items-center justify-center rounded-full bg-white/80">
              <Eye className="h-[17px] w-[17px] text-[#106F9F]" strokeWidth={2.2} aria-hidden="true" />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-[14.5px] font-bold">
                {aAnalyser.length} plongée{aAnalyser.length > 1 ? "s" : ""} avec photos à analyser
              </span>
              <span className="block truncate text-[12.5px] text-[#566B82]">
                Voir les photos et lancer l'analyse
              </span>
            </span>
            <ChevronRight className="h-[17px] w-[17px] text-[#106F9F]" aria-hidden="true" />
          </button>
        )}

        {especes.length > 0 && (
          <div className="mt-[16px] overflow-hidden galet-b border border-[#DCE7F0] bg-white shadow-[0_4px_14px_#123A6308]">
            {especes.map((e) => (
              <button
                key={e.nom}
                type="button"
                onClick={() => navigate({ to: "/espece", search: { nom: e.nom } })}
                className="flex w-full items-center gap-[12px] border-t border-[#EDF2F7] px-[14px] py-[12px] text-left first:border-t-0"
              >
                <span className="flex h-[38px] w-[38px] shrink-0 items-center justify-center goutte bg-[#E3F4FC]">
                  <Fish className="h-[18px] w-[18px] text-[#106F9F]" strokeWidth={1.9} aria-hidden="true" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[15px] font-bold">{e.nom}</span>
                  {estProtegee(e.nom) && <span className="text-[11.5px] font-semibold text-[#106F9F]">Espèce protégée</span>}
                </span>
                <span className="text-[12.5px] font-bold text-[#566B82]">
                  {e.n} plongée{e.n > 1 ? "s" : ""}
                </span>
                <ChevronRight className="h-[16px] w-[16px] text-[#566B82]" aria-hidden="true" />
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
