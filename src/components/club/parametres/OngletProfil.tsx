import { useEffect, useMemo, useState } from "react";
import { Avatar } from "@/components/club/Ui";
import { chargerProfil, sauverProfil, type Compte, type Profil } from "@/lib/moi";
import { oublierVerificationDp } from "@/lib/club";
import { AIDE_ROLE, DUREE_MOYENNE_DEFAUT, heuresEstimees, libelleRole, NIVEAUX, ROLES } from "@/lib/profil-plongeur";
import { BOUTON_PRINCIPAL, BOUTON_SECONDAIRE, Carte, CHAMP, Libelle, Puces, Rang } from "./Commun";

const CERTIFICATIONS = [
  { valeur: "Nitrox", label: "Nitrox Diver" },
  { valeur: "Trimix", label: "Trimix Diver" },
];

type Formulaire = Pick<Profil, "prenom" | "nom" | "niveau" | "role" | "club" | "certifications" | "certificatFin" | "premiereAnnee" | "plongeesAvant" | "heuresAvant" | "profMaxAvant">;

const vers = (p: Profil): Formulaire => ({
  prenom: p.prenom,
  nom: p.nom,
  niveau: p.niveau,
  role: p.role,
  club: p.club,
  certifications: p.certifications,
  certificatFin: p.certificatFin,
  premiereAnnee: p.premiereAnnee,
  plongeesAvant: p.plongeesAvant,
  heuresAvant: p.heuresAvant,
  profMaxAvant: p.profMaxAvant,
});

const memes = (a: Formulaire, b: Formulaire) => JSON.stringify({ ...a, certifications: [...a.certifications].sort() }) === JSON.stringify({ ...b, certifications: [...b.certifications].sort() });

// Paramètres › Mon profil : tout le profil du DP sur une page, en rangées
export function OngletProfil({ compte }: { compte: Compte | null }) {
  const [origine, setOrigine] = useState<Formulaire | null>(null);
  const [f, setF] = useState<Formulaire | null>(null);
  const [enCours, setEnCours] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    void chargerProfil().then((p) => {
      if (!p) return;
      setOrigine(vers(p));
      setF(vers(p));
    });
  }, []);

  // « Profil enregistré » s'efface tout seul
  useEffect(() => {
    if (!message) return;
    const t = setTimeout(() => setMessage(null), 3000);
    return () => clearTimeout(t);
  }, [message]);

  const modifie = useMemo(() => Boolean(f && origine && !memes(f, origine)), [f, origine]);

  if (!f || !origine) return <div className="h-[320px] animate-pulse rounded-[14px] bg-white/60" />;

  const maj = <K extends keyof Formulaire>(k: K, v: Formulaire[K]) => {
    setMessage(null);
    setF({ ...f, [k]: v });
  };

  const enregistrer = async () => {
    if (!f.prenom.trim()) return setErreur("Ton prénom est nécessaire : c'est lui que voient tes plongeurs.");
    const prof = Number(f.profMaxAvant.replace(",", "."));
    if (f.profMaxAvant && (!Number.isFinite(prof) || prof <= 0 || prof > 350)) return setErreur("La profondeur max doit être un nombre de mètres, par exemple 40.");
    const annee = f.premiereAnnee;
    if (annee && !(/^\d{4}$/.test(annee) && Number(annee) >= 1940 && Number(annee) <= new Date().getFullYear())) return setErreur("L'année de ta première plongée doit ressembler à 1987.");
    setEnCours(true);
    setErreur(null);
    try {
      await sauverProfil(f);
      if (f.role !== origine.role) oublierVerificationDp();
      setOrigine(f);
      setMessage("Profil enregistré.");
    } catch (e) {
      console.error(e);
      setErreur(`Le profil n'a pas pu être enregistré.${e && typeof e === "object" && "message" in e ? ` (détail : ${String(e.message)})` : ""}`);
    } finally {
      setEnCours(false);
    }
  };

  const certificat = f.certificatFin ? Math.round((new Date(`${f.certificatFin}T12:00:00`).getTime() - Date.now()) / 86400000) : null;

  return (
    <div className="flex flex-col gap-[20px]">
      {/* Identité */}
      <div className="flex items-center gap-[16px] rounded-[14px] border border-[#E4EBF1] bg-white px-[18px] py-[18px] lg:px-[24px]">
        <Avatar id={compte?.id ?? null} prenom={f.prenom || "?"} taille={60} />
        <div className="min-w-0 flex-1">
          <div className="truncate text-[19px] font-bold">{[f.prenom, f.nom].filter(Boolean).join(" ") || "Ton nom"}</div>
          <div className="truncate text-[13px] text-[#7D93A8]">{[libelleRole(f.role) || "Directeur de plongée", f.niveau, compte?.email].filter(Boolean).join(" · ")}</div>
        </div>
      </div>

      <Carte
        titre="Ce que voient tes plongeurs"
        texte="Ton nom apparaît sur les fiches de sécurité, les tampons et les notifications de sortie."
      >
        <Rang titre="Nom" texte="Ton prénom suffit pour les plongeurs ; le nom complète la fiche de sécurité.">
          <div className="grid grid-cols-1 gap-[12px] sm:grid-cols-2">
            <Libelle texte="Prénom">
              <input className={CHAMP} value={f.prenom} onChange={(e) => maj("prenom", e.target.value)} autoComplete="given-name" />
            </Libelle>
            <Libelle texte="Nom">
              <input className={CHAMP} value={f.nom} onChange={(e) => maj("nom", e.target.value)} autoComplete="family-name" />
            </Libelle>
          </div>
        </Rang>
        <Rang titre="Niveau" texte={f.niveau && !NIVEAUX.includes(f.niveau) ? `Niveau actuel : ${f.niveau}` : "Affiché sous ton nom en haut de l'écran."}>
          <Puces options={NIVEAUX.map((n) => ({ valeur: n, label: n }))} choisies={[f.niveau]} onChange={(n) => maj("niveau", f.niveau === n ? "" : n)} />
        </Rang>
        <Rang titre="Rôle" texte={AIDE_ROLE}>
          <Puces options={ROLES.map((r) => ({ valeur: r.valeur as string, label: r.label }))} choisies={[f.role]} onChange={(r) => maj("role", f.role === r ? "" : r)} />
        </Rang>
        <Rang titre="Certifications" texte="Les gaz que tu es qualifié à utiliser.">
          <Puces
            options={CERTIFICATIONS}
            choisies={f.certifications}
            onChange={(c) => maj("certifications", f.certifications.includes(c) ? f.certifications.filter((x) => x !== c) : [...f.certifications, c])}
          />
        </Rang>
        <Rang titre="Club d'origine" texte="Le club où tu as passé tes niveaux, s'il est différent du centre.">
          <input className={`${CHAMP} lg:max-w-[420px]`} value={f.club} onChange={(e) => maj("club", e.target.value)} placeholder="Centre de plongée le Lion" />
        </Rang>
        <Rang
          titre="Certificat médical"
          texte="Seule la date de fin est gardée, jamais le document. Un rappel arrive un mois avant."
        >
          <div className="flex flex-wrap items-center gap-[12px]">
            <input type="date" className={`${CHAMP} w-[200px]`} value={f.certificatFin} onChange={(e) => maj("certificatFin", e.target.value)} />
            {certificat !== null && (
              <span
                className={`rounded-[8px] px-[10px] py-[5px] text-[12px] font-bold ${
                  certificat < 0 ? "bg-[#FFE9E2] text-[#D9573F]" : certificat <= 30 ? "bg-[#FFF1D6] text-[#8A5A10]" : "bg-[#E2F8EF] text-[#14805F]"
                }`}
              >
                {certificat < 0 ? "Expiré" : certificat <= 30 ? `Expire dans ${certificat} j` : "Valide"}
              </span>
            )}
          </div>
        </Rang>
      </Carte>

      <Carte titre="Ton historique de plongeur" texte="Pour que ton carnet et tes statistiques partent des bons chiffres.">
        <div className="grid grid-cols-1 gap-[14px] py-[18px] sm:grid-cols-2 xl:grid-cols-4">
          <Libelle texte="Première plongée (année)">
            <input className={CHAMP} inputMode="numeric" placeholder="1987" value={f.premiereAnnee} onChange={(e) => maj("premiereAnnee", e.target.value.replace(/\D/g, "").slice(0, 4))} />
          </Libelle>
          <Libelle texte="Plongées avant Palanote">
            <input className={CHAMP} inputMode="numeric" placeholder="0" value={f.plongeesAvant} onChange={(e) => maj("plongeesAvant", e.target.value.replace(/\D/g, "").slice(0, 5))} />
          </Libelle>
          <Libelle texte="Heures sous l'eau avant">
            <input
              className={CHAMP}
              inputMode="decimal"
              placeholder={Number(f.plongeesAvant) > 0 ? `≈ ${heuresEstimees(Number(f.plongeesAvant))} (${DUREE_MOYENNE_DEFAUT} min/plongée)` : "0"}
              value={f.heuresAvant}
              onChange={(e) => maj("heuresAvant", e.target.value.replace(/[^\d,.]/g, "").slice(0, 6))}
            />
          </Libelle>
          <Libelle texte="Profondeur max avant (m)">
            <input className={CHAMP} inputMode="decimal" placeholder="40" value={f.profMaxAvant} onChange={(e) => maj("profMaxAvant", e.target.value.replace(/[^\d,.]/g, "").slice(0, 5))} />
          </Libelle>
        </div>
      </Carte>

      {/* Barre d'enregistrement : apparaît dès qu'un champ change */}
      {(modifie || message || erreur) && (
        <div className="sticky bottom-[calc(88px+env(safe-area-inset-bottom))] z-10 flex flex-wrap items-center gap-[12px] rounded-[14px] border border-[#D8E5EE] bg-white/95 px-[18px] py-[12px] shadow-[0_10px_30px_rgba(15,61,112,.12)] backdrop-blur lg:bottom-[20px] lg:px-[24px]">
          {erreur ? (
            <span className="text-[13px] font-semibold text-[#8A2A1A]">{erreur}</span>
          ) : modifie ? (
            <span className="text-[13px] font-semibold text-[#5B7189]">Modifications non enregistrées</span>
          ) : (
            <span className="text-[13px] font-semibold text-[#14805F]">{message}</span>
          )}
          <span className="ml-auto flex gap-[10px]">
            <button type="button" disabled={!modifie || enCours} onClick={() => { setF(origine); setErreur(null); }} className={BOUTON_SECONDAIRE}>
              Annuler
            </button>
            <button type="button" disabled={!modifie || enCours} onClick={() => void enregistrer()} className={BOUTON_PRINCIPAL}>
              {enCours ? "ENREGISTREMENT…" : "ENREGISTRER"}
            </button>
          </span>
        </div>
      )}
    </div>
  );
}
