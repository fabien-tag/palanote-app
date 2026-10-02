import { useCallback, useEffect, useMemo, useState } from "react";
import { Send } from "lucide-react";
import { Bloc, carte, Voyant } from "@/components/admin/Bento";
import { chargerLettres, CONTENU_LETTRE_DEFAUT, envoyerLettre, type Lettre } from "@/lib/finances";
import { lettreHtml } from "@/lib/lettre-modele";

// Section « Lettre annuelle » : bilan de l'année + appel au Récif, envoyé à ceux qui l'ont accepté.

const champ = "w-full rounded-[12px] border border-[#DCE7F0] bg-white px-[12px] text-[14px] font-normal text-[#123A63] outline-none focus:border-[#57D4F5]";

export function SectionLettre({ prenomAdmin }: { prenomAdmin: string }) {
  const anneeCourante = new Date().getFullYear();
  const [infos, setInfos] = useState<{ destinataires: number; lettres: Lettre[] } | null>(null);
  const [erreurChargement, setErreurChargement] = useState<string | null>(null);
  const [annee, setAnnee] = useState(anneeCourante);
  const [sujet, setSujet] = useState(`Ton année de plongée {annee}`);
  const [contenu, setContenu] = useState(CONTENU_LETTRE_DEFAUT);
  const [enCours, setEnCours] = useState<null | "test" | "envoi">(null);
  const [resultat, setResultat] = useState<{ ok: boolean; texte: string } | null>(null);
  const [confirmer, setConfirmer] = useState(false);

  const charger = useCallback(async () => {
    try {
      setInfos(await chargerLettres());
      setErreurChargement(null);
    } catch (e) {
      console.error("Lettres non chargées", e);
      setErreurChargement("La lettre n'a pas pu être chargée. As-tu lancé le script palanote-finances-lettre.sql ?");
    }
  }, []);
  useEffect(() => void charger(), [charger]);

  const sujetFinal = sujet.replace(/\{annee\}/gi, String(annee));
  const apercu = useMemo(
    () =>
      lettreHtml({
        sujet: sujetFinal,
        contenu,
        annee,
        appUrl: typeof window === "undefined" ? "" : window.location.origin,
        d: { email: "", prenom: prenomAdmin || "Fabien", jeton: "apercu", plongees: 32, minutes: 24 * 60, sites: 8, profondeur: 42 },
      }),
    [sujetFinal, contenu, annee, prenomAdmin],
  );

  const envoyer = async (test: boolean) => {
    setEnCours(test ? "test" : "envoi");
    setResultat(null);
    setConfirmer(false);
    try {
      const r = await envoyerLettre({ sujet: sujetFinal, contenu, annee, test });
      setResultat({
        ok: true,
        texte: test ? "Le test est parti dans ta boîte mail." : `Lettre envoyée à ${r.envoyes} plongeur${r.envoyes > 1 ? "s" : ""} sur ${r.destinataires}.`,
      });
      void charger();
    } catch (e) {
      console.error("Lettre non envoyée", e);
      setResultat({ ok: false, texte: `L'envoi n'a pas abouti : ${e instanceof Error ? e.message : String(e)}` });
    } finally {
      setEnCours(null);
    }
  };

  if (erreurChargement) return <p className="rounded-[16px] bg-[#FFECE8] p-[14px] text-[13.5px] text-[#8A2A1A]">{erreurChargement}</p>;

  const derniere = infos?.lettres.find((l) => !l.test && l.nb_envoyes > 0);
  const dejaCetteAnnee = infos?.lettres.some((l) => !l.test && l.nb_envoyes > 0 && l.annee === annee);
  const n = infos?.destinataires ?? 0;

  return (
    <div className="flex flex-col gap-[12px]">
      <div className="grid grid-cols-1 gap-[12px] md:grid-cols-3">
        <Bloc titre="Destinataires" voyant={n ? "vert" : "gris"} fond="bg-[linear-gradient(160deg,#F2FBF7_0%,#D3F4E7_100%)]">
          <div className="mt-auto flex items-baseline gap-[8px] text-[#0F2A4A]">
            <span className="text-[44px] font-light leading-none tracking-[-0.02em]">{infos ? n : "…"}</span>
            <span className="text-[13px] text-[#123A63]/60">plongeur{n > 1 ? "s" : ""}</span>
          </div>
          <p className="pt-[6px] text-[12.5px] text-[#123A63]/65">ont accepté la lettre dans Moi › Confidentialité</p>
        </Bloc>
        <Bloc titre="Dernier envoi" voyant={dejaCetteAnnee ? "vert" : "orange"} fond="bg-white border border-[#E9EEF3]">
          <div className="mt-auto text-[30px] font-light leading-tight tracking-[-0.02em] text-[#0F2A4A]">
            {derniere ? new Date(derniere.created_at).toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" }) : "Jamais"}
          </div>
          <p className="pt-[6px] text-[12.5px] text-[#123A63]/65">{dejaCetteAnnee ? `La lettre ${annee} est déjà partie.` : `La lettre ${annee} n'est pas encore partie.`}</p>
        </Bloc>
        <Bloc titre="Quand l'envoyer" fond="bg-[linear-gradient(160deg,#FBF9F4_0%,#F1E7D3_100%)]">
          <div className="mt-auto text-[30px] font-light leading-tight tracking-[-0.02em] text-[#0F2A4A]">Début décembre</div>
          <p className="pt-[6px] text-[12.5px] text-[#123A63]/65">Une seule fois par an, comme promis aux plongeurs.</p>
        </Bloc>
      </div>

      <div className="grid grid-cols-1 items-start gap-[12px] xl:grid-cols-2">
        {/* Rédaction */}
        <div className={`${carte} flex flex-col gap-[14px] p-[20px]`}>
          <h2 className="text-[15px] font-semibold">Rédiger la lettre</h2>
          <label className="text-[12.5px] font-semibold text-[#7D93A8]">
            Année du bilan
            <select className={`${champ} mt-[6px] h-[40px]`} value={annee} onChange={(e) => setAnnee(Number(e.target.value))}>
              {[anneeCourante, anneeCourante - 1].map((a) => (
                <option key={a} value={a}>
                  {a}
                </option>
              ))}
            </select>
          </label>
          <label className="text-[12.5px] font-semibold text-[#7D93A8]">
            Objet du mail
            <input className={`${champ} mt-[6px] h-[40px]`} value={sujet} onChange={(e) => setSujet(e.target.value)} />
          </label>
          <label className="text-[12.5px] font-semibold text-[#7D93A8]">
            Message (après le bilan de l'année)
            <textarea className={`${champ} mt-[6px] min-h-[220px] py-[10px] leading-normal`} value={contenu} onChange={(e) => setContenu(e.target.value)} />
          </label>
          <p className="text-[12px] leading-snug text-[#9DB0C0]">
            {"{prenom}"} est remplacé par le prénom de chacun, {"{annee}"} par l'année dans l'objet. Chaque plongeur reçoit en haut son propre bilan (plongées, sites, heures, plus
            profonde), puis le bouton « Rejoindre le Récif » et le lien pour ne plus recevoir la lettre.
          </p>

          {resultat && (
            <p className={`rounded-[12px] p-[12px] text-[13px] ${resultat.ok ? "bg-[#E2F8EF] text-[#0B6B52]" : "bg-[#FFECE8] text-[#8A2A1A]"}`}>{resultat.texte}</p>
          )}
          <div className="flex flex-wrap gap-[10px]">
            <button
              type="button"
              disabled={Boolean(enCours)}
              onClick={() => void envoyer(true)}
              className="h-[44px] rounded-[12px] border border-[#DCE7F0] bg-white px-[16px] text-[13.5px] font-semibold hover:bg-[#F6F8FA] disabled:opacity-50"
            >
              {enCours === "test" ? "Envoi du test…" : "M'envoyer un test"}
            </button>
            <button
              type="button"
              disabled={Boolean(enCours) || n === 0}
              onClick={() => setConfirmer(true)}
              className="flex h-[44px] items-center gap-[8px] rounded-[12px] bg-[#0F2A4A] px-[16px] text-[13.5px] font-semibold text-white disabled:opacity-40"
            >
              <Send className="h-[15px] w-[15px]" />
              {enCours === "envoi" ? "Envoi en cours…" : `Envoyer à ${n} plongeur${n > 1 ? "s" : ""}`}
            </button>
          </div>
          {confirmer && (
            <div className="rounded-[14px] border border-[#F5C9BC] bg-[#FFF6F2] p-[14px] text-[13.5px]">
              <p>
                <b>
                  Envoyer « {sujetFinal} » à {n} plongeur{n > 1 ? "s" : ""} ?
                </b>{" "}
                {dejaCetteAnnee ? "Attention : une lettre a déjà été envoyée pour cette année. " : ""}Un envoi ne se rattrape pas.
              </p>
              <div className="flex gap-[10px] pt-[10px]">
                <button type="button" onClick={() => void envoyer(false)} className="h-[38px] rounded-[10px] bg-[#C94957] px-[14px] text-[13px] font-semibold text-white">
                  Oui, envoyer
                </button>
                <button type="button" onClick={() => setConfirmer(false)} className="h-[38px] rounded-[10px] px-[14px] text-[13px] font-semibold text-[#5B7189]">
                  Annuler
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Aperçu */}
        <div className={`${carte} overflow-hidden`}>
          <div className="flex items-center justify-between border-b border-[#EDF1F5] px-[20px] py-[14px]">
            <h2 className="text-[15px] font-semibold">Aperçu</h2>
            <span className="text-[12px] text-[#9DB0C0]">avec un bilan d'exemple</span>
          </div>
          <iframe title="Aperçu de la lettre" srcDoc={apercu} sandbox="" className="h-[760px] w-full bg-[#EEF3F8]" />
        </div>
      </div>

      {/* Historique */}
      <div className={`${carte} p-[20px]`}>
        <h2 className="text-[15px] font-semibold">Envois</h2>
        {infos && infos.lettres.length === 0 && <p className="py-[14px] text-[13.5px] text-[#9DB0C0]">Aucun envoi pour l'instant.</p>}
        <table className="mt-[8px] w-full text-left text-[13.5px]">
          <tbody>
            {infos?.lettres.map((l) => (
              <tr key={l.id} className="border-t border-[#EDF2F7] first:border-t-0">
                <td className="py-[10px]">
                  <span className="flex items-center gap-[8px]">
                    <Voyant couleur={l.erreur ? (l.nb_envoyes ? "orange" : "rouge") : "vert"} />
                    {new Date(l.created_at).toLocaleString("fr-FR", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" })}
                  </span>
                </td>
                <td className="py-[10px]">{l.sujet}</td>
                <td className="py-[10px] text-[#7D93A8]">{l.test ? "test" : "envoi réel"}</td>
                <td className="py-[10px] text-right">
                  {l.nb_envoyes} / {l.nb_destinataires}
                </td>
                <td className="max-w-[260px] truncate py-[10px] pl-[14px] text-[12px] text-[#C2383D]" title={l.erreur ?? ""}>
                  {l.erreur ?? ""}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Mise en route */}
      <div className={`${carte} p-[20px] text-[13.5px] leading-relaxed text-[#3F5B76]`}>
        <h2 className="pb-[6px] text-[15px] font-semibold text-[#123A63]">Mise en route de l'envoi (une seule fois)</h2>
        <ol className="list-decimal pl-[20px]">
          <li>Crée un compte gratuit sur resend.com (3 000 mails par mois offerts) et ajoute ton nom de domaine pour qu'il soit vérifié.</li>
          <li>Dans Resend, crée une clé API.</li>
          <li>
            Dans Supabase › Edge Functions › Secrets, ajoute <b>RESEND_API_KEY</b> (la clé), <b>LETTRE_EXPEDITEUR</b> (ex. « Palanote &lt;bonjour@ton-domaine.fr&gt; ») et{" "}
            <b>APP_URL</b> (l'adresse de l'app).
          </li>
          <li>Crée la fonction « envoyer-lettre » et colle le code du fichier envoyer-lettre/index.ts.</li>
        </ol>
      </div>
    </div>
  );
}
