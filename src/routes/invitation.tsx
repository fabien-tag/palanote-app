import { useEffect, useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { BookOpen, Camera, Check, Users } from "lucide-react";
import fondAsset from "@/assets/BG.png";
import logoHorizontal from "@/assets/logo-horizontal.png";
import { Meduse } from "@/components/numerisation/Ui";
import { accepterInvitation, garderInvitation, initiales, voirInvitation, type Invitation } from "@/lib/amis";
import { annoncerSurAccueil } from "@/lib/message-accueil";
import { utilisateurConnecte } from "@/lib/plongees";

// Page ouverte en scannant le QR code d'un binôme (écran 31 de la maquette).
export const Route = createFileRoute("/invitation")({
  validateSearch: (search: Record<string, unknown>): { code?: string | undefined } => ({
    code: typeof search["code"] === "string" ? search["code"] : undefined,
  }),
  head: () => ({ meta: [{ title: "Palanote — Invitation" }, { name: "description", content: "Ton binôme t'invite sur Palanote." }] }),
  component: PageInvitation,
});

const AVANTAGES = [
  {
    icone: Users,
    fond: "rgba(61,239,190,.20)",
    couleur: "#14805F",
    titre: "Vos plongées communes se remplissent des deux côtés",
    texte: "Tu saisis la profondeur, il saisit le site : chacun récupère ce qui manque.",
  },
  {
    icone: Camera,
    fond: "rgba(255,138,117,.20)",
    couleur: "#D9573F",
    titre: "Ses photos de la sortie arrivent chez toi",
    texte: "Celles qu'il partage, et seulement celles-là.",
  },
  {
    icone: BookOpen,
    fond: "rgba(87,212,245,.22)",
    couleur: "#1176A8",
    titre: "Tes vieux carnets papier deviennent numériques",
    texte: "Tu les photographies, l'app remplit les fiches.",
  },
];

const MESSAGES_ETAT: Record<string, { titre: string; texte: string }> = {
  expiree: { titre: "Ce code a expiré", texte: "Les codes de binôme ne durent que 10 minutes. Demande à ton binôme de t'en montrer un nouveau." },
  utilisee: { titre: "Ce code a déjà servi", texte: "Chaque code ne marche qu'une fois. Demande à ton binôme de t'en montrer un nouveau." },
  introuvable: { titre: "Invitation introuvable", texte: "Le lien est peut-être incomplet. Demande à ton binôme de te montrer à nouveau son QR code." },
  soi_meme: { titre: "C'est ton propre code", texte: "Montre-le à ton binôme : c'est lui qui doit le scanner avec son téléphone." },
};

function PageInvitation() {
  const navigate = useNavigate();
  const { code } = Route.useSearch();
  const [invitation, setInvitation] = useState<Invitation | null>(null);
  const [connecte, setConnecte] = useState<boolean | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);
  const [envoi, setEnvoi] = useState(false);

  useEffect(() => {
    let actif = true;
    void utilisateurConnecte().then((u) => actif && setConnecte(Boolean(u)));
    if (!code) {
      setInvitation({ etat: "introuvable" });
      return;
    }
    voirInvitation(code)
      .then((i) => actif && setInvitation(i))
      .catch((e) => {
        console.error(e);
        if (actif) setErreur("L'invitation n'a pas pu être chargée. Vérifie ta connexion puis recharge la page.");
      });
    return () => {
      actif = false;
    };
  }, [code]);

  const valide = invitation?.etat === "valide";
  const prenom = invitation?.prenom ?? "Ton binôme";
  const etatProbleme = invitation && !valide ? (MESSAGES_ETAT[invitation.etat] ?? MESSAGES_ETAT["introuvable"]!) : null;

  const rejoindre = (vers: "/creer-un-compte" | "/connexion") => {
    if (code) garderInvitation(code);
    navigate({ to: vers });
  };

  const devenirBinomes = async () => {
    if (!code) return;
    setEnvoi(true);
    setErreur(null);
    try {
      const r = await accepterInvitation(code);
      if (r.etat === "acceptee") {
        annoncerSurAccueil(`Toi et ${r.prenom ?? prenom}, vous êtes maintenant binômes`);
        navigate({ to: "/amis" });
        return;
      }
      setInvitation((i) => ({ ...(i ?? {}), etat: r.etat }));
    } catch (e) {
      console.error(e);
      setErreur("Ça n'a pas marché. Vérifie ta connexion et réessaie.");
    } finally {
      setEnvoi(false);
    }
  };

  return (
    <div className="min-h-screen bg-white text-[#123A63]">
      <div className="cascade mx-auto flex min-h-screen w-full max-w-[430px] flex-col">
        {/* En-tête marin */}
        <div
          className="relative flex h-[clamp(230px,34svh,300px)] shrink-0 flex-col overflow-hidden rounded-b-[30px] bg-[#0E3D72] bg-cover bg-center"
          style={{ backgroundImage: `url(${fondAsset})` }}
        >
          <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(6,30,60,.30)_0%,rgba(6,26,52,.05)_40%,rgba(5,22,46,.78)_100%)]" />
          <div className="relative px-[22px] pt-[20px]">
            <img src={logoHorizontal} alt="Palanote" className="h-[23px] w-auto" />
          </div>
          <div className="flex-grow" />
          <div className="relative flex flex-col items-start gap-[14px] px-[24px] pb-[26px]">
            {invitation?.prenom && (
              <div className="flex items-center gap-[11px]">
                <span className="flex h-[46px] w-[46px] items-center justify-center rounded-full border-2 border-white/70 bg-[#CDE9F8] text-[15px] font-bold text-[#0F3D70]">
                  {initiales(invitation.prenom)}
                </span>
                <span className="text-[13px] font-semibold uppercase tracking-[.08em] text-white/80">{invitation.prenom} t'invite</span>
              </div>
            )}
            <h1 className="text-[26px] font-bold leading-tight text-white">
              Vous plongez ensemble.
              <br />
              Vos carnets aussi.
            </h1>
          </div>
        </div>

        {etatProbleme ? (
          <div className="px-[24px] pt-[26px]">
            <div className="relative rounded-[18px] border border-[#FFD3C8] bg-[#FFF3EF] p-[16px]">
              <p className="text-[15px] font-bold">{etatProbleme.titre}</p>
              <p className="pt-[4px] text-[13.5px] leading-normal text-[#5B7189]">{etatProbleme.texte}</p>
            </div>
          </div>
        ) : (
          <div className="flex flex-col gap-[17px] px-[24px] pt-[24px]">
            {AVANTAGES.map(({ icone: Icone, fond, couleur, titre, texte }) => (
              <div key={titre} className="flex items-start gap-[13px]">
                <span className="flex h-[42px] w-[42px] shrink-0 items-center justify-center rounded-[14px]" style={{ background: fond }}>
                  <Icone className="h-[20px] w-[20px]" style={{ color: couleur }} strokeWidth={2.2} aria-hidden="true" />
                </span>
                <span className="min-w-0">
                  <span className="block text-[14.5px] font-bold leading-snug">{titre}</span>
                  <span className="block pt-[2px] text-[13px] leading-normal text-[#5B7189]">{texte}</span>
                </span>
              </div>
            ))}
          </div>
        )}

        {valide && connecte === false && (
          <div className="px-[24px] pt-[22px]">
            <div className="relative flex items-center gap-[12px] rounded-[18px] border border-[#3DEFBE]/60 bg-[#3DEFBE]/10 p-[15px]">
              <span className="flex h-[34px] w-[34px] shrink-0 items-center justify-center rounded-full bg-[#3DEFBE]">
                <Check className="h-[17px] w-[17px] text-[#0B3B63]" strokeWidth={3} aria-hidden="true" />
              </span>
              <p className="text-[13px] leading-[1.45] text-[#3F5B76]">
                Ton invitation est gardée : <b className="text-[#123A63]">vous serez binômes dès ton inscription</b>, sans rien avoir à retaper.
              </p>
              <Meduse className="-right-[8px] -top-[14px]" />
            </div>
          </div>
        )}

        <div className="flex-grow" />

        <div className="flex flex-col gap-[12px] px-[24px] pt-[22px]">
          {erreur && <p className="text-center text-[13px] text-[#8A2A1A]">{erreur}</p>}
          {valide && connecte === false && (
            <>
              <button
                type="button"
                onClick={() => rejoindre("/creer-un-compte")}
                className="flex h-[54px] items-center justify-center rounded-2xl bg-[#3DEFBE] text-[14px] font-bold text-[#0B3B63] shadow-[0_4px_12px_#123A630D]"
              >
                REJOINDRE PALANOTE
              </button>
              <button
                type="button"
                onClick={() => rejoindre("/connexion")}
                className="self-center text-[13.5px] font-semibold text-[#1176A8] underline underline-offset-4"
              >
                J'ai déjà un compte
              </button>
            </>
          )}
          {valide && connecte === true && (
            <button
              type="button"
              disabled={envoi}
              onClick={() => void devenirBinomes()}
              className="flex h-[54px] items-center justify-center rounded-2xl bg-[#3DEFBE] text-[14px] font-bold text-[#0B3B63] shadow-[0_4px_12px_#123A630D] disabled:opacity-60"
            >
              {envoi ? "UN INSTANT…" : `DEVENIR BINÔMES AVEC ${prenom.toUpperCase()}`}
            </button>
          )}
          {etatProbleme && (
            <button
              type="button"
              onClick={() => navigate({ to: connecte ? "/amis" : "/" })}
              className="flex h-[52px] items-center justify-center rounded-2xl border border-[#57D4F5] bg-white text-[14px] font-bold text-[#1176A8]"
            >
              {connecte ? "ALLER À MES AMIS" : "DÉCOUVRIR PALANOTE"}
            </button>
          )}
        </div>

        <p className="px-[24px] pb-[max(28px,env(safe-area-inset-bottom))] pt-[22px] text-center text-[11.5px] leading-normal text-[#9DB0C0]">
          Gratuite, sans publicité. Ce lien expire au bout de 10 minutes et ne donne accès à rien d'autre qu'à cette invitation.
        </p>
      </div>
    </div>
  );
}
