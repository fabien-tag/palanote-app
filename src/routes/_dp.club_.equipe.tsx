import { useCallback, useEffect, useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { ChevronLeft, ChevronRight, FileSpreadsheet, Pencil, Phone, Plus, UserCheck } from "lucide-react";
import { useConnexionRequise } from "@/components/numerisation/Ui";
import { NavigationDpMobile } from "@/components/club/NavigationDp";
import { Avatar, ChampTexte, Feuille, MessageErreur, PageClub, Titre } from "@/components/club/Ui";
import { messagePlanning, useCentre } from "@/components/club/useCentre";
import { ImportTableur } from "@/components/club/ImportTableur";
import { IMPORT_EQUIPE } from "@/components/club/importsClub";
import { heureCourte } from "@/lib/club";
import {
  ajouterJours,
  aujourdhui,
  depuisIso,
  enConflit,
  enregistrerEquipier,
  equipeCentre,
  libelleRole,
  lundi,
  planningCentre,
  roleCourt,
  ROLES_EQUIPE,
  type Equipier,
  type RoleEquipe,
  type SortiePlanning,
} from "@/lib/planning";
import { seancesCentre, type SeancePlanning } from "@/lib/formations";

// Équipe du centre : DP, guides, pilotes, gonfleurs (avec ou sans compte Palanote),
// et qui encadre quoi dans la semaine.
export const Route = createFileRoute("/_dp/club_/equipe")({
  // Depuis la recherche : ouvre directement la fiche d'un élément
  validateSearch: (search: Record<string, unknown>): { ouvrir?: string } => (typeof search["ouvrir"] === "string" ? { ouvrir: search["ouvrir"] } : {}),
  head: () => ({ meta: [{ title: "Palanote — Équipe" }] }),
  component: PageEquipe,
});

const JOURS = ["Lun", "Mar", "Mer", "Jeu", "Ven", "Sam", "Dim"];

type Brouillon = { id?: string; nom: string; role: RoleEquipe; niveau: string; telephone: string; actif: boolean; compte: boolean };
const VIDE: Brouillon = { nom: "", role: "guide", niveau: "", telephone: "", actif: true, compte: false };

function PageEquipe() {
  const navigate = useNavigate();
  const { pret, ecran } = useConnexionRequise();
  const { centre, erreur: erreurCentre } = useCentre(pret);
  const [equipe, setEquipe] = useState<Equipier[] | null>(null);
  const [sorties, setSorties] = useState<SortiePlanning[]>([]);
  const [seances, setSeances] = useState<SeancePlanning[]>([]); // cours des formations (palanote-formations.sql)
  const [semaine, setSemaine] = useState(() => lundi(aujourdhui()));
  const [fiche, setFiche] = useState<Brouillon | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);
  const [importer, setImporter] = useState(false);

  const charger = useCallback(async () => {
    if (!centre) return;
    try {
      const [e, p] = await Promise.all([equipeCentre(centre.id), planningCentre(centre.id, semaine, ajouterJours(semaine, 6))]);
      setEquipe(e);
      setSorties(p.sorties.filter((s) => s.statut !== "annulee"));
      setErreur(null);
      void seancesCentre(centre.id, semaine, ajouterJours(semaine, 6))
        .then(setSeances)
        .catch(() => setSeances([]));
    } catch (e) {
      console.error(e);
      setEquipe([]);
      setErreur(messagePlanning(e, "L'équipe n'a pas pu être chargée."));
    }
  }, [centre, semaine]);

  useEffect(() => {
    void charger();
  }, [charger]);

  // Fiche demandée par la recherche
  const { ouvrir } = Route.useSearch();
  useEffect(() => {
    if (!ouvrir || !equipe) return;
    const e = equipe.find((x) => x.id === ouvrir);
    if (e) setFiche({ id: e.id, nom: e.nom, role: e.role, niveau: e.niveau ?? "", telephone: e.telephone ?? "", actif: true, compte: Boolean(e.user_id) });
    navigate({ to: ".", search: {}, replace: true });
  }, [ouvrir, equipe]); // eslint-disable-line react-hooks/exhaustive-deps

  if (ecran) return ecran;

  const jours = Array.from({ length: 7 }, (_, i) => ajouterJours(semaine, i));
  // Ce que fait un équipier un jour donné (affecté, ou DP de la sortie)
  const missions = (e: Equipier, d: string) =>
    sorties
      .filter((s) => s.date === d)
      .map((s) => {
        const a = s.equipe.find((x) => x.id === e.id);
        const role = a?.role ?? (e.user_id && s.dp_id === e.user_id ? "dp" : null);
        return role ? { s, role } : null;
      })
      .filter((x): x is { s: SortiePlanning; role: RoleEquipe } => x !== null);

  const actifs = (equipe ?? []).filter((e) => e.actif);
  const anciens = (equipe ?? []).filter((e) => !e.actif);
  const parRole = ROLES_EQUIPE.map((r) => ({ ...r, nb: actifs.filter((e) => e.role === r.id).length })).filter((r) => r.nb > 0);
  const a = depuisIso(semaine);
  const b = depuisIso(ajouterJours(semaine, 6));

  const enregistrer = async (f: Brouillon) => {
    if (!centre) return;
    try {
      await enregistrerEquipier(centre.id, { id: f.id ?? null, nom: f.nom, role: f.role, niveau: f.niveau, telephone: f.telephone, actif: f.actif });
      setFiche(null);
      await charger();
    } catch (e) {
      setErreur(messagePlanning(e, "L'équipier n'a pas pu être enregistré."));
    }
  };

  return (
    <PageClub
      titre="Équipe"
      large
      navigation={<NavigationDpMobile />}
     
      droite={
        centre ? (
          <span className="flex items-center gap-[8px]">
          <button
            type="button"
            onClick={() => setImporter(true)}
            className="flex h-[42px] items-center gap-2 rounded-[12px] border border-[#D8E5EE] bg-white px-[12px] text-[13px] font-bold text-[#14805F] lg:px-[16px]"
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
      {centre && equipe && (
        <>
          <p className="pt-[4px] text-[13.5px] text-[#5B7189]">
            {centre.nom} · {actifs.length} personne{actifs.length > 1 ? "s" : ""}
            {parRole.length > 0 && ` : ${parRole.map((r) => `${r.nb} ${r.court}`).join(", ")}`}
          </p>

          <div className="flex flex-wrap items-center gap-[8px] pt-[16px]">
            <h2 className="text-[13px] font-bold uppercase tracking-[.08em] text-[#5B7189]">Qui encadre quoi</h2>
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

          {actifs.length === 0 ? (
            <p className="mt-[10px] galet-b border border-dashed border-[#D5E1EC] bg-white/60 px-[15px] py-[16px] text-[13.5px] text-[#5B7189]">
              Ajoute tes guides de palanquée et ton pilote : tu pourras les affecter aux sorties depuis le planning.
            </p>
          ) : (
            <div className="mt-[10px] overflow-x-auto galet-b border border-[#E4EBF1] bg-white">
              <table className="w-full min-w-[760px] border-collapse text-[13px]">
                <thead>
                  <tr className="text-left text-[11px] uppercase tracking-[.06em] text-[#7D93A8]">
                    <th className="px-[14px] py-[10px] font-bold">Équipier</th>
                    <th className="px-[6px] font-bold">Rôle</th>
                    {jours.map((d, i) => (
                      <th key={d} className={`px-[4px] text-center font-bold ${d === aujourdhui() ? "text-[#1176A8]" : ""}`}>
                        {JOURS[i]} {depuisIso(d).getDate()}
                      </th>
                    ))}
                    <th className="w-[44px]" />
                  </tr>
                </thead>
                <tbody>
                  {actifs.map((e) => (
                    <tr key={e.id} className="border-t border-[#EEF3F8]">
                      <td className="px-[14px] py-[9px]">
                        <span className="flex items-center gap-[10px]">
                          <Avatar id={e.user_id} prenom={e.nom} taille={32} />
                          <span className="min-w-0">
                            <span className="flex items-center gap-[5px] truncate font-bold">
                              {e.nom}
                              {e.user_id && <UserCheck className="h-[13px] w-[13px] text-[#14805F]" aria-label="Sur Palanote" />}
                            </span>
                            <span className="flex items-center gap-[6px] text-[11.5px] text-[#7D93A8]">
                              {e.niveau ?? "—"}
                              {e.telephone && (
                                <a href={`tel:${e.telephone}`} className="flex items-center gap-[3px] text-[#1176A8]">
                                  <Phone className="h-[11px] w-[11px]" /> {e.telephone}
                                </a>
                              )}
                            </span>
                          </span>
                        </span>
                      </td>
                      <td className="px-[6px]">
                        <span className="rounded-[8px] bg-[#E3EDF6] px-[7px] py-[2px] text-[11.5px] font-bold text-[#3F5B76]">{roleCourt(e.role)}</span>
                      </td>
                      {jours.map((d) => {
                        const m = missions(e, d);
                        return (
                          <td key={d} className="px-[3px] py-[6px] align-top">
                            {seances
                              .filter((x) => x.jour === d && x.moniteur_id === e.id)
                              .map((x) => (
                                <button
                                  key={x.id}
                                  type="button"
                                  onClick={() => navigate({ to: "/club/formations" })}
                                  title={`Formation ${x.code} · ${x.eleve} · ${x.type === "theorie" ? "théorie" : "pratique"}`}
                                  className={`mb-[3px] block w-full truncate rounded-[7px] px-[5px] py-[2px] text-left text-[10.5px] font-bold ${x.type === "theorie" ? "bg-[#EEE8FB] text-[#5B3FA8]" : "bg-[#E3F2FB] text-[#1176A8]"}`}
                                >
                                  {x.heure_debut.replace(":", "h")} {x.code}
                                </button>
                              ))}
                            {m.map(({ s, role }) => (
                              <button
                                key={s.id}
                                type="button"
                                onClick={() => navigate({ to: "/club/planning", search: { semaine: d, sortie: s.id } })}
                                title={`${s.site} · ${libelleRole(role)}`}
                                className={`mb-[3px] block w-full truncate rounded-[7px] px-[5px] py-[2px] text-left text-[10.5px] font-bold ${
                                  m.some((x) => x.s.id !== s.id && enConflit(x.s, s)) ? "bg-[#FFE9E2] text-[#D9573F]" : "bg-[#D5FAF0] text-[#0B3B63]"
                                }`}
                              >
                                {heureCourte(s.heure)} {roleCourt(role)}
                              </button>
                            ))}
                          </td>
                        );
                      })}
                      <td className="pr-[10px] text-right">
                        <button
                          type="button"
                          aria-label={`Modifier ${e.nom}`}
                          onClick={() => setFiche({ id: e.id, nom: e.nom, role: e.role, niveau: e.niveau ?? "", telephone: e.telephone ?? "", actif: true, compte: Boolean(e.user_id) })}
                          className="flex h-[30px] w-[30px] items-center justify-center goutte text-[#7D93A8] hover:bg-[#F1F6FC]"
                        >
                          <Pencil className="h-[14px] w-[14px]" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <p className="pt-[8px] text-[12px] text-[#9DB0C0]">Un clic sur une case ouvre la sortie dans le planning. En corail : deux sorties à moins de 3 h d'écart.</p>

          {anciens.length > 0 && (
            <>
              <Titre>Plus dans l'équipe</Titre>
              <div className="flex flex-wrap gap-[8px]">
                {anciens.map((e) => (
                  <button
                    key={e.id}
                    type="button"
                    onClick={() => void enregistrer({ id: e.id, nom: e.nom, role: e.role, niveau: e.niveau ?? "", telephone: e.telephone ?? "", actif: true, compte: false })}
                    className="rounded-[16px] border border-[#D8E5EE] bg-white px-[12px] py-[6px] text-[12.5px] font-semibold text-[#5B7189]"
                  >
                    {e.nom} · <span className="text-[#1176A8]">Réintégrer</span>
                  </button>
                ))}
              </div>
            </>
          )}
        </>
      )}

      {importer && centre && (
        <ImportTableur
          titre={IMPORT_EQUIPE.titre}
          description={IMPORT_EQUIPE.description}
          champs={IMPORT_EQUIPE.champs}
          modele={IMPORT_EQUIPE.modele}
          transformer={IMPORT_EQUIPE.transformer}
          onImporter={(lignes) => IMPORT_EQUIPE.importer(centre.id, lignes)}
          onFermer={(fait) => {
            setImporter(false);
            if (fait) void charger();
          }}
        />
      )}

      {fiche && (
        <Feuille titre={fiche.id ? `Modifier ${fiche.nom}` : "Ajouter un équipier"} onFermer={() => setFiche(null)}>
          <div className="flex flex-col gap-[12px]">
            <ChampTexte label="Prénom et nom" value={fiche.nom} disabled={fiche.compte} onChange={(e) => setFiche({ ...fiche, nom: e.target.value })} placeholder="Sophie Martin" />
            <div>
              <span className="block pb-[7px] text-[13px] font-semibold text-[#5B7189]">Rôle habituel</span>
              <div className="flex flex-wrap gap-[6px]">
                {ROLES_EQUIPE.map((r) => (
                  <button
                    key={r.id}
                    type="button"
                    onClick={() => setFiche({ ...fiche, role: r.id })}
                    className={`h-[34px] rounded-[17px] px-[12px] text-[12.5px] font-bold ${fiche.role === r.id ? "bg-[#0F3D70] text-white" : "border border-[#D8E5EE] text-[#5B7189]"}`}
                  >
                    {r.libelle}
                  </button>
                ))}
              </div>
            </div>
            <div className="grid grid-cols-2 gap-[10px]">
              <ChampTexte label="Niveau" value={fiche.niveau} onChange={(e) => setFiche({ ...fiche, niveau: e.target.value })} placeholder="E2, N4, permis côtier…" />
              <ChampTexte label="Téléphone" type="tel" value={fiche.telephone} onChange={(e) => setFiche({ ...fiche, telephone: e.target.value })} placeholder="06…" />
            </div>
            {fiche.compte && <p className="text-[12px] text-[#7D93A8]">Son prénom vient de son compte Palanote.</p>}
          </div>
          <button
            type="button"
            disabled={!fiche.nom.trim()}
            onClick={() => void enregistrer(fiche)}
            className="mt-[18px] flex h-14 w-full items-center justify-center galet-moyen bg-[#3DEFBE] text-[14px] font-bold text-[#0B3B63] disabled:opacity-50"
          >
            {fiche.id ? "ENREGISTRER" : "AJOUTER À L'ÉQUIPE"}
          </button>
          {fiche.id && (
            <button
              type="button"
              onClick={() => void enregistrer({ ...fiche, actif: false })}
              className="mx-auto mt-[14px] block text-[13px] font-semibold text-[#9DB0C0] underline underline-offset-4"
            >
              Retirer de l'équipe
            </button>
          )}
        </Feuille>
      )}
    </PageClub>
  );
}
