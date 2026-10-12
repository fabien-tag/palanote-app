import { useEffect, useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { Printer } from "lucide-react";
import { BoutonRetourCarre, useConnexionRequise } from "@/components/numerisation/Ui";
import { detailErreur, MessageErreur } from "@/components/club/Ui";
import { ficheSecurite, heureCourte, scriptManquant, type FicheSecurite } from "@/lib/club";

// Fiche de sécurité de la sortie (parcours 15) : palanquées, niveaux, paramètres prévus et réalisés.
// Pensée pour l'impression (A4 paysage) ou l'enregistrement en PDF depuis le navigateur.
// Les cases vides se remplissent à la main sur le bateau ; celles connues sont déjà remplies
// avec les fiches des plongeurs.
export const Route = createFileRoute("/club_/fiche-securite")({
  validateSearch: (search: Record<string, unknown>): { id?: string } => (typeof search["id"] === "string" ? { id: search["id"] } : {}),
  head: () => ({ meta: [{ title: "Palanote — Fiche de sécurité" }] }),
  component: PageFiche,
});

type Plongeur = FicheSecurite["plongeurs"][number];

const nombre = (n: number | null | undefined, unite: string) => (n === null || n === undefined ? "" : `${String(Number(n)).replace(".", ",")} ${unite}`);

function heureSortie(p: Plongeur) {
  if (p.sortie) return heureCourte(p.sortie);
  if (!p.immersion || !p.duree) return "";
  const [h, m] = p.immersion.split(":").map(Number);
  if (h === undefined || m === undefined || isNaN(h) || isNaN(m)) return "";
  const t = h * 60 + m + p.duree;
  return `${String(Math.floor(t / 60) % 24).padStart(2, "0")}h${String(t % 60).padStart(2, "0")}`;
}

function PageFiche() {
  const navigate = useNavigate();
  const { id } = Route.useSearch();
  const { pret, ecran } = useConnexionRequise();
  const [f, setF] = useState<FicheSecurite | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);

  useEffect(() => {
    if (!pret || !id) return;
    ficheSecurite(id)
      .then(setF)
      .catch((e) => {
        console.error(e);
        setErreur(
          scriptManquant(e)
            ? "La fiche de sécurité n'est pas encore activée : lance le script palanote-accueil-dp.sql dans Supabase."
            : detailErreur(e, "La fiche n'a pas pu être chargée."),
        );
      });
  }, [pret, id]);

  if (ecran) return ecran;

  const groupes = new Map<number | null, Plongeur[]>();
  for (const p of f?.plongeurs ?? []) groupes.set(p.palanquee, [...(groupes.get(p.palanquee) ?? []), p]);
  const ordre = [...groupes.keys()].sort((a, b) => (a ?? 99) - (b ?? 99));
  const nbPlongeurs = f?.plongeurs.length ?? 0;
  const nbPalanquees = ordre.filter((k) => k !== null).length;
  const aPreparer = f?.statut === "prevue";

  return (
    <div className="bureau min-h-screen bg-[#F1F6FC] text-[#123A63] print:bg-white">
      <style>{`@page { size: A4 landscape; margin: 10mm; }`}</style>

      <div className="mx-auto flex max-w-[1120px] items-center gap-3 px-[22px] pb-[10px] pt-[clamp(14px,2.6svh,22px)] print:hidden">
        <BoutonRetourCarre onClick={() => (id ? navigate({ to: "/club/sortie", search: { id } }) : navigate({ to: "/club" }))} />
        <h1 className="min-w-0 flex-1 truncate text-[17px] font-bold">Fiche de sécurité</h1>
        {f && (
          <button
            type="button"
            onClick={() => window.print()}
            className="flex h-[42px] items-center gap-2 galet-moyen bg-[#3DEFBE] px-[16px] text-[13px] font-bold text-[#0B3B63]"
          >
            <Printer className="h-[17px] w-[17px]" strokeWidth={2.3} aria-hidden="true" />
            IMPRIMER · PDF
          </button>
        )}
      </div>

      <div className="mx-auto max-w-[1120px] px-[22px] pb-[30px] print:max-w-none print:p-0">
        <MessageErreur texte={erreur} />
        {f && (
          <div className="galet border border-[#E4EBF1] bg-white p-[20px] text-[13px] print:rounded-none print:border-0 print:p-0 print:text-[11px]">
            {/* En-tête */}
            <div className="flex flex-wrap items-start justify-between gap-[14px] border-b-2 border-[#123A63] pb-[12px]">
              <div>
                <p className="text-[11px] font-bold uppercase tracking-[.12em] text-[#1176A8]">Fiche de sécurité</p>
                <h2 className="pt-[2px] text-[22px] font-bold leading-tight print:text-[18px]">{f.site}</h2>
                <p className="text-[#5B7189]">{[f.lieu, f.centre ? `${f.centre.nom}${f.centre.ville ? `, ${f.centre.ville}` : ""}` : null].filter(Boolean).join(" · ")}</p>
              </div>
              <div className="text-right">
                <p className="text-[16px] font-bold print:text-[14px]">{f.date_texte.charAt(0).toUpperCase() + f.date_texte.slice(1)}</p>
                <p className="text-[#5B7189]">{f.heure ? `Départ ${heureCourte(f.heure)}` : "Heure de départ : ______"}</p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-x-[20px] gap-y-[6px] py-[12px] sm:grid-cols-4">
              <Champ label="Directeur de plongée" valeur={[f.dp.nom?.toUpperCase(), f.dp.prenom].filter(Boolean).join(" ") + (f.dp.niveau ? ` · ${f.dp.niveau}` : "")} />
              <Champ label="Bateau" valeur={f.bateau ?? ""} />
              <Champ label="Profondeur prévue" valeur={nombre(f.profondeur_prevue, "m")} />
              <Champ label="Durée prévue / réalisée" valeur={nombre(f.duree_min, "min")} />
              <Champ label="Température au fond" valeur={nombre(f.temp_fond_c, "°C")} />
              <Champ label="Visibilité" valeur={nombre(f.visibilite_m, "m")} />
              <Champ label="Effectif" valeur={`${nbPlongeurs} plongeur${nbPlongeurs > 1 ? "s" : ""} · ${nbPalanquees} palanquée${nbPalanquees > 1 ? "s" : ""}`} />
              <Champ label="Moyens de secours à bord" valeur="" />
            </div>

            {/* Palanquées */}
            <div className="overflow-x-auto print:overflow-visible">
              <table className="w-full min-w-[860px] border-collapse print:min-w-0">
                <thead>
                  <tr className="text-left text-[11px] uppercase tracking-[.05em] text-[#5B7189]">
                    {["Plongeur", "Niveau", "Rôle", "Prof. prévue", "Prof. réalisée", "Durée", "Immersion", "Sortie", "Paliers", "Émargement"].map((t) => (
                      <th key={t} className="border-b border-[#123A63] px-[6px] py-[6px] font-bold">
                        {t}
                      </th>
                    ))}
                  </tr>
                </thead>
                {ordre.map((k) => (
                  <tbody key={k ?? "aucune"} className="break-inside-avoid">
                    <tr>
                      <td colSpan={10} className="bg-[#E3F2FB] px-[6px] py-[5px] text-[12px] font-bold print:bg-[#EEF4F9]">
                        {k === null ? "Pas encore en palanquée" : `Palanquée ${k}`}
                      </td>
                    </tr>
                    {(groupes.get(k) ?? []).map((p, i) => (
                      <tr key={i} className="border-b border-[#DCE6EE]">
                        <td className="px-[6px] py-[7px] font-semibold">
                          {[p.nom?.toUpperCase(), p.prenom].filter(Boolean).join(" ")}
                          {p.prevu && <span className="pl-[5px] text-[10.5px] font-normal text-[#9DB0C0]">(hors Palanote)</span>}
                        </td>
                        <td className="px-[6px]">{p.niveau ?? ""}</td>
                        <td className="px-[6px] font-semibold">{p.guide ? "GP" : "P"}</td>
                        <td className="px-[6px]">{nombre(f.profondeur_prevue, "m")}</td>
                        <Case valeur={nombre(p.prof_max, "m")} />
                        <Case valeur={nombre(p.duree, "min")} />
                        <Case valeur={heureCourte(p.immersion)} />
                        <Case valeur={heureSortie(p)} />
                        <Case valeur="" />
                        <Case valeur="" large />
                      </tr>
                    ))}
                    {aPreparer && k !== null && (
                      <tr className="border-b border-[#DCE6EE]">
                        {Array.from({ length: 10 }, (_, i) => (
                          <Case key={i} valeur="" />
                        ))}
                      </tr>
                    )}
                  </tbody>
                ))}
              </table>
            </div>
            {nbPlongeurs === 0 && <p className="py-[16px] text-center text-[#5B7189]">Aucun plongeur inscrit pour l'instant.</p>}

            {f.consignes && (
              <p className="pt-[12px]">
                <span className="font-bold">Consignes : </span>
                {f.consignes}
              </p>
            )}

            <div className="mt-[18px] flex flex-wrap items-end justify-between gap-[16px]">
              <p className="text-[11px] text-[#7D93A8]">
                GP : guide de palanquée · P : plongeur. Données réalisées issues des fiches des plongeurs sur Palanote.
                <br />
                Générée le {new Date().toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" })} à{" "}
                {new Date().toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}. À conserver par le centre.
              </p>
              <div className="w-[260px] border border-[#123A63] px-[10px] pb-[42px] pt-[6px] text-[11px] font-bold uppercase tracking-[.05em] text-[#5B7189]">
                Signature du directeur de plongée
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function Champ({ label, valeur }: { label: string; valeur: string }) {
  return (
    <div className="min-w-0">
      <p className="text-[10.5px] font-bold uppercase tracking-[.06em] text-[#7D93A8]">{label}</p>
      <p className="min-h-[18px] truncate border-b border-dotted border-[#B5C4D1] font-semibold">{valeur}</p>
    </div>
  );
}

// Case à remplir à la main si la donnée n'est pas encore connue
function Case({ valeur, large = false }: { valeur: string; large?: boolean }) {
  return <td className={`px-[6px] py-[7px] ${large ? "w-[130px]" : ""} ${valeur ? "font-semibold text-[#123A63]" : ""}`}>{valeur || <span className="block h-[14px] border-b border-dotted border-[#B5C4D1]" />}</td>;
}
