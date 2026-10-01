import { useCallback, useEffect, useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { Download, Trash2 } from "lucide-react";
import { BandeauConfirmation } from "@/components/BandeauConfirmation";
import { Bloc, Interrupteur, Ligne, ModaleSuppressionCompte, Note, PageMoi, TitreSection } from "@/components/moi/Ui";
import { useConnexionRequise } from "@/components/numerisation/Ui";
import { chargerProfil, dateLongue, exporterToutesMesDonnees, sauverLettreAnnuelle, supprimerMonCompte } from "@/lib/moi";

export const Route = createFileRoute("/moi_/confidentialite")({
  head: () => ({ meta: [{ title: "Palanote — Confidentialité" }] }),
  component: Confidentialite,
});

const QUI_VOIT: [string, "binomes" | "concerne" | "toi"][] = [
  ["Ton prénom et ton niveau", "binomes"],
  ["Ton club", "binomes"],
  ["Vos plongées communes", "concerne"],
  ["Ton carnet", "toi"],
  ["Tes photos", "toi"],
  ["Tes positions", "toi"],
  ["Ton nombre de plongées", "toi"],
];

const PASTILLES = {
  binomes: { texte: "tes binômes", classe: "bg-[#3DEFBE]/25 text-[#0B6B52]" },
  concerne: { texte: "le binôme concerné", classe: "bg-[#3DEFBE]/25 text-[#0B6B52]" },
  toi: { texte: "toi seul", classe: "bg-[#EEF4F9] text-[#5B7189]" },
};

function Confidentialite() {
  const navigate = useNavigate();
  const { pret, ecran } = useConnexionRequise();
  const [lettre, setLettre] = useState(false);
  const [lettreLe, setLettreLe] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);
  const [exportEnCours, setExportEnCours] = useState(false);
  const [suppression, setSuppression] = useState(false);
  const [suppressionEnCours, setSuppressionEnCours] = useState(false);
  const [erreurSuppression, setErreurSuppression] = useState<string | null>(null);
  const finMessage = useCallback(() => setMessage(null), []);

  useEffect(() => {
    if (!pret) return;
    void chargerProfil().then((p) => {
      if (!p) return;
      setLettre(p.lettreAnnuelle);
      setLettreLe(p.lettreAnnuelleLe);
    });
  }, [pret]);

  const basculerLettre = async (v: boolean) => {
    const avant = { lettre, lettreLe };
    setLettre(v);
    try {
      setLettreLe(await sauverLettreAnnuelle(v));
    } catch (e) {
      console.error(e);
      setLettre(avant.lettre);
      setLettreLe(avant.lettreLe);
      setErreur("Ton choix n'a pas pu être enregistré. Vérifie ta connexion.");
    }
  };

  const telecharger = async () => {
    setExportEnCours(true);
    setErreur(null);
    try {
      await exporterToutesMesDonnees();
      setMessage("Tes données ont été téléchargées");
    } catch (e) {
      console.error(e);
      setErreur("Le téléchargement n'a pas abouti. Réessaie.");
    } finally {
      setExportEnCours(false);
    }
  };

  const supprimer = async () => {
    setSuppressionEnCours(true);
    setErreurSuppression(null);
    try {
      await supprimerMonCompte();
      navigate({ to: "/", replace: true });
    } catch (e) {
      console.error(e);
      setErreurSuppression(`La suppression n'a pas abouti.${e && typeof e === "object" && "message" in e ? ` (détail : ${String(e.message)})` : ""}`);
    } finally {
      setSuppressionEnCours(false);
    }
  };

  if (ecran) return ecran;

  return (
    <PageMoi titre="Confidentialité">
      {message && <BandeauConfirmation texte={message} onFin={finMessage} />}

      <TitreSection>Qui voit quoi</TitreSection>
      <Bloc>
        {QUI_VOIT.map(([quoi, qui]) => (
          <div key={quoi} className="flex min-h-[58px] items-center justify-between gap-3 border-t border-[#EDF2F7] py-[12px] first:border-t-0">
            <span className="text-[14.5px]">{quoi}</span>
            <span className={`shrink-0 rounded-[10px] px-[9px] py-[3px] text-[11px] font-bold ${PASTILLES[qui].classe}`}>{PASTILLES[qui].texte}</span>
          </div>
        ))}
      </Bloc>
      <Note>
        Ton carnet est privé au départ, et le reste tant que tu ne partages rien. Personne ne peut le demander. Les positions de tes plongées sont
        en plus décalées de 100 à 150 mètres, pour ne jamais donner le point exact d'un site.
      </Note>

      <TitreSection>La lettre annuelle</TitreSection>
      <Bloc>
        <Interrupteur
          titre="Recevoir le bilan de mon année"
          texte={
            <>
              {lettre && lettreLe ? `Accepté le ${dateLongue(lettreLe)}. ` : lettre ? "Accepté. " : ""}
              Un envoi par an, en décembre.
            </>
          }
          actif={lettre}
          onChange={(v) => void basculerLettre(v)}
        />
      </Bloc>
      <Note>
        Ton adresse sert aussi aux messages de service : mot de passe oublié, confirmation. Ceux-là partent même si tu refuses la lettre.
      </Note>

      <TitreSection>Tes données</TitreSection>
      <Bloc>
        <Ligne
          icone={Download}
          label={exportEnCours ? "Préparation…" : "Télécharger tout ce qu'on a sur toi"}
          valeur="fichier JSON"
          onClick={exportEnCours ? undefined : () => void telecharger()}
        />
        <Ligne icone={Trash2} label="Supprimer mon compte et mes données" onClick={() => setSuppression(true)} />
      </Bloc>
      {erreur && <p className="pt-[10px] text-[13px] text-[#8A2A1A]">{erreur}</p>}
      <Note>
        La suppression efface tout : plongées, photos, positions, binômes, compte. Rien n'est gardé, rien n'est récupérable. Une plongée qu'un binôme
        a déjà ajoutée à son carnet reste chez lui : c'est sa copie.
      </Note>

      {suppression && (
        <ModaleSuppressionCompte
          enCours={suppressionEnCours}
          erreur={erreurSuppression}
          onAnnuler={() => setSuppression(false)}
          onConfirmer={() => void supprimer()}
        />
      )}
    </PageMoi>
  );
}
