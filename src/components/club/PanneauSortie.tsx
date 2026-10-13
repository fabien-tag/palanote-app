import { useCallback, useEffect, useState, type DragEvent } from "react";
import { useNavigate } from "@tanstack/react-router";
import { AlertTriangle, BadgeCheck, ExternalLink, FileSpreadsheet, FileText, Minus, Plus, QrCode, Ship, Star, X } from "lucide-react";
import { ImportTableur } from "@/components/club/ImportTableur";
import { IMPORT_SORTIE } from "@/components/club/importsClub";
import { SuiviPalanquees } from "@/components/club/SuiviPalanquees";
import { PasseportDp } from "@/components/club/PasseportDp";
import { alertesPasseport, passeportsSortie, type ResumePasseport } from "@/lib/passeport";
import { Avatar, detailErreur, MessageErreur, PastilleStatut } from "@/components/club/Ui";
import { ajouterPalanquee, definirGuide, detailSortie, heureCourte, placerParticipant, type DetailSortie, type Participant } from "@/lib/club";
import {
  definirSortiePrivilegies,
  MELANGES,
  optionsSortie,
  affecterEquipier,
  choisirBateau,
  enConflit,
  planningCentre,
  profondeurMaxNiveau,
  reserveLeJour,
  reserverMateriel,
  roleCourt,
  ROLES_EQUIPE,
  type Planning,
  type RoleEquipe,
} from "@/lib/planning";

// Panneau latéral d'une sortie, ouvert depuis le planning (version ordinateur) :
// palanquées en kanban (on glisse les plongeurs d'une colonne à l'autre),
// équipe, bateau et matériel de la sortie.
export function PanneauSortie({ id, onFermer, onChange }: { id: string; onFermer: () => void; onChange: () => void }) {
  const navigate = useNavigate();
  const [s, setS] = useState<DetailSortie | null>(null);
  const [jour, setJour] = useState<Planning | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);
  const [survol, setSurvol] = useState<string | null>(null);
  const [importer, setImporter] = useState(false);
  const [options, setOptions] = useState<{ reservee: boolean; melange: string | null } | null>(null);
  const [passeports, setPasseports] = useState<Record<string, ResumePasseport>>({});
  const [passeport, setPasseport] = useState<string | null>(null);

  const charger = useCallback(async () => {
    try {
      const d = await detailSortie(id);
      setS(d);
      void optionsSortie(id)
        .then(setOptions)
        .catch(() => setOptions(null)); // script des privilégiés pas encore lancé
      void passeportsSortie(id)
        .then((l) => setPasseports(Object.fromEntries(l.map((r) => [r.user_id, r]))))
        .catch(() => setPasseports({})); // script du passeport pas encore lancé
      if (d.centre.id) setJour(await planningCentre(d.centre.id, d.date, d.date));
    } catch (e) {
      console.error(e);
      setErreur(detailErreur(e, "La sortie n'a pas pu être chargée."));
    }
  }, [id]);

  useEffect(() => {
    setS(null);
    setJour(null);
    setErreur(null);
    void charger();
  }, [charger]);

  useEffect(() => {
    const k = (e: KeyboardEvent) => e.key === "Escape" && onFermer();
    window.addEventListener("keydown", k);
    return () => window.removeEventListener("keydown", k);
  }, [onFermer]);

  // Une action, puis on recharge le panneau et le calendrier
  const agir = async (f: () => Promise<unknown>) => {
    setErreur(null);
    try {
      await f();
    } catch (e) {
      console.error(e);
      setErreur(detailErreur(e, "L'action n'a pas pu être enregistrée."));
    }
    await charger();
    onChange();
  };

  const modifiable = s?.statut === "prevue" || s?.statut === "terminee";
  const sp = jour?.sorties.find((x) => x.id === id) ?? null;
  const profMax = s?.profondeur_prevue ?? null;

  const deposer = (palanquee: string | null) => (e: DragEvent) => {
    e.preventDefault();
    setSurvol(null);
    const pid = e.dataTransfer.getData("text/participant");
    if (!pid || !s) return;
    const p = s.participants.find((x) => x.participant_id === pid);
    if (!p || p.palanquee_id === palanquee) return;
    // Mise à jour immédiate, puis enregistrement
    setS({ ...s, participants: s.participants.map((x) => (x.participant_id === pid ? { ...x, palanquee_id: palanquee } : x)) });
    void agir(async () => {
      // Le guide qui quitte sa palanquée n'en est plus le guide
      const ancienne = s.palanquees.find((q) => q.id === p.palanquee_id);
      if (ancienne && p.id && ancienne.guide_id === p.id) await definirGuide(ancienne.id, null);
      await placerParticipant(pid, palanquee);
    });
  };

  const melange = options?.melange ?? null;
  const alertes = s
    ? s.participants
        .map((p) => ({ p, a: p.id ? alertesPasseport(passeports[p.id], melange, s.date) : [] }))
        .filter((x) => x.a.length > 0)
    : [];

  const colonnes: { id: string | null; titre: string; guide: string | null }[] = s
    ? [{ id: null, titre: "Non placés", guide: null }, ...s.palanquees.map((q) => ({ id: q.id, titre: `P${q.numero}`, guide: q.guide_id }))]
    : [];

  return (
    <div className="fixed inset-0 z-40 flex justify-end" role="dialog" aria-label="Sortie">
      <button type="button" aria-label="Fermer" onClick={onFermer} className="absolute inset-0 bg-[#0B2540]/30" />
      <div className="relative flex h-full w-full max-w-[720px] flex-col overflow-y-auto bg-[#F1F6FC] shadow-[-12px_0_40px_#0B254026]">
        <div className="sticky top-0 z-10 flex items-start gap-3 border-b border-[#DFEAF2] bg-white px-[24px] pb-[14px] pt-[18px]">
          <div className="min-w-0 flex-1">
            {s && (
              <>
                <p className="text-[12px] font-bold uppercase tracking-[.07em] text-[#1176A8]">
                  {s.date_texte}
                  {s.heure ? ` · ${heureCourte(s.heure)}` : ""}
                </p>
                <h2 className="truncate pt-[2px] text-[22px] font-bold leading-tight">{s.site}</h2>
                <p className="truncate text-[13px] text-[#5B7189]">
                  {[s.lieu, s.bateau, s.profondeur_prevue ? `${String(s.profondeur_prevue).replace(".0", "")} m prévus` : null, `DP ${s.dp.prenom}`]
                    .filter(Boolean)
                    .join(" · ")}
                </p>
              </>
            )}
          </div>
          {s && <PastilleStatut statut={s.statut} />}
          <button type="button" aria-label="Fermer" onClick={onFermer} className="flex h-9 w-9 shrink-0 items-center justify-center goutte bg-[#E3EDF6]">
            <X className="h-[18px] w-[18px]" />
          </button>
        </div>

        <div className="flex flex-col px-[24px] pb-[30px]">
          <MessageErreur texte={erreur} />
          {!s && !erreur && <p className="py-[40px] text-center text-[14px] text-[#5B7189]">Chargement…</p>}
          {s && (
            <>
              <div className="flex flex-wrap gap-[8px] pt-[14px]">
                {s.statut === "prevue" && (
                  <BoutonPetit onClick={() => navigate({ to: "/club/sortie", search: { id, qr: true } })}>
                    <QrCode className="h-[15px] w-[15px]" /> QR code
                  </BoutonPetit>
                )}
                <BoutonPetit onClick={() => navigate({ to: "/club/fiche-securite", search: { id } })}>
                  <FileText className="h-[15px] w-[15px]" /> Fiche de sécurité
                </BoutonPetit>
                <BoutonPetit onClick={() => navigate({ to: "/club/sortie", search: { id } })}>
                  <ExternalLink className="h-[15px] w-[15px]" /> {s.statut === "terminee" ? "Tamponner" : "Ouvrir la sortie"}
                </BoutonPetit>
              </div>

              {/* Accès et mélange : sortie réservée aux membres privilégiés */}
              {options && !s.entre_amis && (
                <Section titre="Accès et mélange">
                  <button
                    type="button"
                    disabled={!modifiable}
                    onClick={() => {
                      const o = { ...options, reservee: !options.reservee };
                      setOptions(o);
                      void agir(() => definirSortiePrivilegies(id, o.reservee, o.melange));
                    }}
                    className={`flex w-full items-center gap-[12px] border px-[14px] py-[11px] text-left ${options.reservee ? "border-[#F2D49A] bg-[#FFF8E8]" : "border-[#E4EBF1] bg-white"} rounded-[10px]`}
                  >
                    <Star className="h-[19px] w-[19px] shrink-0" fill={options.reservee ? "#E9A93A" : "none"} stroke={options.reservee ? "#E9A93A" : "#9DB0C0"} />
                    <span className="min-w-0 flex-1">
                      <span className="block text-[14px] font-bold">Réservée aux membres privilégiés</span>
                      <span className="block text-[12px] text-[#7D93A8]">
                        {options.reservee ? "Seuls les privilégiés peuvent s'inscrire avec le QR ou le lien" : "Ouverte à tous les plongeurs"}
                      </span>
                    </span>
                    <span className={`h-[24px] w-[42px] shrink-0 rounded-full p-[3px] transition-colors ${options.reservee ? "bg-[#E9A93A]" : "bg-[#D5E1EC]"}`}>
                      <span className={`block h-[18px] w-[18px] rounded-full bg-white transition-transform ${options.reservee ? "translate-x-[18px]" : ""}`} />
                    </span>
                  </button>
                  <div className="flex flex-wrap gap-[6px] pt-[10px]">
                    {MELANGES.map((g) => (
                      <button
                        key={g}
                        type="button"
                        disabled={!modifiable}
                        onClick={() => {
                          const o = { ...options, melange: options.melange === g ? null : g };
                          setOptions(o);
                          void agir(() => definirSortiePrivilegies(id, o.reservee, o.melange));
                        }}
                        className={`h-[32px] rounded-[10px] px-[11px] text-[12.5px] font-bold ${options.melange === g ? "bg-[#0F3D70] text-white" : "border border-[#D8E5EE] bg-white text-[#5B7189]"}`}
                      >
                        {g}
                      </button>
                    ))}
                  </div>
                </Section>
              )}

              {/* Palanquées */}
              <Section titre="Palanquées" aide={modifiable ? "glisse les plongeurs d'une colonne à l'autre" : undefined}>
                {alertes.length > 0 && (
                  <div className="mb-[10px] rounded-[10px] border border-[#FFD2C7] bg-[#FFF4F0] px-[12px] py-[9px] text-[12.5px] text-[#8A2A1A]">
                    <p className="flex items-center gap-[6px] font-bold">
                      <AlertTriangle className="h-[14px] w-[14px]" /> À vérifier avant de partir
                    </p>
                    {alertes.map(({ p, a }) => (
                      <button key={p.participant_id} type="button" onClick={() => p.id && setPasseport(p.id)} className="block pt-[3px] text-left underline-offset-2 hover:underline">
                        {p.prenom} : {a.join(", ")}
                      </button>
                    ))}
                  </div>
                )}
                <div className="-mx-[24px] flex gap-[10px] overflow-x-auto px-[24px] pb-[6px]">
                  {colonnes.map((c) => {
                    const membres = s.participants.filter((p) => p.palanquee_id === c.id);
                    const sansGuide = c.id !== null && membres.length > 0 && !c.guide;
                    const cle = c.id ?? "aucune";
                    if (c.id === null && membres.length === 0 && !modifiable) return null;
                    return (
                      <div
                        key={cle}
                        onDragOver={(e) => {
                          if (!modifiable) return;
                          e.preventDefault();
                          setSurvol(cle);
                        }}
                        onDragLeave={() => setSurvol((v) => (v === cle ? null : v))}
                        onDrop={deposer(c.id)}
                        className={`flex w-[172px] shrink-0 flex-col gap-[6px] galet-b border-2 p-[8px] transition-colors ${
                          survol === cle ? "border-[#3DEFBE] bg-[#E2F8EF]" : c.id === null ? "border-dashed border-[#D5E1EC] bg-white/50" : "border-transparent bg-[#E3EDF6]"
                        }`}
                      >
                        <div className="flex items-center justify-between px-[4px] pb-[2px]">
                          <span className="text-[13px] font-bold">{c.titre}</span>
                          <span className="text-[12px] font-semibold text-[#5B7189]">{membres.length}</span>
                        </div>
                        {sansGuide && (
                          <span className="flex items-center gap-[4px] px-[4px] text-[11px] font-bold text-[#D9573F]">
                            <AlertTriangle className="h-[12px] w-[12px]" /> Sans guide
                          </span>
                        )}
                        {membres.map((p) => (
                          <CartePlongeur
                            key={p.participant_id}
                            p={p}
                            guide={c.guide !== null && p.id === c.guide}
                            profMax={profMax}
                            resume={p.id ? passeports[p.id] : undefined}
                            alertes={p.id ? alertesPasseport(passeports[p.id], melange, s.date) : []}
                            onPasseport={p.id && passeports[p.id] ? () => setPasseport(p.id) : undefined}
                            deplacable={modifiable}
                            peutGuider={modifiable && c.id !== null && Boolean(p.id)}
                            onGuide={() => c.id && void agir(() => definirGuide(c.id!, c.guide === p.id ? null : p.id))}
                          />
                        ))}
                        {membres.length === 0 && <span className="px-[4px] py-[10px] text-center text-[12px] text-[#9DB0C0]">{modifiable ? "Dépose ici" : "—"}</span>}
                      </div>
                    );
                  })}
                  {modifiable && (
                    <button
                      type="button"
                      onClick={() => void agir(() => ajouterPalanquee(id))}
                      className="flex w-[120px] shrink-0 flex-col items-center justify-center gap-[4px] galet-b border-2 border-dashed border-[#B5D9EC] text-[13px] font-bold text-[#1176A8]"
                    >
                      <Plus className="h-[18px] w-[18px]" /> Palanquée
                    </button>
                  )}
                </div>
                {(s.statut === "prevue" || s.statut === "terminee") && (
                  <SuiviPalanquees
                    sortie={id}
                    effectifs={Object.fromEntries(s.palanquees.map((q) => [q.id, s.participants.filter((p) => p.palanquee_id === q.id).length]))}
                    dureeDefaut={s.duree_min}
                  />
                )}
                {s.participants.length === 0 && (
                  <p className="pt-[6px] text-[13px] text-[#5B7189]">Personne n'est encore inscrit : montre le QR code ou ouvre la sortie pour ajouter des plongeurs.</p>
                )}
                {s.statut === "prevue" && (
                  <button type="button" onClick={() => setImporter(true)} className="mt-[8px] flex items-center gap-[6px] text-[12.5px] font-bold text-[#14805F]">
                    <FileSpreadsheet className="h-[15px] w-[15px]" /> Importer une liste de plongeurs (Excel)
                  </button>
                )}
              </Section>

              {/* Bateau */}
              {jour && jour.materiel.some((m) => m.type === "bateau") && (
                <Section titre="Bateau">
                  <div className="flex flex-wrap gap-[8px]">
                    {jour.materiel
                      .filter((m) => m.type === "bateau")
                      .map((b) => {
                        const choisi = sp?.bateau_id === b.id;
                        const pris = jour.sorties.find((x) => x.id !== id && x.bateau_id === b.id && x.statut !== "annulee" && enConflit(x, { date: s.date, heure: s.heure }));
                        return (
                          <button
                            key={b.id}
                            type="button"
                            disabled={!modifiable}
                            onClick={() => void agir(() => choisirBateau(id, choisi ? null : b.id))}
                            className={`flex items-center gap-[8px] galet-petit border px-[12px] py-[9px] text-left text-[13px] ${
                              choisi ? "border-[#0F3D70] bg-[#0F3D70] text-white" : "border-[#D8E5EE] bg-white"
                            }`}
                          >
                            <Ship className="h-[16px] w-[16px] shrink-0" />
                            <span>
                              <span className="block font-bold">{b.libelle}</span>
                              <span className={`block text-[11.5px] ${choisi ? "text-white/80" : pris ? "font-bold text-[#D9573F]" : "text-[#5B7189]"}`}>
                                {pris ? `Déjà pris : ${pris.site} ${heureCourte(pris.heure)}` : `${b.places ?? "?"} places`}
                              </span>
                            </span>
                          </button>
                        );
                      })}
                  </div>
                  {sp?.places && (
                    <Jauge valeur={sp.nb_inscrits + sp.nb_prevus} total={sp.places} libelle={`${sp.nb_inscrits + sp.nb_prevus} plongeurs pour ${sp.places} places`} />
                  )}
                </Section>
              )}

              {/* Équipe */}
              {jour && (
                <Section titre="Équipe" aide={jour.equipe.length === 0 ? undefined : "qui encadre cette sortie"}>
                  {jour.equipe.length === 0 ? (
                    <BoutonPetit onClick={() => navigate({ to: "/club/equipe" })}>
                      <Plus className="h-[15px] w-[15px]" /> Ajouter ton équipe
                    </BoutonPetit>
                  ) : (
                    <div className="flex flex-col gap-[6px]">
                      {jour.equipe.map((e) => {
                        const affecte = sp?.equipe.find((x) => x.id === e.id);
                        const estDpSortie = e.user_id !== null && e.user_id === s.dp.id;
                        const ailleurs = jour.sorties.find(
                          (x) =>
                            x.id !== id &&
                            x.statut !== "annulee" &&
                            (x.equipe.some((y) => y.id === e.id) || (e.user_id !== null && x.dp_id === e.user_id)) &&
                            enConflit(x, { date: s.date, heure: s.heure }),
                        );
                        return (
                          <div key={e.id} className="flex items-center gap-[10px] galet-petit bg-white px-[12px] py-[8px]">
                            <Avatar id={e.user_id} prenom={e.nom} taille={32} />
                            <span className="min-w-0 flex-1">
                              <span className="block truncate text-[14px] font-bold">
                                {e.nom}
                                {e.niveau ? <span className="font-semibold text-[#5B7189]"> · {e.niveau}</span> : null}
                              </span>
                              <span className={`block truncate text-[11.5px] ${ailleurs && (affecte || estDpSortie) ? "font-bold text-[#D9573F]" : "text-[#7D93A8]"}`}>
                                {ailleurs ? `Aussi sur ${ailleurs.site} à ${heureCourte(ailleurs.heure) || "?"}` : roleCourt(e.role)}
                              </span>
                            </span>
                            {estDpSortie ? (
                              <span className="rounded-[10px] bg-[#0F3D70] px-[9px] py-[4px] text-[12px] font-bold text-white">DP de la sortie</span>
                            ) : (
                              <select
                                aria-label={`Rôle de ${e.nom}`}
                                value={affecte?.role ?? ""}
                                disabled={!modifiable}
                                onChange={(ev) => void agir(() => affecterEquipier(id, e.id, (ev.target.value || null) as RoleEquipe | null))}
                                className={`h-[34px] rounded-[10px] border px-[8px] text-[13px] font-semibold outline-none ${
                                  affecte ? "border-[#3DEFBE] bg-[#E2F8EF] text-[#0B3B63]" : "border-[#D8E5EE] bg-white text-[#7D93A8]"
                                }`}
                              >
                                <option value="">Pas sur cette sortie</option>
                                {ROLES_EQUIPE.map((r) => (
                                  <option key={r.id} value={r.id}>
                                    {r.libelle}
                                  </option>
                                ))}
                              </select>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </Section>
              )}

              {/* Matériel */}
              {jour && (
                <Section titre="Matériel" aide={jour.materiel.some((m) => m.type !== "bateau") ? "réservé pour cette sortie" : undefined}>
                  {!jour.materiel.some((m) => m.type !== "bateau") ? (
                    <BoutonPetit onClick={() => navigate({ to: "/club/materiel" })}>
                      <Plus className="h-[15px] w-[15px]" /> Ajouter ton matériel
                    </BoutonPetit>
                  ) : (
                    <div className="grid grid-cols-1 gap-[6px] sm:grid-cols-2">
                      {jour.materiel
                        .filter((m) => m.type !== "bateau")
                        .map((m) => {
                          const ici = sp?.materiel.find((x) => x.materiel_id === m.id)?.quantite ?? 0;
                          const autres = reserveLeJour(jour.sorties, s.date, m.id, id);
                          const libre = m.quantite - autres;
                          const trop = ici > libre;
                          return (
                            <div key={m.id} className={`flex items-center gap-[8px] galet-petit border bg-white px-[12px] py-[8px] ${trop ? "border-[#FF8A75]" : "border-transparent"}`}>
                              <span className="min-w-0 flex-1">
                                <span className="block truncate text-[13.5px] font-bold">{m.libelle}</span>
                                <span className={`block text-[11.5px] ${trop ? "font-bold text-[#D9573F]" : "text-[#7D93A8]"}`}>
                                  {trop ? `Il n'en reste que ${Math.max(0, libre)} ce jour-là` : `${Math.max(0, libre - ici)} libres sur ${m.quantite} ce jour-là`}
                                </span>
                              </span>
                              <button
                                type="button"
                                aria-label={`Un ${m.libelle} de moins`}
                                disabled={!modifiable || ici === 0}
                                onClick={() => void agir(() => reserverMateriel(id, m.id, ici - 1))}
                                className="flex h-[28px] w-[28px] items-center justify-center goutte bg-[#E3EDF6] disabled:opacity-40"
                              >
                                <Minus className="h-[14px] w-[14px]" />
                              </button>
                              <span className="w-[26px] text-center text-[15px] font-bold">{ici}</span>
                              <button
                                type="button"
                                aria-label={`Un ${m.libelle} de plus`}
                                disabled={!modifiable}
                                onClick={() => void agir(() => reserverMateriel(id, m.id, ici + 1))}
                                className="flex h-[28px] w-[28px] items-center justify-center goutte bg-[#0F3D70] text-white disabled:opacity-40"
                              >
                                <Plus className="h-[14px] w-[14px]" />
                              </button>
                            </div>
                          );
                        })}
                    </div>
                  )}
                  {modifiable && s.participants.length > 0 && jour.materiel.some((m) => m.type === "bloc") && (
                    <p className="pt-[8px] text-[12px] text-[#7D93A8]">
                      Repère : {s.participants.length} plongeur{s.participants.length > 1 ? "s" : ""} inscrit{s.participants.length > 1 ? "s" : ""}, soit {s.participants.length} bloc
                      {s.participants.length > 1 ? "s" : ""} au minimum.
                    </p>
                  )}
                </Section>
              )}
            </>
          )}
        </div>
      </div>
      {passeport && <PasseportDp userId={passeport} onFermer={() => setPasseport(null)} onChange={() => void charger()} />}
      {importer && (
        <ImportTableur
          titre={IMPORT_SORTIE.titre}
          description={IMPORT_SORTIE.description}
          champs={IMPORT_SORTIE.champs}
          modele={IMPORT_SORTIE.modele}
          transformer={IMPORT_SORTIE.transformer}
          onImporter={(lignes) => IMPORT_SORTIE.importer(id, lignes)}
          onFermer={(fait) => {
            setImporter(false);
            if (fait) {
              void charger();
              onChange();
            }
          }}
        />
      )}
    </div>
  );
}

function CartePlongeur({
  p,
  guide,
  profMax,
  resume,
  alertes,
  onPasseport,
  deplacable,
  peutGuider,
  onGuide,
}: {
  p: Participant;
  guide: boolean;
  profMax: number | null;
  resume?: ResumePasseport | undefined;
  alertes: string[];
  onPasseport?: (() => void) | undefined;
  deplacable: boolean;
  peutGuider: boolean;
  onGuide: () => void;
}) {
  const max = profondeurMaxNiveau(p.niveau);
  const tropProfond = profMax !== null && max !== null && profMax > max;
  return (
    <div
      draggable={deplacable}
      onDragStart={(e) => {
        e.dataTransfer.setData("text/participant", p.participant_id);
        e.dataTransfer.effectAllowed = "move";
      }}
      className={`flex items-center gap-[7px] galet-petit border bg-white px-[8px] py-[7px] shadow-[0_2px_6px_#123A630A] ${deplacable ? "cursor-grab active:cursor-grabbing" : ""} ${
        tropProfond || alertes.length ? "border-[#FF8A75]" : "border-transparent"
      }`}
      title={[tropProfond ? `${p.niveau} : ${max} m maximum en principe, ${profMax} m prévus` : null, ...alertes].filter(Boolean).join(" · ") || undefined}
    >
      <Avatar id={p.id} prenom={p.prenom} taille={26} prevu={p.prevu} />
      <span className="min-w-0 flex-1">
        {onPasseport ? (
          <button type="button" onClick={onPasseport} title="Voir son passeport" className="flex max-w-full items-center gap-[3px] text-left">
            <span className="truncate text-[13px] font-bold leading-tight underline decoration-[#B5D9EC] underline-offset-2">{p.prenom}</span>
            {resume && resume.verifies > 0 && <BadgeCheck className="h-[12px] w-[12px] shrink-0 text-[#14805F]" aria-label="Carte vérifiée" />}
          </button>
        ) : (
          <span className="block truncate text-[13px] font-bold leading-tight">{p.prenom}</span>
        )}
        <span className={`block truncate text-[11px] leading-tight ${tropProfond || alertes.length ? "font-bold text-[#D9573F]" : "text-[#7D93A8]"}`}>
          {alertes.length
            ? alertes[0]
            : tropProfond
              ? `${p.niveau} · ${max} m max`
              : p.prevu
                ? "pas encore inscrit"
                : [p.niveau ?? "niveau ?", resume?.trimix ? "Trimix" : resume?.nitrox ? "Nitrox" : null].filter(Boolean).join(" · ")}
        </span>
      </span>
      {peutGuider || guide ? (
        <button
          type="button"
          onClick={onGuide}
          disabled={!peutGuider}
          aria-label={guide ? `${p.prenom} n'est plus guide` : `${p.prenom} guide la palanquée`}
          title={guide ? "Guide de palanquée" : "Désigner comme guide"}
          className={`flex h-[24px] shrink-0 items-center justify-center rounded-[8px] px-[5px] text-[10.5px] font-bold ${
            guide ? "bg-[#0F3D70] text-white" : "text-[#B5C4D1] hover:text-[#1176A8]"
          }`}
        >
          {guide ? "GP" : <Star className="h-[14px] w-[14px]" />}
        </button>
      ) : null}
    </div>
  );
}

function Section({ titre, aide, children }: { titre: string; aide?: string | undefined; children: React.ReactNode }) {
  return (
    <section className="pt-[20px]">
      <div className="flex items-baseline justify-between gap-2 pb-[9px]">
        <h3 className="text-[13px] font-bold uppercase tracking-[.08em] text-[#5B7189]">{titre}</h3>
        {aide && <span className="text-[12px] text-[#9DB0C0]">{aide}</span>}
      </div>
      {children}
    </section>
  );
}

function BoutonPetit({ onClick, children }: { onClick: () => void; children: React.ReactNode }) {
  return (
    <button type="button" onClick={onClick} className="flex h-[34px] items-center gap-[6px] rounded-[17px] border border-[#D8E5EE] bg-white px-[12px] text-[12.5px] font-bold text-[#1176A8]">
      {children}
    </button>
  );
}

export function Jauge({ valeur, total, libelle }: { valeur: number; total: number; libelle?: string }) {
  const pct = Math.min(100, (valeur / Math.max(1, total)) * 100);
  const plein = valeur > total;
  return (
    <div className="pt-[8px]">
      <div className="h-[6px] overflow-hidden rounded-[3px] bg-[#E3EDF6]">
        <div className={`h-full rounded-[3px] ${plein ? "bg-[#FF8A75]" : pct > 85 ? "bg-[#F5B544]" : "bg-[#3DEFBE]"}`} style={{ width: `${pct}%` }} />
      </div>
      {libelle && <p className={`pt-[4px] text-[11.5px] ${plein ? "font-bold text-[#D9573F]" : "text-[#7D93A8]"}`}>{libelle}</p>}
    </div>
  );
}
