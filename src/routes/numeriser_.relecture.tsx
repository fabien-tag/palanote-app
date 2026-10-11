import { useEffect, useMemo, useState } from "react";
import { createFileRoute, Navigate, useNavigate } from "@tanstack/react-router";
import { BookOpen, Check, ChevronLeft, X } from "lucide-react";
import {
  marquerPageRelue,
  prochaineARelire,
  rejeterExtraction,
  terminerLot,
  urlPhoto,
  validerExtraction,
  type Confiance,
  type Extraction,
} from "@/lib/numerisation";
import { BoutonPrincipal, FondNumerisation, Meduse, useConnexionRequise, useLot } from "@/components/numerisation/Ui";

export const Route = createFileRoute("/numeriser_/relecture")({
  head: () => ({ meta: [{ title: "Palanote — Relecture d'une page" }] }),
  validateSearch: (s: Record<string, unknown>): { lot?: string; ext?: string } => ({
    ...(typeof s["lot"] === "string" && s["lot"] ? { lot: s["lot"] } : {}),
    ...(typeof s["ext"] === "string" && s["ext"] ? { ext: s["ext"] } : {}),
  }),
  component: Relecture,
});

type Def = { cle: string; label: string; unite?: string; type?: "date" | "time" | "nombre" | "texte" };

// Champs principaux (maquette 15), puis ceux qui ne s'affichent que s'ils ont été lus.
const PRINCIPAUX: Def[] = [
  { cle: "date", label: "Date", type: "date" },
  { cle: "site", label: "Site" },
  { cle: "profondeur_max", label: "Profondeur max", unite: "m", type: "nombre" },
  { cle: "duree", label: "Durée", unite: "min", type: "nombre" },
  { cle: "temperature", label: "Température", unite: "°C", type: "nombre" },
  { cle: "pression_fin", label: "Pression fin", unite: "bar", type: "nombre" },
];
const SECONDAIRES: Def[] = [
  { cle: "heure", label: "Heure", type: "time" },
  { cle: "lieu", label: "Lieu" },
  { cle: "pression_debut", label: "Pression départ", unite: "bar", type: "nombre" },
  { cle: "melange", label: "Mélange" },
  { cle: "binomes", label: "Binômes" },
  { cle: "club", label: "Club" },
];

function Badge({ c, modifie, confirme = false }: { c: Confiance; modifie: boolean; confirme?: boolean }) {
  if (confirme && !modifie)
    return <span className="rounded-[10px] bg-[#3DEFBE] px-[9px] py-[3px] text-[11.5px] font-bold text-[#0B3B63]">Vérifié</span>;
  if (modifie) return <span className="rounded-[10px] bg-[#DCEEF8] px-[9px] py-[3px] text-[11.5px] font-bold text-[#1176A8]">Corrigé</span>;
  if (c === "sur") return <span className="rounded-[10px] bg-[#3DEFBE] px-[9px] py-[3px] text-[11.5px] font-bold text-[#0B3B63]">Sûr</span>;
  if (c === "a_verifier")
    return <span className="rounded-[10px] bg-[#FFC65C] px-[9px] py-[3px] text-[11.5px] font-bold text-[#6B4A14]">! À vérifier</span>;
  return <span className="rounded-[10px] bg-[#E6ECF2] px-[9px] py-[3px] text-[11.5px] font-semibold text-[#7D93A8]">Non lu</span>;
}

function Champ({
  def,
  valeur,
  confiance,
  lu,
  modifie,
  confirme,
  onChange,
  onConfirmer,
}: {
  def: Def;
  valeur: string;
  confiance: Confiance;
  lu: string | null;
  modifie: boolean;
  confirme: boolean;
  onChange: (v: string) => void;
  onConfirmer: () => void;
}) {
  const verifier = confiance === "a_verifier" && !modifie && !confirme;
  const vide = confiance === "non_lu" && !valeur;
  return (
    <div className="flex flex-col gap-[7px]">
      <div className="flex items-center justify-between">
        <label htmlFor={`champ-${def.cle}`} className={`text-[13.5px] font-bold ${verifier ? "text-[#8A5A10]" : "text-[#5B7189]"}`}>
          {def.label}
        </label>
        <Badge c={confiance} modifie={modifie} confirme={confirme} />
      </div>
      <div
        className={`flex min-h-[56px] items-center gap-2 galet-c px-[18px] ${
          verifier
            ? "border-2 border-[#F5A524] bg-[#FFF5E5]"
            : vide
              ? "border-[1.5px] border-dashed border-[#D5E1EC] bg-white/60"
              : "border-[1.5px] border-[#E4EBF1] bg-white"
        }`}
      >
        <input
          id={`champ-${def.cle}`}
          type={def.type === "date" ? "date" : def.type === "time" ? "time" : "text"}
          inputMode={def.type === "nombre" ? "decimal" : undefined}
          value={def.type === "nombre" ? valeur.replace(".", ",") : valeur}
          placeholder="—"
          onChange={(e) => onChange(def.type === "nombre" ? e.target.value.replace(",", ".") : e.target.value)}
          className="w-full min-w-0 bg-transparent text-[19px] font-bold text-[#123A63] outline-none placeholder:font-normal placeholder:text-[#9AAAB9]"
        />
        {def.unite && <span className="shrink-0 text-[15px] text-[#9DB0C0]">{def.unite}</span>}
        {verifier && lu && lu !== valeur && <span className="shrink-0 pl-2 text-[12.5px] font-bold text-[#6B4A14]">lu : « {lu} »</span>}
        {/* La valeur lue est bonne : un geste pour la valider, sans la retaper */}
        {verifier && valeur.trim() !== "" && (
          <button
            type="button"
            onClick={onConfirmer}
            aria-label={`${def.label} : la valeur est bonne`}
            className="-mr-[8px] flex h-[38px] shrink-0 items-center gap-[5px] rounded-full bg-[#3DEFBE] px-[13px] text-[13px] font-bold text-[#0B3B63]"
          >
            <Check className="h-[15px] w-[15px]" strokeWidth={3} aria-hidden="true" />
            OK
          </button>
        )}
      </div>
    </div>
  );
}

function Relecture() {
  const navigate = useNavigate();
  const { lot, ext } = Route.useSearch();
  const { ecran } = useConnexionRequise();
  const { donnees, recharger } = useLot(lot);
  const [valeurs, setValeurs] = useState<Record<string, string>>({});
  const [modifies, setModifies] = useState<Set<string>>(new Set());
  const [confirmes, setConfirmes] = useState<Set<string>>(new Set());
  const [garderCommentaire, setGarderCommentaire] = useState<boolean | null>(null);
  const [photo, setPhoto] = useState<string | null>(null);
  const [agrandie, setAgrandie] = useState(false);
  const [enCours, setEnCours] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);

  const pages = donnees?.pages ?? [];
  const extractions = donnees?.extractions ?? [];
  const courante: Extraction | null = useMemo(() => {
    if (!donnees) return null;
    const demandee = ext ? extractions.find((e) => e.id === ext && e.statut === "a_relire") : null;
    return demandee ?? prochaineARelire(pages, extractions);
  }, [donnees, ext]); // eslint-disable-line react-hooks/exhaustive-deps

  const page = pages.find((p) => p.id === courante?.page_id) ?? null;
  const surLaPage = extractions.filter((e) => e.page_id === courante?.page_id && e.statut !== "rejetee");
  const rangSurPage = courante ? surLaPage.findIndex((e) => e.id === courante.id) + 1 : 0;

  // Nouvelle plongée affichée : on repart des valeurs lues.
  useEffect(() => {
    if (!courante) return;
    const v: Record<string, string> = {};
    for (const [k, x] of Object.entries(courante.champs)) v[k] = x ?? "";
    setValeurs(v);
    setModifies(new Set());
    setConfirmes(new Set());
    setGarderCommentaire(null);
    setErreur(null);
    window.scrollTo(0, 0);
  }, [courante?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    setPhoto(null);
    void urlPhoto(page?.chemin ?? null).then(setPhoto);
  }, [page?.chemin]);

  if (ecran) return ecran;
  if (!lot) return <Navigate to="/numeriser" />;
  if (!donnees) return <FondNumerisation>{null}</FondNumerisation>;

  // Plus rien à relire : retour à la lecture s'il reste des pages en cours, sinon récapitulatif.
  if (!courante) {
    const lectureEnCours = pages.some((p) => p.statut === "en_attente" || p.statut === "en_cours");
    return lectureEnCours ? <Navigate to="/numeriser/lecture" search={{ lot }} /> : <Navigate to="/numeriser/fin" search={{ lot }} />;
  }

  const confiance = (cle: string) => (courante.confiances[cle] ?? "non_lu") as Confiance;
  const secondairesLus = SECONDAIRES.filter((d) => (courante.champs[d.cle] ?? "") !== "" || confiance(d.cle) !== "non_lu");
  const affiches = [...PRINCIPAUX, ...secondairesLus];
  const aVerifier = affiches.filter((d) => confiance(d.cle) === "a_verifier" && !modifies.has(d.cle) && !confirmes.has(d.cle)).length;
  const commentaire = (courante.champs["commentaire"] ?? "").trim();
  const signee = valeurs["signee"] === "oui";
  const tamponnee = valeurs["tamponnee"] === "oui";
  const signatureLue = confiance("signee") !== "non_lu" || confiance("tamponnee") !== "non_lu";
  // Signature et tampon : un seul geste « OK » pour les deux quand l'app hésite
  const signatureModifiee = modifies.has("signee") || modifies.has("tamponnee");
  const signatureAVerifier =
    (confiance("signee") === "a_verifier" || confiance("tamponnee") === "a_verifier") && !signatureModifiee && !confirmes.has("signature");
  const totalAVerifier = aVerifier + (signatureAVerifier ? 1 : 0);

  const changer = (cle: string, v: string) => {
    setValeurs((x) => ({ ...x, [cle]: v }));
    setModifies((m) => new Set(m).add(cle));
  };

  // Passe à la plongée suivante (et marque la page relue quand elle est finie).
  const suivante = async (sauter = false) => {
    const restantSurPage = surLaPage.filter((e) => e.id !== courante.id && e.statut === "a_relire");
    if (!sauter && page && restantSurPage.length === 0) await marquerPageRelue(page.id);
    await recharger();
    const apres = prochaineARelire(pages, extractions.filter((e) => e.id !== courante.id), {
      pageOrdre: page?.ordre ?? 0,
      ordre: courante.ordre,
    });
    if (apres) navigate({ to: "/numeriser/relecture", search: { lot, ext: apres.id }, replace: true });
    else {
      const lectureEnCours = pages.some((p) => p.statut === "en_attente" || p.statut === "en_cours");
      if (!lectureEnCours && !sauter) await terminerLot(lot);
      navigate({ to: lectureEnCours ? "/numeriser/lecture" : "/numeriser/fin", search: { lot } });
    }
  };

  const valider = async () => {
    setEnCours(true);
    setErreur(null);
    try {
      const champs: Record<string, string | null> = { ...courante.champs };
      for (const [k, v] of Object.entries(valeurs)) champs[k] = v.trim() === "" ? null : v.trim();
      await validerExtraction(courante, champs, garderCommentaire !== false && commentaire !== "");
      await suivante();
    } catch (e) {
      console.error(e);
      setErreur(
        `La plongée n'a pas pu être enregistrée.${e && typeof e === "object" && "message" in e ? ` (détail : ${String(e.message)})` : ""}`,
      );
    } finally {
      setEnCours(false);
    }
  };

  const rejeter = async () => {
    setEnCours(true);
    try {
      await rejeterExtraction(courante);
      await suivante();
    } finally {
      setEnCours(false);
    }
  };

  const restantesSurPage = surLaPage.length - rangSurPage;
  const libelleValider =
    restantesSurPage > 0
      ? `Valider et passer à la plongée ${rangSurPage + 1}`
      : prochaineARelire(pages, extractions.filter((e) => e.id !== courante.id))
        ? "Valider et passer à la page suivante"
        : "Valider et terminer";

  return (
    <FondNumerisation>
      {/* Haut */}
      <div className="sticky top-0 z-10 flex items-center justify-between bg-[#F1F6FC]/95 px-[22px] pb-3 pt-[16px] backdrop-blur">
        <button
          type="button"
          aria-label="Revenir à la lecture"
          onClick={() => navigate({ to: "/numeriser/lecture", search: { lot } })}
          className="flex h-10 w-10 items-center justify-center goutte bg-[#E3EDF6]"
        >
          <ChevronLeft className="h-[18px] w-[18px]" strokeWidth={2.4} />
        </button>
        <div className="text-center leading-tight">
          <div className="text-[16px] font-bold">
            Page {page?.ordre} sur {pages.length}
          </div>
          <div className="text-[12.5px] text-[#5B7189]">
            plongée {rangSurPage} sur {surLaPage.length}
          </div>
        </div>
        <button type="button" onClick={() => void suivante(true)} className="text-[14.5px] font-bold text-[#1176A8]">
          Passer
        </button>
      </div>

      <div className="flex flex-col gap-[18px] px-[22px] pb-[28px]">
        {/* La page photographiée */}
        <div className="galet bg-white p-[9px] shadow-[0_3px_13px_#123A6308]">
          <button
            type="button"
            onClick={() => photo && setAgrandie(true)}
            className="relative flex h-[200px] w-full items-center justify-center overflow-hidden galet-moyen bg-[#E3F0FA] bg-cover bg-center"
            style={photo ? { backgroundImage: `url(${photo})` } : undefined}
          >
            {!photo && (
              <span className="flex flex-col items-center gap-2 text-[13px] text-[#8FA9C0]">
                <BookOpen className="h-6 w-6" strokeWidth={1.8} />
                la page que tu as photographiée
              </span>
            )}
            <span className="absolute left-[10px] top-[10px] rounded-[10px] bg-white px-[10px] py-[4px] text-[12px] font-bold text-[#123A63] shadow-sm">Agrandir</span>
            {surLaPage.length > 1 && (
              <span className="absolute bottom-[10px] right-[10px] rounded-[10px] bg-white px-[10px] py-[5px] text-[12px] font-bold text-[#123A63] shadow-sm">
                {surLaPage.length} plongées sur cette page
              </span>
            )}
          </button>
          <p className="px-[10px] pb-[6px] pt-[10px] text-[12.5px] leading-snug text-[#5B7189]">
            Garde-la sous les yeux : c'est elle qui fait foi, pas ce que l'app a lu.
          </p>
        </div>

        {totalAVerifier > 0 && (
          <div className="flex items-center gap-[13px] galet-b border-[1.5px] border-[#F5A524] bg-[#FFF5E5] px-[14px] py-[12px]">
            <span className="flex h-[38px] w-[38px] shrink-0 items-center justify-center rounded-full bg-[#FFC65C] text-[16px] font-bold text-[#6B4A14]">{totalAVerifier}</span>
            <p className="text-[13.5px] leading-snug text-[#6B4A14]">
              <b>
                {totalAVerifier} champ{totalAVerifier > 1 ? "s" : ""} à vérifier
              </b>{" "}
              — l'app a lu quelque chose, mais elle n'en est pas sûre. Touche OK si c'est bon, sinon corrige le champ.
            </p>
          </div>
        )}

        {affiches.map((d) => (
          <Champ
            key={d.cle}
            def={d}
            valeur={valeurs[d.cle] ?? ""}
            confiance={confiance(d.cle)}
            lu={courante.lectures[d.cle] ?? null}
            modifie={modifies.has(d.cle)}
            confirme={confirmes.has(d.cle)}
            onChange={(v) => changer(d.cle, v)}
            onConfirmer={() => setConfirmes((c) => new Set(c).add(d.cle))}
          />
        ))}

        {/* Signature et tampon */}
        <div className={`relative galet-c p-[16px] ${signatureAVerifier ? "border-2 border-[#F5A524] bg-[#FFF5E5]" : "border border-[#E4EBF1] bg-white"}`}>
          <div className="flex items-center justify-between pb-[12px]">
            <span className={`text-[14px] font-bold ${signatureAVerifier ? "text-[#8A5A10]" : "text-[#5B7189]"}`}>Signature et tampon</span>
            <Badge
              c={signatureLue ? (confiance("signee") === "a_verifier" || confiance("tamponnee") === "a_verifier" ? "a_verifier" : "sur") : "non_lu"}
              modifie={signatureModifiee}
              confirme={confirmes.has("signature")}
            />
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {(
              [
                ["signee", "Signée", signee],
                ["tamponnee", "Tamponnée", tamponnee],
              ] as const
            ).map(([cle, label, on]) => (
              <button
                key={cle}
                type="button"
                aria-pressed={on}
                onClick={() => changer(cle, on ? "non" : "oui")}
                className={`flex h-[36px] items-center gap-[6px] rounded-[18px] px-[14px] text-[14px] font-bold ${on ? "bg-[#DDF8EF] text-[#0B3B63]" : "border border-[#D8E5EE] bg-white text-[#9DB0C0]"}`}
              >
                {on && <Check className="h-[14px] w-[14px]" strokeWidth={3} />}
                {label}
              </button>
            ))}
            {/* Ce que l'app a lu est bon : on valide d'un geste, comme les autres champs */}
            {signatureAVerifier && (
              <button
                type="button"
                onClick={() => setConfirmes((c) => new Set(c).add("signature"))}
                aria-label="Signature et tampon : c'est bon"
                className="ml-auto flex h-[38px] shrink-0 items-center gap-[5px] rounded-full bg-[#3DEFBE] px-[13px] text-[13px] font-bold text-[#0B3B63]"
              >
                <Check className="h-[15px] w-[15px]" strokeWidth={3} aria-hidden="true" />
                OK
              </button>
            )}
          </div>
          <Meduse className="-right-[8px] -top-[14px]" />
        </div>

        {/* Commentaire manuscrit */}
        {commentaire && (
          <div className="flex flex-col gap-[7px]">
            <span className="text-[13.5px] font-bold text-[#5B7189]">Commentaire manuscrit</span>
            <div className="galet border border-[#E4EBF1] bg-white p-[16px]">
              <p className={`text-[15px] italic leading-snug ${garderCommentaire === false ? "text-[#B8C5D2] line-through" : "text-[#5B7189]"}`}>« {commentaire} »</p>
              <div className="flex gap-2 pt-[12px]">
                <button
                  type="button"
                  onClick={() => setGarderCommentaire(true)}
                  className={`h-[38px] rounded-[19px] px-[18px] text-[14px] font-bold ${garderCommentaire !== false ? "bg-[#3DEFBE] text-[#0B3B63]" : "border border-[#D8E5EE] text-[#5B7189]"}`}
                >
                  Garder ce texte
                </button>
                <button
                  type="button"
                  onClick={() => setGarderCommentaire(false)}
                  className={`h-[38px] rounded-[19px] px-[18px] text-[14px] font-bold ${garderCommentaire === false ? "bg-[#123A63] text-white" : "border border-[#D8E5EE] text-[#5B7189]"}`}
                >
                  Ignorer
                </button>
              </div>
            </div>
          </div>
        )}

        {erreur && (
          <p role="alert" className="galet-petit bg-[#FFE4DE] px-3 py-2 text-[13px] text-[#8A2A1A]">
            {erreur}
          </p>
        )}

        <div className="flex flex-col gap-4 pt-2">
          <BoutonPrincipal onClick={() => void valider()} disabled={enCours}>
            {enCours ? "Enregistrement…" : libelleValider}
          </BoutonPrincipal>
          <button type="button" disabled={enCours} onClick={() => void rejeter()} className="mx-auto text-[13.5px] font-semibold text-[#5B7189] underline underline-offset-4">
            Cette plongée n'en est pas une
          </button>
        </div>
      </div>

      {agrandie && photo && (
        <div role="dialog" aria-label="Page agrandie" className="fixed inset-0 z-50 overflow-auto bg-black/90" onClick={() => setAgrandie(false)}>
          <img src={photo} alt="Page du carnet" className="min-h-full w-full object-contain" />
          <button type="button" aria-label="Fermer" className="fixed right-4 top-4 flex h-10 w-10 items-center justify-center rounded-full bg-white/15 text-white">
            <X className="h-5 w-5" />
          </button>
        </div>
      )}
    </FondNumerisation>
  );
}
