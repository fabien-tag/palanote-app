import { useMemo, useRef, useState, type DragEvent } from "react";
import { AlertTriangle, CheckCircle2, Download, FileSpreadsheet, X } from "lucide-react";
import {
  convertir,
  devinerColonnes,
  EXTENSIONS_TABLEUR,
  lireTableur,
  telechargerModele,
  trouverEntete,
  type Cellule,
  type Champ,
  type Feuillet,
} from "@/lib/tableur";

// Import d'un tableur Excel ou CSV, commun à tous les imports du club :
// 1. on dépose le fichier ; 2. on choisit le feuillet ; 3. on vérifie quelle colonne
// va où (devinée d'après les titres) ; 4. aperçu avec les lignes écartées ; 5. import.
export type LigneImport = Record<string, string | number | null>;

export function ImportTableur({
  titre,
  description,
  champs,
  modele,
  transformer,
  onImporter,
  onFermer,
}: {
  titre: string;
  description: string;
  champs: Champ[];
  modele: { nom: string; lignes: string[][] };
  // Ajuste une ligne lue (ex. séparer « Prénom Nom ») ; renvoie un message pour l'écarter
  transformer?: (l: LigneImport) => LigneImport | string;
  onImporter: (lignes: LigneImport[]) => Promise<string>;
  onFermer: (importe: boolean) => void;
}) {
  const entree = useRef<HTMLInputElement>(null);
  const [fichier, setFichier] = useState<string | null>(null);
  const [feuillets, setFeuillets] = useState<Feuillet[] | null>(null);
  const [feuillet, setFeuillet] = useState(0);
  const [entete, setEntete] = useState(0);
  const [colonnes, setColonnes] = useState<Record<string, number>>({});
  const [survol, setSurvol] = useState(false);
  const [lecture, setLecture] = useState(false);
  const [enCours, setEnCours] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);
  const [resultat, setResultat] = useState<string | null>(null);

  const choisirFeuillet = (f: Feuillet[], i: number) => {
    setFeuillet(i);
    const lignes = f[i]?.lignes ?? [];
    const e = trouverEntete(lignes, champs);
    setEntete(e);
    setColonnes(devinerColonnes(lignes[e] ?? [], champs));
  };

  const ouvrir = async (f: File | undefined) => {
    if (!f) return;
    setErreur(null);
    setResultat(null);
    setLecture(true);
    try {
      const lus = await lireTableur(f);
      if (lus.length === 0) throw new Error("Ce fichier est vide.");
      setFichier(f.name);
      setFeuillets(lus);
      // Le feuillet qui reconnaît le plus de colonnes est choisi d'office
      let meilleur = 0;
      let score = -1;
      lus.forEach((x, i) => {
        const e = trouverEntete(x.lignes, champs);
        const s = Object.values(devinerColonnes(x.lignes[e] ?? [], champs)).filter((v) => v >= 0).length;
        if (s > score) {
          score = s;
          meilleur = i;
        }
      });
      choisirFeuillet(lus, meilleur);
    } catch (e) {
      console.error(e);
      setErreur(e instanceof Error && e.message ? e.message : "Ce fichier n'a pas pu être lu.");
    }
    setLecture(false);
  };

  const lignesBrutes = feuillets?.[feuillet]?.lignes ?? [];
  const titres = lignesBrutes[entete] ?? [];
  const nbColonnes = Math.max(0, ...lignesBrutes.slice(entete, entete + 50).map((l) => l.length));

  // Lignes converties, avec la raison si l'une est écartée
  const analyse = useMemo(() => {
    const ok: LigneImport[] = [];
    const ecartees: { n: number; raison: string }[] = [];
    lignesBrutes.slice(entete + 1).forEach((brute, k) => {
      const n = entete + k + 2; // numéro de ligne dans Excel
      let l: LigneImport = {};
      let raison: string | null = null;
      for (const ch of champs) {
        const i = colonnes[ch.id] ?? -1;
        const v = i >= 0 ? convertir((brute[i] ?? null) as Cellule, ch.type) : null;
        if (v === undefined) {
          if (ch.requis) raison = `${ch.libelle} illisible (« ${String(brute[i])} »)`;
          l[ch.id] = null;
        } else l[ch.id] = v;
        if (ch.requis && (l[ch.id] === null || l[ch.id] === "") && !raison) raison = `${ch.libelle} manquant`;
      }
      if (!raison && transformer) {
        const t = transformer(l);
        if (typeof t === "string") raison = t;
        else l = t;
      }
      if (raison) ecartees.push({ n, raison });
      else ok.push(l);
    });
    return { ok, ecartees };
  }, [lignesBrutes, entete, colonnes, champs, transformer]);

  const manquants = champs.filter((c) => c.requis && (colonnes[c.id] ?? -1) < 0);
  const importer = async () => {
    setEnCours(true);
    setErreur(null);
    try {
      setResultat(await onImporter(analyse.ok));
    } catch (e) {
      console.error(e);
      const m = String((e as { message?: string })?.message ?? "");
      setErreur(
        /Could not find the function|does not exist|PGRST202/i.test(m)
          ? "L'import n'est pas encore activé : lance le script « palanote-import-excel.sql » dans Supabase."
          : `L'import n'a pas abouti${m ? ` (détail : ${m})` : ""}.`,
      );
    }
    setEnCours(false);
  };

  const deposer = (e: DragEvent) => {
    e.preventDefault();
    setSurvol(false);
    void ouvrir(e.dataTransfer.files[0]);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center lg:items-center" role="dialog" aria-modal="true" aria-label={titre}>
      <button type="button" aria-label="Fermer" onClick={() => onFermer(Boolean(resultat))} className="absolute inset-0 bg-[#06203F]/45" />
      <div className="relative flex max-h-[94svh] w-full max-w-[900px] flex-col overflow-hidden rounded-t-[30px] bg-white text-[#123A63] shadow-[0_-10px_30px_rgba(6,32,63,.18)] lg:rounded-[10px]">
        <div className="flex items-start gap-3 border-b border-[#EEF3F8] px-[24px] pb-[14px] pt-[20px]">
          <span className="flex h-[40px] w-[40px] shrink-0 items-center justify-center rounded-[10px] bg-[#E2F8EF]">
            <FileSpreadsheet className="h-[20px] w-[20px] text-[#137758]" />
          </span>
          <div className="min-w-0 flex-1">
            <h2 className="text-[19px] font-bold leading-tight">{titre}</h2>
            <p className="pt-[2px] text-[13px] leading-snug text-[#566B82]">{description}</p>
          </div>
          <button type="button" aria-label="Fermer" onClick={() => onFermer(Boolean(resultat))} className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[10px] bg-[#EEF3F8]">
            <X className="h-[17px] w-[17px]" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-[24px] pb-[20px] pt-[16px]">
          {resultat ? (
            <div className="flex flex-col items-center gap-[10px] py-[30px] text-center">
              <CheckCircle2 className="h-[40px] w-[40px] text-[#137758]" />
              <p className="text-[17px] font-bold">Import terminé</p>
              <p className="max-w-[460px] text-[14px] leading-normal text-[#566B82]">{resultat}</p>
            </div>
          ) : !feuillets ? (
            <>
              <div
                onDragOver={(e) => {
                  e.preventDefault();
                  setSurvol(true);
                }}
                onDragLeave={() => setSurvol(false)}
                onDrop={deposer}
                className={`flex flex-col items-center gap-[10px] rounded-[10px] border-2 border-dashed px-[20px] py-[34px] text-center ${survol ? "border-[#3DEFBE] bg-[#E2F8EF]" : "border-[#C9DCEA] bg-[#F7FAFD]"}`}
              >
                <FileSpreadsheet className="h-[34px] w-[34px] text-[#106F9F]" />
                <p className="text-[15px] font-bold">Dépose ton fichier Excel ici</p>
                <p className="text-[12.5px] text-[#566B82]">.xlsx ou .csv · le fichier est lu sur cet appareil, il n'est envoyé nulle part</p>
                <button
                  type="button"
                  onClick={() => entree.current?.click()}
                  disabled={lecture}
                  className="mt-[4px] h-[42px] rounded-[10px] bg-[#0F3D70] px-[18px] text-[13px] font-bold text-white disabled:opacity-60"
                >
                  {lecture ? "LECTURE…" : "CHOISIR UN FICHIER"}
                </button>
                <input ref={entree} type="file" accept={EXTENSIONS_TABLEUR} className="hidden" onChange={(e) => void ouvrir(e.target.files?.[0])} />
              </div>
              <div className="pt-[16px]">
                <p className="text-[12px] font-bold uppercase tracking-[.08em] text-[#566B82]">Colonnes reconnues</p>
                <div className="flex flex-wrap gap-[6px] pt-[8px]">
                  {champs.map((c) => (
                    <span key={c.id} className={`rounded-[8px] px-[8px] py-[3px] text-[12px] font-semibold ${c.requis ? "bg-[#0F3D70] text-white" : "bg-[#EEF3F8] text-[#3F5B76]"}`}>
                      {c.libelle}
                      {c.requis ? " *" : ""}
                    </span>
                  ))}
                </div>
                <p className="pt-[8px] text-[12px] leading-normal text-[#566B82]">
                  Les titres de colonnes n'ont pas besoin d'être exacts : « Nom de famille », « NIVEAU FFESSM » ou « Date plongée » sont reconnus, et tu pourras corriger avant d'importer.
                </p>
                <button
                  type="button"
                  onClick={() => telechargerModele(modele.nom, modele.lignes)}
                  className="mt-[10px] flex items-center gap-[6px] text-[13px] font-bold text-[#106F9F]"
                >
                  <Download className="h-[15px] w-[15px]" /> Télécharger un modèle à remplir
                </button>
              </div>
            </>
          ) : (
            <>
              <div className="flex flex-wrap items-center gap-[8px]">
                <span className="text-[13px] font-semibold">{fichier}</span>
                <button
                  type="button"
                  onClick={() => {
                    setFeuillets(null);
                    setFichier(null);
                  }}
                  className="text-[12.5px] font-bold text-[#106F9F]"
                >
                  Changer de fichier
                </button>
              </div>

              {feuillets.length > 1 && (
                <div className="pt-[14px]">
                  <p className="pb-[6px] text-[12px] font-bold uppercase tracking-[.08em] text-[#566B82]">Feuillet</p>
                  <div className="flex flex-wrap gap-[6px]">
                    {feuillets.map((f, i) => (
                      <button
                        key={f.nom + i}
                        type="button"
                        onClick={() => choisirFeuillet(feuillets, i)}
                        className={`h-[34px] rounded-[10px] px-[12px] text-[12.5px] font-bold ${i === feuillet ? "bg-[#0F3D70] text-white" : "border border-[#D8E5EE] text-[#566B82]"}`}
                      >
                        {f.nom} <span className="font-semibold opacity-70">· {f.lignes.length} lignes</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              <div className="pt-[16px]">
                <div className="flex flex-wrap items-baseline justify-between gap-2 pb-[6px]">
                  <p className="text-[12px] font-bold uppercase tracking-[.08em] text-[#566B82]">Quelle colonne va où</p>
                  <label className="flex items-center gap-[6px] text-[12px] text-[#566B82]">
                    Titres en ligne
                    <select
                      value={entete}
                      onChange={(e) => {
                        const v = Number(e.target.value);
                        setEntete(v);
                        setColonnes(devinerColonnes(lignesBrutes[v] ?? [], champs));
                      }}
                      className="h-[28px] rounded-[8px] border border-[#D8E5EE] px-[6px] text-[12px] font-bold"
                    >
                      {lignesBrutes.slice(0, 10).map((_, i) => (
                        <option key={i} value={i}>
                          {i + 1}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>
                <div className="grid grid-cols-1 gap-[8px] sm:grid-cols-2 lg:grid-cols-3">
                  {champs.map((c) => (
                    <label key={c.id} className="block rounded-[10px] border border-[#E4EBF1] px-[10px] py-[7px]">
                      <span className="block text-[12px] font-bold">
                        {c.libelle}
                        {c.requis && <span className="text-[#B8432F]"> *</span>}
                      </span>
                      <select
                        value={colonnes[c.id] ?? -1}
                        onChange={(e) => setColonnes({ ...colonnes, [c.id]: Number(e.target.value) })}
                        className={`mt-[3px] h-[30px] w-full rounded-[8px] border px-[6px] text-[12.5px] outline-none ${(colonnes[c.id] ?? -1) >= 0 ? "border-[#3DEFBE] bg-[#F2FDF9]" : "border-[#D8E5EE] text-[#566B82]"}`}
                      >
                        <option value={-1}>— pas dans le fichier</option>
                        {Array.from({ length: nbColonnes }, (_, i) => (
                          <option key={i} value={i}>
                            {String.fromCharCode(65 + (i % 26))} · {titres[i] !== null && titres[i] !== undefined ? String(titres[i]).slice(0, 30) : "(sans titre)"}
                          </option>
                        ))}
                      </select>
                    </label>
                  ))}
                </div>
                {manquants.length > 0 && (
                  <p className="flex items-center gap-[6px] pt-[8px] text-[12.5px] font-bold text-[#B8432F]">
                    <AlertTriangle className="h-[14px] w-[14px]" /> Choisis la colonne : {manquants.map((m) => m.libelle).join(", ")}
                  </p>
                )}
              </div>

              <div className="pt-[16px]">
                <p className="pb-[6px] text-[12px] font-bold uppercase tracking-[.08em] text-[#566B82]">
                  Aperçu · {analyse.ok.length} ligne{analyse.ok.length > 1 ? "s" : ""} à importer
                </p>
                <div className="overflow-x-auto rounded-[10px] border border-[#E4EBF1]">
                  <table className="w-full border-collapse text-[12.5px]">
                    <thead>
                      <tr className="bg-[#F7FAFD] text-left text-[11px] uppercase tracking-[.05em] text-[#566B82]">
                        {champs
                          .filter((c) => (colonnes[c.id] ?? -1) >= 0)
                          .map((c) => (
                            <th key={c.id} className="whitespace-nowrap px-[10px] py-[7px] font-bold">
                              {c.libelle}
                            </th>
                          ))}
                      </tr>
                    </thead>
                    <tbody>
                      {analyse.ok.slice(0, 6).map((l, i) => (
                        <tr key={i} className="border-t border-[#EEF3F8]">
                          {champs
                            .filter((c) => (colonnes[c.id] ?? -1) >= 0)
                            .map((c) => (
                              <td key={c.id} className="max-w-[180px] truncate whitespace-nowrap px-[10px] py-[6px]">
                                {l[c.id] === null ? <span className="text-[#C9D5E0]">—</span> : String(l[c.id])}
                              </td>
                            ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {analyse.ok.length > 6 && <p className="pt-[4px] text-[12px] text-[#566B82]">et {analyse.ok.length - 6} autres lignes</p>}
                {analyse.ecartees.length > 0 && (
                  <details className="pt-[10px] text-[12.5px]">
                    <summary className="cursor-pointer font-bold text-[#8A5A10]">
                      {analyse.ecartees.length} ligne{analyse.ecartees.length > 1 ? "s" : ""} écartée{analyse.ecartees.length > 1 ? "s" : ""}
                    </summary>
                    <ul className="max-h-[140px] overflow-y-auto pt-[6px] text-[#566B82]">
                      {analyse.ecartees.slice(0, 100).map((e) => (
                        <li key={e.n}>
                          Ligne {e.n} : {e.raison}
                        </li>
                      ))}
                    </ul>
                  </details>
                )}
              </div>
            </>
          )}
          {erreur && (
            <p role="alert" className="mt-[12px] rounded-[10px] bg-[#FFE4DE] px-3 py-2 text-[13px] text-[#8A2A1A]">
              {erreur}
            </p>
          )}
        </div>

        <div className="flex items-center justify-end gap-[10px] border-t border-[#EEF3F8] px-[24px] py-[14px]">
          {resultat ? (
            <button type="button" onClick={() => onFermer(true)} className="h-[44px] rounded-[10px] bg-[#3DEFBE] px-[22px] text-[13.5px] font-bold text-[#0B3B63]">
              TERMINER
            </button>
          ) : (
            <>
              <button type="button" onClick={() => onFermer(false)} className="h-[44px] rounded-[10px] px-[16px] text-[13.5px] font-bold text-[#566B82]">
                Annuler
              </button>
              <button
                type="button"
                disabled={!feuillets || enCours || manquants.length > 0 || analyse.ok.length === 0}
                onClick={() => void importer()}
                className="h-[44px] rounded-[10px] bg-[#3DEFBE] px-[22px] text-[13.5px] font-bold text-[#0B3B63] disabled:opacity-40"
              >
                {enCours ? "IMPORT…" : `IMPORTER ${analyse.ok.length} LIGNE${analyse.ok.length > 1 ? "S" : ""}`}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
