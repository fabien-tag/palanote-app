import { useEffect, useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { Check, ChevronLeft, Eye, Plus, X } from "lucide-react";
import { Meduse, useConnexionRequise } from "@/components/numerisation/Ui";
import { dateCourte } from "@/lib/amis";
import { chargerEspeces, ESPECES_COURANTES, imageReference, validerEspeces, type EspecePlongee, type ImageReference } from "@/lib/especes";
import { chargerGalerie, type PhotoGalerie } from "@/lib/galerie";
import { annoncerSurAccueil } from "@/lib/message-accueil";
import { chargerPlongee } from "@/lib/plongees";

// Écran 46 : espèces détectées, à valider. L'app propose, tu valides.
export const Route = createFileRoute("/plongee/especes")({
  validateSearch: (search: Record<string, unknown>): { id?: string | undefined; depuis?: "analyser" | undefined } => ({
    id: typeof search["id"] === "string" ? search["id"] : undefined,
    depuis: search["depuis"] === "analyser" ? "analyser" : undefined,
  }),
  head: () => ({ meta: [{ title: "Palanote — Espèces détectées" }] }),
  component: EspecesDetectees,
});

type Choix = "garder" | "retirer" | null;

function Pastille({ e }: { e: EspecePlongee }) {
  const pct = e.confiance !== null ? Math.round(Number(e.confiance) * 100) : null;
  if (pct === null) return null;
  return pct >= 85 ? (
    <span className="rounded-full bg-[#3DEFBE] px-[8px] py-[2px] text-[11px] font-bold text-[#0B3B63]">Sûr · {pct} %</span>
  ) : (
    <span className="rounded-full bg-[#DCEEF8] px-[8px] py-[2px] text-[11px] font-bold text-[#106F9F]">À confirmer · {pct} %</span>
  );
}

// L'image de référence de l'espèce proposée (Wikipédia), avec le lien vers sa fiche
function Reference({ nom, latin }: { nom: string; latin: string | null }) {
  const [ref, setRef] = useState<ImageReference | null | undefined>(undefined);
  useEffect(() => {
    let actif = true;
    void imageReference(nom, latin).then((r) => actif && setRef(r));
    return () => {
      actif = false;
    };
  }, [nom, latin]);
  return (
    <figure>
      <div className="flex h-[132px] items-center justify-center overflow-hidden rounded-[14px] bg-[#EEF4F9]">
        {ref === undefined ? (
          <span className="h-full w-full animate-pulse bg-[#E3EDF6]" />
        ) : ref ? (
          <img src={ref.url} alt={`Image de référence : ${nom}`} className="h-full w-full object-cover" />
        ) : (
          <span className="px-[10px] text-center text-[12px] leading-snug text-[#566B82]">Pas d'image de référence pour cette espèce</span>
        )}
      </div>
      <figcaption className="px-[2px] pt-[5px] text-[11.5px] font-semibold text-[#566B82]">
        {ref ? (
          <a href={ref.page} target="_blank" rel="noreferrer" className="text-[#106F9F] underline-offset-2 hover:underline">
            Référence (Wikipédia)
          </a>
        ) : (
          "Référence"
        )}
      </figcaption>
    </figure>
  );
}

function EspecesDetectees() {
  const navigate = useNavigate();
  const { id, depuis } = Route.useSearch();
  // On revient là d'où l'on vient : l'écran « Analyser mes photos », ou la fiche de la plongée (en lecture)
  const revenir = () =>
    depuis === "analyser" ? navigate({ to: "/especes/analyser" }) : id ? navigate({ to: "/nouvelle-plongee", search: { id } }) : navigate({ to: "/carnet" });
  const { pret, ecran } = useConnexionRequise();
  const [especes, setEspeces] = useState<EspecePlongee[] | null>(null);
  const [choix, setChoix] = useState<Record<string, Choix>>({});
  const [photos, setPhotos] = useState<PhotoGalerie[]>([]);
  const [site, setSite] = useState<{ nom: string; date: string | null }>({ nom: "", date: null });
  const [ajouts, setAjouts] = useState<string[]>([]);
  const [saisie, setSaisie] = useState<string | null>(null);
  const [enCours, setEnCours] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);

  useEffect(() => {
    if (!pret || !id) return;
    let actif = true;
    void chargerPlongee(id).then((l) => actif && l && setSite({ nom: l.site_name ?? "", date: l.dive_date }));
    void chargerGalerie(id)
      .then((g) => actif && setPhotos(g.filter((p) => p.moi)))
      .catch(() => undefined);
    chargerEspeces(id)
      .then((l) => {
        if (!actif) return;
        const proposees = l.filter((e) => e.statut === "proposee");
        setEspeces(proposees);
        // Les espèces sûres sont cochées d'avance ; les autres attendent ta décision.
        setChoix(Object.fromEntries(proposees.map((e) => [e.id, Number(e.confiance) >= 0.85 ? "garder" : null])));
      })
      .catch((e) => {
        console.error(e);
        if (actif) {
          setEspeces([]);
          setErreur("Les espèces n'ont pas pu être chargées.");
        }
      });
    return () => {
      actif = false;
    };
  }, [pret, id]);

  if (ecran) return ecran;

  const liste = especes ?? [];
  const photoDe = (mediaId: string | null) => photos.find((p) => p.id === mediaId);
  const couverture = photoDe(liste[0]?.media_id ?? null) ?? photos[0];
  const indexCouverture = couverture ? photos.indexOf(couverture) + 1 : 0;
  const nbGardees = Object.values(choix).filter((c) => c === "garder").length + ajouts.length;

  const valider = async () => {
    if (!id) return;
    setEnCours(true);
    setErreur(null);
    try {
      const decisions = Object.entries(choix)
        .filter(([, c]) => c !== null)
        .map(([eid, c]) => ({ id: eid, garder: c === "garder" }));
      await validerEspeces(id, decisions, ajouts);
      annoncerSurAccueil(nbGardees > 0 ? `${nbGardees} espèce${nbGardees > 1 ? "s" : ""} ajoutée${nbGardees > 1 ? "s" : ""} à ta plongée` : "C'est noté");
      revenir();
    } catch (e) {
      console.error(e);
      setErreur("Ta sélection n'a pas pu être enregistrée. Réessaie.");
      setEnCours(false);
    }
  };

  const ajouter = () => {
    const n = (saisie ?? "").trim();
    if (n && !ajouts.includes(n) && !liste.some((e) => e.nom.toLowerCase() === n.toLowerCase())) setAjouts((l) => [...l, n]);
    setSaisie(null);
  };

  const boutonChoix = (e: EspecePlongee, valeur: "garder" | "retirer") => {
    const actif = choix[e.id] === valeur;
    const Icone = valeur === "garder" ? Check : X;
    return (
      <button
        type="button"
        aria-label={valeur === "garder" ? `Garder ${e.nom}` : `Retirer ${e.nom}`}
        aria-pressed={actif}
        onClick={() => setChoix((c) => ({ ...c, [e.id]: actif ? null : valeur }))}
        className={`flex h-[38px] w-[38px] items-center justify-center galet-petit border-[1.5px] ${
          actif ? (valeur === "garder" ? "border-[#3DEFBE] bg-[#3DEFBE] text-[#0B3B63]" : "border-[#FF8A75] bg-[#FFE4DE] text-[#C2412F]") : "border-[#E4EBF1] bg-white text-[#566B82]"
        }`}
      >
        <Icone className="h-[17px] w-[17px]" strokeWidth={2.6} />
      </button>
    );
  };

  return (
    <div className="min-h-screen bg-[#F1F6FC] text-[#123A63]">
      <div className="cascade mx-auto flex min-h-screen w-full max-w-[430px] flex-col px-[22px] pb-[max(24px,env(safe-area-inset-bottom))] pt-[clamp(14px,2.6svh,22px)]">
        <div className="flex items-center justify-between">
          <button
            type="button"
            aria-label="Retour"
            onClick={revenir}
            className="flex h-10 w-10 items-center justify-center goutte bg-[#E3EDF6]"
          >
            <ChevronLeft className="h-[18px] w-[18px]" strokeWidth={2.4} />
          </button>
          <button type="button" onClick={revenir} className="px-[2px] py-[8px] text-[14.5px] font-medium text-[#566B82]">
            Passer
          </button>
        </div>
        <h1 className="pt-[12px] text-[26px] font-bold leading-tight">Espèces détectées</h1>

        {couverture && (
          <div className="mt-[14px] galet border border-[#DCE7F0] bg-white p-[7px] shadow-[0_4px_14px_#123A6308]">
            <div className="relative h-[170px] overflow-hidden galet-moyen bg-[#DCEEF8]">
              <img src={couverture.url} alt="" className="h-full w-full object-cover" />
              {liste.length > 0 && (
                <span className="absolute left-[10px] top-[10px] rounded-full bg-white px-[10px] py-[4px] text-[11.5px] font-bold">
                  {liste.length} espèce{liste.length > 1 ? "s" : ""} détectée{liste.length > 1 ? "s" : ""}
                </span>
              )}
            </div>
            <p className="px-[8px] pb-[4px] pt-[8px] text-[12.5px] text-[#566B82]">
              {[site.nom, site.date ? dateCourte(site.date) : null, photos.length ? `photo ${indexCouverture} sur ${photos.length}` : null].filter(Boolean).join(" · ")}
            </p>
          </div>
        )}

        <p className="pt-[14px] text-[13.5px] leading-snug text-[#566B82]">L'app propose, tu valides. Rien n'est ajouté à la plongée sans ton accord.</p>

        {especes === null && <div className="mt-[12px] h-[180px] animate-pulse galet bg-white" />}

        <div className="flex flex-col gap-[10px] pt-[12px]">
          {liste.map((e, i) => {
            const ph = photoDe(e.media_id);
            return (
              <div key={e.id} className={`relative ${["galet", "galet-b", "galet-c"][i % 3]} border border-[#DCE7F0] bg-white p-[10px] shadow-[0_4px_14px_#123A6308]`}>
                {i === 0 && <Meduse className="-right-[6px] -top-[18px]" />}
                {/* Ta photo et une image de référence, côte à côte, pour comparer avant de valider */}
                <div className="grid grid-cols-2 gap-[8px]">
                  <figure>
                    <div className="flex h-[132px] items-center justify-center overflow-hidden rounded-[14px] bg-[#E3F4FC]">
                      {ph ? <img src={ph.url} alt={`Ta photo, où l'IA voit : ${e.nom}`} className="h-full w-full object-cover" /> : <Eye className="h-[22px] w-[22px] text-[#8FBAD4]" strokeWidth={1.8} />}
                    </div>
                    <figcaption className="px-[2px] pt-[5px] text-[11.5px] font-semibold text-[#566B82]">Ta photo</figcaption>
                  </figure>
                  <Reference nom={e.nom} latin={e.nom_latin} />
                </div>
                <div className="flex items-center gap-[12px] px-[4px] pt-[10px]">
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[16px] font-bold">{e.nom}</span>
                    {e.nom_latin && <span className="block truncate text-[12.5px] italic text-[#566B82]">{e.nom_latin}</span>}
                    <span className="flex flex-wrap items-center gap-[6px] pt-[5px]">
                      <Pastille e={e} />
                      {e.alternative && <span className="truncate text-[11.5px] text-[#566B82]">ou {e.alternative}</span>}
                    </span>
                  </span>
                  <span className="flex gap-[6px]">
                    {boutonChoix(e, "garder")}
                    {boutonChoix(e, "retirer")}
                  </span>
                </div>
              </div>
            );
          })}

          {ajouts.map((n) => (
            <div key={n} className="flex items-center gap-[12px] galet-b border border-[#DCE7F0] bg-white px-[12px] py-[12px]">
              <span className="flex h-[58px] w-[58px] shrink-0 items-center justify-center goutte bg-[#E3F4FC]">
                <Eye className="h-[20px] w-[20px] text-[#8FBAD4]" strokeWidth={1.8} />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[16px] font-bold">{n}</span>
                <span className="mt-[5px] inline-block rounded-full bg-[#E6ECF2] px-[8px] py-[2px] text-[11px] font-bold text-[#566B82]">Ajoutée par toi</span>
              </span>
              <button type="button" aria-label={`Retirer ${n}`} onClick={() => setAjouts((l) => l.filter((x) => x !== n))} className="flex h-[38px] w-[38px] items-center justify-center galet-petit border-[1.5px] border-[#7B8FA3] text-[#566B82]">
                <X className="h-[17px] w-[17px]" strokeWidth={2.6} />
              </button>
            </div>
          ))}

          {especes && liste.length === 0 && ajouts.length === 0 && saisie === null && (
            <div className="flex items-center gap-[12px] galet-c border border-[#DCE7F0] bg-white px-[12px] py-[14px]">
              <span className="flex h-[58px] w-[58px] shrink-0 items-center justify-center goutte bg-[#E3F4FC]">
                <Eye className="h-[20px] w-[20px] text-[#8FBAD4]" strokeWidth={1.8} />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-[16px] font-bold">Espèce non reconnue</span>
                <span className="block text-[12.5px] italic text-[#566B82]">Nomme-la toi-même</span>
                <span className="mt-[5px] inline-block rounded-full bg-[#E6ECF2] px-[8px] py-[2px] text-[11px] font-bold text-[#566B82]">Non identifiée</span>
              </span>
            </div>
          )}
        </div>

        {saisie !== null ? (
          <div className="mt-[12px] flex gap-[8px]">
            <input
              autoFocus
              value={saisie}
              onChange={(e) => setSaisie(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && ajouter()}
              list="especes-courantes"
              placeholder="Nom de l'espèce (ex. Murène)"
              aria-label="Nom de l'espèce"
              className="h-[50px] min-w-0 flex-1 galet-moyen border-[1.5px] border-[#57D4F5] bg-white px-[14px] text-[15px] outline-none"
            />
            <datalist id="especes-courantes">
              {ESPECES_COURANTES.map(([n]) => (
                <option key={n} value={n} />
              ))}
            </datalist>
            <button type="button" onClick={ajouter} className="h-[50px] galet-moyen bg-[#3DEFBE] px-[18px] text-[13px] font-bold text-[#0B3B63]">
              OK
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setSaisie("")}
            className="mt-[14px] flex h-[52px] w-full items-center justify-center gap-[8px] galet-moyen border-[1.5px] border-[#57D4F5] bg-white text-[14px] font-bold text-[#106F9F]"
          >
            <Plus className="h-[16px] w-[16px]" strokeWidth={2.6} aria-hidden="true" />
            AJOUTER UNE ESPÈCE
          </button>
        )}

        <div className="min-h-[22px] flex-grow" />
        {erreur && <p className="pb-[10px] text-center text-[13px] text-[#8A2A1A]">{erreur}</p>}
        <button
          type="button"
          disabled={enCours || (liste.length === 0 && ajouts.length === 0)}
          onClick={() => void valider()}
          className="mt-[14px] flex h-[56px] w-full items-center justify-center galet-moyen bg-[#3DEFBE] text-[14px] font-bold tracking-wide text-[#0B3B63] shadow-[0_6px_16px_#3DEFBE40] disabled:opacity-50"
        >
          {enCours ? "ENREGISTREMENT…" : "VALIDER LES ESPÈCES"}
        </button>
      </div>
    </div>
  );
}
