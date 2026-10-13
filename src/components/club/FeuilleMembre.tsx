import { useEffect, useState } from "react";
import QRCode from "qrcode";
import { Check, Copy, Mail, MessageSquare, Star, UserCheck } from "lucide-react";
import { ChampTexte, Feuille, MessageErreur, detailErreur } from "@/components/club/Ui";
import { ajouterMembre, lienInvitationClub, type MembreInvite, type NouveauMembre } from "@/lib/club";

// Au comptoir : le DP ajoute un nouveau membre, puis lui envoie son lien Palanote
// (QR code à scanner sur place, SMS ou e-mail).
const NIVEAUX = ["Débutant", "N1", "N2", "N3", "N4", "PA20", "PE40", "Open Water", "Advanced"];
const VIDE: NouveauMembre = { prenom: "", nom: "", email: "", telephone: "", niveau: "", licence: "", certificat: "", privilegie: false };

export function FeuilleAjoutMembre({ centre, nomClub, onFermer, onAjoute }: { centre: string; nomClub: string; onFermer: () => void; onAjoute: () => void }) {
  const [m, setM] = useState<NouveauMembre>(VIDE);
  const [enCours, setEnCours] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);
  const [invite, setInvite] = useState<MembreInvite | null>(null);

  if (invite) return <FeuilleInvitationMembre invite={invite} nomClub={nomClub} onFermer={onFermer} nouveau />;

  const emailOk = !m.email.trim() || /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(m.email.trim());
  const valider = async () => {
    setEnCours(true);
    setErreur(null);
    try {
      const r = await ajouterMembre(centre, { ...m, prenom: m.prenom.trim(), email: m.email.trim() });
      setInvite(r);
      onAjoute();
    } catch (e) {
      console.error(e);
      setErreur(detailErreur(e, "Le membre n'a pas pu être ajouté."));
    } finally {
      setEnCours(false);
    }
  };

  return (
    <Feuille titre="Ajouter un membre" onFermer={onFermer}>
      <p className="pb-[10px] text-[13px] leading-snug text-[#5B7189]">
        Il rejoint la liste des adhérents et reçoit son lien Palanote pour créer son carnet, relié au club.
      </p>
      <div className="grid grid-cols-2 gap-x-[10px]">
        <ChampTexte label="Prénom *" value={m.prenom} onChange={(e) => setM({ ...m, prenom: e.target.value })} placeholder="Camille" autoFocus />
        <ChampTexte label="Nom" value={m.nom} onChange={(e) => setM({ ...m, nom: e.target.value })} placeholder="Roux" />
      </div>
      <ChampTexte label="Téléphone (pour l'envoi par SMS)" type="tel" inputMode="tel" value={m.telephone} onChange={(e) => setM({ ...m, telephone: e.target.value })} placeholder="06 12 34 56 78" />
      <ChampTexte label="E-mail (relie son compte au club)" type="email" inputMode="email" value={m.email} onChange={(e) => setM({ ...m, email: e.target.value })} placeholder="camille@exemple.fr" />
      {!emailOk && <p className="-mt-[6px] pb-[6px] text-[12px] font-semibold text-[#D9573F]">Adresse e-mail incomplète.</p>}
      <p className="pb-[6px] pt-[4px] text-[12px] font-bold text-[#5B7189]">Niveau</p>
      <div className="flex flex-wrap gap-[6px] pb-[10px]">
        {NIVEAUX.map((n) => (
          <button
            key={n}
            type="button"
            onClick={() => setM({ ...m, niveau: m.niveau === n ? "" : n })}
            className={`h-[32px] rounded-[10px] px-[10px] text-[12.5px] font-bold ${m.niveau === n ? "bg-[#0F3D70] text-white" : "border border-[#D8E5EE] bg-white text-[#5B7189]"}`}
          >
            {n}
          </button>
        ))}
      </div>
      <div className="grid grid-cols-2 gap-x-[10px]">
        <ChampTexte label="N° de licence" value={m.licence} onChange={(e) => setM({ ...m, licence: e.target.value })} placeholder="A-12-345" />
        <ChampTexte label="Fin du certificat" type="date" value={m.certificat} onChange={(e) => setM({ ...m, certificat: e.target.value })} />
      </div>
      <button
        type="button"
        onClick={() => setM({ ...m, privilegie: !m.privilegie })}
        className={`mt-[4px] flex w-full items-center gap-[10px] rounded-[10px] border px-[12px] py-[10px] text-left text-[13.5px] font-bold ${m.privilegie ? "border-[#F2D49A] bg-[#FFF8E8]" : "border-[#E4EBF1]"}`}
      >
        <Star className="h-[17px] w-[17px]" fill={m.privilegie ? "#E9A93A" : "none"} stroke={m.privilegie ? "#E9A93A" : "#9DB0C0"} />
        Membre privilégié
      </button>
      <MessageErreur texte={erreur} />
      <button
        type="button"
        disabled={enCours || !m.prenom.trim() || !emailOk}
        onClick={() => void valider()}
        className="mt-[14px] flex h-[52px] w-full items-center justify-center rounded-[10px] bg-[#3DEFBE] text-[14px] font-bold text-[#0B3B63] disabled:opacity-50"
      >
        {enCours ? "AJOUT…" : "AJOUTER ET INVITER"}
      </button>
    </Feuille>
  );
}

// L'invitation : QR code à scanner sur place, SMS, e-mail ou lien à copier
export function FeuilleInvitationMembre({ invite, nomClub, onFermer, nouveau = false }: { invite: MembreInvite; nomClub: string; onFermer: () => void; nouveau?: boolean }) {
  const lien = lienInvitationClub(invite.jeton);
  const [qr, setQr] = useState<string | null>(null);
  const [copie, setCopie] = useState(false);
  useEffect(() => {
    void QRCode.toString(lien, { type: "svg", margin: 0, errorCorrectionLevel: "M", color: { dark: "#0F3D70", light: "#FFFFFF" } }).then(setQr);
  }, [lien]);
  const message = `Bonjour ${invite.prenom}, bienvenue à ${nomClub} ! Ton carnet de plongée t'attend sur Palanote : ${lien}`;
  const tel = (invite.telephone ?? "").replace(/[^\d+]/g, "");

  return (
    <Feuille titre={nouveau ? `${invite.prenom} est ajouté` : `Inviter ${invite.prenom}`} onFermer={onFermer}>
      {invite.compte ? (
        <p className="mb-[12px] flex items-start gap-[8px] rounded-[10px] bg-[#E2F8EF] px-[12px] py-[10px] text-[13px] leading-snug text-[#14805F]">
          <UserCheck className="mt-[1px] h-[16px] w-[16px] shrink-0" />
          <span>
            <b>{invite.prenom} a déjà un compte Palanote</b> avec cette adresse : il est relié au club et prévenu dans l'app.
          </span>
        </p>
      ) : (
        <p className="pb-[12px] text-[13px] leading-snug text-[#5B7189]">
          Il scanne le QR code avec son téléphone, ou reçoit le lien par SMS ou e-mail. Il crée son carnet, et son compte est relié au club.
        </p>
      )}
      <div className="mx-auto w-[190px] rounded-[10px] border border-[#E4EBF1] bg-white p-[14px]" aria-label="QR code d'invitation">
        {qr ? <div className="[&>svg]:h-auto [&>svg]:w-full" dangerouslySetInnerHTML={{ __html: qr }} /> : <div className="aspect-square" />}
      </div>
      <p className="pb-[12px] pt-[6px] text-center text-[12px] text-[#7D93A8]">À scanner sur place avec l'appareil photo</p>
      <div className="grid grid-cols-2 gap-[8px]">
        <a
          href={tel ? `sms:${tel}?&body=${encodeURIComponent(message)}` : undefined}
          aria-disabled={!tel}
          className={`flex h-[46px] items-center justify-center gap-[6px] rounded-[10px] text-[13px] font-bold ${tel ? "bg-[#0F3D70] text-white" : "pointer-events-none bg-[#EEF2F6] text-[#9DB0C0]"}`}
        >
          <MessageSquare className="h-[16px] w-[16px]" /> Par SMS
        </a>
        <a
          href={invite.email ? `mailto:${invite.email}?subject=${encodeURIComponent(`Bienvenue à ${nomClub} sur Palanote`)}&body=${encodeURIComponent(message)}` : undefined}
          aria-disabled={!invite.email}
          className={`flex h-[46px] items-center justify-center gap-[6px] rounded-[10px] text-[13px] font-bold ${invite.email ? "border border-[#57D4F5] bg-white text-[#1176A8]" : "pointer-events-none bg-[#EEF2F6] text-[#9DB0C0]"}`}
        >
          <Mail className="h-[16px] w-[16px]" /> Par e-mail
        </a>
      </div>
      <button
        type="button"
        onClick={async () => {
          try {
            await navigator.clipboard.writeText(message);
            setCopie(true);
            setTimeout(() => setCopie(false), 2000);
          } catch {
            /* presse-papiers indisponible */
          }
        }}
        className="mx-auto mt-[12px] flex items-center gap-[6px] text-[13px] font-semibold text-[#1176A8]"
      >
        {copie ? <Check className="h-[15px] w-[15px]" /> : <Copy className="h-[15px] w-[15px]" />} {copie ? "Message copié" : "Copier le message (WhatsApp…)"}
      </button>
      <button type="button" onClick={onFermer} className="mt-[14px] flex h-[48px] w-full items-center justify-center rounded-[10px] bg-[#EEF3F8] text-[14px] font-bold text-[#123A63]">
        TERMINÉ
      </button>
    </Feuille>
  );
}
