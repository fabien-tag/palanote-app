import { useEffect, useRef, useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { ChevronLeft, Eye, Plus, X } from "lucide-react";
import { Meduse, useConnexionRequise } from "@/components/numerisation/Ui";
import { couleurAvatar, dateCourte, heureCourte, initiales } from "@/lib/amis";
import { chargerEspeces, type EspecePlongee } from "@/lib/especes";
import { chargerGalerie, nomCourt, type PhotoGalerie } from "@/lib/galerie";
import { enregistrerPhotosPlongee } from "@/lib/photos-plongee";
import { chargerPlongee } from "@/lib/plongees";

// Galerie commune d'une plongée (écrans 42 et 43) : mes photos et celles que la palanquée partage.
export const Route = createFileRoute("/plongee/photos")({
  validateSearch: (search: Record<string, unknown>): { id?: string | undefined } => ({
    id: typeof search["id"] === "string" ? search["id"] : undefined,
  }),
  head: () => ({ meta: [{ title: "Palanote — Les photos de la plongée" }] }),
  component: GaleriePlongee,
});

const VISIBLES = 8;

function Badge({ photo, taille = 22 }: { photo: PhotoGalerie; taille?: number }) {
  return (
    <span
      className="flex items-center justify-center rounded-full border-2 border-white font-bold text-[#0F3D70]"
      style={{ background: couleurAvatar(photo.auteur.id), width: taille, height: taille, fontSize: Math.round(taille * 0.38) }}
    >
      {initiales(photo.auteur.prenom)}
    </span>
  );
}

function GaleriePlongee() {
  const navigate = useNavigate();
  const { id } = Route.useSearch();
  const { pret, ecran } = useConnexionRequise();
  const [photos, setPhotos] = useState<PhotoGalerie[] | null>(null);
  const [site, setSite] = useState<{ nom: string; date: string | null }>({ nom: "", date: null });
  const [especes, setEspeces] = useState<EspecePlongee[]>([]);
  const [tout, setTout] = useState(false);
  const [ouverte, setOuverte] = useState<number | null>(null);
  const [envoi, setEnvoi] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);
  const fichiers = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!pret || !id) return;
    let actif = true;
    void chargerPlongee(id).then((l) => actif && l && setSite({ nom: l.site_name ?? "", date: l.dive_date }));
    void chargerEspeces(id)
      .then((e) => actif && setEspeces(e.filter((x) => x.statut === "validee")))
      .catch(() => undefined);
    chargerGalerie(id)
      .then((g) => actif && setPhotos(g))
      .catch((e) => {
        console.error(e);
        if (!actif) return;
        setPhotos([]);
        const msg = e && typeof e === "object" && "message" in e ? String(e.message) : "";
        setErreur(msg.includes("galerie_plongee") ? "Lance d'abord le script palanote-photos-especes.sql dans Supabase." : "Les photos n'ont pas pu être chargées.");
      });
    return () => {
      actif = false;
    };
  }, [pret, id]);

  if (ecran) return ecran;

  // « Toi 3 · Mélissa 12 · Claire 9 »
  const parAuteur = new Map<string, { nom: string; n: number; photo: PhotoGalerie }>();
  for (const p of photos ?? []) {
    const k = p.auteur.id;
    const e = parAuteur.get(k) ?? { nom: nomCourt(p.auteur, p.moi), n: 0, photo: p };
    e.n += 1;
    parAuteur.set(k, e);
  }
  const auteurs = [...parAuteur.values()].sort((a, b) => (a.nom === "Toi" ? -1 : b.nom === "Toi" ? 1 : b.n - a.n));
  const liste = photos ?? [];
  const affichees = tout || liste.length <= VISIBLES + 1 ? liste : liste.slice(0, VISIBLES);
  const reste = liste.length - affichees.length;

  const ajouter = async (fs: File[]) => {
    if (!id || fs.length === 0) return;
    setEnvoi(true);
    setErreur(null);
    try {
      await enregistrerPhotosPlongee(
        id,
        fs.map((f) => ({ url: "", fichier: f })),
        [],
      );
      navigate({ to: "/plongee/partage", search: { id } });
    } catch (e) {
      console.error(e);
      setErreur("Tes photos n'ont pas pu être envoyées. Réessaie.");
      setEnvoi(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#F1F6FC] text-[#123A63]">
      <div className="cascade mx-auto flex min-h-screen w-full max-w-[430px] flex-col px-[22px] pb-[max(24px,env(safe-area-inset-bottom))] pt-[clamp(14px,2.6svh,22px)]">
        <div className="flex items-center justify-between">
          <button
            type="button"
            aria-label="Retour"
            onClick={() => (id ? navigate({ to: "/nouvelle-plongee", search: { id } }) : navigate({ to: "/carnet" }))}
            className="flex h-10 w-10 items-center justify-center goutte bg-[#E3EDF6]"
          >
            <ChevronLeft className="h-[18px] w-[18px]" strokeWidth={2.4} />
          </button>
          {liste.some((p) => p.moi) && id && (
            <button type="button" onClick={() => navigate({ to: "/plongee/partage", search: { id } })} className="px-[2px] py-[8px] text-[14px] font-bold text-[#1176A8]">
              Ce que je partage
            </button>
          )}
        </div>
        <h1 className="pt-[12px] text-[26px] font-bold leading-tight">Les photos de la plongée</h1>
        <p className="pt-[2px] text-[13.5px] text-[#5B7189]">{[site.nom, site.date ? dateCourte(site.date) : null].filter(Boolean).join(" · ")}</p>

        {photos === null && <div className="mt-[18px] h-[260px] animate-pulse galet bg-white" />}

        {photos && liste.length > 0 && (
          <>
            <div className="relative mt-[16px] flex items-center gap-[12px] galet border border-[#DCE7F0] bg-white px-[15px] py-[12px] shadow-[0_4px_14px_#123A6308]">
              <Meduse className="-right-[4px] -top-[14px]" />
              <span className="flex">
                {auteurs.slice(0, 4).map((a, i) => (
                  <span key={a.photo.auteur.id} style={{ marginLeft: i ? -8 : 0 }}>
                    <Badge photo={a.photo} taille={30} />
                  </span>
                ))}
              </span>
              <span className="min-w-0">
                <span className="block text-[14px] font-bold">
                  {liste.length} photo{liste.length > 1 ? "s" : ""}, {auteurs.length} plongeur{auteurs.length > 1 ? "s" : ""}.
                </span>
                <span className="block truncate text-[12.5px] text-[#5B7189]">{auteurs.map((a) => `${a.nom} ${a.n}`).join(" · ")}</span>
              </span>
            </div>

            <div className="grid grid-cols-3 gap-[8px] pt-[16px]">
              {affichees.map((p, i) => (
                <button key={p.id} type="button" onClick={() => setOuverte(i)} aria-label={`Photo ${i + 1}, de ${nomCourt(p.auteur, p.moi)}`} className="relative aspect-square overflow-hidden galet-petit bg-[#DCEEF8]">
                  <img src={p.url} alt="" loading="lazy" className="h-full w-full object-cover" />
                  <span className="absolute bottom-[6px] left-[6px]">
                    <Badge photo={p} />
                  </span>
                </button>
              ))}
              {reste > 0 && (
                <button type="button" onClick={() => setTout(true)} className="flex aspect-square items-center justify-center galet-petit bg-[#DCEEF8] text-[18px] font-bold text-[#5B7189]">
                  +{reste}
                </button>
              )}
            </div>
          </>
        )}

        {photos && liste.length === 0 && (
          <p className="pt-[16svh] text-center text-[14.5px] leading-normal text-[#5B7189]">
            {erreur ?? "Pas encore de photos pour cette plongée. Ajoute les tiennes : tes binômes pourront les voir si tu les partages."}
          </p>
        )}

        <div className="min-h-[22px] flex-grow" />
        {erreur && liste.length > 0 && <p className="pb-[10px] text-center text-[13px] text-[#8A2A1A]">{erreur}</p>}
        <button
          type="button"
          disabled={envoi || !id}
          onClick={() => fichiers.current?.click()}
          className="mt-[18px] flex h-[56px] w-full items-center justify-center gap-[10px] galet-moyen bg-[#3DEFBE] text-[14px] font-bold tracking-wide text-[#0B3B63] shadow-[0_6px_16px_#3DEFBE40] disabled:opacity-60"
        >
          {!envoi && <Plus className="h-[18px] w-[18px]" strokeWidth={2.6} aria-hidden="true" />}
          {envoi ? "ENVOI DES PHOTOS…" : "AJOUTER MES PHOTOS"}
        </button>
        <input
          ref={fichiers}
          type="file"
          accept="image/*"
          multiple
          hidden
          onChange={(e) => {
            void ajouter(Array.from(e.target.files ?? []));
            e.target.value = "";
          }}
        />
      </div>

      {ouverte !== null && liste[ouverte] && (
        <Visionneuse photos={liste} depart={ouverte} especes={especes} onFermer={() => setOuverte(null)} />
      )}
    </div>
  );
}

// Écran 43 : une photo, son auteur, et ce qu'on y a vu.
function Visionneuse({ photos, depart, especes, onFermer }: { photos: PhotoGalerie[]; depart: number; especes: EspecePlongee[]; onFermer: () => void }) {
  const navigate = useNavigate();
  const piste = useRef<HTMLDivElement>(null);
  const [index, setIndex] = useState(depart);

  useEffect(() => {
    const el = piste.current;
    if (el) el.scrollLeft = depart * el.clientWidth;
    const echap = (e: KeyboardEvent) => e.key === "Escape" && onFermer();
    window.addEventListener("keydown", echap);
    const ancien = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", echap);
      document.body.style.overflow = ancien;
    };
  }, [depart, onFermer]);

  const photo = photos[Math.min(index, photos.length - 1)]!;
  const surLaPhoto = especes.filter((e) => e.media_id === photo.id);

  return (
    <div role="dialog" aria-modal="true" aria-label="Photo de la plongée" className="fixed inset-0 z-50 flex flex-col bg-[#04142A] text-white">
      <div className="flex items-center justify-between px-[18px] pb-[10px] pt-[max(16px,env(safe-area-inset-top))]">
        <button type="button" onClick={onFermer} aria-label="Fermer" className="flex h-10 w-10 items-center justify-center goutte bg-white/15">
          <X className="h-5 w-5" strokeWidth={2.2} />
        </button>
        <span className="text-[14px] font-semibold text-white/85">
          {index + 1} sur {photos.length}
        </span>
        <span className="w-10" />
      </div>
      <div
        ref={piste}
        onScroll={(e) => setIndex(Math.round(e.currentTarget.scrollLeft / Math.max(1, e.currentTarget.clientWidth)))}
        className="flex flex-1 snap-x snap-mandatory overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        {photos.map((p, i) => (
          <div key={p.id} className="flex h-full w-full shrink-0 snap-center items-center justify-center px-[8px]">
            <img src={p.url} alt={`Photo ${i + 1}`} className="max-h-full max-w-full object-contain" draggable={false} />
          </div>
        ))}
      </div>
      <div className="mx-auto w-full max-w-[430px] px-[20px] pb-[max(22px,env(safe-area-inset-bottom))] pt-[16px]">
        <div className="flex items-center gap-[12px]">
          <span
            className="flex h-[42px] w-[42px] items-center justify-center rounded-full text-[15px] font-bold text-[#0F3D70]"
            style={{ background: couleurAvatar(photo.auteur.id) }}
          >
            {initiales(photo.auteur.prenom)}
          </span>
          <div className="min-w-0 flex-1">
            <div className="truncate text-[16px] font-bold">{photo.moi ? "Toi" : photo.auteur.prenom}</div>
            <div className="text-[12.5px] text-white/65">ajoutée à {heureCourte(photo.cree_le)}</div>
          </div>
          {!photo.moi && <span className="rounded-full border border-white/25 px-[10px] py-[4px] text-[11px] font-bold uppercase tracking-[.06em] text-white/80">Empruntée</span>}
        </div>
        {surLaPhoto.length > 0 && (
          <>
            <div className="pb-[8px] pt-[16px] text-[11.5px] font-bold uppercase tracking-[.08em] text-white/55">Sur cette photo</div>
            <div className="flex flex-wrap gap-[8px]">
              {surLaPhoto.map((e) => (
                <button
                  key={e.id}
                  type="button"
                  onClick={() => navigate({ to: "/espece", search: { nom: e.nom } })}
                  className="flex h-[36px] items-center gap-[6px] rounded-full border border-[#3DEFBE]/60 px-[12px] text-[13px] font-semibold text-[#3DEFBE]"
                >
                  <Eye className="h-[14px] w-[14px]" strokeWidth={2.2} aria-hidden="true" />
                  {e.nom}
                </button>
              ))}
            </div>
          </>
        )}
        {!photo.moi && <p className="pt-[14px] text-[12px] leading-snug text-white/55">Photo de {photo.auteur.prenom}, partagée avec la palanquée. Si son auteur la retire, elle disparaît d'ici.</p>}
      </div>
    </div>
  );
}
