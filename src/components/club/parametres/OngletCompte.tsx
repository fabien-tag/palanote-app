import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { useNavigate } from "@tanstack/react-router";
import { KeyRound, LogOut, Mail } from "lucide-react";
import { ModaleSuppressionCompte } from "@/components/moi/Ui";
import { signOut } from "@/lib/auth";
import { changerEmail, changerMotDePasse, chargerProfil, sauverReglage, supprimerMonCompte, type Compte } from "@/lib/moi";
import { BOUTON_PRINCIPAL, BOUTON_SECONDAIRE, Bascule, Carte, CHAMP, Rang } from "./Commun";

// Paramètres › Connexion et sécurité
export function OngletCompte({ compte }: { compte: Compte | null }) {
  const navigate = useNavigate();
  const [ouvert, setOuvert] = useState<null | "email" | "mdp">(null);
  const [email, setEmail] = useState("");
  const [mdp, setMdp] = useState("");
  const [mdp2, setMdp2] = useState("");
  const [enCours, setEnCours] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [suppression, setSuppression] = useState(false);
  const [erreurSuppression, setErreurSuppression] = useState<string | null>(null);

  const ouvrir = (q: "email" | "mdp") => {
    setErreur(null);
    setMessage(null);
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
      setMessage("Un lien de confirmation t'a été envoyé à la nouvelle adresse.");
    } catch (e) {
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
      setMessage("Ton mot de passe a bien été changé.");
    } catch (e) {
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

  const supprimer = async () => {
    setEnCours(true);
    setErreurSuppression(null);
    try {
      await supprimerMonCompte();
      navigate({ to: "/", replace: true });
    } catch (e) {
      setErreurSuppression(`La suppression n'a pas abouti.${e && typeof e === "object" && "message" in e ? ` (détail : ${String(e.message)})` : ""}`);
    } finally {
      setEnCours(false);
    }
  };

  const google = Boolean(compte?.avecGoogle && !compte.avecMotDePasse);

  return (
    <div className="flex flex-col gap-[20px]">
      <Carte titre="Connexion" texte="L'adresse et le mot de passe qui ouvrent ton espace, sur tous tes appareils.">
        <Rang titre="Adresse e-mail" texte={google ? "Tu te connectes avec Google : c'est l'adresse de ton compte Google." : "Un lien de confirmation part vers la nouvelle adresse."}>
          <div className="flex flex-wrap items-center gap-[12px]">
            <span className="flex min-w-0 items-center gap-[8px] text-[14px] font-semibold">
              <Mail className="h-[16px] w-[16px] shrink-0 text-[#1176A8]" aria-hidden="true" />
              <span className="truncate">{compte?.email ?? "…"}</span>
            </span>
            {!google && (
              <button type="button" onClick={() => ouvrir("email")} className={`${BOUTON_SECONDAIRE} ml-auto h-[36px]`}>
                {ouvert === "email" ? "Fermer" : "Modifier"}
              </button>
            )}
          </div>
          {ouvert === "email" && (
            <div className="flex flex-wrap gap-[10px] pt-[12px]">
              <input className={`${CHAMP} flex-1 sm:max-w-[360px]`} type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Nouvelle adresse" autoComplete="email" autoFocus />
              <button type="button" disabled={enCours} onClick={() => void validerEmail()} className={BOUTON_PRINCIPAL}>
                {enCours ? "ENVOI…" : "CHANGER"}
              </button>
            </div>
          )}
        </Rang>
        <Rang titre="Mot de passe" texte={google ? "Facultatif : pour te connecter aussi avec ton adresse e-mail." : "8 caractères au minimum."}>
          <div className="flex flex-wrap items-center gap-[12px]">
            <span className="flex items-center gap-[8px] text-[14px] font-semibold">
              <KeyRound className="h-[16px] w-[16px] text-[#1176A8]" aria-hidden="true" />
              {compte?.avecMotDePasse ? "••••••••••" : "Aucun mot de passe"}
            </span>
            <button type="button" onClick={() => ouvrir("mdp")} className={`${BOUTON_SECONDAIRE} ml-auto h-[36px]`}>
              {ouvert === "mdp" ? "Fermer" : compte?.avecMotDePasse ? "Modifier" : "Définir"}
            </button>
          </div>
          {ouvert === "mdp" && (
            <div className="grid grid-cols-1 gap-[10px] pt-[12px] sm:grid-cols-[1fr_1fr_auto]">
              <input className={CHAMP} type="password" value={mdp} onChange={(e) => setMdp(e.target.value)} placeholder="Nouveau mot de passe" autoComplete="new-password" autoFocus />
              <input className={CHAMP} type="password" value={mdp2} onChange={(e) => setMdp2(e.target.value)} placeholder="Encore une fois" autoComplete="new-password" />
              <button type="button" disabled={enCours} onClick={() => void validerMdp()} className={BOUTON_PRINCIPAL}>
                {enCours ? "…" : "CHANGER"}
              </button>
            </div>
          )}
        </Rang>
        {(erreur || message) && (
          <p className={`pb-[16px] text-[13px] font-semibold ${erreur ? "text-[#8A2A1A]" : "text-[#14805F]"}`}>{erreur ?? message}</p>
        )}
      </Carte>

      <Carte titre="Session" texte="Tu es connecté sur cet appareil.">
        <Rang titre="Se déconnecter" texte="Tes sorties et ton club restent enregistrés : tu les retrouves en te reconnectant.">
          <button type="button" onClick={() => void signOut().catch(() => undefined).then(() => navigate({ to: "/connexion", replace: true }))} className={BOUTON_SECONDAIRE}>
            <LogOut className="h-[16px] w-[16px]" aria-hidden="true" /> Se déconnecter
          </button>
        </Rang>
      </Carte>

      <Carte titre="Supprimer mon compte" texte="Ton carnet, tes photos et ton compte sont effacés. Les sorties du club restent au club." danger>
        <div className="py-[18px]">
          <button type="button" onClick={() => setSuppression(true)} className="inline-flex h-[42px] items-center rounded-[10px] border border-[#F0B3A6] bg-white px-[16px] text-[13px] font-bold text-[#C94957] hover:bg-[#FFF4F1]">
            Supprimer mon compte…
          </button>
        </div>
      </Carte>

      {suppression &&
        createPortal(
          <div className="bureau">
            <ModaleSuppressionCompte enCours={enCours} erreur={erreurSuppression} onAnnuler={() => setSuppression(false)} onConfirmer={() => void supprimer()} />
          </div>,
          document.body,
        )}
    </div>
  );
}

// Paramètres › Notifications
export function OngletNotifications({ onVoir }: { onVoir: () => void }) {
  const [lecture, setLecture] = useState(true);
  const [binome, setBinome] = useState(true);
  const [erreur, setErreur] = useState<string | null>(null);

  useEffect(() => {
    void chargerProfil().then((p) => {
      if (!p) return;
      setLecture(p.notifLecture);
      setBinome(p.notifBinome);
    });
  }, []);

  const basculer = async (cle: "notif_lecture" | "notif_binome", v: boolean) => {
    const set = cle === "notif_lecture" ? setLecture : setBinome;
    set(v);
    setErreur(null);
    try {
      await sauverReglage(cle, v);
    } catch {
      set(!v);
      setErreur("Le réglage n'a pas pu être enregistré. Vérifie ta connexion.");
    }
  };

  const RAPPELS = [
    ["Matériel", "Contrôles, TIV et requalifications qui arrivent à échéance."],
    ["Plongeurs", "Certificats médicaux expirés ou proches de l'être."],
    ["Sorties", "Sortie à préparer la veille (palanquées, guide, bateau), à clôturer, carnets à tamponner."],
    ["Désistements", "Un plongeur ne peut plus venir : tu valides son retrait."],
    ["Liste d'attente", "Une place se libère, le suivant est prévenu."],
    ["Formations", "La veille de chaque journée de cours que tu encadres."],
  ];

  return (
    <div className="flex flex-col gap-[20px]">
      <Carte
        titre="Rappels du directeur de plongée"
        texte="Ils arrivent dans la cloche, en haut de l'écran. Toujours actifs : ils touchent à la sécurité des plongeurs."
        droite={
          <button type="button" onClick={onVoir} className={`${BOUTON_SECONDAIRE} h-[36px]`}>
            Voir mes notifications
          </button>
        }
      >
        <div className="grid grid-cols-1 gap-x-[32px] py-[8px] md:grid-cols-2">
          {RAPPELS.map(([t, x]) => (
            <div key={t} className="flex gap-[10px] border-t border-[#EDF2F7] py-[12px] first:border-t-0 md:[&:nth-child(2)]:border-t-0">
              <span className="mt-[6px] h-[8px] w-[8px] shrink-0 rounded-full bg-[#3DEFBE]" aria-hidden="true" />
              <span>
                <span className="block text-[14px] font-bold">{t}</span>
                <span className="block text-[12.5px] leading-normal text-[#7D93A8]">{x}</span>
              </span>
            </div>
          ))}
        </div>
      </Carte>

      <Carte titre="Ton carnet de plongeur" texte="Ce que tu reçois comme plongeur, en dehors du club.">
        <Rang titre="Lecture de carnet terminée" texte="Un seul message par lot, jamais par page.">
          <Bascule actif={lecture} label="Lecture de carnet terminée" onChange={(v) => void basculer("notif_lecture", v)} />
        </Rang>
        <Rang titre="Plongée commune notée par un binôme" texte="La proposition t'attend dans l'onglet Amis dans tous les cas.">
          <Bascule actif={binome} label="Plongée commune notée par un binôme" onChange={(v) => void basculer("notif_binome", v)} />
        </Rang>
        {erreur && <p className="pb-[16px] text-[13px] font-semibold text-[#8A2A1A]">{erreur}</p>}
      </Carte>
    </div>
  );
}
