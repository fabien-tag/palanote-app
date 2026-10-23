import { useCallback, useEffect, useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { ChevronLeft, ChevronRight, Clock } from "lucide-react";
import { BandeauConfirmation } from "@/components/BandeauConfirmation";
import { Meduse, useConnexionRequise } from "@/components/numerisation/Ui";
import {
  ajouterPlongeeIdentifiee,
  chiffresPlongee,
  couleurAvatar,
  dateCourte,
  initiales,
  mesBinomes,
  plongeesEnsemble,
  plongeesEnsembleTexte,
  retirerBinome,
  type PlongeeEnsemble,
  type Plongeur,
} from "@/lib/amis";

// Fiche d'un binôme : uniquement les plongées faites ensemble.
export const Route = createFileRoute("/amis_/binome")({
  validateSearch: (search: Record<string, unknown>): { id?: string | undefined } => ({
    id: typeof search["id"] === "string" ? search["id"] : undefined,
  }),
  head: () => ({ meta: [{ title: "Palanote — Binôme" }] }),
  component: FicheBinome,
});

const MOIS = ["janvier", "février", "mars", "avril", "mai", "juin", "juillet", "août", "septembre", "octobre", "novembre", "décembre"];

function FicheBinome() {
  const navigate = useNavigate();
  const { id } = Route.useSearch();
  const { pret, ecran } = useConnexionRequise();
  const [ami, setAmi] = useState<Plongeur | null | undefined>(undefined);
  const [plongees, setPlongees] = useState<PlongeeEnsemble[] | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [ajoutEnCours, setAjoutEnCours] = useState<string | null>(null);
  const finMessage = useCallback(() => setMessage(null), []);
  const [confirmerRetrait, setConfirmerRetrait] = useState(false);
  const [retraitEnCours, setRetraitEnCours] = useState(false);
  const retirer = async () => {
    if (!id || retraitEnCours) return;
    setRetraitEnCours(true);
    try {
      await retirerBinome(id);
      navigate({ to: "/amis", replace: true });
    } catch (e) {
      console.error(e);
      setErreur("Le binôme n'a pas pu être retiré. Vérifie ta connexion et réessaie.");
      setRetraitEnCours(false);
    }
  };

  useEffect(() => {
    if (!pret || !id) return;
    let actif = true;
    (async () => {
      try {
        const liste = await mesBinomes();
        if (!actif) return;
        const trouve = liste.find((b) => b.id === id) ?? null;
        setAmi(trouve);
        if (!trouve) return;
        const p = await plongeesEnsemble(id).catch((e) => {
          console.error(e);
          return [] as PlongeeEnsemble[];
        });
        if (actif) setPlongees(p);
      } catch (e) {
        console.error(e);
        if (actif) {
          setAmi(null);
          setErreur("Cette fiche n'a pas pu être chargée.");
        }
      }
    })();
    return () => {
      actif = false;
    };
  }, [pret, id]);

  const ajouter = async (p: PlongeeEnsemble) => {
    setAjoutEnCours(p.id);
    try {
      const maPlongee = await ajouterPlongeeIdentifiee(p.id);
      setPlongees((l) => (l ?? []).map((x) => (x.id === p.id ? { ...x, statut: "ajoutee", ma_plongee: maPlongee } : x)));
      setMessage("La plongée a été ajoutée à ton carnet");
    } catch (e) {
      console.error(e);
      setErreur("La plongée n'a pas pu être ajoutée. Réessaie.");
    } finally {
      setAjoutEnCours(null);
    }
  };

  if (ecran) return ecran;

  const depuis = ami?.depuis ? new Date(ami.depuis) : null;

  return (
    <div className="min-h-screen bg-[#F1F6FC] text-[#123A63]">
      {message && <BandeauConfirmation texte={message} onFin={finMessage} />}
      <div className="cascade mx-auto flex min-h-screen w-full max-w-[430px] flex-col px-[22px] pb-[max(24px,env(safe-area-inset-bottom))] pt-[clamp(14px,2.6svh,22px)]">
        <div className="flex items-center gap-3">
          <button
            type="button"
            aria-label="Retour"
            onClick={() => navigate({ to: "/amis" })}
            className="flex h-10 w-10 items-center justify-center goutte bg-[#E3EDF6]"
          >
            <ChevronLeft className="h-[18px] w-[18px]" strokeWidth={2.4} />
          </button>
          <h1 className="text-[17px] font-bold">Binôme</h1>
        </div>

        {ami === null && (
          <p className="pt-[18svh] text-center text-[14.5px] text-[#566B82]">{erreur ?? "Ce plongeur ne fait pas partie de tes binômes."}</p>
        )}

        {ami && (
          <>
            {/* Carte du binôme */}
            <div className="mt-[22px] flex flex-col items-center text-center">
              <span
                className="flex h-[76px] w-[76px] items-center justify-center rounded-full border-[3px] border-white text-[24px] font-bold text-[#0F3D70] shadow-[0_6px_18px_rgba(15,61,112,.12)]"
                style={{ background: couleurAvatar(ami.id) }}
              >
                {initiales(ami.prenom)}
              </span>
              <h2 className="pt-[12px] text-[22px] font-bold">{ami.prenom}</h2>
              {(ami.niveau || ami.club) && <p className="text-[13.5px] text-[#566B82]">{[ami.niveau, ami.club].filter(Boolean).join(" · ")}</p>}
              <div className="mt-[12px] flex flex-wrap justify-center gap-[8px]">
                <span className="rounded-full bg-[#3DEFBE]/25 px-[12px] py-[5px] text-[12.5px] font-semibold text-[#0B6B52]">
                  {plongeesEnsembleTexte(plongees?.length ?? 0)}
                </span>
                {depuis && (
                  <span className="rounded-full bg-[#E3EDF6] px-[12px] py-[5px] text-[12.5px] font-semibold text-[#566B82]">
                    Binômes depuis {MOIS[depuis.getMonth()]} {depuis.getFullYear()}
                  </span>
                )}
              </div>
            </div>

            <h3 className="pb-[10px] pt-[26px] text-[17px] font-bold">Vos plongées ensemble</h3>

            {plongees && plongees.length === 0 && (
              <div className="relative galet-c border border-[#CFE6F3] bg-[#E3F2FB]/80 p-[14px] text-[13px] leading-normal">
                Aucune plongée ensemble pour l'instant. Dans une fiche de plongée, ajoute <b>{ami.prenom}</b> dans <b>Palanquée › Binômes</b> : la
                plongée apparaîtra ici et lui sera proposée dans son carnet.
                <Meduse className="-right-[8px] -top-[14px]" />
              </div>
            )}

            <div className="flex flex-col gap-[10px]">
              {(plongees ?? []).map((p) => {
                const ouvrable = Boolean(p.ma_plongee);
                const recue = !p.identifie_par_moi && p.statut === "a_confirmer";
                const contenu = (
                  <>
                    <div className="min-w-0 flex-1">
                      <div className="text-[12px] font-semibold uppercase tracking-[.04em] text-[#566B82]">{dateCourte(p.date)}</div>
                      <div className="truncate text-[15.5px] font-bold">{p.site || "Site non renseigné"}</div>
                      {(p.lieu || chiffresPlongee(p)) && (
                        <div className="truncate pt-[1px] text-[12.5px] text-[#566B82]">{[p.lieu, chiffresPlongee(p)].filter(Boolean).join(" · ")}</div>
                      )}
                      {p.identifie_par_moi && p.statut === "a_confirmer" && (
                        <span className="mt-[7px] inline-flex items-center gap-[5px] rounded-full bg-[#FFE6CC] px-[9px] py-[3px] text-[11px] font-semibold text-[#C2570C]">
                          <Clock className="h-[11px] w-[11px]" strokeWidth={2.6} aria-hidden="true" />
                          En attente de {ami.prenom}
                        </span>
                      )}
                    </div>
                    {ouvrable && <ChevronRight className="h-[18px] w-[18px] shrink-0 text-[#566B82]" aria-hidden="true" />}
                  </>
                );
                const classe = "flex w-full items-center gap-[12px] galet border border-[#DCE7F0] bg-white px-[15px] py-[13px] text-left shadow-[0_4px_14px_#123A6308]";
                return (
                  <div key={p.id}>
                    {ouvrable ? (
                      <button type="button" className={classe} onClick={() => navigate({ to: "/nouvelle-plongee", search: { id: p.ma_plongee! } })}>
                        {contenu}
                      </button>
                    ) : (
                      <div className={classe}>{contenu}</div>
                    )}
                    {recue && (
                      <button
                        type="button"
                        disabled={ajoutEnCours === p.id}
                        onClick={() => navigate({ to: "/amis/proposition", search: { id: p.id } })}
                        className="mt-[6px] flex h-[42px] w-full items-center justify-center galet-moyen bg-[#3DEFBE] text-[13px] font-bold text-[#0B3B63] disabled:opacity-60"
                      >
                        AJOUTER À MON CARNET
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
            {erreur && <p className="pt-3 text-center text-[13px] text-[#8A2A1A]">{erreur}</p>}
            <p className="pt-[18px] text-center text-[11.5px] leading-normal text-[#566B82]">
              Tu ne vois que les plongées faites ensemble. Le reste du carnet de {ami.prenom} reste privé.
            </p>
            <div className="pt-[22px] text-center">
              {!confirmerRetrait ? (
                <button type="button" onClick={() => setConfirmerRetrait(true)} className="text-[13.5px] font-semibold text-[#B8432F] underline underline-offset-4">
                  Retirer {ami.prenom} de mes binômes
                </button>
              ) : (
                <div className="galet-b border border-[#F2C9C0] bg-white p-[14px] text-left text-[13px] leading-normal">
                  <p>
                    Vous ne serez plus binômes, des deux côtés. Les plongées déjà dans vos carnets restent. Pour vous retrouver, il faudra un nouveau QR code.
                  </p>
                  <div className="flex gap-[10px] pt-[12px]">
                    <button
                      type="button"
                      disabled={retraitEnCours}
                      onClick={() => void retirer()}
                      className="h-[42px] flex-1 rounded-full bg-[#B8432F] text-[13.5px] font-bold text-white disabled:opacity-60"
                    >
                      {retraitEnCours ? "Retrait…" : "Retirer"}
                    </button>
                    <button type="button" onClick={() => setConfirmerRetrait(false)} className="h-[42px] flex-1 rounded-full bg-[#E7EFF6] text-[13.5px] font-bold text-[#123A63]">
                      Annuler
                    </button>
                  </div>
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
