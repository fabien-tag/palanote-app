import { useEffect, useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { PageMoi, TitreSection } from "@/components/moi/Ui";
import { useConnexionRequise } from "@/components/numerisation/Ui";
import { signOut } from "@/lib/auth";
import { annoncerSurAccueil } from "@/lib/message-accueil";
import { chargerProfil, sauverProfil } from "@/lib/moi";
import { AIDE_ROLE, NIVEAUX, ROLES } from "@/lib/profil-plongeur";

export const Route = createFileRoute("/moi_/profil")({
  head: () => ({ meta: [{ title: "Palanote — Mon profil" }] }),
  component: ModifierProfil,
});

// Certifications de gaz : la valeur enregistrée, et ce qui s'affiche
const CERTIFICATIONS = [
  { valeur: "Nitrox", label: "Nitrox Diver" },
  { valeur: "Trimix", label: "Trimix Diver" },
];

function Champ({
  label,
  aide,
  ...props
}: { label: string; aide?: string } & React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <label className="block">
      <span className="block pb-[7px] text-[13px] font-semibold text-[#5B7189]">{label}</span>
      <input
        {...props}
        className="block h-[52px] w-full rounded-[16px] border-[1.5px] border-[#E4EBF1] bg-white px-[16px] text-[15px] text-[#123A63] outline-none placeholder:text-[#B5C4D1] focus:border-[#57D4F5]"
      />
      {aide && <span className="block pt-[6px] text-[12px] text-[#9DB0C0]">{aide}</span>}
    </label>
  );
}

function ModifierProfil() {
  const navigate = useNavigate();
  const { pret, ecran } = useConnexionRequise();
  const [prenom, setPrenom] = useState("");
  const [niveau, setNiveau] = useState("");
  const [club, setClub] = useState("");
  const [premiereAnnee, setPremiereAnnee] = useState("");
  const [plongeesAvant, setPlongeesAvant] = useState("");
  const [profMaxAvant, setProfMaxAvant] = useState("");
  const [profOrigine, setProfOrigine] = useState("");
  const [role, setRole] = useState("");
  const [roleOrigine, setRoleOrigine] = useState("");
  const [certifications, setCertifications] = useState<string[]>([]);
  const [certifsOrigine, setCertifsOrigine] = useState<string[]>([]);
  const [charge, setCharge] = useState(false);
  const [enCours, setEnCours] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);

  useEffect(() => {
    if (!pret) return;
    void chargerProfil().then((p) => {
      if (p) {
        setPrenom(p.prenom);
        setNiveau(p.niveau);
        setClub(p.club);
        setPremiereAnnee(p.premiereAnnee);
        setPlongeesAvant(p.plongeesAvant);
        setProfMaxAvant(p.profMaxAvant);
        setProfOrigine(p.profMaxAvant);
        setRole(p.role);
        setRoleOrigine(p.role);
        setCertifications(p.certifications);
        setCertifsOrigine(p.certifications);
      }
      setCharge(true);
    });
  }, [pret]);

  const anneeValide = premiereAnnee === "" || (/^\d{4}$/.test(premiereAnnee) && Number(premiereAnnee) >= 1940 && Number(premiereAnnee) <= new Date().getFullYear());

  const enregistrer = async () => {
    if (!prenom.trim()) return setErreur("Ton prénom est nécessaire : c'est lui que voient tes binômes.");
    const prof = Number(profMaxAvant.replace(",", "."));
    if (profMaxAvant && (!Number.isFinite(prof) || prof <= 0 || prof > 350)) return setErreur("La profondeur max doit être un nombre de mètres, par exemple 40.");
    if (!anneeValide) return setErreur("L'année de ta première plongée doit ressembler à 1987.");
    setEnCours(true);
    setErreur(null);
    try {
      const certifsChangees = [...certifications].sort().join() !== [...certifsOrigine].sort().join();
      await sauverProfil({ prenom, niveau, club, premiereAnnee, plongeesAvant, ...(certifsChangees ? { certifications } : {}), ...(role !== roleOrigine ? { role } : {}), ...(profMaxAvant !== profOrigine ? { profMaxAvant } : {}) });
      annoncerSurAccueil("Ton profil a bien été mis à jour");
      navigate({ to: "/moi" });
    } catch (e) {
      console.error(e);
      setErreur(`Le profil n'a pas pu être enregistré.${e && typeof e === "object" && "message" in e ? ` (détail : ${String(e.message)})` : ""}`);
    } finally {
      setEnCours(false);
    }
  };

  if (ecran) return ecran;

  return (
    <PageMoi titre="Mon profil">
      {charge && (
        <>
          <TitreSection>Ce que voient tes binômes</TitreSection>
          <div className="flex flex-col gap-[16px]">
            <Champ label="Prénom" value={prenom} onChange={(e) => setPrenom(e.target.value)} autoComplete="given-name" placeholder="Fabien" />
            <div>
              <span className="block pb-[8px] text-[13px] font-semibold text-[#5B7189]">Niveau</span>
              <div className="flex flex-wrap gap-[8px]">
                {NIVEAUX.map((n) => {
                  const actif = niveau === n;
                  return (
                    <button
                      key={n}
                      type="button"
                      onClick={() => setNiveau(actif ? "" : n)}
                      className={`h-[40px] rounded-full border-[1.5px] px-[14px] text-[13.5px] font-semibold ${
                        actif ? "border-[#3DEFBE] bg-[#3DEFBE] text-[#0B3B63]" : "border-[#E4EBF1] bg-white text-[#5B7189]"
                      }`}
                    >
                      {n}
                    </button>
                  );
                })}
              </div>
              {niveau && !NIVEAUX.includes(niveau) && <p className="pt-[8px] text-[12.5px] text-[#5B7189]">Niveau actuel : {niveau}</p>}
            </div>
            <div>
              <span className="block pb-[8px] text-[13px] font-semibold text-[#5B7189]">Ton rôle</span>
              <div className="flex flex-wrap gap-[8px]">
                {ROLES.map((r) => {
                  const actif = role === r.valeur;
                  return (
                    <button
                      key={r.valeur}
                      type="button"
                      aria-pressed={actif}
                      onClick={() => setRole(actif ? "" : r.valeur)}
                      className={`h-[40px] rounded-full border-[1.5px] px-[14px] text-[13.5px] font-semibold ${
                        actif ? "border-[#3DEFBE] bg-[#3DEFBE] text-[#0B3B63]" : "border-[#E4EBF1] bg-white text-[#5B7189]"
                      }`}
                    >
                      {r.label}
                    </button>
                  );
                })}
              </div>
              <p className="pt-[6px] text-[12px] text-[#9DB0C0]">{AIDE_ROLE}</p>
            </div>
            <Champ label="Club" value={club} onChange={(e) => setClub(e.target.value)} placeholder="CIP Lavandou" />
            <div>
              <span className="block pb-[8px] text-[13px] font-semibold text-[#5B7189]">Certifications</span>
              <div className="flex flex-wrap gap-[8px]">
                {CERTIFICATIONS.map((c) => {
                  const actif = certifications.includes(c.valeur);
                  return (
                    <button
                      key={c.valeur}
                      type="button"
                      aria-pressed={actif}
                      onClick={() => setCertifications((l) => (actif ? l.filter((x) => x !== c.valeur) : [...l, c.valeur]))}
                      className={`h-[40px] rounded-full border-[1.5px] px-[14px] text-[13.5px] font-semibold ${
                        actif ? "border-[#3DEFBE] bg-[#3DEFBE] text-[#0B3B63]" : "border-[#E4EBF1] bg-white text-[#5B7189]"
                      }`}
                    >
                      {c.label}
                    </button>
                  );
                })}
              </div>
              <p className="pt-[6px] text-[12px] text-[#9DB0C0]">Affichées en haut de ton carnet, à côté de ton niveau.</p>
            </div>
          </div>

          <TitreSection>Pour des statistiques justes</TitreSection>
          <div className="flex flex-col gap-[16px]">
            <Champ
              label="Année de ta première plongée"
              value={premiereAnnee}
              onChange={(e) => setPremiereAnnee(e.target.value.replace(/\D/g, "").slice(0, 4))}
              inputMode="numeric"
              placeholder="1987"
            />
            <Champ
              label="Plongées faites avant Palanote"
              aide="Ton carnet continue la numérotation à partir de ce nombre."
              value={plongeesAvant}
              onChange={(e) => setPlongeesAvant(e.target.value.replace(/\D/g, "").slice(0, 5))}
              inputMode="numeric"
              placeholder="0"
            />
            <Champ
              label="Profondeur max avant Palanote (en mètres)"
              aide="Comptée dans ta profondeur max, en haut de ton carnet et dans Moi."
              value={profMaxAvant}
              onChange={(e) => setProfMaxAvant(e.target.value.replace(/[^\d,.]/g, "").slice(0, 5))}
              inputMode="decimal"
              placeholder="40"
            />
          </div>

          <div className="min-h-[24px] flex-grow" />
          {erreur && <p className="pb-[10px] text-center text-[13px] text-[#8A2A1A]">{erreur}</p>}
          <button
            type="button"
            disabled={enCours}
            onClick={() => void enregistrer()}
            className="mt-[18px] flex h-[54px] items-center justify-center rounded-2xl bg-[#3DEFBE] text-[14px] font-bold text-[#0B3B63] shadow-[0_4px_12px_#123A630D] disabled:opacity-60"
          >
            {enCours ? "ENREGISTREMENT…" : "ENREGISTRER"}
          </button>
          <button
            type="button"
            onClick={() => void signOut().catch(() => undefined).then(() => navigate({ to: "/connexion", replace: true }))}
            className="mt-[12px] flex h-[52px] items-center justify-center rounded-2xl border border-[#E4EBF1] bg-white text-[14px] font-bold text-[#123A63]"
          >
            Se déconnecter
          </button>
        </>
      )}
    </PageMoi>
  );
}
