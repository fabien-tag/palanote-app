import { useCallback, useEffect, useMemo, useState } from "react";
import { CheckCircle2, ImagePlus, Play, Plus, Trash2, XCircle } from "lucide-react";
import { carte } from "@/components/admin/Bento";
import { SuiviProduction } from "@/components/admin/SuiviAgent";
import {
  ajouterCas,
  CHAMPS_EVAL,
  chargerBanc,
  evaluerCas,
  nouveauRun,
  resume,
  retirerCas,
  urlPhotoCas,
  type Attendu,
  type CasEval,
  type ResultatEval,
  type RunEval,
  type TypeCas,
} from "@/lib/evalAgent";

// Section « Agent IA » du tableau de bord : le banc d'essai de l'agent de lecture.
// L'eval set (règle 60-20-20), puis la même évaluation en lecture directe et avec l'agent.

const champ = "w-full rounded-[12px] border border-[#DCE7F0] bg-white px-[12px] text-[14px] text-[#123A63] outline-none focus:border-[#57D4F5]";
const TYPES: { id: TypeCas; label: string; aide: string }[] = [
  { id: "nominal", label: "Nominal", aide: "6 cas : pages normales" },
  { id: "bordure", label: "En bordure", aide: "2 cas : écriture difficile, 2 plongées par page…" },
  { id: "hostile", label: "Hostile", aide: "2 cas : photo floue, page qui n'est pas un carnet" },
];

export function SectionAgent() {
  const [donnees, setDonnees] = useState<{ cas: CasEval[]; runs: RunEval[]; resultats: ResultatEval[] } | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);
  const [ajout, setAjout] = useState(false);
  const [enCours, setEnCours] = useState<{ mode: "direct" | "agent"; fait: number; total: number } | null>(null);
  const [detail, setDetail] = useState<{ cas: CasEval; r: ResultatEval } | null>(null);

  const charger = useCallback(async () => {
    try {
      setDonnees(await chargerBanc());
      setErreur(null);
    } catch (e) {
      console.error(e);
      setErreur("Le banc d'essai n'a pas pu être chargé. As-tu lancé le script palanote-eval-agent.sql ?");
    }
  }, []);
  useEffect(() => void charger(), [charger]);

  // La dernière évaluation de chaque mode
  const derniers = useMemo(() => {
    const d = donnees;
    if (!d) return { direct: null, agent: null } as Record<"direct" | "agent", { run: RunEval; res: ResultatEval[] } | null>;
    const pour = (mode: "direct" | "agent") => {
      const run = d.runs.find((r) => r.mode === mode && d.resultats.some((x) => x.run_id === r.id));
      return run ? { run, res: d.resultats.filter((x) => x.run_id === run.id) } : null;
    };
    return { direct: pour("direct"), agent: pour("agent") };
  }, [donnees]);

  const lancer = async (mode: "direct" | "agent") => {
    if (!donnees || donnees.cas.length === 0) return;
    setErreur(null);
    try {
      const run = await nouveauRun(mode);
      setEnCours({ mode, fait: 0, total: donnees.cas.length });
      for (const [i, c] of donnees.cas.entries()) {
        try {
          await evaluerCas(run.id, c.id, mode);
        } catch (e) {
          setErreur(`« ${c.titre} » : ${(e as Error).message}`);
        }
        setEnCours({ mode, fait: i + 1, total: donnees.cas.length });
      }
      await charger();
    } catch (e) {
      setErreur((e as Error).message);
    } finally {
      setEnCours(null);
    }
  };

  if (!donnees) return erreur ? <p className="rounded-[16px] bg-[#FFECE8] p-[14px] text-[13.5px] text-[#8A2A1A]">{erreur}</p> : null;

  const repartition = TYPES.map((t) => ({ ...t, n: donnees.cas.filter((c) => c.type === t.id).length }));

  return (
    <div className="flex flex-col gap-[18px]">
      <SuiviProduction />
      <div className={`${carte} p-[20px]`}>
        <div className="flex flex-wrap items-start gap-[14px]">
          <div className="min-w-0 flex-1">
            <h2 className="text-[19px] font-bold">Banc d'essai de l'agent de lecture</h2>
            <p className="max-w-[70ch] pt-[4px] text-[13.5px] leading-normal text-[#5B7189]">
              Des pages de carnet avec la bonne réponse. Chaque évaluation relit toutes les pages et note chaque cas : réussi s'il trouve le bon nombre de plongées, n'invente
              rien et ne donne aucune valeur fausse comme « sûre ».
            </p>
            <p className="flex flex-wrap gap-[8px] pt-[10px] text-[12.5px]">
              {repartition.map((t) => (
                <span key={t.id} className="rounded-[8px] bg-[#F1F6FC] px-[8px] py-[4px] font-semibold text-[#3F5B76]">
                  {t.label} : {t.n}
                </span>
              ))}
              <span className="px-[4px] py-[4px] text-[#9DB0C0]">Objectif 60-20-20 : 6, 2 et 2 cas</span>
            </p>
          </div>
          <div className="flex flex-wrap gap-[8px]">
            <button
              type="button"
              disabled={!!enCours || donnees.cas.length === 0}
              onClick={() => void lancer("direct")}
              className="flex h-[42px] items-center gap-[7px] rounded-[12px] border border-[#DCE7F0] bg-white px-[14px] text-[13px] font-bold disabled:opacity-40"
            >
              <Play className="h-[15px] w-[15px]" aria-hidden="true" /> Lecture directe
            </button>
            <button
              type="button"
              disabled={!!enCours || donnees.cas.length === 0}
              onClick={() => void lancer("agent")}
              className="flex h-[42px] items-center gap-[7px] rounded-[12px] bg-[#3DEFBE] px-[14px] text-[13px] font-bold text-[#0B3B63] disabled:opacity-40"
            >
              <Play className="h-[15px] w-[15px]" aria-hidden="true" /> Avec l'agent
            </button>
          </div>
        </div>
        {enCours && (
          <div className="pt-[14px]">
            <p className="pb-[6px] text-[13px] font-semibold">
              Évaluation {enCours.mode === "agent" ? "avec l'agent" : "en lecture directe"} : {enCours.fait} / {enCours.total}
            </p>
            <div className="h-[8px] overflow-hidden rounded-full bg-[#EEF4F9]">
              <div className="h-full bg-[#3DEFBE] transition-all" style={{ width: `${(enCours.fait / Math.max(1, enCours.total)) * 100}%` }} />
            </div>
          </div>
        )}
        {erreur && <p className="mt-[12px] rounded-[12px] bg-[#FFECE8] p-[10px] text-[13px] text-[#8A2A1A]">{erreur}</p>}
      </div>

      {/* La comparaison */}
      <div className="grid grid-cols-1 gap-[14px] md:grid-cols-2">
        {(["direct", "agent"] as const).map((m) => {
          const d = derniers[m];
          const s = d ? resume(d.res) : null;
          return (
            <div key={m} className={`${carte} p-[20px] ${m === "agent" ? "border-[#3DEFBE]" : ""}`}>
              <p className="text-[13px] font-semibold text-[#7D93A8]">{m === "agent" ? "Avec l'agent (vérifications)" : "Lecture directe (un seul appel)"}</p>
              {s ? (
                <>
                  <p className="pt-[6px] text-[38px] font-bold leading-none tracking-[-0.02em]">
                    {s.reussis}/{s.n}
                    <span className="pl-[8px] text-[14px] font-semibold text-[#7D93A8]">cas réussis</span>
                  </p>
                  <dl className="grid grid-cols-2 gap-[8px] pt-[14px] text-[13px]">
                    <Mesure label="Champs exacts" valeur={`${s.exactPct} %`} />
                    <Mesure label="Faux donnés « sûrs »" valeur={String(s.faux)} alerte={s.faux > 0} />
                    <Mesure label="Champs inventés" valeur={String(s.invente)} alerte={s.invente > 0} />
                    <Mesure label="Doutes signalés" valeur={String(s.signale)} />
                    <Mesure label="Vérifications de l'agent" valeur={String(s.verifications)} />
                    <Mesure label="Coût estimé par page" valeur={`${s.coutParPage.toLocaleString("fr-FR", { maximumFractionDigits: 3 })} €`} />
                    <Mesure label="Durée moyenne" valeur={`${s.dureeMoyenne.toLocaleString("fr-FR")} s`} />
                    <Mesure label="Erreurs techniques" valeur={String(s.erreurs)} alerte={s.erreurs > 0} />
                  </dl>
                  <p className="pt-[10px] text-[11.5px] text-[#9DB0C0]">Le {new Date(d!.run.created_at).toLocaleString("fr-FR", { dateStyle: "short", timeStyle: "short" })}</p>
                </>
              ) : (
                <p className="pt-[10px] text-[13.5px] text-[#9DB0C0]">Pas encore lancé.</p>
              )}
            </div>
          );
        })}
      </div>

      {/* Les cas */}
      <div className={`${carte} overflow-hidden`}>
        <div className="flex items-center gap-[10px] border-b border-[#EEF2F6] px-[20px] py-[14px]">
          <h3 className="flex-1 text-[15px] font-bold">L'eval set · {donnees.cas.length} cas</h3>
          <button type="button" onClick={() => setAjout(!ajout)} className="flex h-[36px] items-center gap-[6px] rounded-[10px] bg-[#0F3D70] px-[12px] text-[12.5px] font-bold text-white">
            <Plus className="h-[14px] w-[14px]" aria-hidden="true" /> Ajouter un cas
          </button>
        </div>
        {ajout && <FormulaireCas onFait={() => (setAjout(false), void charger())} onAnnuler={() => setAjout(false)} />}
        {donnees.cas.length === 0 && !ajout && <p className="px-[20px] py-[18px] text-[13.5px] text-[#566B82]">Ajoute tes 10 photos de pages, avec ce qui est vraiment écrit dessus.</p>}
        <table className="w-full text-left text-[13px]">
          <tbody>
            {donnees.cas.map((c) => {
              const rd = derniers.direct?.res.find((x) => x.cas_id === c.id);
              const ra = derniers.agent?.res.find((x) => x.cas_id === c.id);
              return (
                <tr key={c.id} className="border-t border-[#EEF2F6]">
                  <td className="px-[20px] py-[10px]">
                    <span className="block font-semibold">{c.titre}</span>
                    <span className="text-[12px] text-[#7D93A8]">
                      {TYPES.find((t) => t.id === c.type)?.label} · {c.attendu.lisible === false ? "illisible attendu" : `${c.attendu.plongees.length} plongée${c.attendu.plongees.length > 1 ? "s" : ""}`}
                    </span>
                  </td>
                  <td className="px-[10px] py-[10px]">{rd ? <Pastille r={rd} onClick={() => setDetail({ cas: c, r: rd })} libelle="Direct" /> : <span className="text-[#C9D6E2]">—</span>}</td>
                  <td className="px-[10px] py-[10px]">{ra ? <Pastille r={ra} onClick={() => setDetail({ cas: c, r: ra })} libelle="Agent" /> : <span className="text-[#C9D6E2]">—</span>}</td>
                  <td className="px-[20px] py-[10px] text-right">
                    <button type="button" aria-label="Retirer ce cas" onClick={() => void retirerCas(c).then(charger)} className="text-[#9DB0C0] hover:text-[#C94957]">
                      <Trash2 className="h-[15px] w-[15px]" aria-hidden="true" />
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {detail && <DetailResultat cas={detail.cas} r={detail.r} onFermer={() => setDetail(null)} />}
    </div>
  );
}

function Mesure({ label, valeur, alerte = false }: { label: string; valeur: string; alerte?: boolean }) {
  return (
    <div className="rounded-[12px] bg-[#F6F8FA] px-[10px] py-[8px]">
      <dt className="text-[11.5px] text-[#7D93A8]">{label}</dt>
      <dd className={`text-[16px] font-bold ${alerte ? "text-[#C94957]" : ""}`}>{valeur}</dd>
    </div>
  );
}

function Pastille({ r, onClick, libelle }: { r: ResultatEval; onClick: () => void; libelle: string }) {
  return (
    <button type="button" onClick={onClick} className={`flex items-center gap-[5px] rounded-[8px] px-[8px] py-[4px] text-[12px] font-bold ${r.reussi ? "bg-[#E2F8EF] text-[#14805F]" : "bg-[#FFECE8] text-[#C94957]"}`}>
      {r.reussi ? <CheckCircle2 className="h-[14px] w-[14px]" aria-hidden="true" /> : <XCircle className="h-[14px] w-[14px]" aria-hidden="true" />}
      {libelle}
      {r.etapes ? <span className="font-semibold opacity-70">· {r.etapes} ét.</span> : null}
    </button>
  );
}

const VERDICTS: Record<string, { texte: string; classe: string }> = {
  exact: { texte: "exact", classe: "text-[#14805F]" },
  exact_signale: { texte: "exact, signalé à vérifier", classe: "text-[#14805F]" },
  signale: { texte: "faux mais signalé", classe: "text-[#8A5A10]" },
  faux: { texte: "faux et donné « sûr »", classe: "text-[#C94957]" },
  invente: { texte: "inventé", classe: "text-[#C94957]" },
};

function DetailResultat({ cas, r, onFermer }: { cas: CasEval; r: ResultatEval; onFermer: () => void }) {
  const [photo, setPhoto] = useState<string | null>(null);
  useEffect(() => void urlPhotoCas(cas.chemin).then(setPhoto), [cas.chemin]);
  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-[#0A2A50]/40" onClick={onFermer}>
      <div className="h-full w-full max-w-[720px] overflow-y-auto bg-white p-[22px]" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-start gap-[10px]">
          <h3 className="flex-1 text-[18px] font-bold">{cas.titre}</h3>
          <button type="button" onClick={onFermer} className="text-[13px] font-bold text-[#1176A8]">
            Fermer
          </button>
        </div>
        <p className={`pt-[4px] text-[13.5px] font-bold ${r.reussi ? "text-[#14805F]" : "text-[#C94957]"}`}>
          {r.reussi ? "Réussi" : "Raté"} · {r.etapes ?? "?"} étape{(r.etapes ?? 0) > 1 ? "s" : ""} · {(Math.round((r.duree_ms ?? 0) / 100) / 10).toLocaleString("fr-FR")} s
        </p>
        {r.erreur && <p className="mt-[8px] rounded-[10px] bg-[#FFECE8] p-[10px] text-[13px] text-[#8A2A1A]">{r.erreur}</p>}
        {photo && <img src={photo} alt="" className="mt-[12px] max-h-[320px] w-full rounded-[12px] object-contain ring-1 ring-[#E9EEF3]" />}
        {r.journal?.length > 0 && (
          <div className="mt-[12px] rounded-[12px] bg-[#E3F2FB] p-[12px] text-[13px]">
            <p className="font-bold">Vérifications de l'agent</p>
            {r.journal.map((j, i) => (
              <p key={i} className="pt-[4px] text-[#3F5B76]">
                {j.outil === "zoomer" ? "Zoom" : "Page voisine"} : {j.raison}
              </p>
            ))}
          </div>
        )}
        {r.details.hostile ? (
          <p className="pt-[14px] text-[13.5px]">Page hostile : {r.details.lu_n ?? 0} plongée(s) proposée(s), 0 attendue.</p>
        ) : (
          <table className="mt-[14px] w-full text-left text-[13px]">
            <thead className="text-[11.5px] text-[#7D93A8]">
              <tr>
                <th className="py-[6px]">Champ</th>
                <th>Attendu</th>
                <th>Lu par l'agent</th>
                <th>Verdict</th>
              </tr>
            </thead>
            <tbody>
              {(r.details.champs ?? []).map((c, i) => (
                <tr key={i} className="border-t border-[#EEF2F6]">
                  <td className="py-[6px] pr-[8px] font-semibold">
                    {CHAMPS_EVAL.find((x) => x.cle === c.champ)?.label ?? c.champ}
                    {(r.details.attendu_n ?? 1) > 1 ? ` (${c.plongee})` : ""}
                  </td>
                  <td className="pr-[8px]">{c.attendu === null ? <i className="text-[#9DB0C0]">rien d'écrit</i> : String(c.attendu)}</td>
                  <td className="pr-[8px]">
                    {c.lu === null ? <i className="text-[#9DB0C0]">vide</i> : String(c.lu)} <span className="text-[11px] text-[#9DB0C0]">{c.confiance}</span>
                  </td>
                  <td className={`font-semibold ${VERDICTS[c.verdict]?.classe ?? ""}`}>{VERDICTS[c.verdict]?.texte ?? c.verdict}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        {r.details.structure === false && (
          <p className="pt-[10px] text-[13px] font-semibold text-[#C94957]">
            Nombre de plongées : {r.details.lu_n} lues pour {r.details.attendu_n} attendues.
          </p>
        )}
      </div>
    </div>
  );
}

// Ajouter un cas : la photo, son type et ce qui est vraiment écrit dessus
function FormulaireCas({ onFait, onAnnuler }: { onFait: () => void; onAnnuler: () => void }) {
  const [fichier, setFichier] = useState<File | null>(null);
  const [titre, setTitre] = useState("");
  const [type, setType] = useState<TypeCas>("nominal");
  const [lisible, setLisible] = useState(true);
  const [plongees, setPlongees] = useState<Record<string, string>[]>([{}]);
  const [note, setNote] = useState("");
  const [enCours, setEnCours] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);

  const valider = async () => {
    if (!fichier || !titre.trim()) return setErreur("Il faut une photo et un titre.");
    setEnCours(true);
    setErreur(null);
    try {
      // Vide = non vérifié ; « - » = rien n'est écrit (l'agent ne doit rien inventer)
      const attendu: Attendu = {
        lisible,
        plongees: lisible
          ? plongees.map((p) =>
              Object.fromEntries(
                Object.entries(p)
                  .filter(([, v]) => v.trim() !== "")
                  .map(([k, v]) => [k, v.trim() === "-" ? null : v.trim()]),
              ),
            )
          : [],
      };
      await ajouterCas(fichier, titre.trim(), type, attendu, note);
      onFait();
    } catch (e) {
      setErreur((e as Error).message);
    } finally {
      setEnCours(false);
    }
  };

  return (
    <div className="flex flex-col gap-[12px] border-b border-[#EEF2F6] bg-[#FAFCFE] px-[20px] py-[16px]">
      <div className="grid grid-cols-1 gap-[12px] md:grid-cols-[200px_1fr]">
        <label className="flex h-[120px] cursor-pointer flex-col items-center justify-center gap-[6px] rounded-[14px] border-[1.5px] border-dashed border-[#C9D9E5] bg-white text-[12.5px] font-semibold text-[#7D93A8]">
          <ImagePlus className="h-[20px] w-[20px]" aria-hidden="true" />
          {fichier ? fichier.name : "Photo de la page"}
          <input type="file" accept="image/jpeg,image/png,image/webp" className="sr-only" onChange={(e) => setFichier(e.target.files?.[0] ?? null)} />
        </label>
        <div className="flex flex-col gap-[10px]">
          <input className={`${champ} h-[40px]`} placeholder="Titre (ex. Carnet 1987, page 12)" value={titre} onChange={(e) => setTitre(e.target.value)} />
          <div className="flex flex-wrap gap-[6px]">
            {TYPES.map((t) => (
              <button
                key={t.id}
                type="button"
                title={t.aide}
                onClick={() => {
                  setType(t.id);
                  if (t.id === "hostile") setLisible(false);
                }}
                className={`h-[32px] rounded-[10px] px-[10px] text-[12.5px] font-bold ${type === t.id ? "bg-[#0F3D70] text-white" : "border border-[#DCE7F0] bg-white text-[#5B7189]"}`}
              >
                {t.label}
              </button>
            ))}
            <label className="flex items-center gap-[6px] pl-[8px] text-[12.5px] font-semibold">
              <input type="checkbox" checked={!lisible} onChange={(e) => setLisible(!e.target.checked)} className="h-[16px] w-[16px] accent-[#0F3D70]" />
              Page illisible ou pas un carnet
            </label>
          </div>
        </div>
      </div>
      {lisible && (
        <>
          <p className="text-[12px] text-[#7D93A8]">Ce qui est vraiment écrit. Laisse vide pour ne pas vérifier un champ ; tape « - » si rien n'est écrit (l'agent ne doit rien inventer).</p>
          {plongees.map((p, i) => (
            <div key={i} className="flex flex-col gap-[6px] rounded-[12px] border border-[#E4EBF1] bg-white px-[12px] py-[10px]">
              <div className="flex items-center justify-between">
                <p className="text-[12px] font-bold text-[#0F3D70]">{plongees.length > 1 ? `Plongée ${i + 1} sur la page` : "La plongée de la page"}</p>
                {plongees.length > 1 && (
                  <button
                    type="button"
                    onClick={() => setPlongees(plongees.filter((_, j) => j !== i))}
                    aria-label={`Retirer la plongée ${i + 1}`}
                    className="flex h-[28px] items-center gap-[5px] rounded-[8px] px-[8px] text-[12px] font-bold text-[#B8432F] hover:bg-[#FFF1EC]"
                  >
                    <Trash2 className="h-[14px] w-[14px]" aria-hidden="true" />
                    Retirer
                  </button>
                )}
              </div>
              <div className="grid grid-cols-2 gap-[8px] md:grid-cols-6">
                {CHAMPS_EVAL.map((c) => (
                  <label key={c.cle} className="text-[11.5px] font-semibold text-[#566B82]">
                    {c.label}
                    <input
                      className={`${champ} mt-[4px] h-[36px]`}
                      placeholder={c.aide}
                      value={p[c.cle] ?? ""}
                      onChange={(e) => setPlongees(plongees.map((x, j) => (j === i ? { ...x, [c.cle]: e.target.value } : x)))}
                    />
                  </label>
                ))}
              </div>
            </div>
          ))}
          <button type="button" onClick={() => setPlongees([...plongees, {}])} className="w-fit text-[12.5px] font-bold text-[#106F9F]">
            + Une autre plongée sur la page
          </button>
        </>
      )}
      <input className={`${champ} h-[38px]`} placeholder="Note (ce qui rend ce cas difficile)" value={note} onChange={(e) => setNote(e.target.value)} />
      {erreur && <p className="text-[13px] font-semibold text-[#8A2A1A]">{erreur}</p>}
      <div className="flex flex-wrap items-center gap-[10px]">
        <button type="button" disabled={enCours} onClick={() => void valider()} className="h-[42px] w-fit rounded-[12px] bg-[#3DEFBE] px-[18px] text-[13px] font-bold text-[#0B3B63] disabled:opacity-50">
          {enCours ? "ENVOI…" : "AJOUTER CE CAS"}
        </button>
        <button
          type="button"
          disabled={enCours}
          onClick={onAnnuler}
          className="flex h-[42px] items-center gap-[6px] rounded-[12px] border border-[#DCE7F0] bg-white px-[14px] text-[13px] font-bold text-[#566B82] hover:text-[#B8432F] disabled:opacity-50"
        >
          <Trash2 className="h-[15px] w-[15px]" aria-hidden="true" />
          Abandonner ce cas
        </button>
      </div>
    </div>
  );
}
