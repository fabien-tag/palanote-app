import { useEffect, useRef, useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { Check, Image as ImageIcon, Info, Sparkles, X } from "lucide-react";
import { creerLot, envoyerPage } from "@/lib/numerisation";
import { rechercheLot, useConnexionRequise, useLot } from "@/components/numerisation/Ui";

export const Route = createFileRoute("/numeriser_/capture")({
  head: () => ({ meta: [{ title: "Palanote — Photographier une page" }] }),
  // ?lot=… : carnet en cours · ?ordre=… : page à reprendre en photo
  validateSearch: (s: Record<string, unknown>): { lot?: string; ordre?: number } => ({
    ...rechercheLot(s),
    ...(Number.isInteger(Number(s["ordre"])) && Number(s["ordre"]) > 0 ? { ordre: Number(s["ordre"]) } : {}),
  }),
  component: Capture,
});

type Envoi = { cle: string; ordre: number; url: string; etat: "envoi" | "erreur" };

function Capture() {
  const navigate = useNavigate();
  const recherche = Route.useSearch();
  const { pret, ecran } = useConnexionRequise();
  const [lotId, setLotId] = useState<string | undefined>(recherche.lot);
  const { donnees, recharger } = useLot(lotId);
  const [envois, setEnvois] = useState<Envoi[]>([]);
  const [message, setMessage] = useState<string | null>(null);
  // La photo de chaque page reste dans sa vignette pendant toute la lecture
  const [apercus, setApercus] = useState<Record<number, string>>({});
  // Éclair blanc dans le viseur au déclenchement
  const [eclair, setEclair] = useState(0);

  // Caméra en direct
  const video = useRef<HTMLVideoElement>(null);
  const flux = useRef<MediaStream | null>(null);
  const [camera, setCamera] = useState<"attente" | "ok" | "indisponible">("attente");
  const [torche, setTorche] = useState<{ dispo: boolean; on: boolean }>({ dispo: false, on: false });
  const secours = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!pret) return;
    let arret = false;
    (async () => {
      try {
        const f = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: "environment" }, width: { ideal: 2560 }, height: { ideal: 1920 } },
          audio: false,
        });
        if (arret) return f.getTracks().forEach((t) => t.stop());
        flux.current = f;
        if (video.current) {
          video.current.srcObject = f;
          await video.current.play().catch(() => undefined);
        }
        const piste = f.getVideoTracks()[0];
        const capacites = (piste?.getCapabilities?.() ?? {}) as { torch?: boolean };
        setTorche({ dispo: Boolean(capacites.torch), on: false });
        setCamera("ok");
      } catch {
        setCamera("indisponible");
      }
    })();
    return () => {
      arret = true;
      flux.current?.getTracks().forEach((t) => t.stop());
    };
  }, [pret]);

  const basculerTorche = async () => {
    const piste = flux.current?.getVideoTracks()[0];
    if (!piste) return;
    const on = !torche.on;
    try {
      await piste.applyConstraints({ advanced: [{ torch: on } as MediaTrackConstraintSet] });
      setTorche({ dispo: true, on });
    } catch {
      setTorche({ dispo: false, on: false });
    }
  };

  const pages = donnees?.pages ?? [];
  const ordresConnus = [...pages.map((p) => p.ordre), ...envois.map((e) => e.ordre)];
  const prochainOrdre = recherche.ordre ?? (ordresConnus.length ? Math.max(...ordresConnus) + 1 : 1);
  const lues = pages.filter((p) => p.statut === "lue").length;
  const enCours = pages.filter((p) => p.statut === "en_attente" || p.statut === "en_cours").length + envois.filter((e) => e.etat === "envoi").length;

  const envoyer = async (photo: Blob) => {
    const ordre = prochainOrdre;
    const cle = crypto.randomUUID();
    const url = URL.createObjectURL(photo);
    setEnvois((l) => [...l, { cle, ordre, url, etat: "envoi" }]);
    setApercus((a) => ({ ...a, [ordre]: url }));
    setEclair((n) => n + 1);
    setMessage(null);
    try {
      let id = lotId;
      if (!id) {
        id = (await creerLot()).id;
        setLotId(id);
        navigate({ to: "/numeriser/capture", search: { lot: id }, replace: true });
      }
      await envoyerPage(id, photo, ordre);
      setEnvois((l) => l.filter((e) => e.cle !== cle));
      await recharger();
      // Page reprise : on retourne directement voir sa lecture.
      if (recherche.ordre) navigate({ to: "/numeriser/lecture", search: { lot: id } });
    } catch (e) {
      console.error(e);
      setEnvois((l) => l.map((x) => (x.cle === cle ? { ...x, etat: "erreur" } : x)));
      setMessage("La page n'a pas pu être envoyée. Vérifie ta connexion et reprends-la.");
    }
  };

  const declencher = async () => {
    const v = video.current;
    if (camera !== "ok" || !v || !v.videoWidth) return secours.current?.click();
    const canvas = document.createElement("canvas");
    canvas.width = v.videoWidth;
    canvas.height = v.videoHeight;
    canvas.getContext("2d")?.drawImage(v, 0, 0);
    const photo = await new Promise<Blob | null>((ok) => canvas.toBlob(ok, "image/jpeg", 0.92));
    if (photo) void envoyer(photo);
  };

  const fermer = () =>
    lotId ? navigate({ to: "/numeriser/lecture", search: { lot: lotId } }) : navigate({ to: "/numeriser" });

  if (ecran) return ecran;

  const vignettes = [
    ...pages.map((p) => ({ cle: p.id, ordre: p.ordre, etat: p.statut === "lue" ? "lue" : p.statut === "illisible" || p.statut === "erreur" ? "probleme" : "cours" })),
    ...envois.map((e) => ({ cle: e.cle, ordre: e.ordre, etat: e.etat === "erreur" ? "probleme" : "cours" })),
  ].sort((a, b) => a.ordre - b.ordre);

  return (
    // Hauteur calée sur la partie visible de l'écran : le viseur prend la place qui reste,
    // le bouton de déclenchement est toujours visible en bas.
    <div className="h-screen supports-[height:100dvh]:h-[100dvh] w-full overflow-hidden bg-[#071A30] text-white">
      <div className="cascade mx-auto flex h-full w-full max-w-[430px] flex-col px-[22px] pb-[max(clamp(12px,2.6svh,22px),env(safe-area-inset-bottom))] pt-[clamp(10px,2.2svh,18px)]">
        {/* Haut */}
        <div className="flex shrink-0 items-center justify-between">
          <button
            type="button"
            aria-label="Fermer"
            onClick={fermer}
            className="flex h-10 w-10 items-center justify-center goutte bg-white/10"
          >
            <X className="h-[19px] w-[19px]" strokeWidth={2.2} />
          </button>
          <div className="text-center leading-tight">
            <div className="text-[16px] font-bold">Page {prochainOrdre}</div>
            <div className="text-[12px] text-white/60">{donnees?.lot.libelle?.toLowerCase() ?? "nouveau carnet"}</div>
          </div>
          {torche.dispo ? (
            <button
              type="button"
              aria-label={torche.on ? "Éteindre la lampe" : "Allumer la lampe"}
              aria-pressed={torche.on}
              onClick={() => void basculerTorche()}
              className={`flex h-10 w-10 items-center justify-center goutte ${torche.on ? "bg-[#3DEFBE] text-[#0B3B63]" : "bg-white/10"}`}
            >
              <Sparkles className="h-[18px] w-[18px]" strokeWidth={2} />
            </button>
          ) : (
            <span className="h-10 w-10" />
          )}
        </div>

        {/* Viseur */}
        <div className="relative mt-[clamp(10px,2.4svh,22px)] min-h-[180px] w-full flex-1 overflow-hidden galet bg-[linear-gradient(160deg,#1B3550,#11233A)]">
          <video ref={video} playsInline muted className={`absolute inset-0 h-full w-full object-cover ${camera === "ok" ? "" : "hidden"}`} />
          {camera !== "ok" && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 px-8 text-center">
              <div className="flex w-[50%] flex-col items-center gap-[7px] opacity-40">
                <span className="h-[2px] w-[70%] bg-white/50" />
                <span className="h-[2px] w-full bg-white/50" />
                <span className="h-[2px] w-[55%] bg-white/50" />
              </div>
              <span className="text-[13.5px] text-white/60">
                {camera === "attente" ? "Ouverture de l'appareil photo…" : "Touche le bouton pour photographier la page de ton carnet"}
              </span>
            </div>
          )}
          {eclair > 0 && <span key={eclair} aria-hidden="true" className="eclair-photo pointer-events-none absolute inset-0 bg-white" />}
          {/* Coins du cadre */}
          {[
            "left-[18px] top-[18px] border-l-[3px] border-t-[3px] rounded-tl-[10px]",
            "right-[18px] top-[18px] border-r-[3px] border-t-[3px] rounded-tr-[10px]",
            "left-[18px] bottom-[18px] border-l-[3px] border-b-[3px] rounded-bl-[10px]",
            "right-[18px] bottom-[18px] border-r-[3px] border-b-[3px] rounded-br-[10px]",
          ].map((c) => (
            <span key={c} aria-hidden="true" className={`absolute h-[32px] w-[32px] border-[#3DEFBE] ${c}`} />
          ))}
          <div className="absolute inset-x-0 bottom-[26px] flex justify-center">
            <span className="flex h-[30px] items-center gap-[6px] rounded-[15px] border border-[#3DEFBE]/50 bg-[#0B3B3B]/70 px-[14px] text-[12.5px] font-semibold text-[#3DEFBE]">
              <Check className="h-[13px] w-[13px]" strokeWidth={3} aria-hidden="true" />
              Une page dans le cadre
            </span>
          </div>
        </div>

        <p className="mt-[clamp(8px,1.6svh,14px)] flex shrink-0 gap-[9px] text-[12.5px] leading-snug text-white/60">
          <Info className="mt-[1px] h-[15px] w-[15px] shrink-0" strokeWidth={2} aria-hidden="true" />
          Une seule page dans le cadre, à plat, sans ombre portée. Le reste, l'app s'en occupe.
        </p>
        {message && (
          <p role="alert" className="mt-2 shrink-0 galet-petit bg-[#FF8A75]/20 px-3 py-2 text-[12.5px] text-[#FFD4CB]">
            {message}
          </p>
        )}

        {/* Pages déjà prises */}
        <div className="mt-[clamp(8px,1.6svh,16px)] flex min-h-[54px] shrink-0 items-center justify-between gap-3">
          <div className="flex gap-2 overflow-x-auto">
            {vignettes.map((v) => (
              <div
                key={v.cle}
                aria-label={`Page ${v.ordre} : ${v.etat === "lue" ? "lue" : v.etat === "probleme" ? "à reprendre" : "en cours de lecture"}`}
                className={`relative flex h-[54px] w-[42px] shrink-0 items-end justify-center overflow-hidden galet-petit bg-white/10 pb-[6px] text-[12px] font-bold text-white/80 ${
                  v.etat === "cours" ? "ring-1 ring-[#3DEFBE]/60" : ""
                }`}
              >
                {apercus[v.ordre] && (
                  <img src={apercus[v.ordre]} alt="" className={`absolute inset-0 h-full w-full object-cover ${v.etat === "cours" ? "opacity-70" : "opacity-45"}`} />
                )}
                {/* Lecture en cours : un trait vert balaie la page, comme un scanner */}
                {v.etat === "cours" && (
                  <span aria-hidden="true" className="scan-page pointer-events-none absolute inset-x-0 h-[16px]">
                    <span className="absolute inset-x-0 bottom-0 h-[2px] bg-[#3DEFBE] shadow-[0_0_8px_2px_#3DEFBE]" />
                    <span className="absolute inset-0 bg-gradient-to-b from-transparent to-[#3DEFBE]/35" />
                  </span>
                )}
                <span className="relative drop-shadow-[0_1px_2px_rgba(0,0,0,.6)]">{v.ordre}</span>
                <span
                  className={`absolute right-[4px] top-[4px] flex h-[14px] w-[14px] items-center justify-center rounded-full ${
                    v.etat === "lue" ? "pop-lue bg-[#3DEFBE]" : v.etat === "probleme" ? "bg-[#FFC65C]" : "bg-[#0B3B63]/70"
                  }`}
                >
                  {v.etat === "lue" ? (
                    <Check className="h-[9px] w-[9px] text-[#0B3B63]" strokeWidth={3.5} />
                  ) : v.etat === "probleme" ? (
                    <span className="text-[9px] font-bold text-[#6B4A14]">!</span>
                  ) : (
                    <span className="h-[6px] w-[6px] animate-pulse rounded-full bg-[#3DEFBE]" />
                  )}
                </span>
              </div>
            ))}
          </div>
          {vignettes.length > 0 && (
            <div className="shrink-0 text-right leading-tight">
              <div className="text-[14px] font-bold text-[#3DEFBE]">
                {lues} page{lues > 1 ? "s" : ""} lue{lues > 1 ? "s" : ""}
              </div>
              {enCours > 0 && <div className="text-[11.5px] text-white/60">{enCours} en cours</div>}
            </div>
          )}
        </div>

        {/* Commandes */}
        <div className="mt-[clamp(8px,1.8svh,16px)] flex shrink-0 items-center justify-between">
          <button
            type="button"
            aria-label="Choisir dans mes photos"
            onClick={() => navigate({ to: "/numeriser/choisir", search: lotId ? { lot: lotId } : {} })}
            className="flex h-[52px] w-[52px] items-center justify-center goutte bg-white/10"
          >
            <ImageIcon className="h-[21px] w-[21px]" strokeWidth={1.9} />
          </button>
          <button
            type="button"
            aria-label={`Photographier la page ${prochainOrdre}`}
            onClick={() => void declencher()}
            className="flex h-[76px] w-[76px] items-center justify-center rounded-full bg-white/90 p-[5px] transition active:scale-95"
          >
            <span className="h-full w-full rounded-full bg-[#3DEFBE]" />
          </button>
          <button
            type="button"
            onClick={fermer}
            disabled={!lotId}
            className="flex h-[52px] min-w-[78px] items-center justify-center galet-moyen bg-white/10 px-3 text-[14px] font-bold disabled:opacity-40"
          >
            Terminer
          </button>
        </div>

        {/* Secours : appareil photo du téléphone si la caméra en direct n'est pas accessible */}
        <input
          ref={secours}
          type="file"
          accept="image/*"
          capture="environment"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) void envoyer(f);
            e.target.value = "";
          }}
        />
      </div>
    </div>
  );
}
