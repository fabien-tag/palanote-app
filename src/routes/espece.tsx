import { useEffect, useMemo, useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { ChevronLeft, Fish, MapPin, Share2, ShieldAlert } from "lucide-react";
import { Meduse, useConnexionRequise } from "@/components/numerisation/Ui";
import { estProtegee, latinDe, mesEspecesValidees, normaliser, statsEspece, urlPhotoMedia } from "@/lib/especes";
import { cacheCarnetEnMemoire, chargerPlongees, type CartePlongee } from "@/lib/plongees";
import { cleSpot, regrouperEnSpots } from "@/lib/spots";

// Écran 47 : la fiche d'une espèce, vue depuis mon carnet.
export const Route = createFileRoute("/espece")({
  validateSearch: (search: Record<string, unknown>): { nom?: string | undefined } => ({
    nom: typeof search["nom"] === "string" ? search["nom"] : undefined,
  }),
  head: () => ({ meta: [{ title: "Palanote — Fiche espèce" }] }),
  component: FicheEspece,
});

const INITIALES_MOIS = ["J", "F", "M", "A", "M", "J", "J", "A", "S", "O", "N", "D"];

function FicheEspece() {
  const navigate = useNavigate();
  const { nom = "" } = Route.useSearch();
  const { pret, ecran } = useConnexionRequise();
  const [plongees, setPlongees] = useState<CartePlongee[]>(() => cacheCarnetEnMemoire()?.plongees ?? []);
  const [latin, setLatin] = useState<string | null>(() => latinDe(nom));
  const [photo, setPhoto] = useState<string | null>(null);

  useEffect(() => {
    if (!pret) return;
    let actif = true;
    void chargerPlongees()
      .then((p) => actif && setPlongees(p))
      .catch(() => undefined);
    void mesEspecesValidees()
      .then(async (l) => {
        const miennes = l.filter((e) => normaliser(e.nom) === normaliser(nom));
        const avecLatin = miennes.find((e) => e.nom_latin);
        if (actif && avecLatin?.nom_latin) setLatin(avecLatin.nom_latin);
        const avecPhoto = miennes.find((e) => e.media_id);
        if (avecPhoto?.media_id) {
          const url = await urlPhotoMedia(avecPhoto.media_id);
          if (actif) setPhoto(url);
        }
      })
      .catch(() => undefined);
    return () => {
      actif = false;
    };
  }, [pret, nom]);

  const stats = useMemo(() => statsEspece(nom, plongees), [nom, plongees]);
  // Les sites où je l'ai croisée (mêmes fiches de site que l'onglet Carte)
  const sites = useMemo(() => {
    const cle = normaliser(nom);
    return regrouperEnSpots(plongees)
      .map((s) => ({ s, n: s.plongees.filter((p) => (p.faune ?? []).some((f) => normaliser(f) === cle)).length }))
      .filter((x) => x.n > 0)
      .sort((a, b) => b.n - a.n);
  }, [nom, plongees]);

  if (ecran) return ecran;

  const max = Math.max(1, ...stats.parMois);
  const protegee = estProtegee(nom);

  const partager = async () => {
    const texte = `J'ai croisé ${nom} ${stats.observations} fois en plongée${sites[0] ? `, surtout à ${sites[0].s.nom}` : ""}. Noté sur Palanote.`;
    try {
      if (navigator.share) await navigator.share({ title: nom, text: texte });
      else await navigator.clipboard.writeText(texte);
    } catch {
      /* partage annulé */
    }
  };

  return (
    <div className="min-h-screen bg-[#F1F6FC] text-[#123A63]">
      <div className="cascade mx-auto flex min-h-screen w-full max-w-[430px] flex-col px-[22px] pb-[max(24px,env(safe-area-inset-bottom))] pt-[clamp(14px,2.6svh,22px)]">
        <div className="flex items-center justify-between">
          <button type="button" aria-label="Retour" onClick={() => window.history.length > 1 ? window.history.back() : navigate({ to: "/especes" })} className="flex h-10 w-10 items-center justify-center goutte bg-[#E3EDF6]">
            <ChevronLeft className="h-[18px] w-[18px]" strokeWidth={2.4} />
          </button>
          <button type="button" aria-label="Partager" onClick={() => void partager()} className="flex h-10 w-10 items-center justify-center goutte bg-[#E3EDF6]">
            <Share2 className="h-[17px] w-[17px]" strokeWidth={2.2} />
          </button>
        </div>

        <div className="mt-[14px] galet border border-[#DCE7F0] bg-white p-[7px] shadow-[0_4px_14px_#123A6308]">
          <div className="flex h-[170px] items-center justify-center overflow-hidden galet-moyen bg-[linear-gradient(150deg,#BFE6F5,#E3F4FC)]">
            {photo ? <img src={photo} alt={nom} className="h-full w-full object-cover" /> : <Fish className="h-[46px] w-[46px] text-[#8FBAD4]" strokeWidth={1.4} aria-hidden="true" />}
          </div>
          <div className="px-[10px] pb-[8px] pt-[10px]">
            <h1 className="text-[24px] font-bold leading-tight">{nom}</h1>
            {latin && <p className="text-[14px] italic text-[#1176A8]">{latin}</p>}
          </div>
        </div>

        <div className="relative mt-[12px] grid grid-cols-3 galet-b border border-[#DCE7F0] bg-white px-[8px] py-[14px] text-center shadow-[0_4px_14px_#123A6308]">
          <Meduse className="-right-[4px] -top-[14px]" />
          <div>
            <b className="block text-[20px] leading-tight">{stats.observations}</b>
            <small className="text-[11.5px] text-[#9DB0C0]">observation{stats.observations > 1 ? "s" : ""}</small>
          </div>
          <div>
            <b className="block text-[20px] leading-tight">{sites.length}</b>
            <small className="text-[11.5px] text-[#9DB0C0]">site{sites.length > 1 ? "s" : ""}</small>
          </div>
          <div>
            <b className="block text-[20px] leading-tight">{stats.meilleurMois ?? "—"}</b>
            <small className="text-[11.5px] text-[#9DB0C0]">le meilleur mois</small>
          </div>
        </div>

        {stats.observations > 0 && (
          <div className="mt-[12px] galet-c border border-[#DCE7F0] bg-white px-[16px] py-[14px] shadow-[0_4px_14px_#123A6308]">
            <h2 className="text-[15px] font-bold">Quand tu l'as croisé</h2>
            <p className="text-[12px] text-[#9DB0C0]">
              observations par mois, sur tes {stats.observations} rencontre{stats.observations > 1 ? "s" : ""}
            </p>
            <div className="flex h-[120px] items-end gap-[6px] pt-[16px]" aria-hidden="true">
              {stats.parMois.map((n, i) => (
                <div key={i} className="flex flex-1 flex-col items-center justify-end gap-[4px]">
                  {n === max && n > 0 && <span className="text-[11px] font-bold">{n}</span>}
                  <span className={`w-full rounded-[4px] ${n ? "bg-[#57B8E6]" : "bg-[#E4EBF1]"}`} style={{ height: n ? `${Math.max(8, (n / max) * 78)}px` : "3px" }} />
                </div>
              ))}
            </div>
            <div className="flex gap-[6px] pt-[6px]">
              {INITIALES_MOIS.map((m, i) => (
                <span key={i} className={`flex-1 text-center text-[10.5px] ${stats.parMois[i] === max && max > 0 ? "font-bold text-[#123A63]" : "text-[#9DB0C0]"}`}>
                  {m}
                </span>
              ))}
            </div>
          </div>
        )}

        {sites.length > 0 && (
          <div className="mt-[12px] overflow-hidden galet border border-[#DCE7F0] bg-white shadow-[0_4px_14px_#123A6308]">
            {sites.slice(0, 6).map(({ s, n }) => (
              <button
                key={s.id}
                type="button"
                onClick={() => navigate({ to: "/site", search: { cle: cleSpot(s) } })}
                className="flex w-full items-center gap-[12px] border-t border-[#EDF2F7] px-[14px] py-[12px] text-left first:border-t-0"
              >
                <span className="flex h-[36px] w-[36px] shrink-0 items-center justify-center goutte bg-[#E3F4FC]">
                  <MapPin className="h-[16px] w-[16px] text-[#1176A8]" strokeWidth={2.2} aria-hidden="true" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[15px] font-bold">{s.nom}</span>
                  {s.ville && <span className="block truncate text-[12.5px] text-[#9DB0C0]">{s.ville}</span>}
                </span>
                <span className="text-[12.5px] font-bold text-[#5B7189]">{n}×</span>
              </button>
            ))}
          </div>
        )}

        {stats.observations === 0 && <p className="pt-[18px] text-center text-[14px] text-[#5B7189]">Pas encore croisé dans ton carnet.</p>}

        {protegee && (
          <div className="mt-[12px] flex gap-[10px] galet-moyen border border-[#BFE6F5] bg-[#E3F4FC] px-[14px] py-[12px] text-[13px] leading-snug">
            <ShieldAlert className="mt-[1px] h-[17px] w-[17px] shrink-0 text-[#1176A8]" strokeWidth={2.2} aria-hidden="true" />
            <span>
              <b>Espèce protégée.</b> La position de tes plongées n'est jamais partagée avec les autres plongeurs : on ne peut pas remonter jusqu'à ses sites depuis Palanote.
            </span>
          </div>
        )}
      </div>
    </div>
  );
}
