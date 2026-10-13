import { useCallback, useEffect, useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { BookOpen, Check, GraduationCap, Plus, Search, Trash2, Waves, X } from "lucide-react";
import { useConnexionRequise } from "@/components/numerisation/Ui";
import { NavigationDpMobile } from "@/components/club/NavigationDp";
import { ChampTexte, Feuille, MessageErreur, PageClub, detailErreur } from "@/components/club/Ui";
import { PanneauLateral } from "@/components/club/PanneauLateral";
import { messagePlanning, useCentre } from "@/components/club/useCentre";
import { adherentsCentre, equipeCentre, type Adherent, type Equipier } from "@/lib/planning";
import {
  CATEGORIES_FORMATION,
  catalogueFormations,
  catalogueFormationsType,
  cocherSeance,
  enregistrerFormationCatalogue,
  formationsCentre,
  jourCourt,
  jourLong,
  modifierFormation,
  prixTexte,
  programmeType,
  programmerFormation,
  retirerFormationCatalogue,
  STATUTS_FORMATION,
  supprimerFormation,
  type FormationCatalogue,
  type FormationEleve,
  type Seance,
  type StatutFormation,
} from "@/lib/formations";

// Les formations du club : le catalogue (niveaux, Nitrox… avec tarifs et nombre de cours),
// les élèves en formation, leur moniteur et leurs séances jour par jour.
export const Route = createFileRoute("/_dp/club_/formations")({
  head: () => ({ meta: [{ title: "Palanote — Formations" }] }),
  component: PageFormations,
});

function PastilleStatutFormation({ statut }: { statut: StatutFormation }) {
  const s = STATUTS_FORMATION.find((x) => x.id === statut) ?? STATUTS_FORMATION[0]!;
  return <span className={`inline-block whitespace-nowrap rounded-[8px] px-[8px] py-[2px] text-[11.5px] font-bold ${s.classe}`}>{s.libelle}</span>;
}

const aujourdhuiIso = () => new Date().toISOString().slice(0, 10);

function PageFormations() {
  const { pret, ecran } = useConnexionRequise();
  const { centre, erreur: erreurCentre } = useCentre(pret);
  const [onglet, setOnglet] = useState<"eleves" | "catalogue">("eleves");
  const [catalogue, setCatalogue] = useState<FormationCatalogue[] | null>(null);
  const [formations, setFormations] = useState<FormationEleve[] | null>(null);
  const [equipe, setEquipe] = useState<Equipier[]>([]);
  const [adherents, setAdherents] = useState<Adherent[]>([]);
  const [erreur, setErreur] = useState<string | null>(null);
  const [fiche, setFiche] = useState<Partial<FormationCatalogue> | null>(null);
  const [programme, setProgramme] = useState<FormationEleve | "nouvelle" | null>(null);
  const [detail, setDetail] = useState<string | null>(null);
  const [filtre, setFiltre] = useState<"actives" | "toutes">("actives");

  const charger = useCallback(async () => {
    if (!centre) return;
    try {
      const [c, f, e, a] = await Promise.all([catalogueFormations(centre.id), formationsCentre(centre.id), equipeCentre(centre.id), adherentsCentre(centre.id)]);
      setCatalogue(c);
      setFormations(f);
      setEquipe(e.filter((x) => x.actif));
      setAdherents(a);
      setErreur(null);
    } catch (e) {
      console.error(e);
      setCatalogue([]);
      setFormations([]);
      setErreur(messagePlanning(e, "Les formations ne sont pas encore installées : lance le script palanote-formations.sql dans Supabase."));
    }
  }, [centre]);
  useEffect(() => {
    void charger();
  }, [charger]);

  if (ecran) return ecran;
  const liste = (formations ?? []).filter((f) => filtre === "toutes" || f.statut === "prevue" || f.statut === "en_cours");
  const enCours = (formations ?? []).filter((f) => f.statut === "en_cours" || f.statut === "prevue").length;
  const ouverte = formations?.find((f) => f.id === detail) ?? null;

  return (
    <PageClub
      titre="Formations"
      large
      navigation={<NavigationDpMobile />}
      droite={
        centre ? (
          <button
            type="button"
            onClick={() => (onglet === "catalogue" ? setFiche({ categorie: "niveau", organisme: "FFESSM", nb_theorie: 2, nb_pratique: 4 }) : setProgramme("nouvelle"))}
            className="flex h-[42px] items-center gap-2 rounded-[10px] bg-[#3DEFBE] px-[14px] text-[13px] font-bold text-[#0B3B63] lg:px-[18px]"
          >
            <Plus className="h-[17px] w-[17px]" strokeWidth={2.6} aria-hidden="true" />
            <span className="hidden sm:inline">{onglet === "catalogue" ? "AJOUTER UNE FORMATION" : "INSCRIRE UN ÉLÈVE"}</span>
          </button>
        ) : null
      }
    >
      <MessageErreur texte={erreurCentre ?? erreur} />
      {centre && (
        <>
          <div className="mt-[4px] flex w-fit rounded-[10px] bg-[#E3EDF6] p-[3px]" role="tablist">
            {(
              [
                ["eleves", `Élèves en formation${enCours ? ` · ${enCours}` : ""}`],
                ["catalogue", `Catalogue${catalogue?.length ? ` · ${catalogue.length}` : ""}`],
              ] as const
            ).map(([id, l]) => (
              <button
                key={id}
                type="button"
                role="tab"
                aria-selected={onglet === id}
                onClick={() => setOnglet(id)}
                className={`h-[36px] rounded-[8px] px-[14px] text-[13px] font-bold ${onglet === id ? "bg-white text-[#123A63] shadow-[0_2px_6px_#123A6314]" : "text-[#5B7189]"}`}
              >
                {l}
              </button>
            ))}
          </div>

          {onglet === "eleves" && formations && (
            <>
              <div className="flex items-center gap-[10px] pt-[14px]">
                <div className="flex rounded-[10px] bg-[#E3EDF6] p-[3px]">
                  {(
                    [
                      ["actives", "En cours et à venir"],
                      ["toutes", "Toutes"],
                    ] as const
                  ).map(([id, l]) => (
                    <button
                      key={id}
                      type="button"
                      onClick={() => setFiltre(id)}
                      className={`h-[32px] rounded-[8px] px-[12px] text-[12.5px] font-bold ${filtre === id ? "bg-white text-[#123A63] shadow-[0_2px_6px_#123A6314]" : "text-[#5B7189]"}`}
                    >
                      {l}
                    </button>
                  ))}
                </div>
              </div>
              {liste.length === 0 ? (
                <div className="mt-[12px] rounded-[10px] border border-dashed border-[#C9DCEA] bg-white/60 px-[18px] py-[18px] text-[13.5px] leading-normal text-[#5B7189]">
                  <p className="font-bold text-[#123A63]">Aucun élève en formation.</p>
                  <p className="pt-[4px]">
                    {catalogue?.length
                      ? "Inscris un élève : choisis sa formation, son moniteur et sa date de début, le programme se remplit tout seul."
                      : "Commence par le catalogue : ajoute les formations du club (ou le catalogue type FFESSM en un clic)."}
                  </p>
                </div>
              ) : (
                <div className="mt-[12px] overflow-x-auto rounded-[10px] border border-[#E4EBF1] bg-white">
                  <table className="w-full min-w-[820px] border-collapse text-[13px]">
                    <thead>
                      <tr className="border-b border-[#E4EBF1] text-left text-[11px] font-bold uppercase tracking-[.06em] text-[#7D93A8]">
                        <th className="px-[14px] py-[10px]">Élève</th>
                        <th className="px-[8px] py-[10px]">Formation</th>
                        <th className="px-[8px] py-[10px]">Moniteur</th>
                        <th className="px-[8px] py-[10px]">Dates</th>
                        <th className="px-[8px] py-[10px]">Avancement</th>
                        <th className="px-[8px] py-[10px]">Tarif</th>
                        <th className="px-[14px] py-[10px] text-right">Statut</th>
                      </tr>
                    </thead>
                    <tbody>
                      {liste.map((f) => {
                        const faites = f.seances.filter((s) => s.faite).length;
                        return (
                          <tr key={f.id} onClick={() => setDetail(f.id)} className="cursor-pointer border-b border-[#F0F4F8] last:border-0 hover:bg-[#F5F9FD]">
                            <td className="px-[14px] py-[11px]">
                              <b>{f.eleve_nom}</b>
                              {f.eleve_niveau && <span className="block text-[11.5px] text-[#7D93A8]">{f.eleve_niveau}{f.eleve_id ? " · sur Palanote" : ""}</span>}
                            </td>
                            <td className="px-[8px]">
                              <span className="mr-[6px] rounded-[6px] bg-[#0F3D70] px-[6px] py-[1px] text-[11px] font-bold text-white">{f.code ?? "—"}</span>
                              {f.intitule}
                            </td>
                            <td className="px-[8px]">{f.moniteur?.nom ?? <span className="font-semibold text-[#D9573F]">À désigner</span>}</td>
                            <td className="whitespace-nowrap px-[8px]">
                              {jourCourt(f.date_debut)} → {jourCourt(f.date_fin)}
                            </td>
                            <td className="px-[8px]">
                              <span className="flex items-center gap-[8px]">
                                <span className="h-[6px] w-[80px] overflow-hidden rounded-full bg-[#E3EDF6]">
                                  <span className="block h-full bg-[#3DEFBE]" style={{ width: `${f.seances.length ? (faites / f.seances.length) * 100 : 0}%` }} />
                                </span>
                                <span className="text-[12px] text-[#5B7189]">
                                  {faites}/{f.seances.length}
                                </span>
                              </span>
                            </td>
                            <td className="px-[8px]">{prixTexte(f.prix)}</td>
                            <td className="px-[14px] text-right">
                              <PastilleStatutFormation statut={f.statut} />
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </>
          )}

          {onglet === "catalogue" && catalogue && (
            <>
              {catalogue.length === 0 && (
                <div className="mt-[14px] rounded-[10px] border border-dashed border-[#C9DCEA] bg-white/60 px-[18px] py-[18px] text-[13.5px] text-[#5B7189]">
                  <p className="font-bold text-[#123A63]">Le catalogue est vide.</p>
                  <p className="pt-[4px]">Ajoute tes formations une par une, ou pars du catalogue type d'un club FFESSM (tarifs indicatifs à adapter).</p>
                  <button
                    type="button"
                    onClick={() => void catalogueFormationsType(centre.id).then(charger).catch((e) => setErreur(detailErreur(e, "Le catalogue n'a pas pu être ajouté.")))}
                    className="mt-[12px] flex h-[40px] items-center gap-[8px] rounded-[10px] bg-[#0F3D70] px-[14px] text-[13px] font-bold text-white"
                  >
                    <BookOpen className="h-[16px] w-[16px]" /> Ajouter le catalogue type (N1 à N4, Nitrox, RIFAP…)
                  </button>
                </div>
              )}
              {CATEGORIES_FORMATION.map((cat) => {
                const l = catalogue.filter((f) => f.categorie === cat.id);
                if (l.length === 0) return null;
                return (
                  <div key={cat.id}>
                    <p className="pb-[8px] pt-[20px] text-[11.5px] font-bold uppercase tracking-[.12em] text-[#7D93A8]">{cat.libelle}</p>
                    <div className="grid gap-[10px] sm:grid-cols-2 xl:grid-cols-3">
                      {l.map((f) => (
                        <button
                          key={f.id}
                          type="button"
                          onClick={() => setFiche(f)}
                          className={`flex flex-col rounded-[10px] border bg-white p-[14px] text-left hover:border-[#57D4F5] ${f.actif ? "border-[#E4EBF1]" : "border-dashed border-[#D5E1EC] opacity-60"}`}
                        >
                          <span className="flex items-start gap-[10px]">
                            <span className="flex h-[40px] min-w-[44px] items-center justify-center rounded-[10px] bg-[#0F3D70] px-[6px] text-[13px] font-bold text-white">{f.code}</span>
                            <span className="min-w-0 flex-1">
                              <span className="block text-[14.5px] font-bold leading-tight">{f.intitule}</span>
                              <span className="block text-[12px] text-[#7D93A8]">{f.organisme}</span>
                            </span>
                            <span className="text-[16px] font-bold text-[#14805F]">{prixTexte(f.prix)}</span>
                          </span>
                          <span className="flex flex-wrap gap-[6px] pt-[10px] text-[12px] font-semibold">
                            <span className="flex items-center gap-[4px] rounded-[8px] bg-[#EEF4F9] px-[8px] py-[3px] text-[#3F5B76]">
                              <BookOpen className="h-[13px] w-[13px]" /> {f.nb_theorie} cours théoriques
                            </span>
                            <span className="flex items-center gap-[4px] rounded-[8px] bg-[#E2F8EF] px-[8px] py-[3px] text-[#14805F]">
                              <Waves className="h-[13px] w-[13px]" /> {f.nb_pratique} séances pratiques
                            </span>
                            {f.en_cours > 0 && (
                              <span className="rounded-[8px] bg-[#FFF1D6] px-[8px] py-[3px] text-[#8A5A10]">
                                {f.en_cours} élève{f.en_cours > 1 ? "s" : ""}
                              </span>
                            )}
                          </span>
                          {f.prerequis && <span className="pt-[8px] text-[12px] text-[#5B7189]">Prérequis : {f.prerequis}</span>}
                        </button>
                      ))}
                    </div>
                  </div>
                );
              })}
            </>
          )}
        </>
      )}

      {fiche && centre && <FeuilleCatalogue centre={centre.id} f={fiche} onFermer={() => setFiche(null)} onFait={() => void charger()} />}
      {programme && centre && (
        <PanneauProgramme
          centre={centre.id}
          catalogue={(catalogue ?? []).filter((c) => c.actif)}
          adherents={adherents}
          equipe={equipe}
          existante={programme === "nouvelle" ? null : programme}
          onFermer={() => setProgramme(null)}
          onFait={(id) => {
            setProgramme(null);
            void charger().then(() => setDetail(id));
          }}
        />
      )}
      {ouverte && (
        <PanneauDetail
          f={ouverte}
          equipe={equipe}
          onFermer={() => setDetail(null)}
          onChange={() => void charger()}
          onModifier={() => {
            setDetail(null);
            setProgramme(ouverte);
          }}
        />
      )}
    </PageClub>
  );
}

// ---------- Catalogue : ajouter ou modifier une formation ----------
function FeuilleCatalogue({ centre, f, onFermer, onFait }: { centre: string; f: Partial<FormationCatalogue>; onFermer: () => void; onFait: () => void }) {
  const [b, setB] = useState({
    code: f.code ?? "",
    intitule: f.intitule ?? "",
    organisme: f.organisme ?? "FFESSM",
    categorie: f.categorie ?? "niveau",
    prix: f.prix !== null && f.prix !== undefined ? String(f.prix) : "",
    nb_theorie: String(f.nb_theorie ?? 0),
    nb_pratique: String(f.nb_pratique ?? 0),
    prerequis: f.prerequis ?? "",
    description: f.description ?? "",
    actif: f.actif ?? true,
  });
  const [erreur, setErreur] = useState<string | null>(null);
  const [enCours, setEnCours] = useState(false);
  const valider = async () => {
    setEnCours(true);
    try {
      await enregistrerFormationCatalogue(centre, { ...(f.id ? { id: f.id } : {}), ...b, prix: b.prix.replace(",", ".") } as unknown as Partial<FormationCatalogue>);
      onFait();
      onFermer();
    } catch (e) {
      setErreur(detailErreur(e, "La formation n'a pas pu être enregistrée."));
    } finally {
      setEnCours(false);
    }
  };
  const nombre = (v: string) => v.replace(/\D/g, "").slice(0, 2);
  return (
    <Feuille titre={f.id ? `Modifier ${f.code}` : "Ajouter une formation"} onFermer={onFermer}>
      <div className="grid grid-cols-[1fr_2fr] gap-x-[10px]">
        <ChampTexte label="Code" value={b.code} onChange={(e) => setB({ ...b, code: e.target.value })} placeholder="N2" />
        <ChampTexte label="Intitulé" value={b.intitule} onChange={(e) => setB({ ...b, intitule: e.target.value })} placeholder="Plongeur Niveau 2" />
      </div>
      <p className="pb-[6px] text-[12px] font-bold text-[#5B7189]">Famille</p>
      <div className="flex flex-wrap gap-[6px] pb-[10px]">
        {CATEGORIES_FORMATION.map((c) => (
          <button
            key={c.id}
            type="button"
            onClick={() => setB({ ...b, categorie: c.id })}
            className={`h-[32px] rounded-[10px] px-[10px] text-[12.5px] font-bold ${b.categorie === c.id ? "bg-[#0F3D70] text-white" : "border border-[#D8E5EE] bg-white text-[#5B7189]"}`}
          >
            {c.libelle}
          </button>
        ))}
      </div>
      <div className="grid grid-cols-3 gap-x-[10px]">
        <ChampTexte label="Tarif (€)" inputMode="decimal" value={b.prix} onChange={(e) => setB({ ...b, prix: e.target.value.replace(/[^\d,.]/g, "") })} placeholder="590" />
        <ChampTexte label="Cours théo." inputMode="numeric" value={b.nb_theorie} onChange={(e) => setB({ ...b, nb_theorie: nombre(e.target.value) })} />
        <ChampTexte label="Séances prat." inputMode="numeric" value={b.nb_pratique} onChange={(e) => setB({ ...b, nb_pratique: nombre(e.target.value) })} />
      </div>
      <ChampTexte label="Organisme" value={b.organisme} onChange={(e) => setB({ ...b, organisme: e.target.value })} />
      <ChampTexte label="Prérequis" value={b.prerequis} onChange={(e) => setB({ ...b, prerequis: e.target.value })} placeholder="N1, 16 ans, certificat médical" />
      <ChampTexte label="Description" value={b.description} onChange={(e) => setB({ ...b, description: e.target.value })} placeholder="Autonome à 20 m…" />
      {f.id && (
        <label className="flex items-center gap-[8px] pt-[4px] text-[13px] font-semibold">
          <input type="checkbox" checked={b.actif} onChange={(e) => setB({ ...b, actif: e.target.checked })} className="h-[17px] w-[17px] accent-[#0F3D70]" />
          Proposée cette saison
        </label>
      )}
      <MessageErreur texte={erreur} />
      <button
        type="button"
        disabled={enCours || !b.code.trim() || !b.intitule.trim()}
        onClick={() => void valider()}
        className="mt-[14px] flex h-[50px] w-full items-center justify-center rounded-[10px] bg-[#3DEFBE] text-[14px] font-bold text-[#0B3B63] disabled:opacity-50"
      >
        {enCours ? "ENREGISTREMENT…" : "ENREGISTRER"}
      </button>
      {f.id && (
        <button
          type="button"
          onClick={() => void retirerFormationCatalogue(f.id!).then(() => (onFait(), onFermer())).catch((e) => setErreur(detailErreur(e, "Retrait impossible.")))}
          className="mx-auto mt-[12px] flex items-center gap-[5px] text-[13px] font-semibold text-[#9DB0C0] underline underline-offset-4"
        >
          <Trash2 className="h-[13px] w-[13px]" /> Retirer du catalogue
        </button>
      )}
    </Feuille>
  );
}

// ---------- Inscrire un élève / modifier son programme ----------
function PanneauProgramme({
  centre,
  catalogue,
  adherents,
  equipe,
  existante,
  onFermer,
  onFait,
}: {
  centre: string;
  catalogue: FormationCatalogue[];
  adherents: Adherent[];
  equipe: Equipier[];
  existante: FormationEleve | null;
  onFermer: () => void;
  onFait: (id: string) => void;
}) {
  const [catId, setCatId] = useState(existante?.catalogue_id ?? "");
  const [adhId, setAdhId] = useState(existante?.adherent_id ?? "");
  const [moniteur, setMoniteur] = useState(existante?.moniteur_id ?? "");
  const [debut, setDebut] = useState(existante?.date_debut ?? aujourdhuiIso());
  const [prix, setPrix] = useState(existante?.prix !== null && existante?.prix !== undefined ? String(existante.prix) : "");
  const [seances, setSeances] = useState<Seance[]>(existante?.seances ?? []);
  const [q, setQ] = useState("");
  const [erreur, setErreur] = useState<string | null>(null);
  const [enCours, setEnCours] = useState(false);
  const cat = catalogue.find((c) => c.id === catId) ?? null;
  const eleve = adherents.find((a) => a.id === adhId) ?? null;
  const moniteurs = equipe.filter((e) => e.role === "dp" || e.role === "guide");

  // Nouveau cursus ou nouvelle date : le programme type se recalcule
  const regenerer = (c: FormationCatalogue | null, d: string) => {
    if (!c) return;
    setSeances(programmeType(c.nb_theorie, c.nb_pratique, d));
    setPrix(c.prix !== null ? String(c.prix) : "");
  };
  const trouves = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return [];
    return adherents.filter((a) => `${a.prenom} ${a.nom ?? ""} ${a.niveau ?? ""}`.toLowerCase().includes(s)).slice(0, 6);
  }, [q, adherents]);
  const jours = [...new Set(seances.map((s) => s.jour))].sort();

  const valider = async () => {
    setEnCours(true);
    setErreur(null);
    try {
      const r = await programmerFormation(
        centre,
        { ...(existante ? { id: existante.id } : {}), catalogue_id: catId, adherent_id: adhId, moniteur_id: moniteur || null, prix: prix.replace(",", ".") },
        seances,
      );
      onFait(r.id);
    } catch (e) {
      setErreur(detailErreur(e, "La formation n'a pas pu être programmée."));
    } finally {
      setEnCours(false);
    }
  };
  const puce = (actif: boolean) => `h-[34px] rounded-[10px] px-[11px] text-[12.5px] font-bold ${actif ? "bg-[#0F3D70] text-white" : "border border-[#D8E5EE] bg-white text-[#5B7189]"}`;

  return (
    <PanneauLateral
      titre={existante ? `Programme de ${existante.eleve_nom}` : "Inscrire un élève en formation"}
      sousTitre="Il reçoit son programme dans l'app, puis un rappel avant le début et la veille de chaque journée de cours."
      onFermer={onFermer}
      pied={
        <button
          type="button"
          disabled={enCours || !catId || !adhId || seances.length === 0}
          onClick={() => void valider()}
          className="flex h-[52px] w-full items-center justify-center rounded-[10px] bg-[#3DEFBE] text-[14px] font-bold text-[#0B3B63] disabled:opacity-50"
        >
          {enCours ? "ENREGISTREMENT…" : existante ? "ENREGISTRER LE PROGRAMME" : `PROGRAMMER${seances.length ? ` · ${seances.length} SÉANCES` : ""}`}
        </button>
      }
    >
      <MessageErreur texte={erreur} />
      <p className="pb-[6px] pt-[16px] text-[11.5px] font-bold uppercase tracking-[.1em] text-[#9DB0C0]">Formation</p>
      <div className="flex flex-wrap gap-[6px]">
        {catalogue.map((c) => (
          <button
            key={c.id}
            type="button"
            onClick={() => {
              setCatId(c.id);
              regenerer(c, debut);
            }}
            className={puce(catId === c.id)}
            title={c.intitule}
          >
            {c.code}
          </button>
        ))}
        {catalogue.length === 0 && <p className="text-[13px] text-[#7D93A8]">Ajoute d'abord des formations au catalogue.</p>}
      </div>
      {cat && (
        <p className="pt-[8px] text-[12.5px] text-[#5B7189]">
          {cat.intitule} · {cat.nb_theorie} cours théoriques · {cat.nb_pratique} séances pratiques · {prixTexte(cat.prix)}
        </p>
      )}

      <p className="pb-[6px] pt-[18px] text-[11.5px] font-bold uppercase tracking-[.1em] text-[#9DB0C0]">Élève</p>
      {eleve ? (
        <div className="flex items-center gap-[10px] rounded-[10px] border border-[#57D4F5] bg-[#F3FAFE] px-[12px] py-[9px]">
          <span className="min-w-0 flex-1">
            <b>{[eleve.prenom, eleve.nom].filter(Boolean).join(" ")}</b>
            <span className="block text-[12px] text-[#7D93A8]">{[eleve.niveau, eleve.sur_palanote ? "sur Palanote, sera prévenu" : "pas encore sur Palanote"].filter(Boolean).join(" · ")}</span>
          </span>
          {!existante && (
            <button type="button" aria-label="Changer d'élève" onClick={() => setAdhId("")} className="text-[#9DB0C0]">
              <X className="h-[16px] w-[16px]" />
            </button>
          )}
        </div>
      ) : (
        <>
          <label className="flex h-[42px] items-center gap-[8px] rounded-[10px] border border-[#E4EBF1] px-[12px] focus-within:border-[#57D4F5]">
            <Search className="h-[16px] w-[16px] text-[#9DB0C0]" />
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Chercher parmi les membres du club…" className="min-w-0 flex-1 bg-transparent text-[14px] outline-none" />
          </label>
          <div className="flex flex-col gap-[4px] pt-[6px]">
            {trouves.map((a) => (
              <button
                key={a.id}
                type="button"
                onClick={() => {
                  setAdhId(a.id);
                  setQ("");
                }}
                className="flex items-center justify-between rounded-[10px] px-[10px] py-[7px] text-left text-[13.5px] hover:bg-[#F1F6FC]"
              >
                <span>
                  <b>{[a.prenom, a.nom].filter(Boolean).join(" ")}</b> <span className="text-[#7D93A8]">{a.niveau ?? ""}</span>
                </span>
                <Plus className="h-[15px] w-[15px] text-[#1176A8]" />
              </button>
            ))}
            {q.trim() && trouves.length === 0 && <p className="px-[4px] text-[12.5px] text-[#9DB0C0]">Personne de ce nom. Ajoute-le d'abord dans Membres du club.</p>}
          </div>
        </>
      )}

      <p className="pb-[6px] pt-[18px] text-[11.5px] font-bold uppercase tracking-[.1em] text-[#9DB0C0]">Moniteur en charge</p>
      <div className="flex flex-wrap gap-[6px]">
        {moniteurs.map((m) => (
          <button key={m.id} type="button" onClick={() => setMoniteur(moniteur === m.id ? "" : m.id)} className={puce(moniteur === m.id)}>
            {m.nom}
            {m.niveau ? ` · ${m.niveau}` : ""}
          </button>
        ))}
        {moniteurs.length === 0 && <p className="text-[13px] text-[#7D93A8]">Ajoute tes moniteurs dans Équipe (rôle DP ou guide).</p>}
      </div>

      <div className="grid grid-cols-2 gap-x-[10px] pt-[16px]">
        <ChampTexte
          label="Début de la formation"
          type="date"
          value={debut}
          onChange={(e) => {
            setDebut(e.target.value);
            if (!existante) regenerer(cat, e.target.value);
          }}
        />
        <ChampTexte label="Tarif (€)" inputMode="decimal" value={prix} onChange={(e) => setPrix(e.target.value.replace(/[^\d,.]/g, ""))} />
      </div>

      <div className="flex items-baseline justify-between pt-[10px]">
        <p className="text-[11.5px] font-bold uppercase tracking-[.1em] text-[#9DB0C0]">Programme · {seances.length} séances</p>
        {cat && (
          <button type="button" onClick={() => regenerer(cat, debut)} className="text-[12px] font-semibold text-[#1176A8]">
            Recalculer le programme type
          </button>
        )}
      </div>
      <p className="pb-[8px] text-[12px] text-[#7D93A8]">Pratique le matin et l'après-midi, théorie entre midi et deux. Modifie les horaires si besoin.</p>
      <div className="flex flex-col gap-[12px]">
        {jours.map((j, n) => (
          <div key={j} className="rounded-[10px] border border-[#E4EBF1]">
            <p className="border-b border-[#F0F4F8] px-[12px] py-[7px] text-[13px] font-bold">
              Jour {n + 1} · {jourLong(j)}
            </p>
            {seances.map((s, i) =>
              s.jour !== j ? null : (
                <div key={i} className="flex flex-wrap items-center gap-[8px] px-[12px] py-[7px]">
                  <button
                    type="button"
                    onClick={() => setSeances((l) => l.map((x, k) => (k === i ? { ...x, type: x.type === "theorie" ? "pratique" : "theorie" } : x)))}
                    className={`h-[28px] w-[78px] rounded-[8px] text-[11.5px] font-bold ${s.type === "theorie" ? "bg-[#EEF4F9] text-[#3F5B76]" : "bg-[#E2F8EF] text-[#14805F]"}`}
                    title="Changer le type"
                  >
                    {s.type === "theorie" ? "Théorie" : "Pratique"}
                  </button>
                  <input
                    type="time"
                    value={s.heure_debut}
                    onChange={(e) => setSeances((l) => l.map((x, k) => (k === i ? { ...x, heure_debut: e.target.value } : x)))}
                    className="h-[30px] rounded-[8px] border border-[#E4EBF1] px-[6px] text-[13px]"
                    aria-label="Heure de début"
                  />
                  <input
                    value={s.intitule ?? ""}
                    onChange={(e) => setSeances((l) => l.map((x, k) => (k === i ? { ...x, intitule: e.target.value } : x)))}
                    placeholder={s.type === "theorie" ? "Sujet (réglementation…)" : "Lieu ou exercice (fosse, mer…)"}
                    className="h-[30px] min-w-[140px] flex-1 rounded-[8px] border border-[#E4EBF1] px-[8px] text-[13px]"
                  />
                  <input
                    type="date"
                    value={s.jour}
                    onChange={(e) => setSeances((l) => l.map((x, k) => (k === i ? { ...x, jour: e.target.value } : x)))}
                    className="h-[30px] rounded-[8px] border border-[#E4EBF1] px-[6px] text-[12.5px]"
                    aria-label="Jour"
                  />
                  <button type="button" aria-label="Retirer la séance" onClick={() => setSeances((l) => l.filter((_, k) => k !== i))} className="text-[#9DB0C0]">
                    <Trash2 className="h-[14px] w-[14px]" />
                  </button>
                </div>
              ),
            )}
          </div>
        ))}
        <button
          type="button"
          onClick={() =>
            setSeances((l) => [...l, { type: "pratique", jour: jours[jours.length - 1] ?? debut, heure_debut: "09:00", heure_fin: "12:00", intitule: null }])
          }
          className="flex items-center gap-[6px] self-start text-[13px] font-bold text-[#1176A8]"
        >
          <Plus className="h-[14px] w-[14px]" /> Ajouter une séance
        </button>
      </div>
    </PanneauLateral>
  );
}

// ---------- La formation d'un élève ----------
function PanneauDetail({
  f,
  equipe,
  onFermer,
  onChange,
  onModifier,
}: {
  f: FormationEleve;
  equipe: Equipier[];
  onFermer: () => void;
  onChange: () => void;
  onModifier: () => void;
}) {
  const [erreur, setErreur] = useState<string | null>(null);
  const agir = async (a: () => Promise<unknown>) => {
    setErreur(null);
    try {
      await a();
      onChange();
    } catch (e) {
      setErreur(detailErreur(e, "La modification n'a pas pu être enregistrée."));
    }
  };
  const jours = [...new Set(f.seances.map((s) => s.jour))].sort();
  const faites = f.seances.filter((s) => s.faite).length;
  return (
    <PanneauLateral
      surTitre={`${f.code ?? "Formation"} · ${jourCourt(f.date_debut)} → ${jourCourt(f.date_fin)}`}
      titre={f.eleve_nom}
      sousTitre={`${f.intitule} · ${prixTexte(f.prix)}`}
      droite={<PastilleStatutFormation statut={f.statut} />}
      onFermer={onFermer}
      pied={
        <div className="flex gap-[8px]">
          <button type="button" onClick={onModifier} className="flex h-[46px] flex-1 items-center justify-center rounded-[10px] border border-[#D8E5EE] text-[13px] font-bold">
            Modifier le programme
          </button>
          <button
            type="button"
            disabled={f.statut === "validee"}
            onClick={() => void agir(() => modifierFormation(f.id, "validee"))}
            className="flex h-[46px] flex-1 items-center justify-center gap-[6px] rounded-[10px] bg-[#3DEFBE] text-[13px] font-bold text-[#0B3B63] disabled:opacity-50"
          >
            <GraduationCap className="h-[16px] w-[16px]" /> {f.statut === "validee" ? "Formation validée" : "Valider la formation"}
          </button>
        </div>
      }
    >
      <MessageErreur texte={erreur} />
      <div className="flex items-center gap-[10px] pt-[16px]">
        <span className="h-[8px] flex-1 overflow-hidden rounded-full bg-[#E3EDF6]">
          <span className="block h-full bg-[#3DEFBE]" style={{ width: `${f.seances.length ? (faites / f.seances.length) * 100 : 0}%` }} />
        </span>
        <span className="text-[12.5px] font-semibold text-[#5B7189]">
          {faites}/{f.seances.length} séances faites
        </span>
      </div>

      <p className="pb-[6px] pt-[18px] text-[11.5px] font-bold uppercase tracking-[.1em] text-[#9DB0C0]">Moniteur en charge</p>
      <select
        value={f.moniteur_id ?? ""}
        onChange={(e) => e.target.value && void agir(() => modifierFormation(f.id, null, e.target.value))}
        className="h-[40px] w-full rounded-[10px] border border-[#E4EBF1] bg-white px-[10px] text-[14px]"
      >
        <option value="">À désigner</option>
        {equipe
          .filter((m) => m.role === "dp" || m.role === "guide")
          .map((m) => (
            <option key={m.id} value={m.id}>
              {m.nom}
              {m.niveau ? ` · ${m.niveau}` : ""}
            </option>
          ))}
      </select>
      {!f.eleve_id && <p className="pt-[8px] text-[12px] text-[#8A5A10]">L'élève n'a pas encore de compte Palanote : invite-le depuis Membres du club pour qu'il reçoive son programme.</p>}

      <p className="pb-[6px] pt-[18px] text-[11.5px] font-bold uppercase tracking-[.1em] text-[#9DB0C0]">Séances</p>
      <div className="flex flex-col gap-[10px]">
        {jours.map((j, n) => (
          <div key={j} className="rounded-[10px] border border-[#E4EBF1]">
            <p className="border-b border-[#F0F4F8] px-[12px] py-[7px] text-[13px] font-bold">
              Jour {n + 1} · {jourLong(j)}
            </p>
            {f.seances
              .filter((s) => s.jour === j)
              .map((s) => (
                <label key={s.id} className="flex cursor-pointer items-center gap-[10px] px-[12px] py-[8px] text-[13.5px]">
                  <input
                    type="checkbox"
                    checked={Boolean(s.faite)}
                    onChange={(e) => s.id && void agir(() => cocherSeance(s.id!, e.target.checked))}
                    className="h-[17px] w-[17px] accent-[#14805F]"
                  />
                  <span className="w-[46px] font-mono text-[12.5px] font-bold">{s.heure_debut}</span>
                  <span className={`rounded-[8px] px-[7px] py-[1px] text-[11.5px] font-bold ${s.type === "theorie" ? "bg-[#EEF4F9] text-[#3F5B76]" : "bg-[#E2F8EF] text-[#14805F]"}`}>
                    {s.type === "theorie" ? "Théorie" : "Pratique"}
                  </span>
                  <span className={`min-w-0 flex-1 truncate ${s.faite ? "text-[#9DB0C0] line-through" : ""}`}>{s.intitule ?? ""}</span>
                  {s.faite && <Check className="h-[15px] w-[15px] text-[#14805F]" />}
                </label>
              ))}
          </div>
        ))}
      </div>

      <div className="flex flex-wrap gap-[6px] pt-[18px]">
        {STATUTS_FORMATION.filter((s) => s.id !== f.statut && s.id !== "validee").map((s) => (
          <button key={s.id} type="button" onClick={() => void agir(() => modifierFormation(f.id, s.id))} className="h-[32px] rounded-[10px] border border-[#D8E5EE] px-[10px] text-[12px] font-bold text-[#5B7189]">
            Passer en « {s.libelle} »
          </button>
        ))}
        <button
          type="button"
          onClick={() => void agir(() => supprimerFormation(f.id)).then(onFermer)}
          className="ml-auto flex h-[32px] items-center gap-[5px] px-[6px] text-[12px] font-semibold text-[#9DB0C0] underline underline-offset-4"
        >
          <Trash2 className="h-[13px] w-[13px]" /> Supprimer
        </button>
      </div>
    </PanneauLateral>
  );
}
