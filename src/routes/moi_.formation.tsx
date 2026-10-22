import { useEffect, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { BookOpen, Check, GraduationCap, UserRound, Waves } from "lucide-react";
import { useConnexionRequise } from "@/components/numerisation/Ui";
import { PageMoi, TitreSection } from "@/components/moi/Ui";
import { genererRappelsFormations } from "@/lib/notifications";
import { jourCourt, jourLong, mesFormations, prixTexte, STATUTS_FORMATION, type FormationEleve } from "@/lib/formations";

// Ma formation : le cursus suivi au club (N1, N2, Nitrox…), le moniteur, et le programme
// jour par jour (pratique le matin et l'après-midi, théorie entre midi et deux).
export const Route = createFileRoute("/moi_/formation")({
  head: () => ({ meta: [{ title: "Palanote — Ma formation" }] }),
  component: PageMaFormation,
});

const aujourdhui = () => new Date().toISOString().slice(0, 10);

function PageMaFormation() {
  const { pret, ecran } = useConnexionRequise();
  const [liste, setListe] = useState<FormationEleve[] | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);
  useEffect(() => {
    if (!pret) return;
    void genererRappelsFormations().catch(() => 0);
    mesFormations()
      .then(setListe)
      .catch(() => {
        setListe([]);
        setErreur("Les formations ne sont pas encore activées par ton club.");
      });
  }, [pret]);
  if (ecran) return ecran;

  const actives = (liste ?? []).filter((f) => f.statut === "prevue" || f.statut === "en_cours");
  const passees = (liste ?? []).filter((f) => f.statut === "validee" || f.statut === "abandon");

  return (
    <PageMoi titre="Ma formation">
      {erreur && <p className="pt-[16px] text-[13.5px] text-[#566B82]">{erreur}</p>}
      {liste && liste.length === 0 && !erreur && (
        <div className="mt-[18px] flex flex-col items-center gap-[10px] text-center">
          <span className="flex h-[56px] w-[56px] items-center justify-center goutte bg-[#E3EDF6]">
            <GraduationCap className="h-[26px] w-[26px] text-[#566B82]" />
          </span>
          <p className="text-[16px] font-bold">Pas de formation en cours</p>
          <p className="max-w-[300px] text-[13.5px] leading-normal text-[#566B82]">
            Quand ton club t'inscrit à un niveau (N1, N2, Nitrox…), ton programme jour par jour arrive ici, avec un rappel la veille de chaque cours.
          </p>
        </div>
      )}
      {actives.map((f) => (
        <CarteFormation key={f.id} f={f} />
      ))}
      {passees.length > 0 && (
        <>
          <TitreSection>Formations passées</TitreSection>
          <div className="flex flex-col gap-[8px]">
            {passees.map((f) => (
              <div key={f.id} className="flex items-center gap-[12px] galet-b border border-[#E4EBF1] bg-white px-[14px] py-[11px]">
                <span className="flex h-[38px] min-w-[44px] items-center justify-center goutte bg-[#0F3D70] px-[6px] text-[12.5px] font-bold text-white">{f.code ?? "—"}</span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[14px] font-bold">{f.intitule}</span>
                  <span className="block text-[12px] text-[#566B82]">
                    {f.club} · {jourCourt(f.date_debut)} → {jourCourt(f.date_fin)}
                  </span>
                </span>
                <span className={`rounded-[10px] px-[8px] py-[2px] text-[11.5px] font-bold ${STATUTS_FORMATION.find((s) => s.id === f.statut)?.classe}`}>
                  {STATUTS_FORMATION.find((s) => s.id === f.statut)?.libelle}
                </span>
              </div>
            ))}
          </div>
        </>
      )}
    </PageMoi>
  );
}

function CarteFormation({ f }: { f: FormationEleve }) {
  const jours = [...new Set(f.seances.map((s) => s.jour))].sort();
  const faites = f.seances.filter((s) => s.faite).length;
  const auj = aujourdhui();
  return (
    <>
      <div className="relative mt-[16px] overflow-hidden galet-c bg-gradient-to-br from-[#0F3D70] to-[#1176A8] p-[18px] text-white">
        <p className="text-[12px] font-bold uppercase tracking-[.12em] text-white/70">{f.club}</p>
        <p className="pt-[4px] text-[24px] font-bold leading-tight">{f.intitule}</p>
        <p className="pt-[6px] text-[13.5px] text-white/85">
          Du {jourLong(f.date_debut)} au {jourLong(f.date_fin)}
        </p>
        <div className="flex flex-wrap gap-[6px] pt-[12px] text-[12px] font-bold">
          <span className="flex items-center gap-[5px] rounded-[12px] bg-white/15 px-[10px] py-[4px]">
            <UserRound className="h-[13px] w-[13px]" /> {f.moniteur?.nom ?? "Moniteur à venir"}
          </span>
          <span className="rounded-[12px] bg-white/15 px-[10px] py-[4px]">
            {faites}/{f.seances.length} séances
          </span>
          <span className="rounded-[12px] bg-white/15 px-[10px] py-[4px]">{prixTexte(f.prix)}</span>
        </div>
      </div>
      <TitreSection>Mon programme</TitreSection>
      <div className="flex flex-col gap-[10px]">
        {jours.map((j, n) => (
          <div key={j} className={`galet-b border bg-white ${j === auj ? "border-[#3DEFBE]" : "border-[#E4EBF1]"}`}>
            <p className="flex items-center justify-between px-[14px] pb-[4px] pt-[10px] text-[13.5px] font-bold">
              Jour {n + 1} · {jourLong(j)}
              {j === auj && <span className="rounded-[10px] bg-[#D5FAF0] px-[8px] py-[1px] text-[11px] normal-case text-[#0B3B63]">Aujourd'hui</span>}
            </p>
            {f.seances
              .filter((s) => s.jour === j)
              .map((s, i) => (
                <div key={s.id ?? i} className="flex items-center gap-[10px] px-[14px] py-[7px] text-[13.5px]">
                  <span className="w-[44px] font-bold">{s.heure_debut.replace(":", "h")}</span>
                  <span className={`flex h-[28px] w-[28px] items-center justify-center goutte ${s.type === "theorie" ? "bg-[#EEF4F9] text-[#3F5B76]" : "bg-[#E2F8EF] text-[#137758]"}`}>
                    {s.type === "theorie" ? <BookOpen className="h-[14px] w-[14px]" /> : <Waves className="h-[14px] w-[14px]" />}
                  </span>
                  <span className={`min-w-0 flex-1 ${s.faite ? "text-[#566B82] line-through" : ""}`}>
                    {s.type === "theorie" ? "Théorie" : "Pratique"}
                    {s.intitule ? ` · ${s.intitule}` : ""}
                  </span>
                  {s.faite && <Check className="h-[15px] w-[15px] text-[#137758]" />}
                </div>
              ))}
            <div className="h-[6px]" />
          </div>
        ))}
      </div>
    </>
  );
}
