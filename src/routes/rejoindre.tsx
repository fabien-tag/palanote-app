import { useEffect, useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { Anchor, BookOpen, Stamp, Waves } from "lucide-react";
import { Meduse } from "@/components/numerisation/Ui";
import { detailErreur, MessageErreur, PageClub } from "@/components/club/Ui";
import { accepterInvitationClub, garderInvitationClub, voirInvitationClub, type InvitationClub } from "@/lib/club";
import { annoncerSurAccueil } from "@/lib/message-accueil";
import { utilisateurConnecte } from "@/lib/plongees";

// Le lien d'invitation envoyé par le club (QR code au comptoir, SMS ou e-mail) :
// le nouveau membre crée son carnet (ou se connecte), et son compte est relié au club.
export const Route = createFileRoute("/rejoindre")({
  validateSearch: (search: Record<string, unknown>): { code?: string } => (typeof search["code"] === "string" ? { code: search["code"] } : {}),
  head: () => ({ meta: [{ title: "Palanote — Ton club t'invite" }, { name: "description", content: "Ton club de plongée t'invite sur Palanote, le carnet de plongée numérique." }] }),
  component: PageRejoindre,
});

function PageRejoindre() {
  const navigate = useNavigate();
  const { code } = Route.useSearch();
  const [inv, setInv] = useState<InvitationClub | null | undefined>(undefined);
  const [connecte, setConnecte] = useState<boolean | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);
  const [enCours, setEnCours] = useState(false);

  useEffect(() => {
    void utilisateurConnecte().then((u) => setConnecte(Boolean(u)));
    if (!code) return setInv(null);
    void voirInvitationClub(code)
      .then((x) => setInv(x ?? null))
      .catch(() => setInv(null));
  }, [code]);

  const rejoindre = async () => {
    if (!code) return;
    setEnCours(true);
    setErreur(null);
    try {
      const r = await accepterInvitationClub(code);
      annoncerSurAccueil(`Bienvenue ! Ton compte est relié à ${r.club}.`);
      navigate({ to: "/carnet" });
    } catch (e) {
      setErreur(detailErreur(e, "L'invitation n'a pas pu être acceptée."));
    } finally {
      setEnCours(false);
    }
  };

  const sansCompte = (vers: "/creer-un-compte" | "/connexion") => {
    if (code) garderInvitationClub(code);
    navigate({ to: vers });
  };

  return (
    <PageClub titre="Invitation" onRetour={() => navigate({ to: connecte ? "/carnet" : "/" })}>
      <MessageErreur texte={erreur} />
      {inv === null && (
        <div className="mt-[16px] galet-c border border-[#FFD3C8] bg-[#FFF3EF] p-[16px]">
          <p className="text-[15px] font-bold">Invitation introuvable</p>
          <p className="pt-[4px] text-[13.5px] leading-normal text-[#566B82]">Le lien est peut-être incomplet. Demande au club de te le renvoyer.</p>
        </div>
      )}
      {inv && (
        <>
          <div className="relative mt-[12px] galet-c border border-[#E4EBF1] bg-white p-[18px]">
            <span className="flex h-[52px] w-[52px] items-center justify-center goutte bg-[#0F3D70] text-white">
              <Anchor className="h-[24px] w-[24px]" />
            </span>
            <p className="pt-[12px] text-[13px] font-bold uppercase tracking-[.08em] text-[#106F9F]">Bienvenue {inv.prenom}</p>
            <h1 className="pt-[2px] text-[24px] font-bold leading-tight">{inv.club} t'invite sur Palanote</h1>
            {inv.ville && <p className="text-[13.5px] text-[#566B82]">{inv.ville}</p>}
            <Meduse className="-right-[6px] -top-[14px]" />
          </div>
          <div className="flex flex-col gap-[14px] pt-[20px]">
            {[
              { I: BookOpen, t: "Ton carnet de plongée", x: inv.plongees > 0 ? `Tes ${inv.plongees} plongées avec le club t'y attendent.` : "Toutes tes plongées au même endroit, sur ton téléphone." },
              { I: Waves, t: "Les sorties du club", x: "Tu t'inscris d'un scan, tu vois ta palanquée et les consignes du DP." },
              { I: Stamp, t: "Le tampon numérique", x: "Ta plongée validée par le DP, sans chercher le tampon à la sortie de l'eau." },
            ].map(({ I, t, x }) => (
              <div key={t} className="flex items-start gap-[12px]">
                <span className="flex h-[40px] w-[40px] shrink-0 items-center justify-center goutte bg-[#E3F2FB] text-[#106F9F]">
                  <I className="h-[19px] w-[19px]" />
                </span>
                <span>
                  <span className="block text-[14px] font-bold leading-snug">{t}</span>
                  <span className="block text-[12.5px] leading-normal text-[#566B82]">{x}</span>
                </span>
              </div>
            ))}
          </div>
          <div className="min-h-[22px] flex-grow" />
          {connecte ? (
            <button
              type="button"
              disabled={enCours}
              onClick={() => void rejoindre()}
              className="flex h-14 w-full items-center justify-center galet-moyen bg-[#3DEFBE] text-[14px] font-bold text-[#0B3B63] disabled:opacity-50"
            >
              {enCours ? "UN INSTANT…" : `REJOINDRE ${inv.club.toUpperCase()}`}
            </button>
          ) : connecte === false ? (
            <>
              <button
                type="button"
                onClick={() => sansCompte("/creer-un-compte")}
                className="flex h-14 w-full items-center justify-center galet-moyen bg-[#3DEFBE] text-[14px] font-bold text-[#0B3B63]"
              >
                CRÉER MON CARNET
              </button>
              <button
                type="button"
                onClick={() => sansCompte("/connexion")}
                className="mx-auto mt-[12px] block text-[13.5px] font-semibold text-[#106F9F] underline underline-offset-4"
              >
                J'ai déjà un compte
              </button>
              <p className="pt-[12px] text-center text-[11.5px] leading-normal text-[#566B82]">
                {inv.email ? `Utilise de préférence ${inv.email}. ` : ""}Carnet gratuit, sans publicité.
              </p>
            </>
          ) : null}
        </>
      )}
    </PageClub>
  );
}
