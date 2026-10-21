import { useEffect, useRef, useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { Check, ChevronLeft, ChevronRight, Eye, Fish, RefreshCw } from "lucide-react";
import { Meduse, useConnexionRequise } from "@/components/numerisation/Ui";
import { FeuilleAccord } from "@/components/especes/BandeAnalyse";
import {
  accordAnalyse,
  changerAccordAnalyse,
  chargerEspeces,
  lancerAnalyse,
  statutAnalyse,
  type StatutAnalyse,
} from "@/lib/especes";
import { chargerGalerie } from "@/lib/galerie";
import { dateCourte } from "@/lib/amis";
import { chargerPlongees } from "@/lib/plongees";
import { supabase } from "@/lib/supabase";

// « Analyser mes photos » : toutes les plongées avec des photos pas encore analysées,
// leurs photos sous les yeux, et un bouton pour lancer l'identification des espèces.
// L'IA propose, le plongeur valide ensuite espèce par espèce (écran 46).
export const Route = createFileRoute("/especes_/analyser")({
  head: () => ({ meta: [{ title: "Palanote — Analyser mes photos" }] }),
  component: AnalyserPhotos,
});

type Etat = "a_analyser" | "en_cours" | "trouvees" | "aucune" | "erreur";
type Ligne = {
  id: string;
  site: string;
  date: string;
  photos: string[];
  nbPhotos: number;
  etat: Etat;
  proposees: number;
  validees: number;
};

function etatDe(statut: StatutAnalyse, proposees: number): Etat {
  if (statut === "en_cours") return "en_cours";
  if (statut === "erreur") return "erreur";
  if (proposees > 0) return "trouvees";
  if (statut === "aucune" || statut === "terminee") return "aucune";
  return "a_analyser";
}

function AnalyserPhotos() {
  const navigate = useNavigate();
  const { pret, ecran } = useConnexionRequise();
  const [lignes, setLignes] = useState<Ligne[] | null>(null);
  const [accord, setAccord] = useState(false);
  const [feuille, setFeuille] = useState<string[] | null>(null); // les plongées à lancer après l'accord
  const actif = useRef(true);

  useEffect(() => {
    actif.current = true;
    return () => {
      actif.current = false;
    };
  }, []);

  useEffect(() => {
    if (!pret) return;
    void (async () => {
      const { data: s } = await supabase.auth.getSession();
      const uid = s.session?.user.id;
      if (!uid) return;
      const [plongees, { data: medias }, { data: statuts }, oui] = await Promise.all([
        chargerPlongees(),
        supabase
          .from("media")
          .select("dive_id")
          .eq("user_id", uid)
          .not("dive_id", "is", null)
          .is("deleted_at", null),
        supabase
          .from("dives")
          .select("id, analyse_statut")
          .eq("user_id", uid)
          .is("deleted_at", null),
        accordAnalyse(),
      ]);
      setAccord(oui);
      const nb = new Map<string, number>();
      for (const m of (medias ?? []) as { dive_id: string }[])
        nb.set(m.dive_id, (nb.get(m.dive_id) ?? 0) + 1);
      const statut = new Map(
        ((statuts ?? []) as { id: string; analyse_statut: StatutAnalyse }[]).map((d) => [
          d.id,
          d.analyse_statut,
        ]),
      );
      const avecPhotos = plongees.filter((p) => nb.has(p.id));
      const base = await Promise.all(
        avecPhotos.map(async (p) => {
          const [galerie, especes] = await Promise.all([
            chargerGalerie(p.id).catch(() => []),
            chargerEspeces(p.id).catch(() => []),
          ]);
          const proposees = especes.filter((e) => e.statut === "proposee").length;
          const validees = especes.filter((e) => e.statut === "validee").length;
          return {
            id: p.id,
            site: p.siteNom || "Plongée sans site",
            date: p.date,
            photos: galerie.filter((g) => g.moi).map((g) => g.url),
            nbPhotos: nb.get(p.id) ?? 0,
            etat: etatDe(statut.get(p.id) ?? null, proposees),
            proposees,
            validees,
          } satisfies Ligne;
        }),
      );
      // D'abord ce qui reste à faire, puis ce qui est déjà analysé
      const ordre: Record<Etat, number> = {
        trouvees: 0,
        en_cours: 1,
        a_analyser: 2,
        erreur: 2,
        aucune: 3,
      };
      if (actif.current)
        setLignes(
          base.sort((a, b) => ordre[a.etat] - ordre[b.etat] || b.date.localeCompare(a.date)),
        );
    })().catch(() => actif.current && setLignes([]));
  }, [pret]);

  // Pendant une analyse, on regarde toutes les 3 secondes où elle en est
  const enCours = (lignes ?? []).some((l) => l.etat === "en_cours");
  useEffect(() => {
    if (!enCours) return;
    const t = window.setInterval(() => {
      for (const l of lignes ?? []) if (l.etat === "en_cours") void suivre(l.id);
    }, 3000);
    return () => window.clearInterval(t);
  }, [enCours, lignes]); // eslint-disable-line react-hooks/exhaustive-deps

  const majLigne = (id: string, maj: Partial<Ligne>) =>
    setLignes((ls) => (ls ? ls.map((l) => (l.id === id ? { ...l, ...maj } : l)) : ls));

  async function suivre(id: string) {
    try {
      const [statut, especes] = await Promise.all([statutAnalyse(id), chargerEspeces(id)]);
      const proposees = especes.filter((e) => e.statut === "proposee").length;
      const validees = especes.filter((e) => e.statut === "validee").length;
      if (actif.current) majLigne(id, { etat: etatDe(statut, proposees), proposees, validees });
    } catch {
      /* on réessaie au prochain tour */
    }
  }

  async function analyser(ids: string[]) {
    if (!accord) return setFeuille(ids);
    for (const id of ids) {
      majLigne(id, { etat: "en_cours" });
      try {
        await lancerAnalyse(id);
        await suivre(id);
      } catch (e) {
        console.error(e);
        majLigne(id, { etat: "erreur" });
      }
    }
  }

  const accepter = async () => {
    const ids = feuille ?? [];
    setFeuille(null);
    try {
      await changerAccordAnalyse(true);
      setAccord(true);
    } catch {
      return;
    }
    // L'accord vient d'être donné : on lance directement
    for (const id of ids) {
      majLigne(id, { etat: "en_cours" });
      try {
        await lancerAnalyse(id);
        await suivre(id);
      } catch (e) {
        console.error(e);
        majLigne(id, { etat: "erreur" });
      }
    }
  };

  if (ecran) return ecran;

  const aFaire = (lignes ?? []).filter((l) => l.etat === "a_analyser" || l.etat === "erreur");
  const nbPhotosAFaire = aFaire.reduce((n, l) => n + l.nbPhotos, 0);

  return (
    <div className="min-h-screen bg-[#F1F6FC] text-[#123A63]">
      <div className="cascade mx-auto flex min-h-screen w-full max-w-[430px] flex-col px-[22px] pb-[max(24px,env(safe-area-inset-bottom))] pt-[clamp(14px,2.6svh,22px)]">
        <div className="flex items-center">
          <button
            type="button"
            aria-label="Retour"
            onClick={() => navigate({ to: "/especes" })}
            className="flex h-10 w-10 items-center justify-center goutte bg-[#E3EDF6]"
          >
            <ChevronLeft className="h-[18px] w-[18px]" strokeWidth={2.4} />
          </button>
        </div>
        <h1 className="pt-[12px] text-[26px] font-bold leading-tight">Analyser mes photos</h1>
        <p className="pt-[4px] text-[13.5px] leading-snug text-[#5B7189]">
          L'IA regarde les photos de chaque plongée et te propose les espèces qu'elle reconnaît.
          Rien n'entre dans ton carnet sans ta validation.
        </p>

        {lignes === null && (
          <p className="pt-[24px] text-[14px] text-[#9DB0C0]">Chargement de tes photos…</p>
        )}
        {lignes && lignes.length === 0 && (
          <p className="mt-[18px] galet border border-[#DCE7F0] bg-white p-[16px] text-[14px] leading-snug text-[#5B7189]">
            Aucune photo dans tes plongées pour l'instant. Ajoute des photos à une plongée, puis
            reviens ici.
          </p>
        )}

        {aFaire.length > 1 && (
          <button
            type="button"
            onClick={() => void analyser(aFaire.map((l) => l.id))}
            className="relative mt-[18px] flex h-[56px] w-full items-center justify-center gap-[8px] galet-moyen bg-[#3DEFBE] text-[14px] font-bold text-[#0B3B63]"
          >
            <Fish className="h-[18px] w-[18px]" strokeWidth={2.2} aria-hidden="true" />
            Tout analyser ({aFaire.length} plongées, {nbPhotosAFaire} photo
            {nbPhotosAFaire > 1 ? "s" : ""})
          </button>
        )}

        <div className="flex flex-col gap-[14px] pt-[18px]">
          {(lignes ?? []).map((l) => (
            <article
              key={l.id}
              className="relative galet-b border border-[#DCE7F0] bg-white p-[14px] shadow-[0_4px_14px_#123A6308]"
            >
              {l.etat === "trouvees" && <Meduse className="-right-[4px] -top-[14px]" />}
              <button
                type="button"
                onClick={() => navigate({ to: "/nouvelle-plongee", search: { id: l.id } })}
                className="flex w-full items-baseline gap-[8px] text-left"
              >
                <span className="min-w-0 flex-1 truncate text-[16px] font-bold">{l.site}</span>
                <span className="shrink-0 text-[12.5px] text-[#5B7189]">{dateCourte(l.date)}</span>
              </button>
              {/* Les photos de la plongée */}
              <div className="-mx-[2px] mt-[10px] flex gap-[6px] overflow-x-auto pb-[2px]">
                {l.photos.length > 0 ? (
                  l.photos.map((u, i) => (
                    <img
                      key={i}
                      src={u}
                      alt=""
                      loading="lazy"
                      className="h-[86px] w-[86px] shrink-0 rounded-[12px] object-cover"
                    />
                  ))
                ) : (
                  <span className="text-[12.5px] text-[#9DB0C0]">
                    {l.nbPhotos} photo{l.nbPhotos > 1 ? "s" : ""}
                  </span>
                )}
              </div>
              <div className="pt-[12px]">
                <ActionLigne
                  l={l}
                  onAnalyser={() => void analyser([l.id])}
                  onValider={() => navigate({ to: "/plongee/especes", search: { id: l.id, depuis: "analyser" } })}
                />
              </div>
            </article>
          ))}
        </div>
      </div>
      {feuille && (
        <FeuilleAccord
          nbPhotos={(lignes ?? [])
            .filter((l) => feuille.includes(l.id))
            .reduce((n, l) => n + l.nbPhotos, 0)}
          onAccepter={() => void accepter()}
          onFermer={() => setFeuille(null)}
        />
      )}
    </div>
  );
}

function ActionLigne({
  l,
  onAnalyser,
  onValider,
}: {
  l: Ligne;
  onAnalyser: () => void;
  onValider: () => void;
}) {
  const bouton =
    "flex h-[46px] w-full items-center justify-center gap-[8px] galet-moyen text-[13.5px] font-bold";
  if (l.etat === "a_analyser")
    return (
      <button type="button" onClick={onAnalyser} className={`${bouton} bg-[#0F3D70] text-white`}>
        <Fish className="h-[17px] w-[17px]" strokeWidth={2.2} aria-hidden="true" />
        Identifier les espèces sur {l.nbPhotos > 1 ? `ces ${l.nbPhotos} photos` : "cette photo"}
      </button>
    );
  if (l.etat === "en_cours")
    return (
      <div className={`${bouton} bg-[#E3F4FC] text-[#1176A8]`}>
        <span className="flex gap-[3px]" aria-hidden="true">
          {[0, 1, 2].map((i) => (
            <span
              key={i}
              className="h-[5px] w-[5px] animate-pulse rounded-full bg-[#1176A8]"
              style={{ animationDelay: `${i * 0.2}s` }}
            />
          ))}
        </span>
        Analyse en cours…
      </div>
    );
  if (l.etat === "trouvees")
    return (
      <button type="button" onClick={onValider} className={`${bouton} bg-[#3DEFBE] text-[#0B3B63]`}>
        {l.proposees} espèce{l.proposees > 1 ? "s" : ""} détectée{l.proposees > 1 ? "s" : ""} : à
        valider
        <ChevronRight className="h-[17px] w-[17px]" strokeWidth={2.4} aria-hidden="true" />
      </button>
    );
  if (l.etat === "aucune")
    return (
      <div className="flex items-center gap-[8px] text-[13px] text-[#5B7189]">
        <Check className="h-[15px] w-[15px] text-[#14805F]" strokeWidth={2.6} aria-hidden="true" />
        <span className="flex-1">{l.validees > 0 ? `${l.validees} espèce${l.validees > 1 ? "s" : ""} validée${l.validees > 1 ? "s" : ""}` : "Analysée, aucune espèce gardée"}</span>
        <button
          type="button"
          onClick={onValider}
          className="flex items-center gap-[4px] py-[4px] font-bold text-[#1176A8]"
        >
          <Eye className="h-[15px] w-[15px]" aria-hidden="true" />
          Voir les espèces
        </button>
      </div>
    );
  return (
    <button
      type="button"
      onClick={onAnalyser}
      className={`${bouton} border border-[#DCE7F0] bg-white text-[#0F3D70]`}
    >
      <RefreshCw className="h-[16px] w-[16px]" strokeWidth={2.2} aria-hidden="true" />
      Analyse impossible pour le moment : réessayer
    </button>
  );
}
