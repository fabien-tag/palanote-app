import { useEffect, useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { PageMoi, TitreSection } from "@/components/moi/Ui";
import { useConnexionRequise } from "@/components/numerisation/Ui";
import { annoncerSurAccueil } from "@/lib/message-accueil";
import { chargerProfil, sauverProfil } from "@/lib/moi";

export const Route = createFileRoute("/moi_/profil")({
  head: () => ({ meta: [{ title: "Palanote — Mon profil" }] }),
  component: ModifierProfil,
});

const NIVEAUX = ["N1 / Open Water", "N2 / Advanced", "N3 / Rescue", "N4 / Divemaster", "Encadrant"];

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
      }
      setCharge(true);
    });
  }, [pret]);

  const anneeValide = premiereAnnee === "" || (/^\d{4}$/.test(premiereAnnee) && Number(premiereAnnee) >= 1940 && Number(premiereAnnee) <= new Date().getFullYear());

  const enregistrer = async () => {
    if (!prenom.trim()) return setErreur("Ton prénom est nécessaire : c'est lui que voient tes binômes.");
    if (!anneeValide) return setErreur("L'année de ta première plongée doit ressembler à 1987.");
    setEnCours(true);
    setErreur(null);
    try {
      await sauverProfil({ prenom, niveau, club, premiereAnnee, plongeesAvant });
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
            <Champ label="Club" value={club} onChange={(e) => setClub(e.target.value)} placeholder="CIP Lavandou" />
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
        </>
      )}
    </PageMoi>
  );
}
