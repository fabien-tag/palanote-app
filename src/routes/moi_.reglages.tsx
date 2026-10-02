import { useCallback, useEffect, useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { Anchor, Award, Globe, KeyRound, Mail, Ruler, Thermometer, UserRound } from "lucide-react";
import { BandeauConfirmation } from "@/components/BandeauConfirmation";
import { Bloc, Interrupteur, Ligne, ModaleSuppressionCompte, Note, PageMoi, TitreSection } from "@/components/moi/Ui";
import { useConnexionRequise } from "@/components/numerisation/Ui";
import { signOut } from "@/lib/auth";
import { changerEmail, changerMotDePasse, chargerProfil, compteConnecte, sauverReglage, supprimerMonCompte, type Compte, type Profil } from "@/lib/moi";
import { libelleRole } from "@/lib/profil-plongeur";

export const Route = createFileRoute("/moi_/reglages")({
  head: () => ({ meta: [{ title: "Palanote — Réglages" }] }),
  component: Reglages,
});

const champ =
  "block h-[48px] w-full galet-moyen border-[1.5px] border-[#E4EBF1] bg-white px-[14px] text-[15px] text-[#123A63] outline-none placeholder:text-[#B5C4D1] focus:border-[#57D4F5]";
const boutonPetit = "flex h-[44px] flex-1 items-center justify-center galet-moyen text-[13px] font-bold disabled:opacity-50";

function Reglages() {
  const navigate = useNavigate();
  const { pret, ecran } = useConnexionRequise();
  const [compte, setCompte] = useState<Compte | null>(null);
  const [profil, setProfil] = useState<Profil | null>(null);
  const [notifLecture, setNotifLecture] = useState(true);
  const [notifBinome, setNotifBinome] = useState(true);
  const [ouvert, setOuvert] = useState<null | "email" | "mdp">(null);
  const [email, setEmail] = useState("");
  const [mdp, setMdp] = useState("");
  const [mdp2, setMdp2] = useState("");
  const [enCours, setEnCours] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [suppression, setSuppression] = useState(false);
  const [erreurSuppression, setErreurSuppression] = useState<string | null>(null);
  const finMessage = useCallback(() => setMessage(null), []);

  useEffect(() => {
    if (!pret) return;
    void compteConnecte().then(setCompte);
    void chargerProfil().then((p) => {
      if (!p) return;
      setProfil(p);
      setNotifLecture(p.notifLecture);
      setNotifBinome(p.notifBinome);
    });
  }, [pret]);

  const basculer = async (cle: "notif_lecture" | "notif_binome", v: boolean) => {
    const set = cle === "notif_lecture" ? setNotifLecture : setNotifBinome;
    set(v);
    try {
      await sauverReglage(cle, v);
    } catch (e) {
      console.error(e);
      set(!v);
      setErreur("Le réglage n'a pas pu être enregistré. Vérifie ta connexion.");
    }
  };

  const ouvrir = (q: "email" | "mdp") => {
    setErreur(null);
    setOuvert(ouvert === q ? null : q);
    setEmail("");
    setMdp("");
    setMdp2("");
  };

  const validerEmail = async () => {
    if (!/^\S+@\S+\.\S+$/.test(email.trim())) return setErreur("Cette adresse e-mail n'a pas l'air valide.");
    setEnCours(true);
    setErreur(null);
    try {
      await changerEmail(email);
      setOuvert(null);
      setMessage("Un lien de confirmation t'a été envoyé par e-mail");
    } catch (e) {
      console.error(e);
      setErreur(`L'adresse n'a pas pu être changée.${e && typeof e === "object" && "message" in e ? ` (détail : ${String(e.message)})` : ""}`);
    } finally {
      setEnCours(false);
    }
  };

  const validerMdp = async () => {
    if (mdp.length < 8) return setErreur("Choisis au moins 8 caractères.");
    if (mdp !== mdp2) return setErreur("Les deux mots de passe ne sont pas identiques.");
    setEnCours(true);
    setErreur(null);
    try {
      await changerMotDePasse(mdp);
      setOuvert(null);
      setMessage("Ton mot de passe a bien été changé");
    } catch (e) {
      console.error(e);
      const code = (e as { code?: string })?.code;
      setErreur(
        code === "weak_password"
          ? "Ce mot de passe est trop simple ou déjà compromis. Choisis-en un autre."
          : code === "same_password"
            ? "C'est déjà ton mot de passe actuel."
            : code === "reauthentication_needed"
              ? "Pour ta sécurité, déconnecte-toi puis reconnecte-toi avant de changer ton mot de passe."
              : "Le mot de passe n'a pas pu être changé.",
      );
    } finally {
      setEnCours(false);
    }
  };

  const deconnecter = async () => {
    await signOut().catch(() => undefined);
    navigate({ to: "/connexion", replace: true });
  };

  const supprimer = async () => {
    setEnCours(true);
    setErreurSuppression(null);
    try {
      await supprimerMonCompte();
      navigate({ to: "/", replace: true });
    } catch (e) {
      console.error(e);
      setErreurSuppression(`La suppression n'a pas abouti.${e && typeof e === "object" && "message" in e ? ` (détail : ${String(e.message)})` : ""}`);
    } finally {
      setEnCours(false);
    }
  };

  if (ecran) return ecran;

  return (
    <PageMoi titre="Réglages">
      {message && <BandeauConfirmation texte={message} onFin={finMessage} />}

      <TitreSection>Mon profil de plongeur</TitreSection>
      <Bloc>
        <Ligne icone={Award} label="Niveau" valeur={profil?.niveau || "À renseigner"} onClick={() => navigate({ to: "/moi/profil" })} />
        <Ligne icone={UserRound} label="Rôle" valeur={libelleRole(profil?.role) || "À renseigner"} onClick={() => navigate({ to: "/moi/profil" })} />
        <Ligne icone={Anchor} label="Club ou centre" valeur={profil?.club || "À renseigner"} onClick={() => navigate({ to: "/moi/profil" })} />
      </Bloc>

      <TitreSection>Unités</TitreSection>
      <Bloc>
        <Ligne icone={Ruler} label="Profondeur" valeur="mètres" />
        <Ligne icone={Thermometer} label="Température" valeur="degrés Celsius" />
        <Ligne icone={Globe} label="Langue" valeur="Français" />
      </Bloc>
      <Note>Les pieds, les degrés Fahrenheit et l'anglais arriveront plus tard.</Note>

      <TitreSection>Notifications</TitreSection>
      <Bloc>
        <Interrupteur
          titre="Quand une lecture de carnet se termine"
          texte="Un seul message par lot, jamais par page."
          actif={notifLecture}
          onChange={(v) => void basculer("notif_lecture", v)}
        />
        <Interrupteur
          titre="Quand un binôme note une plongée commune"
          texte="La proposition t'attend dans l'onglet Amis dans tous les cas."
          actif={notifBinome}
          onChange={(v) => void basculer("notif_binome", v)}
        />
      </Bloc>
      <div className="mt-[12px] galet-b border border-[#BFE3F4] bg-[#E3F2FB] p-[15px]">
        <div className="text-[14px] font-bold">Sur iPhone, ajoute Palanote à ton écran d'accueil</div>
        <div className="pt-[3px] text-[12.5px] leading-normal text-[#3F5B76]">
          C'est la seule façon de recevoir une notification. Règle d'Apple, pas de nous. Dans Safari : bouton Partager, puis « Sur l'écran d'accueil ».
        </div>
      </div>
      <Note>Les notifications arrivent bientôt : tes choix sont déjà gardés.</Note>
      <Note>
        La lettre annuelle se règle dans{" "}
        <button type="button" onClick={() => navigate({ to: "/moi/confidentialite" })} className="font-bold text-[#123A63] underline underline-offset-2">
          Confidentialité
        </button>{" "}
        : c'est un consentement, il porte une date, et il n'a qu'un seul endroit.
      </Note>

      <TitreSection>Mon compte</TitreSection>
      <Bloc>
        <Ligne icone={Mail} label="Adresse e-mail" valeur={compte?.email ?? ""} onClick={() => ouvrir("email")} />
        {ouvert === "email" && (
          <div className="flex flex-col gap-[10px] pb-[14px]">
            {compte?.avecGoogle && !compte.avecMotDePasse ? (
              <p className="text-[12.5px] leading-normal text-[#5B7189]">Tu te connectes avec Google : ton adresse e-mail est celle de ton compte Google.</p>
            ) : (
              <>
                <input className={champ} type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Nouvelle adresse" autoComplete="email" />
                <p className="text-[12px] text-[#9DB0C0]">Un lien de confirmation part vers la nouvelle adresse. L'ancienne reste active d'ici là.</p>
                <div className="flex gap-[10px]">
                  <button type="button" className={`${boutonPetit} bg-[#EEF4F9] text-[#5B7189]`} onClick={() => setOuvert(null)}>
                    Annuler
                  </button>
                  <button type="button" disabled={enCours} className={`${boutonPetit} bg-[#3DEFBE] text-[#0B3B63]`} onClick={() => void validerEmail()}>
                    {enCours ? "Envoi…" : "Changer"}
                  </button>
                </div>
              </>
            )}
          </div>
        )}
        <Ligne icone={KeyRound} label="Mot de passe" valeur={compte?.avecMotDePasse ? "••••••••" : undefined} onClick={() => ouvrir("mdp")} />
        {ouvert === "mdp" && (
          <div className="flex flex-col gap-[10px] pb-[14px]">
            {compte?.avecGoogle && !compte.avecMotDePasse && (
              <p className="text-[12.5px] leading-normal text-[#5B7189]">
                Tu te connectes avec Google. Tu peux aussi définir un mot de passe pour te connecter avec ton adresse e-mail.
              </p>
            )}
            <input className={champ} type="password" value={mdp} onChange={(e) => setMdp(e.target.value)} placeholder="Nouveau mot de passe" autoComplete="new-password" />
            <input className={champ} type="password" value={mdp2} onChange={(e) => setMdp2(e.target.value)} placeholder="Encore une fois" autoComplete="new-password" />
            <div className="flex gap-[10px]">
              <button type="button" className={`${boutonPetit} bg-[#EEF4F9] text-[#5B7189]`} onClick={() => setOuvert(null)}>
                Annuler
              </button>
              <button type="button" disabled={enCours} className={`${boutonPetit} bg-[#3DEFBE] text-[#0B3B63]`} onClick={() => void validerMdp()}>
                {enCours ? "…" : "Changer"}
              </button>
            </div>
          </div>
        )}
      </Bloc>
      {erreur && <p className="pt-[10px] text-[13px] text-[#8A2A1A]">{erreur}</p>}

      <button
        type="button"
        onClick={() => void deconnecter()}
        className="mt-[22px] flex h-[56px] items-center justify-center galet-moyen border border-[#E4EBF1] bg-white text-[14px] font-bold"
      >
        Se déconnecter
      </button>
      <button type="button" onClick={() => setSuppression(true)} className="mx-auto mt-[22px] text-[14px] font-bold text-[#C94957]">
        Supprimer mon compte
      </button>

      {suppression && (
        <ModaleSuppressionCompte
          enCours={enCours}
          erreur={erreurSuppression}
          onAnnuler={() => setSuppression(false)}
          onConfirmer={() => void supprimer()}
        />
      )}
    </PageMoi>
  );
}
