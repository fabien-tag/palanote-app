import { useEffect, useMemo, useRef, useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { Plus, X } from "lucide-react";
import { chargerLot, creerLot, envoyerPage } from "@/lib/numerisation";
import { BoutonPrincipal, FondNumerisation, rechercheLot, useConnexionRequise } from "@/components/numerisation/Ui";
import { prendrePhotosEnAttente } from "@/lib/photos-en-attente";

export const Route = createFileRoute("/numeriser_/choisir")({
  head: () => ({ meta: [{ title: "Palanote — Choisir des pages" }] }),
  validateSearch: rechercheLot,
  component: Choisir,
});

type Photo = { id: string; fichier: File; url: string; date: number };

const FONDS = ["#DCEEF8", "#DCF7EE", "#FFF1D9", "#FFE4DE", "#E3EAF1"];

function libelleJour(t: number) {
  const j = new Date(t);
  j.setHours(0, 0, 0, 0);
  const auj = new Date();
  auj.setHours(0, 0, 0, 0);
  const diff = Math.round((auj.getTime() - j.getTime()) / 86_400_000);
  if (diff <= 0) return "AUJOURD'HUI";
  if (diff === 1) return "HIER";
  return j.toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" }).toUpperCase();
}

function Choisir() {
  const navigate = useNavigate();
  const { lot } = Route.useSearch();
  const { pret, ecran } = useConnexionRequise();
  const [onglet, setOnglet] = useState<"photos" | "fichiers">("photos");
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [ordre, setOrdre] = useState<string[]>([]); // ids dans l'ordre touché
  const [agrandie, setAgrandie] = useState<Photo | null>(null);
  const [envoi, setEnvoi] = useState<{ fait: number; total: number } | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);
  const champ = useRef<HTMLInputElement>(null);
  const appui = useRef<ReturnType<typeof setTimeout> | null>(null);
  const appuiLong = useRef(false);

  const ajouter = (fichiers: File[]) => {
    const nouvelles = fichiers
      .filter((f) => f.type.startsWith("image/") || /\.(jpe?g|png|webp|heic|heif)$/i.test(f.name))
      .map((f) => ({ id: crypto.randomUUID(), fichier: f, url: URL.createObjectURL(f), date: f.lastModified || Date.now() }));
    setPhotos((l) => [...l, ...nouvelles].sort((a, b) => b.date - a.date));
  };

  // Photos choisies depuis l'écran précédent.
  const recues = useRef(false);
  useEffect(() => {
    if (recues.current) return;
    recues.current = true;
    const enAttente = prendrePhotosEnAttente();
    if (enAttente.length) ajouter(enAttente);
  }, []);

  const groupes = useMemo(() => {
    const g: { jour: string; photos: Photo[] }[] = [];
    photos.forEach((p) => {
      const jour = libelleJour(p.date);
      const dernier = g[g.length - 1];
      if (dernier && dernier.jour === jour) dernier.photos.push(p);
      else g.push({ jour, photos: [p] });
    });
    return g;
  }, [photos]);

  const basculer = (id: string) =>
    setOrdre((o) => (o.includes(id) ? o.filter((x) => x !== id) : [...o, id]));

  // « Tout » : toutes les photos, de la plus ancienne à la plus récente.
  const toutPrendre = () =>
    setOrdre((o) => (o.length === photos.length ? [] : [...photos].sort((a, b) => a.date - b.date).map((p) => p.id)));

  const envoyer = async () => {
    if (!ordre.length) return;
    setErreur(null);
    setEnvoi({ fait: 0, total: ordre.length });
    try {
      const id = lot ?? (await creerLot()).id;
      const existantes = lot ? (await chargerLot(lot)).pages.map((p) => p.ordre) : [];
      let suivant = existantes.length ? Math.max(...existantes) + 1 : 1;
      for (const [i, pid] of ordre.entries()) {
        const p = photos.find((x) => x.id === pid);
        if (p) await envoyerPage(id, p.fichier, suivant++);
        setEnvoi({ fait: i + 1, total: ordre.length });
      }
      navigate({ to: "/numeriser/lecture", search: { lot: id } });
    } catch (e) {
      console.error(e);
      setEnvoi(null);
      setErreur("L'envoi s'est interrompu. Les pages déjà parties sont gardées ; relance l'envoi pour les autres.");
    }
  };

  if (ecran) return ecran;
  if (!pret) return <FondNumerisation>{null}</FondNumerisation>;

  return (
    <FondNumerisation>
      <div className="flex items-center justify-between px-[22px] pb-[14px] pt-[18px]">
        <button
          type="button"
          onClick={() => navigate(lot ? { to: "/numeriser/lecture", search: { lot } } : { to: "/numeriser" })}
          className="text-[14.5px] font-semibold text-[#566B82]"
        >
          Annuler
        </button>
        <h1 className="text-[16px] font-bold">Choisir des pages</h1>
        <button type="button" onClick={toutPrendre} disabled={!photos.length} className="text-[14.5px] font-bold text-[#106F9F] disabled:opacity-40">
          Tout
        </button>
      </div>

      <div className="px-[22px]">
        <div role="tablist" className="flex galet-moyen bg-[#E3EDF6] p-[4px]">
          {(
            [
              ["photos", "Mes photos"],
              ["fichiers", "Fichiers et PDF"],
            ] as const
          ).map(([v, l]) => (
            <button
              key={v}
              role="tab"
              type="button"
              aria-selected={onglet === v}
              onClick={() => setOnglet(v)}
              className={`h-[34px] flex-1 galet-petit text-[13.5px] font-semibold ${onglet === v ? "bg-white text-[#123A63] shadow-[0_2px_6px_rgba(15,61,112,.10)]" : "text-[#566B82]"}`}
            >
              {l}
            </button>
          ))}
        </div>
      </div>

      {onglet === "fichiers" ? (
        <div className="mx-[22px] mt-[16px] galet-b border border-[#D9E6F0] bg-white p-[18px] text-[13.5px] leading-normal text-[#566B82]">
          <b className="text-[#123A63]">Les PDF arrivent bientôt.</b> En attendant, choisis tes pages dans tes photos.
        </div>
      ) : (
        <>
          <div className="mx-[22px] mt-[16px] flex items-start gap-3 galet-moyen border border-[#C6E3F2] bg-[#E3F2FB] px-[14px] py-[12px]">
            <span className="flex h-[26px] w-[26px] shrink-0 items-center justify-center rounded-full bg-[#3DEFBE] text-[12.5px] font-bold text-[#0B3B63]">1</span>
            <p className="text-[13px] leading-normal text-[#123A63]">
              <b>Touche-les dans l'ordre des pages.</b> Le chiffre te montre l'ordre retenu — c'est lui qui numérotera tes plongées.
            </p>
          </div>

          <div className="flex-grow px-[22px] pb-[110px]">
            {groupes.map((g, gi) => (
              <section key={g.jour} className="pt-[18px]">
                <div className="flex items-baseline justify-between pb-[10px]">
                  <h2 className="text-[12px] font-bold tracking-[.04em] text-[#566B82]">{g.jour}</h2>
                  {gi === 0 && <span className="text-[11.5px] text-[#566B82]">appui long pour agrandir</span>}
                </div>
                <div className="grid grid-cols-3 gap-[9px]">
                  {g.photos.map((p, i) => {
                    const rang = ordre.indexOf(p.id);
                    const choisie = rang >= 0;
                    return (
                      <button
                        key={p.id}
                        type="button"
                        aria-pressed={choisie}
                        aria-label={choisie ? `Page ${rang + 1}` : "Choisir cette photo"}
                        onPointerDown={() => {
                          appuiLong.current = false;
                          appui.current = setTimeout(() => {
                            appuiLong.current = true;
                            setAgrandie(p);
                          }, 450);
                        }}
                        onPointerUp={() => appui.current && clearTimeout(appui.current)}
                        onPointerLeave={() => appui.current && clearTimeout(appui.current)}
                        onClick={() => !appuiLong.current && basculer(p.id)}
                        onContextMenu={(e) => e.preventDefault()}
                        className={`relative aspect-[3/4] overflow-hidden galet-moyen bg-cover bg-center ${choisie ? "ring-[2.5px] ring-[#3DEFBE]" : ""}`}
                        style={{ backgroundImage: `url(${p.url})`, backgroundColor: FONDS[i % FONDS.length] }}
                      >
                        <span
                          className={`absolute right-[7px] top-[7px] flex h-[24px] w-[24px] items-center justify-center rounded-full text-[12px] font-bold ${
                            choisie ? "bg-[#3DEFBE] text-[#0B3B63]" : "border-[1.5px] border-[#C9D6E2] bg-white/90"
                          }`}
                        >
                          {choisie ? rang + 1 : ""}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </section>
            ))}

            <button
              type="button"
              onClick={() => champ.current?.click()}
              className="mt-[18px] flex h-[52px] w-full items-center justify-center gap-2 galet-moyen border-2 border-dashed border-[#1176A8]/35 text-[13.5px] font-bold text-[#106F9F]"
            >
              <Plus className="h-[17px] w-[17px]" strokeWidth={2.6} aria-hidden="true" />
              {photos.length ? "Ajouter d'autres photos" : "Ouvrir mes photos"}
            </button>
            <input
              ref={champ}
              type="file"
              accept="image/*"
              multiple
              className="hidden"
              onChange={(e) => {
                ajouter(Array.from(e.target.files ?? []));
                e.target.value = "";
              }}
            />
            {erreur && (
              <p role="alert" className="mt-3 galet-petit bg-[#FFE4DE] px-3 py-2 text-[13px] text-[#8A2A1A]">
                {erreur}
              </p>
            )}
          </div>

          <div className="fixed inset-x-0 bottom-0 z-10 mx-auto w-full max-w-[430px] bg-gradient-to-t from-[#F1F6FC] via-[#F1F6FC] to-transparent px-[22px] pb-[22px] pt-[26px]">
            <BoutonPrincipal onClick={() => void envoyer()} disabled={!ordre.length || envoi !== null}>
              {envoi
                ? `Envoi ${envoi.fait} / ${envoi.total}…`
                : ordre.length
                  ? `Envoyer ${ordre.length} page${ordre.length > 1 ? "s" : ""}`
                  : "Touche les pages à envoyer"}
            </BoutonPrincipal>
          </div>
        </>
      )}

      {agrandie && (
        <div role="dialog" aria-label="Photo agrandie" className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 p-4" onClick={() => setAgrandie(null)}>
          <img src={agrandie.url} alt="Page agrandie" className="max-h-full max-w-full galet-petit object-contain" />
          <button type="button" aria-label="Fermer" className="absolute right-4 top-4 flex h-10 w-10 items-center justify-center rounded-full bg-white/15 text-white">
            <X className="h-5 w-5" />
          </button>
        </div>
      )}
    </FondNumerisation>
  );
}
