import { useCallback, useEffect, useState, type DragEvent } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { AlertTriangle, ChevronLeft, ChevronRight, FileSpreadsheet, Plus, Ship, Stamp, Star } from "lucide-react";
import { useConnexionRequise } from "@/components/numerisation/Ui";
import { NavigationDpMobile } from "@/components/club/NavigationDp";
import { ChampTexte, Feuille, MessageErreur, PageClub } from "@/components/club/Ui";
import { Jauge, PanneauSortie } from "@/components/club/PanneauSortie";
import { ExportSaison } from "@/components/club/ExportSaison";
import { useNouvelleSortie } from "@/components/club/PanneauNouvelleSortie";
import { messagePlanning, useCentre } from "@/components/club/useCentre";
import { heureCourte, poserTampon, sortiesDp, terminerSortie, type SortieResume, type StatutSortie } from "@/lib/club";
import {
  ajouterJours,
  alertesSortie,
  aujourdhui,
  deplacerSortie,
  depuisIso,
  lundi,
  planningCentre,
  privilegiesCentre,
  roleCourt,
  type Planning,
  type SortiePlanning,
} from "@/lib/planning";

// Planning du centre (poste de pilotage du DP, pensé pour l'ordinateur) :
//   · Semaine : une colonne par jour, on glisse une sortie prévue d'un jour à l'autre,
//     un clic sur « + » crée une sortie ce jour-là ;
//   · Mois : chaque jour avec ses sorties et son nombre de palanquées ;
//   · Suivi : le kanban des sorties (prévue → à clôturer → à tamponner → tamponnée).
// Un clic sur une sortie ouvre son panneau : palanquées en kanban, équipe, bateau, matériel.
type Vue = "semaine" | "mois" | "suivi";

export const Route = createFileRoute("/_dp/club_/planning")({
  validateSearch: (search: Record<string, unknown>): { vue?: Vue; semaine?: string; sortie?: string } => ({
    ...(search["vue"] === "mois" || search["vue"] === "suivi" || search["vue"] === "semaine" ? { vue: search["vue"] as Vue } : {}),
    ...(typeof search["semaine"] === "string" && /^\d{4}-\d{2}-\d{2}$/.test(search["semaine"]) ? { semaine: search["semaine"] } : {}),
    ...(typeof search["sortie"] === "string" ? { sortie: search["sortie"] } : {}),
  }),
  head: () => ({ meta: [{ title: "Palanote — Planning" }] }),
  component: PagePlanning,
});

const JOURS = ["Lun", "Mar", "Mer", "Jeu", "Ven", "Sam", "Dim"];
const MOIS = ["janvier", "février", "mars", "avril", "mai", "juin", "juillet", "août", "septembre", "octobre", "novembre", "décembre"];

const COULEUR_STATUT: Record<StatutSortie, string> = {
  prevue: "border-l-[#57D4F5]",
  terminee: "border-l-[#FF8A75]",
  validee: "border-l-[#3DEFBE]",
  annulee: "border-l-[#C9D5E0]",
};

function PagePlanning() {
  const navigate = useNavigate({ from: "/club/planning" });
  const { vue = "semaine", semaine, sortie } = Route.useSearch();
  const { pret, ecran } = useConnexionRequise();
  const { centre, centres, erreur: erreurCentre } = useCentre(pret);
  const [plan, setPlan] = useState<Planning | null>(null);
  const [suivi, setSuivi] = useState<SortieResume[] | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);
  const [survol, setSurvol] = useState<string | null>(null);
  const [aCloturer, setACloturer] = useState<SortieResume | null>(null);
  const [aTamponner, setATamponner] = useState<SortieResume | null>(null);
  const [exporter, setExporter] = useState(false);
  const nouvelleSortie = useNouvelleSortie();
  const [reservees, setReservees] = useState<Map<string, string | null>>(new Map()); // sortie → mélange

  const ref = semaine ?? aujourdhui();
  const debutSemaine = lundi(ref);
  const premierDuMois = `${ref.slice(0, 7)}-01`;
  const debut = vue === "mois" ? lundi(premierDuMois) : debutSemaine;
  // Le mois : de la semaine du 1er à celle du dernier jour (4 à 6 semaines)
  const dernierDuMois = (() => {
    const d = depuisIso(premierDuMois);
    d.setMonth(d.getMonth() + 1, 0);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  })();
  const nbJours =
    vue === "mois" ? Math.round((depuisIso(ajouterJours(lundi(dernierDuMois), 6)).getTime() - depuisIso(lundi(premierDuMois)).getTime()) / 86400000) + 1 : 7;
  const fin = ajouterJours(debut, nbJours - 1);
  const jours = Array.from({ length: nbJours }, (_, i) => ajouterJours(debut, i));
  const auj = aujourdhui();

  const charger = useCallback(async () => {
    if (!centre) return;
    try {
      if (vue === "suivi") {
        const l = await sortiesDp();
        setSuivi(l.filter((s) => s.centre_id === centre.id));
      } else {
        setPlan(await planningCentre(centre.id, debut, fin));
      }
      setErreur(null);
    } catch (e) {
      console.error(e);
      setErreur(messagePlanning(e, "Le planning n'a pas pu être chargé."));
    }
  }, [centre, vue, debut, fin]);

  useEffect(() => {
    void charger();
  }, [charger]);

  // Les plongées réservées aux membres privilégiés (étoile sur les cartes)
  useEffect(() => {
    if (!centre) return;
    privilegiesCentre(centre.id)
      .then((c) => setReservees(new Map(c.sorties.map((x) => [x.id, x.melange]))))
      .catch(() => undefined);
  }, [centre, sortie]);

  if (ecran) return ecran;

  const aller = (s: { vue?: Vue; semaine?: string }) => navigate({ search: (prev) => ({ ...prev, ...s }), replace: true });
  const ouvrir = (id: string) => navigate({ search: (prev) => ({ ...prev, sortie: id }) });
  const fermer = () =>
    navigate({
      search: (prev) => {
        const { sortie: _ferme, ...reste } = prev;
        return reste;
      },
    });
  const decaler = (n: number) => {
    if (vue === "mois") {
      const d = depuisIso(premierDuMois);
      d.setMonth(d.getMonth() + n);
      aller({ semaine: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-01` });
    } else aller({ semaine: ajouterJours(debutSemaine, 7 * n) });
  };
  const nouvelle = (date?: string) =>
    nouvelleSortie(centre?.id ?? null, { ...(date ? { date } : {}), retour: "planning" });

  // Glisser une sortie prévue sur un autre jour
  const deposer = (date: string) => (e: DragEvent) => {
    e.preventDefault();
    setSurvol(null);
    const id = e.dataTransfer.getData("text/sortie");
    const s = plan?.sorties.find((x) => x.id === id);
    if (!s || !plan || s.date === date) return;
    setPlan({ ...plan, sorties: plan.sorties.map((x) => (x.id === id ? { ...x, date } : x)) });
    void deplacerSortie(id, date)
      .catch((err) => setErreur(messagePlanning(err, "La sortie n'a pas pu être déplacée.")))
      .finally(() => void charger());
  };
  const cibleJour = (date: string) =>
    date >= auj
      ? {
          onDragOver: (e: DragEvent) => {
            if (!e.dataTransfer.types.includes("text/sortie")) return;
            e.preventDefault();
            setSurvol(date);
          },
          onDragLeave: () => setSurvol((v) => (v === date ? null : v)),
          onDrop: deposer(date),
        }
      : {};

  const titrePeriode =
    vue === "mois"
      ? `${MOIS[depuisIso(premierDuMois).getMonth()]} ${premierDuMois.slice(0, 4)}`
      : vue === "semaine"
        ? (() => {
            const a = depuisIso(debut);
            const b = depuisIso(fin);
            return a.getMonth() === b.getMonth()
              ? `${a.getDate()} – ${b.getDate()} ${MOIS[b.getMonth()]} ${b.getFullYear()}`
              : `${a.getDate()} ${MOIS[a.getMonth()]} – ${b.getDate()} ${MOIS[b.getMonth()]} ${b.getFullYear()}`;
          })()
        : "Où en sont tes sorties";

  const sortiesDu = (d: string) => (plan?.sorties ?? []).filter((s) => s.date === d && s.statut !== "annulee");

  return (
    <PageClub
      titre="Planning"
      large="plein"
      navigation={<NavigationDpMobile />}
      droite={
        centre ? (
          <span className="flex items-center gap-[8px]">
          <button
            type="button"
            onClick={() => setExporter(true)}
            aria-label="Exporter la saison en Excel"
            className="flex h-[42px] items-center gap-2 rounded-[10px] border border-[#D8E5EE] bg-white px-[12px] text-[13px] font-bold text-[#14805F] lg:px-[14px]"
          >
            <FileSpreadsheet className="h-[17px] w-[17px]" aria-hidden="true" />
            <span className="hidden sm:inline">EXPORTER</span>
          </button>
          <button
            type="button"
            onClick={() => nouvelle()}
            className="flex h-[42px] items-center gap-2 galet-moyen bg-[#3DEFBE] px-[14px] text-[13px] font-bold text-[#0B3B63] lg:hidden"
          >
            <Plus className="h-[17px] w-[17px]" strokeWidth={2.6} aria-hidden="true" />
            <span className="hidden sm:inline">NOUVELLE SORTIE</span>
          </button>
          </span>
        ) : null
      }
    >
      <MessageErreur texte={erreurCentre ?? erreur} />
      {centres && centres.length === 0 && !erreurCentre && (
        <p className="pt-[16px] text-[14px] text-[#5B7189]">
          Choisis d'abord ton centre dans l'onglet Sorties.{" "}
          <button type="button" className="font-bold text-[#1176A8]" onClick={() => navigate({ to: "/club/centre" })}>
            Choisir mon centre
          </button>
        </p>
      )}

      {centre && (
        <>
          {/* Barre d'outils : vue, période */}
          <div className="flex flex-wrap items-center gap-[10px] pt-[6px]">
            <div className="flex rounded-[14px] bg-[#E3EDF6] p-[3px]" role="tablist" aria-label="Vue du planning">
              {(
                [
                  ["semaine", "Semaine"],
                  ["mois", "Mois"],
                  ["suivi", "Suivi"],
                ] as const
              ).map(([id, l]) => (
                <button
                  key={id}
                  type="button"
                  role="tab"
                  aria-selected={vue === id}
                  onClick={() => aller({ vue: id })}
                  className={`h-[34px] rounded-[11px] px-[14px] text-[13px] font-bold ${vue === id ? "bg-white text-[#123A63] shadow-[0_2px_6px_#123A6314]" : "text-[#5B7189]"}`}
                >
                  {l}
                </button>
              ))}
            </div>
            {vue !== "suivi" && (
              <div className="flex items-center gap-[6px]">
                <button type="button" aria-label="Période précédente" onClick={() => decaler(-1)} className="flex h-[36px] w-[36px] items-center justify-center goutte bg-white">
                  <ChevronLeft className="h-[18px] w-[18px]" />
                </button>
                <button type="button" aria-label="Période suivante" onClick={() => decaler(1)} className="flex h-[36px] w-[36px] items-center justify-center goutte bg-white">
                  <ChevronRight className="h-[18px] w-[18px]" />
                </button>
                <button type="button" onClick={() => aller({ semaine: auj })} className="h-[36px] rounded-[18px] border border-[#D8E5EE] bg-white px-[12px] text-[12.5px] font-bold text-[#1176A8]">
                  Aujourd'hui
                </button>
              </div>
            )}
            <h2 className="text-[17px] font-bold first-letter:uppercase">{titrePeriode}</h2>
            <span className="ml-auto text-[12.5px] text-[#7D93A8]">{centre.nom}</span>
          </div>

          {vue !== "suivi" && plan && <ResumePeriode plan={plan} />}

          {/* Vue semaine */}
          {vue === "semaine" && (
            <div className="grid grid-cols-1 gap-[10px] pt-[12px] lg:grid-cols-7">
              {jours.map((d, i) => {
                const liste = sortiesDu(d);
                const pal = liste.reduce((t, s) => t + s.nb_palanquees, 0);
                const passe = d < auj;
                return (
                  <div
                    key={d}
                    {...cibleJour(d)}
                    className={`flex flex-col galet-b border-2 p-[8px] transition-colors lg:min-h-[440px] ${
                      survol === d ? "border-[#3DEFBE] bg-[#E2F8EF]" : d === auj ? "border-[#57D4F5] bg-white" : "border-transparent bg-white/60"
                    }`}
                  >
                    <div className={`flex items-center justify-between px-[4px] lg:pb-[8px] ${liste.length > 0 ? "pb-[8px]" : ""}`}>
                      <span className={`text-[13px] font-bold ${passe ? "text-[#9DB0C0]" : ""}`}>
                        {JOURS[i]} <span className="text-[18px]">{depuisIso(d).getDate()}</span>
                      </span>
                      <span className="flex items-center gap-[8px]">
                        {liste.length > 0 && <span className="text-[11.5px] font-semibold text-[#5B7189]">{pal} pal.</span>}
                        {!passe && (
                          <button type="button" onClick={() => nouvelle(d)} aria-label={`Nouvelle sortie le ${d}`} className="flex h-[28px] w-[28px] items-center justify-center goutte bg-[#E3F2FB] text-[#1176A8] lg:hidden">
                            <Plus className="h-[15px] w-[15px]" />
                          </button>
                        )}
                      </span>
                    </div>
                    <div className="flex flex-col gap-[8px]">
                      {liste.map((s) => (
                        <CarteSortie key={s.id} s={s} plan={plan!} reservee={reservees.has(s.id) ? { melange: reservees.get(s.id) ?? null } : null} onClick={() => ouvrir(s.id)} />
                      ))}
                    </div>
                    {!passe && (
                      <button
                        type="button"
                        onClick={() => nouvelle(d)}
                        aria-label={`Nouvelle sortie le ${d}`}
                        className="mt-[8px] hidden h-[34px] items-center justify-center gap-[4px] rounded-[12px] text-[12.5px] font-bold text-[#9DB0C0] hover:bg-[#E3F2FB] hover:text-[#1176A8] lg:flex"
                      >
                        <Plus className="h-[15px] w-[15px]" /> Sortie
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {/* Vue mois */}
          {vue === "mois" && (
            <div className="pt-[12px]">
              <div className="hidden grid-cols-7 gap-[6px] pb-[6px] lg:grid">
                {JOURS.map((j) => (
                  <span key={j} className="px-[6px] text-[12px] font-bold uppercase tracking-[.06em] text-[#7D93A8]">
                    {j}
                  </span>
                ))}
              </div>
              <div className="grid grid-cols-1 gap-[6px] lg:grid-cols-7">
                {jours.map((d) => {
                  const liste = sortiesDu(d);
                  const pal = liste.reduce((t, s) => t + s.nb_palanquees, 0);
                  const horsMois = d.slice(0, 7) !== premierDuMois.slice(0, 7);
                  if (horsMois && liste.length === 0) return <div key={d} className="hidden min-h-[108px] rounded-[14px] bg-white/30 lg:block" />;
                  return (
                    <div
                      key={d}
                      {...cibleJour(d)}
                      onClick={() => aller({ vue: "semaine", semaine: d })}
                      className={`flex min-h-[108px] cursor-pointer flex-col gap-[4px] rounded-[14px] border-2 p-[7px] ${
                        survol === d ? "border-[#3DEFBE] bg-[#E2F8EF]" : d === auj ? "border-[#57D4F5] bg-white" : "border-transparent bg-white"
                      } ${horsMois ? "opacity-50" : ""} ${liste.length === 0 ? "hidden lg:flex" : ""}`}
                    >
                      <div className="flex items-baseline justify-between">
                        <span className={`text-[13px] font-bold ${d < auj ? "text-[#9DB0C0]" : ""}`}>
                          <span className="lg:hidden">{JOURS[(depuisIso(d).getDay() + 6) % 7]} </span>
                          {depuisIso(d).getDate()}
                        </span>
                        {pal > 0 && <span className="rounded-[8px] bg-[#0F3D70] px-[6px] py-[1px] text-[11px] font-bold text-white">{pal} pal.</span>}
                      </div>
                      {liste.map((s) => (
                        <button
                          key={s.id}
                          type="button"
                          draggable={s.statut === "prevue"}
                          onDragStart={(e) => {
                            e.stopPropagation();
                            e.dataTransfer.setData("text/sortie", s.id);
                          }}
                          onClick={(e) => {
                            e.stopPropagation();
                            ouvrir(s.id);
                          }}
                          className={`truncate rounded-[8px] border-l-[3px] bg-[#F1F6FC] px-[6px] py-[3px] text-left text-[11.5px] font-semibold ${COULEUR_STATUT[s.statut]}`}
                        >
                          {heureCourte(s.heure)} {s.site}
                          {alertesSortie(s, plan!.sorties, plan!.materiel).length > 0 && <AlertTriangle className="ml-[3px] inline h-[11px] w-[11px] text-[#D9573F]" />}
                        </button>
                      ))}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Suivi : le kanban des sorties */}
          {vue === "suivi" && suivi && (
            <KanbanSorties
              sorties={suivi}
              onOuvrir={ouvrir}
              onCloturer={setACloturer}
              onTamponner={setATamponner}
            />
          )}
        </>
      )}

      {sortie && <PanneauSortie id={sortie} onFermer={fermer} onChange={() => void charger()} />}

      {aCloturer && (
        <FeuilleCloturer
          s={aCloturer}
          onFermer={() => setACloturer(null)}
          onFait={() => {
            setACloturer(null);
            void charger();
          }}
        />
      )}
      {aTamponner && (
        <Feuille titre={`Tamponner ${aTamponner.site} ?`} onFermer={() => setATamponner(null)}>
          <p className="text-[14px] leading-normal text-[#5B7189]">
            {aTamponner.nb_completees ?? 0} fiche{(aTamponner.nb_completees ?? 0) > 1 ? "s" : ""} remplie{(aTamponner.nb_completees ?? 0) > 1 ? "s" : ""} sur {aTamponner.nb_inscrits ?? 0}.
            Tout le monde est tamponné ; ceux qui rempliront leur fiche plus tard le seront automatiquement. Pour retirer quelqu'un du tampon, ouvre la sortie.
          </p>
          <button
            type="button"
            onClick={() => {
              const s = aTamponner;
              setATamponner(null);
              void poserTampon(s.id, [])
                .catch((e) => setErreur(messagePlanning(e, "Le tampon n'a pas pu être posé.")))
                .finally(() => void charger());
            }}
            className="mt-[18px] flex h-14 w-full items-center justify-center gap-2 galet-moyen bg-[#FF8A75] text-[14px] font-bold text-white"
          >
            <Stamp className="h-[18px] w-[18px]" /> POSER LE TAMPON
          </button>
        </Feuille>
      )}
      {exporter && centre && <ExportSaison centre={centre.id} onFermer={() => setExporter(false)} />}
    </PageClub>
  );
}

// Les chiffres de la période affichée
function ResumePeriode({ plan }: { plan: Planning }) {
  const actives = plan.sorties.filter((s) => s.statut !== "annulee");
  const plongeurs = actives.reduce((t, s) => t + s.nb_inscrits + s.nb_prevus, 0);
  const pal = actives.reduce((t, s) => t + s.nb_palanquees, 0);
  const alertes = actives.reduce((t, s) => t + alertesSortie(s, plan.sorties, plan.materiel).length, 0);
  return (
    <div className="flex flex-wrap gap-[8px] pt-[12px]">
      {[
        { v: actives.length, l: `sortie${actives.length > 1 ? "s" : ""}` },
        { v: pal, l: `palanquée${pal > 1 ? "s" : ""}` },
        { v: plongeurs, l: `plongeur${plongeurs > 1 ? "s" : ""}` },
      ].map(({ v, l }) => (
        <span key={l} className="rounded-[12px] bg-white px-[12px] py-[6px] text-[13px]">
          <b className="text-[15px]">{v}</b> {l}
        </span>
      ))}
      {alertes > 0 && (
        <span className="flex items-center gap-[5px] rounded-[12px] bg-[#FFE9E2] px-[12px] py-[6px] text-[13px] font-bold text-[#D9573F]">
          <AlertTriangle className="h-[14px] w-[14px]" /> {alertes} point{alertes > 1 ? "s" : ""} à régler
        </span>
      )}
    </div>
  );
}

function CarteSortie({ s, plan, reservee, onClick }: { s: SortiePlanning; plan: Planning; reservee: { melange: string | null } | null; onClick: () => void }) {
  const alertes = alertesSortie(s, plan.sorties, plan.materiel);
  const monde = s.nb_inscrits + s.nb_prevus;
  const deplacable = s.statut === "prevue" && s.date >= aujourdhui();
  return (
    <button
      type="button"
      draggable={deplacable}
      onDragStart={(e) => {
        e.dataTransfer.setData("text/sortie", s.id);
        e.dataTransfer.effectAllowed = "move";
      }}
      onClick={onClick}
      className={`block w-full rounded-[14px] border-l-[4px] bg-white px-[10px] py-[9px] text-left shadow-[0_3px_10px_#123A630D] ${COULEUR_STATUT[s.statut]} ${
        deplacable ? "cursor-grab active:cursor-grabbing" : ""
      }`}
    >
      <span className="flex items-center gap-[4px] text-[11.5px] font-bold text-[#1176A8]">
        {heureCourte(s.heure) || "—"}
        {!s.mienne && <span className="font-semibold text-[#7D93A8]"> · DP {s.dp}</span>}
        {reservee && <Star className="ml-auto h-[13px] w-[13px] shrink-0" fill="#E9A93A" stroke="#E9A93A" aria-label="Réservée aux membres privilégiés" />}
      </span>
      <span className="block truncate text-[14px] font-bold leading-snug">{s.site}</span>
      <span className="block truncate text-[11.5px] text-[#5B7189]">
        {monde} plong. · {s.nb_palanquees} pal.
        {s.statut !== "prevue" && ` · ${s.nb_completees}/${s.nb_inscrits} fiches`}
      </span>
      {reservee?.melange && <span className="mt-[3px] inline-block rounded-[6px] bg-[#E3F2FB] px-[5px] py-[1px] text-[10.5px] font-bold text-[#1176A8]">{reservee.melange}</span>}
      {s.bateau && (
        <span className="flex items-center gap-[4px] pt-[3px] text-[11px] text-[#7D93A8]">
          <Ship className="h-[11px] w-[11px]" /> <span className="truncate">{s.bateau}</span>
        </span>
      )}
      {s.places ? <Jauge valeur={monde} total={s.places} /> : null}
      {s.equipe.length > 0 && (
        <span className="flex flex-wrap gap-[3px] pt-[6px]">
          {s.equipe.map((e) => (
            <span key={e.id} className="rounded-[7px] bg-[#E3EDF6] px-[5px] py-[1px] text-[10.5px] font-bold text-[#3F5B76]">
              {e.nom.split(" ")[0]} · {roleCourt(e.role)}
            </span>
          ))}
        </span>
      )}
      {alertes.length > 0 && (
        <span className="flex items-start gap-[4px] pt-[6px] text-[11px] font-bold leading-tight text-[#D9573F]">
          <AlertTriangle className="mt-[1px] h-[11px] w-[11px] shrink-0" />
          {alertes[0]}
          {alertes.length > 1 ? ` (+${alertes.length - 1})` : ""}
        </span>
      )}
    </button>
  );
}

// Kanban des sorties : on glisse une carte vers la droite pour faire avancer la sortie
type Colonne = "prevue" | "cloturer" | "tamponner" | "tamponnee";
function KanbanSorties({
  sorties,
  onOuvrir,
  onCloturer,
  onTamponner,
}: {
  sorties: SortieResume[];
  onOuvrir: (id: string) => void;
  onCloturer: (s: SortieResume) => void;
  onTamponner: (s: SortieResume) => void;
}) {
  const [survol, setSurvol] = useState<Colonne | null>(null);
  const auj = aujourdhui();
  const colonneDe = (s: SortieResume): Colonne | null =>
    s.statut === "prevue" ? (s.date < auj ? "cloturer" : "prevue") : s.statut === "terminee" ? "tamponner" : s.statut === "validee" ? "tamponnee" : null;
  const colonnes: { id: Colonne; titre: string; aide: string }[] = [
    { id: "prevue", titre: "Prévues", aide: "à préparer" },
    { id: "cloturer", titre: "À clôturer", aide: "la plongée a eu lieu" },
    { id: "tamponner", titre: "À tamponner", aide: "les fiches arrivent" },
    { id: "tamponnee", titre: "Tamponnées", aide: "30 derniers jours" },
  ];
  const limite = ajouterJours(auj, -30);
  const dans = (c: Colonne) =>
    sorties
      .filter((s) => colonneDe(s) === c && (c !== "tamponnee" || s.date >= limite))
      .sort((a, b) => {
        const x = `${a.date} ${a.heure ?? ""}`;
        const y = `${b.date} ${b.heure ?? ""}`;
        return c === "prevue" ? x.localeCompare(y) : y.localeCompare(x);
      });

  // Transitions permises en glissant : prévue/à clôturer → à tamponner, à tamponner → tamponnée
  const deposer = (c: Colonne) => (e: DragEvent) => {
    e.preventDefault();
    setSurvol(null);
    const s = sorties.find((x) => x.id === e.dataTransfer.getData("text/kanban"));
    if (!s) return;
    const de = colonneDe(s);
    if (c === "tamponner" && (de === "prevue" || de === "cloturer")) onCloturer(s);
    if (c === "tamponnee" && de === "tamponner") onTamponner(s);
  };

  return (
    <div className="-mx-[22px] flex gap-[12px] overflow-x-auto px-[22px] pt-[14px] lg:mx-0 lg:grid lg:grid-cols-4 lg:px-0">
      {colonnes.map((c) => {
        const liste = dans(c.id);
        const cible = c.id === "tamponner" || c.id === "tamponnee";
        return (
          <div
            key={c.id}
            onDragOver={(e) => {
              if (!cible) return;
              e.preventDefault();
              setSurvol(c.id);
            }}
            onDragLeave={() => setSurvol((v) => (v === c.id ? null : v))}
            onDrop={deposer(c.id)}
            className={`flex w-[260px] shrink-0 flex-col gap-[8px] galet-b border-2 p-[10px] lg:w-auto lg:min-h-[480px] ${
              survol === c.id ? "border-[#3DEFBE] bg-[#E2F8EF]" : "border-transparent bg-[#E3EDF6]"
            }`}
          >
            <div className="flex items-baseline justify-between px-[4px]">
              <span className="text-[14px] font-bold">
                {c.titre} <span className="text-[#5B7189]">{liste.length}</span>
              </span>
              <span className="text-[11.5px] text-[#7D93A8]">{c.aide}</span>
            </div>
            {liste.map((s) => (
              <button
                key={s.id}
                type="button"
                draggable={c.id !== "tamponnee"}
                onDragStart={(e) => e.dataTransfer.setData("text/kanban", s.id)}
                onClick={() => onOuvrir(s.id)}
                className={`block w-full cursor-grab rounded-[14px] border-l-[4px] bg-white px-[11px] py-[9px] text-left shadow-[0_3px_10px_#123A630D] active:cursor-grabbing ${COULEUR_STATUT[s.statut]}`}
              >
                <span className="block text-[11.5px] font-bold text-[#1176A8] first-letter:uppercase">
                  {depuisIso(s.date).toLocaleDateString("fr-FR", { weekday: "short", day: "numeric", month: "short" })}
                  {s.heure ? ` · ${heureCourte(s.heure)}` : ""}
                </span>
                <span className="block truncate text-[14px] font-bold">{s.site}</span>
                <span className="block truncate text-[11.5px] text-[#5B7189]">
                  {s.nb_inscrits ?? 0} plongeur{(s.nb_inscrits ?? 0) > 1 ? "s" : ""}
                  {c.id !== "prevue" ? ` · ${s.nb_completees ?? 0}/${s.nb_inscrits ?? 0} fiches` : s.nb_prevus ? ` · ${s.nb_prevus} en attente` : ""}
                </span>
              </button>
            ))}
            {liste.length === 0 && <span className="px-[4px] py-[14px] text-center text-[12px] text-[#9DB0C0]">{cible ? "Glisse une sortie ici" : "Rien ici"}</span>}
          </div>
        );
      })}
    </div>
  );
}

// « La plongée est finie » depuis le kanban : les infos communes, puis les fiches partent
function FeuilleCloturer({ s, onFermer, onFait }: { s: SortieResume; onFermer: () => void; onFait: () => void }) {
  const [duree, setDuree] = useState("45");
  const [temp, setTemp] = useState("");
  const [visi, setVisi] = useState("");
  const [enCours, setEnCours] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);
  const nombre = (v: string) => (v.trim() === "" ? null : Number(v.replace(",", ".")));
  return (
    <Feuille titre={`${s.site} : la plongée est finie`} onFermer={onFermer}>
      <p className="pb-[14px] text-[13.5px] text-[#5B7189]">Chaque plongeur reçoit sa fiche préremplie avec ces infos.</p>
      <div className="grid grid-cols-3 gap-[10px]">
        <ChampTexte label="Durée (min)" inputMode="numeric" value={duree} onChange={(e) => setDuree(e.target.value.replace(/\D/g, "").slice(0, 3))} />
        <ChampTexte label="Eau (°C)" inputMode="decimal" value={temp} onChange={(e) => setTemp(e.target.value.replace(/[^\d,.]/g, "").slice(0, 4))} />
        <ChampTexte label="Visi. (m)" inputMode="numeric" value={visi} onChange={(e) => setVisi(e.target.value.replace(/\D/g, "").slice(0, 3))} />
      </div>
      <MessageErreur texte={erreur} />
      <button
        type="button"
        disabled={enCours || !Number(duree)}
        onClick={() => {
          setEnCours(true);
          terminerSortie(s.id, Number(duree), nombre(temp), nombre(visi))
            .then(onFait)
            .catch((e) => {
              setErreur(messagePlanning(e, "La sortie n'a pas pu être clôturée."));
              setEnCours(false);
            });
        }}
        className="mt-[18px] flex h-14 w-full items-center justify-center galet-moyen bg-[#3DEFBE] text-[14px] font-bold text-[#0B3B63] disabled:opacity-50"
      >
        {enCours ? "ENVOI…" : "ENVOYER LES FICHES"}
      </button>
    </Feuille>
  );
}
