import { useCallback, useEffect, useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { AlertTriangle, ChevronLeft, ChevronRight, FileSpreadsheet, Pencil, Plus } from "lucide-react";
import { useConnexionRequise } from "@/components/numerisation/Ui";
import { NavigationDpMobile } from "@/components/club/NavigationDp";
import { ChampTexte, Feuille, MessageErreur, PageClub } from "@/components/club/Ui";
import { messagePlanning, useCentre } from "@/components/club/useCentre";
import { ImportTableur } from "@/components/club/ImportTableur";
import { IMPORT_MATERIEL } from "@/components/club/importsClub";
import { InventaireMateriel } from "@/components/club/InventaireMateriel";
import { heureCourte } from "@/lib/club";
import {
  ajouterJours,
  aujourdhui,
  controleProche,
  depuisIso,
  enConflit,
  enregistrerMateriel,
  lundi,
  planningCentre,
  reserveLeJour,
  retirerMateriel,
  TYPES_MATERIEL,
  type Materiel,
  type SortiePlanning,
  type TypeMateriel,
} from "@/lib/planning";

// Matériel du centre : bateaux (places), blocs, gilets, détendeurs, combinaisons…
// avec l'utilisation jour par jour (réservations des sorties) et les contrôles à prévoir.
export const Route = createFileRoute("/_dp/club_/materiel")({
  // Depuis la recherche : ouvre directement la fiche d'un élément
  validateSearch: (search: Record<string, unknown>): { ouvrir?: string; vue?: "inventaire" | "reservations" } => ({
    ...(typeof search["ouvrir"] === "string" ? { ouvrir: search["ouvrir"] } : {}),
    ...(search["vue"] === "inventaire" || search["vue"] === "reservations" ? { vue: search["vue"] } : {}),
  }),
  head: () => ({ meta: [{ title: "Palanote — Matériel" }] }),
  component: PageMateriel,
});

const JOURS = ["Lun", "Mar", "Mer", "Jeu", "Ven", "Sam", "Dim"];

type Brouillon = { id?: string; type: TypeMateriel; libelle: string; quantite: string; places: string; controle: string; note: string };
const VIDE: Brouillon = { type: "bloc", libelle: "", quantite: "1", places: "", controle: "", note: "" };

function PageMateriel() {
  const navigate = useNavigate();
  const { pret, ecran } = useConnexionRequise();
  const { centre, erreur: erreurCentre } = useCentre(pret);
  const [materiel, setMateriel] = useState<Materiel[] | null>(null);
  const [sorties, setSorties] = useState<SortiePlanning[]>([]);
  const [semaine, setSemaine] = useState(() => lundi(aujourdhui()));
  const [fiche, setFiche] = useState<Brouillon | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);
  const [importer, setImporter] = useState(false);
  const rechercheVue = Route.useSearch();
  const [vue, setVue] = useState<"inventaire" | "reservations">(rechercheVue.vue ?? (rechercheVue.ouvrir ? "reservations" : "inventaire"));

  const charger = useCallback(async () => {
    if (!centre) return;
    try {
      const p = await planningCentre(centre.id, semaine, ajouterJours(semaine, 6));
      setMateriel(p.materiel);
      setSorties(p.sorties.filter((s) => s.statut !== "annulee"));
      setErreur(null);
    } catch (e) {
      console.error(e);
      setMateriel([]);
      setErreur(messagePlanning(e, "Le matériel n'a pas pu être chargé."));
    }
  }, [centre, semaine]);

  useEffect(() => {
    void charger();
  }, [charger]);

  // Fiche demandée par la recherche
  const { ouvrir } = Route.useSearch();
  useEffect(() => {
    if (!ouvrir || !materiel) return;
    const m = materiel.find((x) => x.id === ouvrir);
    if (m) setFiche({ id: m.id, type: m.type, libelle: m.libelle, quantite: String(m.quantite), places: m.places ? String(m.places) : "", controle: m.prochain_controle ?? "", note: m.note ?? "" });
    navigate({ to: ".", search: {}, replace: true });
  }, [ouvrir, materiel]); // eslint-disable-line react-hooks/exhaustive-deps

  if (ecran) return ecran;

  const jours = Array.from({ length: 7 }, (_, i) => ajouterJours(semaine, i));
  const controles = (materiel ?? []).filter((m) => controleProche(m.prochain_controle));
  const a = depuisIso(semaine);
  const b = depuisIso(ajouterJours(semaine, 6));

  const enregistrer = async (f: Brouillon) => {
    if (!centre) return;
    try {
      await enregistrerMateriel(centre.id, {
        id: f.id ?? null,
        type: f.type,
        libelle: f.libelle,
        quantite: f.type === "bateau" ? 1 : Math.max(0, Number(f.quantite) || 0),
        places: f.type === "bateau" ? Number(f.places) || null : null,
        controle: f.controle || null,
        note: f.note || null,
      });
      setFiche(null);
      await charger();
    } catch (e) {
      setErreur(messagePlanning(e, "Le matériel n'a pas pu être enregistré."));
    }
  };

  // Une case du tableau : ce qui est réservé ce jour-là sur le stock
  const caseJour = (m: Materiel, d: string) => {
    if (m.type === "bateau") {
      const l = sorties.filter((s) => s.date === d && s.bateau_id === m.id);
      const conflit = l.some((x, i) => l.some((y, j) => i < j && enConflit(x, y)));
      return l.length === 0 ? null : (
        <span className={`block truncate rounded-[7px] px-[5px] py-[2px] text-[10.5px] font-bold ${conflit ? "bg-[#FFE9E2] text-[#B8432F]" : "bg-[#D5FAF0] text-[#0B3B63]"}`}>
          {l.map((s) => heureCourte(s.heure) || "?").join(" · ")}
        </span>
      );
    }
    const r = reserveLeJour(sorties, d, m.id);
    if (r === 0) return null;
    const trop = r > m.quantite;
    const juste = !trop && r >= m.quantite * 0.85;
    return (
      <span
        className={`block rounded-[7px] px-[5px] py-[2px] text-center text-[11px] font-bold ${
          trop ? "bg-[#FFE9E2] text-[#B8432F]" : juste ? "bg-[#FFF1D6] text-[#8A5A10]" : "bg-[#D5FAF0] text-[#0B3B63]"
        }`}
      >
        {r}/{m.quantite}
      </span>
    );
  };

  return (
    <PageClub
      titre="Matériel"
      large
      navigation={<NavigationDpMobile />}
     
      droite={
        centre ? (
          <span className="flex items-center gap-[8px]">
          <button
            type="button"
            onClick={() => setImporter(true)}
            className="flex h-[42px] items-center gap-2 rounded-[12px] border border-[#D8E5EE] bg-white px-[12px] text-[13px] font-bold text-[#137758] lg:px-[16px]"
          >
            <FileSpreadsheet className="h-[17px] w-[17px]" aria-hidden="true" />
            <span className="hidden sm:inline">IMPORTER (EXCEL)</span>
          </button>
          <button
            type="button"
            onClick={() => setFiche({ ...VIDE })}
            className="flex h-[42px] items-center gap-2 galet-moyen bg-[#3DEFBE] px-[14px] text-[13px] font-bold text-[#0B3B63] lg:px-[18px]"
          >
            <Plus className="h-[17px] w-[17px]" strokeWidth={2.6} aria-hidden="true" />
            <span className="hidden sm:inline">AJOUTER</span>
          </button>
          </span>
        ) : null
      }
    >
      <MessageErreur texte={erreurCentre ?? erreur} />
      {centre && (
        <div className="mt-[4px] flex w-fit rounded-[10px] bg-[#E3EDF6] p-[3px]" role="tablist" aria-label="Vue du matériel">
          {(
            [
              ["inventaire", "Inventaire"],
              ["reservations", "Réservations des sorties"],
            ] as const
          ).map(([id, l]) => (
            <button
              key={id}
              type="button"
              role="tab"
              aria-selected={vue === id}
              onClick={() => setVue(id)}
              className={`h-[36px] rounded-[8px] px-[14px] text-[13px] font-bold ${vue === id ? "bg-white text-[#123A63] shadow-[0_2px_6px_#123A6314]" : "text-[#566B82]"}`}
            >
              {l}
            </button>
          ))}
        </div>
      )}
      {centre && vue === "inventaire" && <InventaireMateriel centre={centre.id} />}
      {centre && materiel && vue === "reservations" && (
        <>
          {controles.length > 0 && (
            <div className="mt-[6px] flex flex-wrap gap-[8px]">
              {controles.map((m) => {
                const etat = controleProche(m.prochain_controle);
                return (
                  <span
                    key={m.id}
                    className={`flex items-center gap-[6px] rounded-[12px] px-[11px] py-[6px] text-[12.5px] font-bold ${etat === "depasse" ? "bg-[#FFE9E2] text-[#B8432F]" : "bg-[#FFF1D6] text-[#8A5A10]"}`}
                  >
                    <AlertTriangle className="h-[14px] w-[14px]" />
                    {m.libelle} : contrôle {etat === "depasse" ? "dépassé" : "à prévoir"} ({depuisIso(m.prochain_controle!).toLocaleDateString("fr-FR", { day: "numeric", month: "short" })})
                  </span>
                );
              })}
            </div>
          )}

          <div className="flex flex-wrap items-center gap-[8px] pt-[16px]">
            <h2 className="text-[13px] font-bold uppercase tracking-[.08em] text-[#566B82]">Réservé par les sorties</h2>
            <span className="text-[13px] font-semibold">
              {a.getDate()} {a.toLocaleDateString("fr-FR", { month: "short" })} – {b.getDate()} {b.toLocaleDateString("fr-FR", { month: "short" })}
            </span>
            <button type="button" aria-label="Semaine précédente" onClick={() => setSemaine(ajouterJours(semaine, -7))} className="ml-auto flex h-[32px] w-[32px] items-center justify-center goutte bg-white">
              <ChevronLeft className="h-[16px] w-[16px]" />
            </button>
            <button type="button" aria-label="Semaine suivante" onClick={() => setSemaine(ajouterJours(semaine, 7))} className="flex h-[32px] w-[32px] items-center justify-center goutte bg-white">
              <ChevronRight className="h-[16px] w-[16px]" />
            </button>
          </div>

          {materiel.length === 0 ? (
            <p className="mt-[10px] galet-b border border-dashed border-[#D5E1EC] bg-white/60 px-[15px] py-[16px] text-[13.5px] text-[#566B82]">
              Ajoute ton bateau (avec son nombre de places) et ton stock de blocs, gilets et combinaisons : tu les réserveras pour chaque sortie depuis le planning.
            </p>
          ) : (
            <div className="mt-[10px] overflow-x-auto galet-b border border-[#E4EBF1] bg-white">
              <table className="w-full min-w-[760px] border-collapse text-[13px]">
                <thead>
                  <tr className="text-left text-[11px] uppercase tracking-[.06em] text-[#566B82]">
                    <th className="px-[14px] py-[10px] font-bold">Matériel</th>
                    <th className="px-[6px] font-bold">Stock</th>
                    <th className="px-[6px] font-bold">Contrôle</th>
                    {jours.map((d, i) => (
                      <th key={d} className={`w-[64px] px-[3px] text-center font-bold ${d === aujourdhui() ? "text-[#106F9F]" : ""}`}>
                        {JOURS[i]} {depuisIso(d).getDate()}
                      </th>
                    ))}
                    <th className="w-[44px]" />
                  </tr>
                </thead>
                {TYPES_MATERIEL.map((t) => {
                  const liste = materiel.filter((m) => m.type === t.id);
                  if (liste.length === 0) return null;
                  return (
                    <tbody key={t.id}>
                      <tr>
                        <td colSpan={11} className="bg-[#F1F6FC] px-[14px] py-[5px] text-[11.5px] font-bold uppercase tracking-[.06em] text-[#566B82]">
                          {t.pluriel}
                        </td>
                      </tr>
                      {liste.map((m) => {
                        const etat = controleProche(m.prochain_controle);
                        return (
                          <tr key={m.id} className="border-t border-[#EEF3F8]">
                            <td className="px-[14px] py-[9px]">
                              <span className="block font-bold">{m.libelle}</span>
                              {m.note && <span className="block truncate text-[11.5px] text-[#566B82]">{m.note}</span>}
                            </td>
                            <td className="px-[6px] font-semibold">{m.type === "bateau" ? `${m.places ?? "?"} places` : m.quantite}</td>
                            <td className="px-[6px]">
                              {m.prochain_controle ? (
                                <span className={`text-[12px] font-semibold ${etat === "depasse" ? "text-[#B8432F]" : etat === "proche" ? "text-[#8A5A10]" : "text-[#566B82]"}`}>
                                  {depuisIso(m.prochain_controle).toLocaleDateString("fr-FR", { day: "numeric", month: "short", year: "2-digit" })}
                                </span>
                              ) : (
                                <span className="text-[#C9D5E0]">—</span>
                              )}
                            </td>
                            {jours.map((d) => (
                              <td key={d} className="px-[3px] py-[6px]">
                                {caseJour(m, d)}
                              </td>
                            ))}
                            <td className="pr-[10px] text-right">
                              <button
                                type="button"
                                aria-label={`Modifier ${m.libelle}`}
                                onClick={() =>
                                  setFiche({
                                    id: m.id,
                                    type: m.type,
                                    libelle: m.libelle,
                                    quantite: String(m.quantite),
                                    places: m.places ? String(m.places) : "",
                                    controle: m.prochain_controle ?? "",
                                    note: m.note ?? "",
                                  })
                                }
                                className="flex h-[30px] w-[30px] items-center justify-center goutte text-[#566B82] hover:bg-[#F1F6FC]"
                              >
                                <Pencil className="h-[14px] w-[14px]" />
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  );
                })}
              </table>
            </div>
          )}
          <p className="pt-[8px] text-[12px] text-[#566B82]">
            Chaque case : quantité réservée ce jour-là sur le stock. En jaune, presque tout est pris ; en corail, il en manque. Les réservations se font dans le panneau de la sortie, depuis le planning.
          </p>
        </>
      )}

      {importer && centre && (
        <ImportTableur
          titre={IMPORT_MATERIEL.titre}
          description={IMPORT_MATERIEL.description}
          champs={IMPORT_MATERIEL.champs}
          modele={IMPORT_MATERIEL.modele}
          transformer={IMPORT_MATERIEL.transformer}
          onImporter={(lignes) => IMPORT_MATERIEL.importer(centre.id, lignes)}
          onFermer={(fait) => {
            setImporter(false);
            if (fait) void charger();
          }}
        />
      )}

      {fiche && (
        <Feuille titre={fiche.id ? `Modifier ${fiche.libelle}` : "Ajouter du matériel"} onFermer={() => setFiche(null)}>
          <div className="flex flex-col gap-[12px]">
            <div className="flex flex-wrap gap-[6px]">
              {TYPES_MATERIEL.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => setFiche({ ...fiche, type: t.id })}
                  className={`h-[34px] rounded-[17px] px-[12px] text-[12.5px] font-bold ${fiche.type === t.id ? "bg-[#0F3D70] text-white" : "border border-[#D8E5EE] text-[#566B82]"}`}
                >
                  {t.libelle}
                </button>
              ))}
            </div>
            <ChampTexte
              label={fiche.type === "bateau" ? "Nom du bateau" : "Libellé"}
              value={fiche.libelle}
              onChange={(e) => setFiche({ ...fiche, libelle: e.target.value })}
              placeholder={fiche.type === "bateau" ? "Le Poséidon" : fiche.type === "bloc" ? "Bloc 12 L" : fiche.type === "combinaison" ? "Combi 5 mm taille M" : "Gilet taille M"}
            />
            <div className="grid grid-cols-2 gap-[10px]">
              {fiche.type === "bateau" ? (
                <ChampTexte label="Places (plongeurs)" inputMode="numeric" value={fiche.places} onChange={(e) => setFiche({ ...fiche, places: e.target.value.replace(/\D/g, "").slice(0, 3) })} placeholder="16" />
              ) : (
                <ChampTexte label="Quantité" inputMode="numeric" value={fiche.quantite} onChange={(e) => setFiche({ ...fiche, quantite: e.target.value.replace(/\D/g, "").slice(0, 3) })} />
              )}
              <ChampTexte label="Prochain contrôle" type="date" value={fiche.controle} onChange={(e) => setFiche({ ...fiche, controle: e.target.value })} />
            </div>
            <ChampTexte label="Note" value={fiche.note} onChange={(e) => setFiche({ ...fiche, note: e.target.value })} placeholder={fiche.type === "bloc" ? "Requalification (TIV) en mars" : "Facultatif"} />
          </div>
          <button
            type="button"
            disabled={!fiche.libelle.trim() || (fiche.type === "bateau" && !Number(fiche.places))}
            onClick={() => void enregistrer(fiche)}
            className="mt-[18px] flex h-14 w-full items-center justify-center galet-moyen bg-[#3DEFBE] text-[14px] font-bold text-[#0B3B63] disabled:opacity-50"
          >
            {fiche.id ? "ENREGISTRER" : "AJOUTER"}
          </button>
          {fiche.id && (
            <button
              type="button"
              onClick={() => {
                const id = fiche.id!;
                setFiche(null);
                void retirerMateriel(id)
                  .catch((e) => setErreur(messagePlanning(e, "Le matériel n'a pas pu être retiré.")))
                  .finally(() => void charger());
              }}
              className="mx-auto mt-[14px] block text-[13px] font-semibold text-[#566B82] underline underline-offset-4"
            >
              Retirer ce matériel
            </button>
          )}
        </Feuille>
      )}
    </PageClub>
  );
}
