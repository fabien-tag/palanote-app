import { useEffect, useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { BookOpen, Check, ChevronLeft, ChevronRight, Infinity as Infini, Sparkles } from "lucide-react";
import { Meduse, useConnexionRequise } from "@/components/numerisation/Ui";
import { chargerForfait, OFFRES, signalerInteret, type Forfait } from "@/lib/forfait";

// Version gratuite + forfaits : ce qui est offert, ce qu'il reste, et comment aller plus loin.
export const Route = createFileRoute("/forfait")({
  head: () => ({ meta: [{ title: "Palanote — Ton forfait" }] }),
  component: PageForfait,
});

const GRATUIT = [
  "Ton carnet complet, sans limite de plongées",
  "Binômes, carte des sites, photos",
  "Les espèces reconnues sur tes photos, sans limite",
  "Export de tout ton carnet (UDDF)",
];

function PageForfait() {
  const navigate = useNavigate();
  const { pret, ecran } = useConnexionRequise();
  const [f, setF] = useState<Forfait | null>(null);
  const [interet, setInteret] = useState<"pack" | "plus" | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);

  useEffect(() => {
    if (!pret) return;
    void chargerForfait().then(setF);
  }, [pret]);

  if (ecran) return ecran;

  const total = f ? f.offertes + f.achetees : 0;
  const part = f && total > 0 ? Math.min(1, f.lues / total) : 0;
  const retour = () => (window.history.length > 1 ? window.history.back() : navigate({ to: "/moi" }));

  const jeSuisInteresse = async (offre: "pack" | "plus") => {
    setErreur(null);
    try {
      await signalerInteret(offre);
      setInteret(offre);
    } catch {
      setErreur("Ça n'a pas fonctionné. Réessaie.");
    }
  };

  return (
    <div className="min-h-screen bg-[#F1F6FC] text-[#123A63]">
      <div className="cascade mx-auto flex min-h-screen w-full max-w-[430px] flex-col px-[22px] pb-[max(28px,env(safe-area-inset-bottom))] pt-[clamp(14px,2.6svh,22px)]">
        <div className="flex items-center">
          <button type="button" aria-label="Retour" onClick={retour} className="flex h-10 w-10 items-center justify-center goutte bg-[#E3EDF6]">
            <ChevronLeft className="h-[18px] w-[18px]" strokeWidth={2.4} />
          </button>
        </div>
        <h1 className="pt-[12px] text-[26px] font-bold leading-tight">Ton forfait</h1>
        <p className="pt-[4px] text-[14px] leading-snug text-[#5B7189]">
          Le carnet est gratuit, pour tout le monde. Seule la lecture de tes carnets papier par l'IA a un coût : on t'offre les {f?.offertes ?? 50} premières pages.
        </p>

        {/* Où j'en suis */}
        {f && (
          <div className="relative mt-[16px] galet border border-[#DCE7F0] bg-white px-[16px] py-[15px] shadow-[0_4px_14px_#123A6308]">
            <Meduse className="-right-[4px] -top-[14px]" />
            {f.plus ? (
              <>
                <p className="text-[15px] font-bold">Tu as Palanote+</p>
                <p className="pt-[2px] text-[13px] text-[#5B7189]">
                  Numérisation sans limite
                  {f.plusJusquAu ? ` jusqu'au ${new Date(f.plusJusquAu).toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" })}` : ""}.
                </p>
              </>
            ) : (
              <>
                <div className="flex items-baseline justify-between gap-2">
                  <p className="text-[15px] font-bold">Pages lues par l'IA</p>
                  <p className="text-[13px] font-bold text-[#5B7189]">
                    {f.lues} / {total}
                  </p>
                </div>
                <div className="mt-[8px] h-[8px] overflow-hidden rounded-full bg-[#E4EBF1]" aria-hidden="true">
                  <div className={`h-full rounded-full ${f.restantes === 0 ? "bg-[#F5A524]" : "bg-[#3DEFBE]"}`} style={{ width: `${Math.max(part * 100, f.lues ? 3 : 0)}%` }} />
                </div>
                <p className="pt-[8px] text-[13px] text-[#5B7189]">
                  {f.restantes === 0
                    ? "Tu as utilisé toutes tes pages. Tes plongées restent dans ton carnet, rien n'est perdu."
                    : `Il te reste ${f.restantes} page${(f.restantes ?? 0) > 1 ? "s" : ""}${f.achetees ? ` (dont ${f.achetees} achetées)` : " offertes"}.`}
                </p>
              </>
            )}
          </div>
        )}

        {/* Gratuit */}
        <section className="mt-[14px] galet-b border border-[#DCE7F0] bg-white px-[16px] py-[15px] shadow-[0_4px_14px_#123A6308]">
          <div className="flex items-center justify-between">
            <h2 className="text-[16px] font-bold">Gratuit</h2>
            {f && !f.plus && <span className="rounded-full bg-[#E2F8EF] px-[10px] py-[3px] text-[11.5px] font-bold text-[#14805F]">Ton forfait</span>}
          </div>
          <ul className="flex flex-col gap-[6px] pt-[8px]">
            {[...GRATUIT, `${f?.offertes ?? 50} pages de carnet papier lues par l'IA`].map((t) => (
              <li key={t} className="flex gap-[8px] text-[13.5px] leading-snug text-[#3F5B76]">
                <Check className="mt-[2px] h-[15px] w-[15px] shrink-0 text-[#14805F]" strokeWidth={2.6} aria-hidden="true" />
                {t}
              </li>
            ))}
          </ul>
        </section>

        {/* Pack */}
        <Offre
          icone={BookOpen}
          nom={OFFRES.pack.nom}
          prix={OFFRES.pack.prix}
          periode="une seule fois"
          texte={`${OFFRES.pack.pages} pages de plus, sans abonnement. Elles n'expirent pas : idéal pour numériser tes vieux carnets d'un coup.`}
          interesse={interet === "pack"}
          onInteret={() => void jeSuisInteresse("pack")}
          forme="galet-c"
        />

        {/* Palanote+ */}
        <Offre
          icone={Infini}
          nom={OFFRES.plus.nom}
          prix={OFFRES.plus.prix}
          periode={OFFRES.plus.periode}
          texte="Numérisation sans limite pendant un an. Pour ceux qui ont beaucoup de carnets, ou qui veulent faire vivre l'app."
          interesse={interet === "plus"}
          onInteret={() => void jeSuisInteresse("plus")}
          forme="galet"
          vedette
        />

        {erreur && <p className="pt-[10px] text-[13px] text-[#8A2A1A]">{erreur}</p>}

        <p className="pt-[14px] text-center text-[12.5px] leading-snug text-[#9DB0C0]">
          Le paiement en ligne ouvre très bientôt. En attendant, dis-nous ce qui t'intéresse : ça nous aide à choisir.
        </p>

        <button
          type="button"
          onClick={() => navigate({ to: "/recif" })}
          className="mt-[16px] flex items-center gap-[12px] galet-moyen border border-[#B8E4D8] bg-[#E2F8EF] px-[15px] py-[13px] text-left"
        >
          <Sparkles className="h-[18px] w-[18px] shrink-0 text-[#14805F]" strokeWidth={2} aria-hidden="true" />
          <span className="min-w-0 flex-1 text-[13.5px] leading-snug">
            <b>Tu veux juste soutenir l'app ?</b> Le Récif, c'est un don libre, sans rien en échange.
          </span>
          <ChevronRight className="h-[16px] w-[16px] shrink-0 text-[#3F5B76]" aria-hidden="true" />
        </button>
      </div>
    </div>
  );
}

function Offre({
  icone: Icone,
  nom,
  prix,
  periode,
  texte,
  interesse,
  onInteret,
  forme,
  vedette,
}: {
  icone: typeof BookOpen;
  nom: string;
  prix: string;
  periode: string;
  texte: string;
  interesse: boolean;
  onInteret: () => void;
  forme: string;
  vedette?: boolean;
}) {
  return (
    <section
      className={`mt-[12px] ${forme} border px-[16px] py-[15px] shadow-[0_4px_14px_#123A6308] ${
        vedette ? "border-[#0F3D70] bg-[linear-gradient(150deg,#0F3D70,#16528F)] text-white" : "border-[#DCE7F0] bg-white"
      }`}
    >
      <div className="flex items-start gap-[12px]">
        <span className={`flex h-[40px] w-[40px] shrink-0 items-center justify-center goutte ${vedette ? "bg-white/15" : "bg-[#E3F4FC]"}`}>
          <Icone className={`h-[19px] w-[19px] ${vedette ? "text-[#3DEFBE]" : "text-[#1176A8]"}`} strokeWidth={2} aria-hidden="true" />
        </span>
        <div className="min-w-0 flex-1">
          <h2 className="text-[16px] font-bold">{nom}</h2>
          <p className={`text-[13px] ${vedette ? "text-white/75" : "text-[#5B7189]"}`}>
            <b className={`text-[18px] ${vedette ? "text-white" : "text-[#123A63]"}`}>{prix}</b> {periode}
          </p>
        </div>
      </div>
      <p className={`pt-[10px] text-[13.5px] leading-snug ${vedette ? "text-white/85" : "text-[#3F5B76]"}`}>{texte}</p>
      <button
        type="button"
        onClick={onInteret}
        disabled={interesse}
        className={`mt-[12px] flex h-[48px] w-full items-center justify-center gap-[8px] galet-moyen text-[13.5px] font-bold tracking-wide ${
          vedette ? "bg-[#3DEFBE] text-[#0B3B63]" : "border-[1.5px] border-[#C9D9E6] bg-white text-[#123A63]"
        } disabled:opacity-80`}
      >
        {interesse ? (
          <>
            <Check className="h-[16px] w-[16px]" strokeWidth={2.6} aria-hidden="true" /> C'EST NOTÉ, MERCI
          </>
        ) : (
          "ÇA M'INTÉRESSE"
        )}
      </button>
    </section>
  );
}
