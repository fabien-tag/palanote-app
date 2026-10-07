import { useEffect, useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { Check, ChevronLeft, Images, MapPinOff, ShieldCheck } from "lucide-react";
import { Meduse, useConnexionRequise } from "@/components/numerisation/Ui";
import { couleurAvatar, dateCourte, initiales, type Plongeur } from "@/lib/amis";
import { chargerGalerie, palanqueePlongee, partagerPhotos, type PhotoGalerie } from "@/lib/galerie";
import { annoncerSurAccueil } from "@/lib/message-accueil";
import { chargerPlongee } from "@/lib/plongees";

// Écran 44 : ce que je partage avec la palanquée, et sa portée.
export const Route = createFileRoute("/plongee/partage")({
  validateSearch: (search: Record<string, unknown>): { id?: string | undefined } => ({
    id: typeof search["id"] === "string" ? search["id"] : undefined,
  }),
  head: () => ({ meta: [{ title: "Palanote — Partager mes photos" }] }),
  component: PartagePhotos,
});

function PartagePhotos() {
  const navigate = useNavigate();
  const { id } = Route.useSearch();
  const { pret, ecran } = useConnexionRequise();
  const [mes, setMes] = useState<PhotoGalerie[] | null>(null);
  const [choisies, setChoisies] = useState<string[]>([]);
  const [palanquee, setPalanquee] = useState<Plongeur[]>([]);
  const [visible, setVisible] = useState(true);
  const [site, setSite] = useState<{ nom: string; date: string | null }>({ nom: "", date: null });
  const [enCours, setEnCours] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);

  useEffect(() => {
    if (!pret || !id) return;
    let actif = true;
    void chargerPlongee(id).then((l) => actif && l && setSite({ nom: l.site_name ?? "", date: l.dive_date }));
    void palanqueePlongee(id)
      .then((p) => actif && setPalanquee(p))
      .catch(() => undefined);
    chargerGalerie(id)
      .then((g) => {
        if (!actif) return;
        const miennes = g.filter((p) => p.moi);
        setMes(miennes);
        // Rien encore partagé : tout est coché par défaut ; sinon on reprend le choix précédent.
        const deja = miennes.filter((p) => p.partagee).map((p) => p.id);
        setChoisies(deja.length ? deja : miennes.map((p) => p.id));
        setVisible(deja.length > 0 || miennes.every((p) => !p.partagee));
      })
      .catch((e) => {
        console.error(e);
        if (actif) {
          setMes([]);
          setErreur("Tes photos n'ont pas pu être chargées.");
        }
      });
    return () => {
      actif = false;
    };
  }, [pret, id]);

  if (ecran) return ecran;

  const liste = mes ?? [];
  const nb = visible ? choisies.length : 0;
  const toutes = choisies.length === liste.length;

  const valider = async () => {
    if (!id) return;
    setEnCours(true);
    setErreur(null);
    try {
      const n = await partagerPhotos(id, visible ? choisies : []);
      annoncerSurAccueil(n > 0 ? `${n} photo${n > 1 ? "s" : ""} partagée${n > 1 ? "s" : ""} avec la palanquée` : "Tes photos restent privées");
      navigate({ to: "/plongee/photos", search: { id } });
    } catch (e) {
      console.error(e);
      const msg = e && typeof e === "object" && "message" in e ? String(e.message) : "";
      setErreur(msg.includes("partager_photos") ? "Lance d'abord le script palanote-photos-especes.sql dans Supabase." : "Le partage n'a pas pu être enregistré.");
      setEnCours(false);
    }
  };

  const point = (Icone: typeof Images, titre: string, texte: string) => (
    <div className="flex gap-[12px] py-[9px]">
      <span className="flex h-[34px] w-[34px] shrink-0 items-center justify-center goutte bg-[#E3F4FC]">
        <Icone className="h-[16px] w-[16px] text-[#1176A8]" strokeWidth={2.2} aria-hidden="true" />
      </span>
      <div>
        <div className="text-[14.5px] font-bold">{titre}</div>
        <div className="text-[12.5px] leading-snug text-[#5B7189]">{texte}</div>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-[#F1F6FC] text-[#123A63]">
      <div className="cascade mx-auto flex min-h-screen w-full max-w-[430px] flex-col px-[22px] pb-[max(24px,env(safe-area-inset-bottom))] pt-[clamp(14px,2.6svh,22px)]">
        <div className="flex items-center justify-between">
          <button
            type="button"
            aria-label="Retour"
            onClick={() => (id ? navigate({ to: "/plongee/photos", search: { id } }) : navigate({ to: "/carnet" }))}
            className="flex h-10 w-10 items-center justify-center goutte bg-[#E3EDF6]"
          >
            <ChevronLeft className="h-[18px] w-[18px]" strokeWidth={2.4} />
          </button>
          {liste.length > 0 && (
            <button type="button" onClick={() => setChoisies(toutes ? [] : liste.map((p) => p.id))} className="px-[2px] py-[8px] text-[14px] font-bold text-[#1176A8]">
              {toutes ? "Tout décocher" : "Tout cocher"}
            </button>
          )}
        </div>
        <h1 className="pt-[12px] text-[26px] font-bold leading-tight">
          {liste.length ? `Tes ${liste.length} photo${liste.length > 1 ? "s" : ""}` : "Tes photos"}
        </h1>
        <p className="pt-[2px] text-[13.5px] text-[#5B7189]">{[site.nom, site.date ? dateCourte(site.date) : null].filter(Boolean).join(" · ")}</p>

        {mes === null && <div className="mt-[18px] h-[120px] animate-pulse galet bg-white" />}

        {liste.length > 0 && (
          <div className="grid grid-cols-3 gap-[8px] pt-[16px]">
            {liste.map((p, i) => {
              const actif = choisies.includes(p.id);
              return (
                <button
                  key={p.id}
                  type="button"
                  aria-pressed={actif}
                  aria-label={`Photo ${i + 1}`}
                  onClick={() => setChoisies((l) => (actif ? l.filter((x) => x !== p.id) : [...l, p.id]))}
                  className={`relative aspect-square overflow-hidden galet-petit bg-[#DCEEF8] transition-opacity ${actif ? "" : "opacity-45"}`}
                >
                  <img src={p.url} alt="" className="h-full w-full object-cover" />
                  <span
                    className={`absolute right-[6px] top-[6px] flex h-[22px] w-[22px] items-center justify-center rounded-full border-2 ${actif ? "border-[#3DEFBE] bg-[#3DEFBE]" : "border-white bg-black/20"}`}
                  >
                    {actif && <Check className="h-[12px] w-[12px] text-[#0B3B63]" strokeWidth={3} />}
                  </span>
                </button>
              );
            })}
          </div>
        )}

        {mes && liste.length === 0 && !erreur && <p className="pt-[14svh] text-center text-[14.5px] text-[#5B7189]">Tu n'as pas encore ajouté de photos à cette plongée.</p>}

        {liste.length > 0 && (
          <>
            <div className="relative mt-[16px] galet border border-[#DCE7F0] bg-white px-[16px] py-[14px] shadow-[0_4px_14px_#123A6308]">
              <Meduse className="-right-[4px] -top-[14px]" />
              <div className="flex items-center gap-[12px]">
                <div className="min-w-0 flex-1">
                  <div className="text-[15px] font-bold">Visibles par la palanquée</div>
                  <div className="text-[12.5px] text-[#5B7189]">
                    {palanquee.length
                      ? `Les ${palanquee.length + 1} personnes qui ont cette plongée dans leur carnet.`
                      : "Dès qu'un binôme ajoute cette plongée à son carnet."}
                  </div>
                </div>
                <button
                  type="button"
                  role="switch"
                  aria-checked={visible}
                  aria-label="Visibles par la palanquée"
                  onClick={() => setVisible((v) => !v)}
                  className={`relative h-[30px] w-[52px] shrink-0 rounded-full transition-colors ${visible ? "bg-[#3DEFBE]" : "bg-[#D5E0EA]"}`}
                >
                  <span className={`absolute top-[3px] h-[24px] w-[24px] rounded-full bg-white shadow transition-all ${visible ? "left-[25px]" : "left-[3px]"}`} />
                </button>
              </div>
              {palanquee.length > 0 && (
                <div className="mt-[12px] flex items-center gap-[10px] border-t border-[#EDF2F7] pt-[12px]">
                  <span className="flex">
                    {palanquee.slice(0, 5).map((g, i) => (
                      <span
                        key={g.id}
                        className="flex h-[28px] w-[28px] items-center justify-center rounded-full border-2 border-white text-[10.5px] font-bold text-[#0F3D70]"
                        style={{ background: couleurAvatar(g.id), marginLeft: i ? -8 : 0 }}
                      >
                        {initiales(g.prenom)}
                      </span>
                    ))}
                  </span>
                  <span className="truncate text-[13px] text-[#5B7189]">{palanquee.map((g) => g.prenom).join(", ")}</span>
                </div>
              )}
            </div>

            <div className="pt-[10px]">
              {point(MapPinOff, "La position est retirée du fichier", "Chaque photo est réenregistrée sans ses données GPS. C'est la position de la plongée qui fait foi, et elle n'est jamais montrée aux autres.")}
              {point(ShieldCheck, "Elles restent à toi", "Tu peux en retirer une à tout moment : elle disparaît alors des fiches des autres.")}
              {point(Images, "Un seul exemplaire est stocké", "La photo n'est pas recopiée dans chaque carnet : les autres fiches pointent dessus.")}
            </div>
          </>
        )}

        <div className="min-h-[22px] flex-grow" />
        {erreur && <p className="pb-[10px] text-center text-[13px] text-[#8A2A1A]">{erreur}</p>}
        {liste.length > 0 && (
          <button
            type="button"
            disabled={enCours}
            onClick={() => void valider()}
            className="mt-[18px] flex h-[56px] w-full items-center justify-center galet-moyen bg-[#3DEFBE] text-[14px] font-bold tracking-wide text-[#0B3B63] shadow-[0_6px_16px_#3DEFBE40] disabled:opacity-60"
          >
            {enCours ? "ENREGISTREMENT…" : nb > 0 ? `PARTAGER ${nb > 1 ? `MES ${nb} PHOTOS` : "MA PHOTO"}` : "GARDER MES PHOTOS PRIVÉES"}
          </button>
        )}
      </div>
    </div>
  );
}
