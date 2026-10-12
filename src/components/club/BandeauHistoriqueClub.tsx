import { useEffect, useState } from "react";
import { ChevronRight, History } from "lucide-react";
import { Feuille, MessageErreur } from "@/components/club/Ui";
import { GALETS, GOUTTE } from "@/lib/formes";
import { importerPlongees, plongeesDAvant, separerDoublons, type PlongeeImportee } from "@/lib/import-plongees";
import { depuisIso, marquerHistoriqueClub, monHistoriqueClub, type HistoriqueClub } from "@/lib/planning";

// Accueil du carnet : « Ton club a gardé N de tes plongées ».
// Le club les a importées d'Excel avant que le plongeur ait l'app ; elles l'attendent,
// rattachées à son adresse e-mail. Il les ajoute à son carnet en un geste, ou les écarte.
export function BandeauHistoriqueClub({ onAjoute }: { onAjoute: () => void }) {
  const [liste, setListe] = useState<HistoriqueClub[]>([]);
  const [ouvert, setOuvert] = useState<HistoriqueClub | null>(null);
  const [avant, setAvant] = useState(0);
  const [ajuster, setAjuster] = useState(true);
  const [enCours, setEnCours] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);

  useEffect(() => {
    let actif = true;
    monHistoriqueClub()
      .then((l) => actif && setListe(l.filter((h) => h.plongees.length > 0)))
      .catch(() => {
        /* script pas encore lancé ou hors ligne : rien à proposer */
      });
    void plongeesDAvant().then((n) => actif && setAvant(n));
    return () => {
      actif = false;
    };
  }, []);

  const h = liste[0];
  if (!h) return null;

  const periode = (x: HistoriqueClub) => {
    const premiere = depuisIso(x.plongees[0]!.date);
    const derniere = depuisIso(x.plongees[x.plongees.length - 1]!.date);
    const f = (d: Date) => d.toLocaleDateString("fr-FR", { month: "short", year: "numeric" });
    return f(premiere) === f(derniere) ? f(premiere) : `${f(premiere)} → ${f(derniere)}`;
  };

  const ajouter = async (x: HistoriqueClub) => {
    setEnCours(true);
    setErreur(null);
    try {
      const plongees: PlongeeImportee[] = x.plongees.map((p) => ({
        dive_date: p.date,
        start_time: p.heure ? p.heure.slice(0, 5) : null,
        site_name: p.site,
        site_location: p.lieu,
        site_coords: null,
        max_depth_m: p.profondeur,
        avg_depth_m: null,
        duration_min: p.duree,
        temp_bottom_c: null,
        visibility_m: null,
        rating: null,
        gas_mix: null,
        o2_pct: null,
        he_pct: null,
        pressure_start_bar: null,
        pressure_end_bar: null,
        tank_volume_l: null,
        buddies: [],
        comment: [`Plongée avec ${x.centre}`, p.palanquee ? `palanquée ${p.palanquee}` : null, p.role, p.note].filter(Boolean).join(" · "),
      }));
      const { nouvelles } = await separerDoublons(plongees);
      if (nouvelles.length > 0) await importerPlongees(nouvelles, ajuster && avant > 0);
      await marquerHistoriqueClub(x.centre_id);
      setOuvert(null);
      setListe((l) => l.filter((y) => y.centre_id !== x.centre_id));
      onAjoute();
    } catch (e) {
      console.error(e);
      setErreur("Les plongées n'ont pas pu être ajoutées. Réessaie dans un instant.");
    }
    setEnCours(false);
  };

  const ecarter = (x: HistoriqueClub) => {
    setOuvert(null);
    setListe((l) => l.filter((y) => y.centre_id !== x.centre_id));
    void marquerHistoriqueClub(x.centre_id).catch(() => undefined);
  };

  return (
    <div className="px-[22px] pt-[22px]">
      <button
        type="button"
        onClick={() => setOuvert(h)}
        style={{ borderRadius: GALETS[1] }}
        className="relative flex w-full items-center gap-3 border border-[#F5D7A1] bg-[#FFF6E6] px-[15px] py-[13px] text-left shadow-[0_4px_14px_#123A6309]"
      >
        <span style={{ borderRadius: GOUTTE }} className="flex h-[44px] w-[44px] shrink-0 items-center justify-center bg-[#0F3D70]">
          <History className="h-[20px] w-[20px] text-white" strokeWidth={2.2} aria-hidden="true" />
        </span>
        <span className="flex min-w-0 flex-grow flex-col gap-px">
          <span className="text-[14.5px] font-bold text-[#123A63]">
            {h.centre} a gardé {h.plongees.length} de tes plongées
          </span>
          <span className="truncate text-[12.5px] text-[#6B5320]">{periode(h)} · ajoute-les à ton carnet</span>
        </span>
        <ChevronRight className="h-[17px] w-[17px] shrink-0 text-[#123A63]" strokeWidth={2.4} aria-hidden="true" />
      </button>

      {ouvert && (
        <Feuille titre={`Tes plongées avec ${ouvert.centre}`} onFermer={() => setOuvert(null)}>
          <p className="text-[13.5px] leading-normal text-[#5B7189]">
            Ton club les avait notées avant que tu sois sur Palanote. Elles arrivent dans ton carnet avec la date, le site, la profondeur et la durée ; tu pourras
            compléter chacune ensuite.
          </p>
          <div className="mt-[12px] max-h-[34svh] overflow-y-auto rounded-[14px] border border-[#E4EBF1]">
            {ouvert.plongees.map((p, i) => (
              <div key={p.id} className={`flex items-center gap-[10px] px-[12px] py-[8px] ${i > 0 ? "border-t border-[#EEF3F8]" : ""}`}>
                <span className="w-[74px] shrink-0 text-[12px] font-bold text-[#1176A8]">
                  {depuisIso(p.date).toLocaleDateString("fr-FR", { day: "numeric", month: "short", year: "2-digit" })}
                </span>
                <span className="min-w-0 flex-1 truncate text-[13.5px] font-semibold">{p.site ?? "Site non noté"}</span>
                <span className="shrink-0 text-[12px] text-[#5B7189]">
                  {[p.profondeur ? `${String(p.profondeur).replace(".0", "").replace(".", ",")} m` : null, p.duree ? `${p.duree} min` : null].filter(Boolean).join(" · ")}
                </span>
              </div>
            ))}
          </div>
          {avant > 0 && (
            <label className="mt-[12px] flex items-start gap-[10px] text-[13px] leading-snug">
              <input type="checkbox" checked={ajuster} onChange={(e) => setAjuster(e.target.checked)} className="mt-[2px] h-[17px] w-[17px] accent-[#0F3D70]" />
              <span>
                Ces plongées faisaient partie de mes {avant} plongées d'avant Palanote
                <span className="block text-[12px] text-[#7D93A8]">Ton total ne les comptera pas deux fois.</span>
              </span>
            </label>
          )}
          <MessageErreur texte={erreur} />
          <button
            type="button"
            disabled={enCours}
            onClick={() => void ajouter(ouvert)}
            className="mt-[16px] flex h-14 w-full items-center justify-center galet-moyen bg-[#3DEFBE] text-[14px] font-bold text-[#0B3B63] disabled:opacity-60"
          >
            {enCours ? "AJOUT…" : `AJOUTER ${ouvert.plongees.length} PLONGÉE${ouvert.plongees.length > 1 ? "S" : ""} À MON CARNET`}
          </button>
          <button type="button" onClick={() => ecarter(ouvert)} className="mx-auto mt-[12px] block text-[13px] font-semibold text-[#9DB0C0] underline underline-offset-4">
            Non merci, ne plus me les proposer
          </button>
        </Feuille>
      )}
    </div>
  );
}
