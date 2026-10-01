import { useCallback, useEffect, useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { ChevronLeft, Clock, Share2 } from "lucide-react";
import QRCode from "qrcode";
import logoCorail from "@/assets/palanote-logo-cigle.png";
import { Meduse, useConnexionRequise } from "@/components/numerisation/Ui";
import { creerInvitation, initiales, lienInvitation, monProfil } from "@/lib/amis";

export const Route = createFileRoute("/amis_/ajouter")({
  head: () => ({ meta: [{ title: "Palanote — Ajouter un binôme" }] }),
  component: AjouterBinome,
});

function AjouterBinome() {
  const navigate = useNavigate();
  const { pret, ecran } = useConnexionRequise();
  const [profil, setProfil] = useState<{ prenom: string; niveau: string | null; club: string | null } | null>(null);
  const [invitation, setInvitation] = useState<{ lien: string; expire: number } | null>(null);
  const [qr, setQr] = useState<string | null>(null);
  const [reste, setReste] = useState(0);
  const [erreur, setErreur] = useState<string | null>(null);
  const [partage, setPartage] = useState<string | null>(null);

  const nouvelle = useCallback(async () => {
    setErreur(null);
    try {
      const inv = await creerInvitation();
      const lien = lienInvitation(inv.token);
      setInvitation({ lien, expire: new Date(inv.expire_le).getTime() });
      setQr(await QRCode.toString(lien, { type: "svg", margin: 0, errorCorrectionLevel: "M", color: { dark: "#0F3D70", light: "#FFFFFF" } }));
    } catch (e) {
      console.error(e);
      setErreur(
        `Le QR code n'a pas pu être créé. Vérifie ta connexion.${e && typeof e === "object" && "message" in e ? ` (détail : ${String(e.message)})` : ""}`,
      );
    }
  }, []);

  useEffect(() => {
    if (!pret) return;
    void monProfil().then(setProfil);
    void nouvelle();
  }, [pret, nouvelle]);

  // Compte à rebours ; un nouveau code est créé tout seul quand il expire.
  useEffect(() => {
    if (!invitation) return;
    const maj = () => {
      const s = Math.max(0, Math.round((invitation.expire - Date.now()) / 1000));
      setReste(s);
      if (s === 0) void nouvelle();
    };
    maj();
    const t = setInterval(maj, 1000);
    return () => clearInterval(t);
  }, [invitation, nouvelle]);

  const envoyerLien = async () => {
    if (!invitation) return;
    const texte = `${profil?.prenom ?? "Je"} t'invite à devenir binômes sur Palanote :`;
    try {
      if (navigator.share) {
        await navigator.share({ title: "Palanote", text: texte, url: invitation.lien });
        return;
      }
      await navigator.clipboard.writeText(`${texte} ${invitation.lien}`);
      setPartage("Lien copié : colle-le dans un message à ton binôme.");
    } catch {
      /* partage annulé */
    }
  };

  if (ecran) return ecran;

  const minutes = Math.ceil(reste / 60);

  return (
    <div className="min-h-screen bg-[#F1F6FC] text-[#123A63]">
      <div className="cascade mx-auto flex min-h-screen w-full max-w-[430px] flex-col px-[22px] pb-[max(18px,env(safe-area-inset-bottom))] pt-[clamp(14px,2.6svh,22px)]">
        <div className="flex items-center gap-3">
          <button
            type="button"
            aria-label="Retour"
            onClick={() => navigate({ to: "/amis" })}
            className="flex h-10 w-10 items-center justify-center rounded-[14px] bg-[#E3EDF6]"
          >
            <ChevronLeft className="h-[18px] w-[18px]" strokeWidth={2.4} />
          </button>
          <h1 className="text-[17px] font-bold">Ajouter un binôme</h1>
        </div>

        <p className="pt-[clamp(18px,5svh,44px)] text-center text-[14.5px] leading-normal text-[#5B7189]">
          Montre cet écran à ton binôme.
          <br />
          Il vise avec l'appareil photo de son téléphone.
        </p>

        {/* QR code */}
        <div className="mx-auto mt-[18px] flex h-[clamp(200px,30svh,236px)] w-[clamp(200px,30svh,236px)] items-center justify-center rounded-[26px] bg-white p-[18px] shadow-[0_8px_26px_rgba(15,61,112,.12)]">
          {qr ? (
            <div className="relative h-full w-full">
              <div className="h-full w-full [&>svg]:h-full [&>svg]:w-full" dangerouslySetInnerHTML={{ __html: qr }} />
              <div className="absolute left-1/2 top-1/2 flex h-[42px] w-[42px] -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-[12px] bg-[#0F3D70] p-[7px]">
                <img src={logoCorail} alt="" className="h-full w-auto" />
              </div>
            </div>
          ) : (
            <span className="text-[13px] text-[#9DB0C0]">{erreur ? "—" : "Création du code…"}</span>
          )}
        </div>

        {/* Qui invite */}
        {profil && (
          <div className="mx-auto mt-[16px] flex items-center gap-[12px]">
            <span className="flex h-[42px] w-[42px] items-center justify-center rounded-full bg-[#DCEEF8] text-[14px] font-bold text-[#0F3D70]">
              {initiales(profil.prenom)}
            </span>
            <span>
              <span className="block text-[17px] font-bold leading-tight">{profil.prenom}</span>
              {(profil.niveau || profil.club) && (
                <span className="block text-[12.5px] text-[#5B7189]">{[profil.niveau, profil.club].filter(Boolean).join(" · ")}</span>
              )}
            </span>
          </div>
        )}

        {invitation && reste > 0 && (
          <div className="mx-auto mt-[12px] flex h-[30px] items-center gap-[6px] rounded-[15px] bg-[#E3EDF6] px-[12px] text-[12.5px] font-semibold text-[#5B7189]">
            <Clock className="h-[13px] w-[13px]" strokeWidth={2.4} aria-hidden="true" />
            Ce code expire dans {minutes} min
          </div>
        )}
        {erreur && (
          <div className="mt-[14px] text-center">
            <p className="text-[13px] text-[#8A2A1A]">{erreur}</p>
            <button type="button" onClick={() => void nouvelle()} className="pt-2 text-[13.5px] font-bold text-[#1176A8] underline">
              Réessayer
            </button>
          </div>
        )}

        <div className="relative mt-[clamp(14px,3svh,24px)] rounded-[18px] border border-[#CFE6F3] bg-[#E3F2FB]/80 p-[14px] text-[13px] leading-normal">
          <b>Vous devenez binômes</b> dès qu'il a scanné le code. S'il n'a pas encore Palanote, il crée son compte : l'invitation l'attend, sans rien à
          retaper.
          <Meduse className="-right-[8px] -top-[14px]" />
        </div>

        <div className="min-h-4 flex-grow" />

        {partage && <p className="pb-2 text-center text-[12.5px] text-[#14805F]">{partage}</p>}
        <button
          type="button"
          disabled={!invitation}
          onClick={() => void envoyerLien()}
          className="flex h-[52px] w-full items-center justify-center gap-2 rounded-2xl border border-[#57D4F5] bg-white text-[14px] font-bold text-[#1176A8] disabled:opacity-50"
        >
          <Share2 className="h-[17px] w-[17px]" strokeWidth={2.4} aria-hidden="true" />
          ENVOYER LE LIEN À LA PLACE
        </button>
      </div>
    </div>
  );
}
