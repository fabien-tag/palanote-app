import { useEffect, useRef, useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { ChevronLeft, ChevronRight, Camera, Image as ImageIcon } from "lucide-react";
import fondOcr from "@/assets/ocr-fond.jpg";
import { lotEnCours, type Lot } from "@/lib/numerisation";
import { deposerPhotosEnAttente } from "@/lib/photos-en-attente";

export const Route = createFileRoute("/numeriser")({
  head: () => ({
    meta: [
      { title: "Palanote — Numériser mes carnets" },
      { name: "description", content: "Photographie tes carnets papier : l'app en tire les plongées, tu relis et tu valides." },
      { property: "og:title", content: "Palanote — Numériser mes carnets" },
      { property: "og:description", content: "Photographie tes carnets papier : l'app en tire les plongées, tu relis et tu valides." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Numeriser,
});

const etapes = [
  {
    titre: "Tu photographies",
    texte: "Une page à la fois — ou tu choisis des photos déjà prises. Ça marche sans réseau : tout part quand tu en as.",
  },
  {
    titre: "L’app lit et propose",
    texte: "Chaque champ arrive avec ce qu’elle a lu et à quel point elle en est sûre.",
  },
  {
    titre: "Tu relis et tu valides",
    texte: "Rien n’entre dans ton carnet avant. Une donnée fausse est pire qu’une donnée absente.",
  },
];

// Cadence d'apparition : chaque élément part du repos et attend son tour.
const PAS = 90;
const retards = {
  retour: 80,
  icone: 170,
  titre: 260,
  accroche: 350,
  etapes: 460,
  boutonPrincipal: 730,
  boutonSecondaire: 820,
  import: 910,
};

const d = (ms: number) => ({ animationDelay: `${ms}ms` });

function Numeriser() {
  const navigate = useNavigate();
  const galerieRef = useRef<HTMLInputElement>(null);
  const [enCours, setEnCours] = useState<Lot | null>(null);

  // Un carnet commencé et pas terminé : on propose de le reprendre.
  useEffect(() => {
    void lotEnCours().then(setEnCours);
  }, []);

  return (
    // Hauteur calée sur la partie visible de l'écran (dvh) : promesse, 3 étapes et boutons
    // tiennent sans défiler. Les tailles suivent la petite hauteur visible (svh, barres affichées).
    <div className="relative h-screen supports-[height:100dvh]:h-[100dvh] w-full overflow-hidden bg-[#0E3D72]">
      <div
        aria-hidden="true"
        className="absolute inset-0 bg-cover"
        style={{ backgroundImage: `url(${fondOcr})`, backgroundPosition: "center 28%" }}
      />
      <div
        aria-hidden="true"
        className="absolute inset-0"
        style={{
          background:
            "linear-gradient(180deg, rgba(4,18,38,.52) 0%, rgba(4,18,38,.12) 22%, rgba(4,18,38,0) 36%), linear-gradient(0deg, rgba(4,16,34,.66) 0%, rgba(4,16,34,.14) 24%, rgba(4,16,34,0) 42%), rgba(4,18,38,.25)",
        }}
      />

      <div className="relative mx-auto flex h-full w-full max-w-[430px] flex-col">
        <div className="shrink-0 px-[22px] pt-[clamp(10px,2.2svh,18px)]">
          <button
            type="button"
            aria-label="Retour"
            onClick={() => navigate({ to: "/carnet" })}
            style={d(retards.retour)}
            className="apparition flex h-10 w-10 items-center justify-center rounded-[14px] bg-white/[0.18]"
          >
            <ChevronLeft className="h-[18px] w-[18px] text-white" strokeWidth={2.4} />
          </button>
        </div>

        <div className="flex min-h-0 flex-grow flex-col overflow-y-auto px-6 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          <div className="h-[clamp(0px,calc(10svh-40px),66px)] shrink-0" />
          <div style={d(retards.icone)} className="apparition flex justify-center">
            <Camera className="h-[clamp(30px,5.4svh,44px)] w-[clamp(30px,5.4svh,44px)] text-[#3DEFBE]" strokeWidth={1.9} aria-hidden="true" />
          </div>
          <h1 style={d(retards.titre)} className="apparition mt-[clamp(6px,1.8svh,16px)] text-center text-[clamp(22px,3.9svh,27px)] font-bold leading-[1.22] text-white">
            Tes carnets papier,
            <br />
            page par page
          </h1>
          <p style={d(retards.accroche)} className="apparition mt-[clamp(4px,1.2svh,10px)] text-center text-[clamp(13.5px,2.1svh,14.5px)] leading-normal text-white/90">
            Photographie une page, l'app en tire les plongées. Tu relis, tu corriges, tu valides.
          </p>

          <ol className="mt-[clamp(10px,2.6svh,26px)] flex flex-col gap-[clamp(8px,1.9svh,19px)]">
            {etapes.map((e, i) => (
              <li
                key={e.titre}
                style={d(retards.etapes + i * PAS)}
                className="apparition flex items-start gap-[13px]"
              >
                <span className="flex h-[26px] w-[26px] shrink-0 items-center justify-center rounded-full border-[1.5px] border-[#3DEFBE] bg-[#3DEFBE]/[0.18] text-[12.5px] font-bold text-[#3DEFBE]">
                  {i + 1}
                </span>
                <div className="flex flex-col gap-0.5">
                  <span className="text-[clamp(14.5px,2.2svh,15.5px)] font-bold leading-[1.3] text-white">{e.titre}</span>
                  <span className="text-[clamp(13px,2svh,14px)] leading-snug text-white/85">{e.texte}</span>
                </div>
              </li>
            ))}
          </ol>

          <div className="min-h-2 flex-grow" />
        </div>

        {/* Galerie du téléphone : les photos choisies passent à l'écran « Choisir des pages ». */}
        <input
          ref={galerieRef}
          type="file"
          accept="image/*"
          multiple
          className="hidden"
          onChange={(e) => {
            const fichiers = Array.from(e.target.files ?? []);
            e.target.value = "";
            if (!fichiers.length) return;
            deposerPhotosEnAttente(fichiers);
            navigate({ to: "/numeriser/choisir" });
          }}
        />

        {enCours && (
          <div className="shrink-0 px-[22px] pt-[clamp(8px,1.6svh,14px)]">
            <button
              type="button"
              onClick={() => navigate({ to: "/numeriser/reprendre", search: { lot: enCours.id } })}
              className="flex w-full items-center gap-3 rounded-2xl bg-white/[0.14] px-4 py-3 text-left backdrop-blur-sm"
            >
              <span className="flex-grow">
                <span className="block text-[14px] font-bold text-white">{enCours.libelle ?? "Ton carnet"} en cours</span>
                <span className="block text-[12.5px] text-white/75">Reprends là où tu t'étais arrêté.</span>
              </span>
              <ChevronRight className="h-[17px] w-[17px] text-white" strokeWidth={2.4} aria-hidden="true" />
            </button>
          </div>
        )}

        <div className="flex shrink-0 flex-col gap-[clamp(8px,1.4svh,11px)] px-[22px] pb-[max(clamp(12px,2.8svh,26px),env(safe-area-inset-bottom))] pt-[clamp(8px,1.6svh,14px)]">
          <button
            type="button"
            onClick={() => navigate({ to: "/numeriser/capture" })}
            style={d(retards.boutonPrincipal)}
            className="apparition flex h-[clamp(48px,7svh,56px)] items-center justify-center rounded-2xl bg-[#3DEFBE] text-[14px] font-bold text-[#0B3B63] shadow-[0_4px_12px_rgba(18,58,99,.05)]"
          >
            PHOTOGRAPHIER UNE PAGE
          </button>
          <button
            type="button"
            onClick={() => galerieRef.current?.click()}
            style={d(retards.boutonSecondaire)}
            className="apparition flex h-[clamp(46px,6.8svh,54px)] items-center justify-center gap-[9px] rounded-2xl border-2 border-[#3DEFBE] text-[13.5px] font-bold tracking-[.05em] text-[#3DEFBE]"
          >
            <ImageIcon className="h-[18px] w-[18px]" strokeWidth={2} aria-hidden="true" />
            CHOISIR DANS MES PHOTOS
          </button>
          <p style={d(retards.import)} className="apparition text-center text-[13px] leading-[1.45] text-white/70">
            Tes plongées sont déjà dans une autre app&nbsp;?
            <br />
            <button type="button" className="font-bold text-[#3DEFBE] underline underline-offset-4">
              Importer un fichier de données
            </button>
          </p>
        </div>
      </div>
    </div>
  );
}
