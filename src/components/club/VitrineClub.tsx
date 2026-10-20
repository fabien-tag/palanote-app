import { useRef } from "react";
import { Link } from "@tanstack/react-router";
import { ArrowLeft, Lock, Plus } from "lucide-react";
import { RechercheCentre } from "@/components/club/RechercheCentre";
import type { Centre } from "@/lib/club";
import cigle from "@/assets/palanote-logo-cigle.png";
import ecranTableau from "@/assets/club/ecran-tableau-de-bord.webp";
import ecranQr from "@/assets/club/ecran-qr-inscription.webp";
import ecranFiche from "@/assets/club/ecran-fiche-securite.webp";
import ecranAdherents from "@/assets/club/ecran-adherents.webp";

// L'entrée de l'espace club pour un plongeur qui n'a pas encore de centre :
// une vitrine qui montre le vrai tableau de bord, et la recherche de son club en premier plan.

const MOMENTS: {
  quand: string;
  titre: string;
  texte: string;
  image: string;
  alt: string;
  telephone?: boolean;
}[] = [
  {
    quand: "La veille",
    titre: "Tes plongeurs s'inscrivent tout seuls",
    texte:
      "Tu crées la sortie, ils scannent le QR code sur le bateau ou reçoivent le lien. Ceux qui n'ont pas encore Palanote créent leur compte en scannant : leur inscription les attend.",
    image: ecranQr,
    alt: "Le QR code d'inscription à une sortie, avec les plongeurs en attente",
    telephone: true,
  },
  {
    quand: "Sur le bateau",
    titre: "La fiche de sécurité se remplit pendant que tu composes les palanquées",
    texte:
      "Niveaux, profondeurs prévues, effectif : tout part de la liste des inscrits. Tu l'imprimes ou tu la signes sur l'écran. Au retour, tu tamponnes les carnets de toute la sortie d'un geste.",
    image: ecranFiche,
    alt: "La fiche de sécurité d'une sortie, palanquée par palanquée",
  },
  {
    quand: "Toute la saison",
    titre: "Tes adhérents et leurs certificats, au même endroit",
    texte:
      "Importe ta liste Excel. Palanote te prévient quand un certificat médical expire, quand un bloc doit passer en contrôle, et quand une fiche reste à remplir.",
    image: ecranAdherents,
    alt: "La liste des adhérents du club, avec l'état de leurs certificats médicaux",
  },
];

const BULLES = [
  { g: 8, t: 10, d: 0, r: 9 },
  { g: 27, t: 13, d: 3, r: 6 },
  { g: 46, t: 11, d: 6, r: 11 },
  { g: 63, t: 14, d: 1.5, r: 7 },
  { g: 81, t: 12, d: 4.5, r: 9 },
  { g: 94, t: 15, d: 2, r: 6 },
];

export function VitrineClub({ onFini }: { onFini: (c: Centre) => void }) {
  const recherche = useRef<HTMLInputElement>(null);
  const chercher = () => {
    window.scrollTo({ top: 0, behavior: "smooth" });
    setTimeout(() => recherche.current?.focus(), 350);
  };

  return (
    <div className="min-h-svh bg-[#F1F6FC] text-[#0F3D70]">
      {/* Haut de page : la promesse, la recherche, le vrai tableau de bord */}
      <section className="relative isolate overflow-hidden bg-[#0A2A50] pb-[56px] text-white [border-bottom-left-radius:44px_28px] [border-bottom-right-radius:64px_40px] lg:pb-[88px]">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(70%_60%_at_85%_10%,#1176A866,transparent),radial-gradient(50%_50%_at_10%_100%,#57D4F522,transparent)]"
        />
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 -z-10 overflow-hidden"
        >
          {BULLES.map((b, i) => (
            <span
              key={i}
              className="bulle absolute bottom-[-20px] rounded-full ring-1 ring-white/40 [background:radial-gradient(circle_at_30%_30%,rgb(255_255_255/.45),rgb(255_255_255/.05))]"
              style={{
                left: `${b.g}%`,
                width: b.r,
                height: b.r,
                ["--duree" as string]: `${b.t}s`,
                ["--delai" as string]: `${b.d}s`,
              }}
            />
          ))}
        </div>

        <div className="mx-auto max-w-[1240px] px-[20px] lg:px-[48px]">
          <div className="flex items-center justify-between py-[20px]">
            <span className="flex items-center gap-[10px]">
              <img src={cigle} alt="" className="h-[34px] w-[34px] rounded-[10px]" />
              <span className="text-[16px] font-bold">Palanote Club</span>
            </span>
            <Link
              to="/carnet"
              className="flex items-center gap-[6px] text-[13.5px] font-semibold text-white/75 hover:text-white"
            >
              <ArrowLeft className="h-[15px] w-[15px]" aria-hidden="true" />
              Mon carnet
            </Link>
          </div>

          <div className="grid grid-cols-1 items-center gap-[44px] pt-[18px] lg:grid-cols-[minmax(0,5fr)_minmax(0,6fr)] lg:gap-[56px] lg:pt-[40px]">
            <div className="max-w-[560px]">
              <p className="text-[14px] font-semibold text-[#57D4F5]">
                Pour les directeurs de plongée
              </p>
              <h1 className="pt-[12px] text-[34px] font-bold leading-[1.08] tracking-[-0.02em] sm:text-[44px] lg:text-[52px]">
                Le bateau part à 9 h. Ta fiche de sécurité est déjà prête.
              </h1>
              <p className="max-w-[48ch] pt-[18px] text-[16px] leading-relaxed text-white/75 lg:text-[17px]">
                Inscriptions par QR code, palanquées, fiche de sécurité et tampon numérique : ton
                club passe au sans-papier dès la prochaine sortie.
              </p>

              <div className="pt-[30px]">
                <p className="pb-[10px] text-[14px] font-semibold text-white">
                  Commence par trouver ton club
                </p>
                <RechercheCentre ref={recherche} grand onFini={onFini} />
                <Link
                  to="/club/centre"
                  className="mt-[16px] inline-flex items-center gap-[7px] text-[14px] font-semibold text-[#3DEFBE] underline-offset-4 hover:underline"
                >
                  <Plus className="h-[16px] w-[16px]" strokeWidth={2.6} aria-hidden="true" />
                  Ton club n'est pas encore sur Palanote ? Crée-le en une minute
                </Link>
              </div>
            </div>

            {/* Le vrai tableau de bord, et le QR code sur le téléphone */}
            <div className="vitrine-ecrans relative pb-[40px] lg:pb-0">
              <div className="overflow-hidden rounded-[14px] bg-white shadow-[0_40px_80px_-30px_#000a] ring-1 ring-white/10">
                <div
                  className="flex items-center gap-[6px] bg-[#E9EFF5] px-[12px] py-[9px]"
                  aria-hidden="true"
                >
                  <span className="h-[9px] w-[9px] rounded-full bg-[#FF8A75]" />
                  <span className="h-[9px] w-[9px] rounded-full bg-[#FFC65C]" />
                  <span className="h-[9px] w-[9px] rounded-full bg-[#3DEFBE]" />
                </div>
                <img
                  src={ecranTableau}
                  alt="Le tableau de bord du directeur de plongée : prochaine sortie, semaine, points d'attention"
                  className="block w-full"
                />
              </div>
              <div className="absolute -bottom-[8px] right-[-6px] w-[30%] max-w-[170px] overflow-hidden rounded-[26px] border-[5px] border-[#06203F] bg-white shadow-[0_30px_60px_-20px_#000c] sm:right-[-14px] lg:-bottom-[48px] lg:left-[-48px] lg:right-auto">
                <img src={ecranQr} alt="" className="block w-full" />
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Une sortie, du jour d'avant au retour au port */}
      <section className="mx-auto max-w-[1240px] px-[20px] pt-[72px] lg:px-[48px] lg:pt-[120px]">
        <h2 className="max-w-[30ch] text-[28px] font-bold leading-tight tracking-[-0.01em] lg:text-[36px]">
          Une sortie de club, du jour d'avant au retour au port
        </h2>
        <div className="flex flex-col gap-[64px] pt-[48px] lg:gap-[96px] lg:pt-[64px]">
          {MOMENTS.map((m, i) => (
            <article
              key={m.quand}
              className="grid grid-cols-1 items-center gap-[28px] lg:grid-cols-2 lg:gap-[72px]"
            >
              <div className={i % 2 === 1 ? "lg:order-2" : ""}>
                <p className="text-[14px] font-bold text-[#1176A8]">{m.quand}</p>
                <h3 className="max-w-[24ch] pt-[8px] text-[24px] font-bold leading-tight lg:text-[28px]">
                  {m.titre}
                </h3>
                <p className="max-w-[52ch] pt-[14px] text-[15.5px] leading-relaxed text-[#4A6280]">
                  {m.texte}
                </p>
              </div>
              <div
                className={`flex ${i % 2 === 1 ? "lg:order-1" : ""} ${m.telephone ? "justify-center" : ""}`}
              >
                {m.telephone ? (
                  <div className="w-[56%] max-w-[230px] overflow-hidden rounded-[34px] border-[7px] border-[#0A2A50] bg-white shadow-[0_30px_60px_-28px_#0A2A5099]">
                    <img src={m.image} alt={m.alt} loading="lazy" className="block w-full" />
                  </div>
                ) : (
                  <div className="w-full overflow-hidden rounded-[14px] bg-white shadow-[0_30px_60px_-30px_#0A2A5066] ring-1 ring-[#E4EBF1]">
                    <img src={m.image} alt={m.alt} loading="lazy" className="block w-full" />
                  </div>
                )}
              </div>
            </article>
          ))}
        </div>
      </section>

      {/* Confiance, puis retour à la recherche */}
      <section className="mx-auto max-w-[1240px] px-[20px] py-[72px] lg:px-[48px] lg:py-[112px]">
        <div className="grid grid-cols-1 gap-[28px] galet bg-[#E3F2FB] p-[28px] lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center lg:p-[44px]">
          <div className="flex gap-[16px]">
            <span className="flex h-[48px] w-[48px] shrink-0 items-center justify-center goutte bg-white">
              <Lock
                className="h-[22px] w-[22px] text-[#1176A8]"
                strokeWidth={2.2}
                aria-hidden="true"
              />
            </span>
            <div>
              <h2 className="text-[20px] font-bold leading-snug lg:text-[22px]">
                Les données de ton club restent à ton club
              </h2>
              <p className="max-w-[60ch] pt-[6px] text-[15px] leading-relaxed text-[#4A6280]">
                Seul le directeur de plongée du centre voit les adhérents et leurs certificats
                médicaux. Un centre déjà géré ne peut pas être rejoint par quelqu'un d'autre.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={chercher}
            className="flex h-[56px] items-center justify-center galet-moyen bg-[#3DEFBE] px-[28px] text-[15px] font-bold text-[#0B3B63]"
          >
            Chercher mon club
          </button>
        </div>
      </section>
    </div>
  );
}
