import { useEffect, useState } from "react";
import { carte } from "@/components/admin/Bento";
import { chargerSuiviAgent, coutEuros, type ChiffresMode, type SuiviAgent } from "@/lib/evalAgent";

// « L'agent en production » : ce que l'agent a vraiment fait sur les pages des plongeurs.
// Le pendant du banc d'essai : l'eval set mesure la qualité avant livraison, ce suivi la mesure après.
const PERIODES = [7, 30, 90];
const pct = (a: number, b: number) => (b > 0 ? `${Math.round((a / b) * 100)} %` : "—");
const euros = (v: number) => `${v.toLocaleString("fr-FR", { maximumFractionDigits: 3 })} €`;

export function SuiviProduction() {
  const [jours, setJours] = useState(30);
  const [suivi, setSuivi] = useState<SuiviAgent | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);

  useEffect(() => {
    let actif = true;
    setErreur(null);
    chargerSuiviAgent(jours)
      .then((s) => actif && setSuivi(s))
      .catch((e) => {
        console.error(e);
        if (actif)
          setErreur(
            "Le suivi n'a pas pu être chargé. As-tu lancé le script palanote-suivi-agent.sql ?",
          );
      });
    return () => {
      actif = false;
    };
  }, [jours]);

  const max = Math.max(1, ...(suivi?.par_jour ?? []).map((j) => j.agent + j.direct));

  return (
    <div className={`${carte} p-[20px]`}>
      <div className="flex flex-wrap items-start gap-[12px]">
        <div className="min-w-0 flex-1">
          <h2 className="text-[19px] font-bold">L'agent en production</h2>
          <p className="max-w-[70ch] pt-[4px] text-[13.5px] leading-normal text-[#5B7189]">
            Ce que l'agent a vraiment fait sur les carnets des plongeurs. Le taux de correction
            compare chaque champ proposé par l'IA à la valeur que le plongeur a validée.
          </p>
        </div>
        <div className="flex gap-[4px] rounded-[12px] bg-[#F1F6FC] p-[4px]">
          {PERIODES.map((p) => (
            <button
              key={p}
              type="button"
              aria-pressed={jours === p}
              onClick={() => setJours(p)}
              className={`h-[32px] rounded-[9px] px-[12px] text-[12.5px] font-bold ${jours === p ? "bg-white text-[#0F3D70] shadow-sm" : "text-[#7D93A8]"}`}
            >
              {p} jours
            </button>
          ))}
        </div>
      </div>

      {erreur && (
        <p className="mt-[12px] rounded-[12px] bg-[#FFECE8] p-[10px] text-[13px] text-[#8A2A1A]">
          {erreur}
        </p>
      )}
      {!suivi && !erreur && (
        <div className="mt-[14px] h-[160px] animate-pulse rounded-[14px] bg-[#F1F6FC]" />
      )}

      {suivi && (
        <>
          <div className="grid grid-cols-1 gap-[12px] pt-[16px] md:grid-cols-2">
            <Colonne
              titre="Avec l'agent"
              sous="vérifie ses doutes avant de proposer"
              c={suivi.modes.agent}
              accent
            />
            <Colonne
              titre="Lecture directe"
              sous="pages lues avant l'agent, pour comparer"
              c={suivi.modes.direct}
            />
          </div>

          <div className="grid grid-cols-1 gap-[16px] pt-[18px] lg:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)]">
            {/* Pages lues par jour, sur 14 jours */}
            <div>
              <p className="pb-[8px] text-[12.5px] font-semibold text-[#7D93A8]">
                Pages lues, 14 derniers jours
              </p>
              <div
                className="flex h-[96px] items-end gap-[4px]"
                role="img"
                aria-label="Pages lues par jour sur les 14 derniers jours"
              >
                {suivi.par_jour.map((j) => (
                  <div
                    key={j.jour}
                    className="flex flex-1 flex-col justify-end"
                    title={`${new Date(j.jour).toLocaleDateString("fr-FR", { day: "numeric", month: "short" })} : ${j.agent} avec l'agent, ${j.direct} en lecture directe`}
                  >
                    <div
                      className="rounded-t-[3px] bg-[#3DEFBE]"
                      style={{ height: `${(j.agent / max) * 88}px` }}
                    />
                    <div
                      className="bg-[#C9D9E5]"
                      style={{ height: `${(j.direct / max) * 88}px` }}
                    />
                    <div className="h-[2px] bg-[#E4EBF1]" />
                  </div>
                ))}
              </div>
              <p className="flex gap-[12px] pt-[8px] text-[11.5px] text-[#7D93A8]">
                <span className="flex items-center gap-[5px]">
                  <span className="h-[8px] w-[8px] rounded-full bg-[#3DEFBE]" /> avec l'agent
                </span>
                <span className="flex items-center gap-[5px]">
                  <span className="h-[8px] w-[8px] rounded-full bg-[#C9D9E5]" /> lecture directe
                </span>
                <span className="ml-auto">
                  {suivi.plongees_validees} plongée{suivi.plongees_validees > 1 ? "s" : ""} validée
                  {suivi.plongees_validees > 1 ? "s" : ""}, {suivi.plongees_rejetees} rejetée
                  {suivi.plongees_rejetees > 1 ? "s" : ""}
                </span>
              </p>
            </div>

            {/* Les dernières pages lues */}
            <div>
              <p className="pb-[8px] text-[12.5px] font-semibold text-[#7D93A8]">
                Dernières pages lues
              </p>
              {suivi.dernieres.length === 0 ? (
                <p className="text-[13px] text-[#9DB0C0]">Aucune page sur cette période.</p>
              ) : (
                <ul className="flex max-h-[180px] flex-col gap-[6px] overflow-y-auto pr-[4px]">
                  {suivi.dernieres.map((d, i) => (
                    <li
                      key={i}
                      className="flex items-start gap-[8px] rounded-[10px] bg-[#F6F8FA] px-[10px] py-[7px] text-[12.5px]"
                    >
                      <span
                        className={`mt-[4px] h-[8px] w-[8px] shrink-0 rounded-full ${d.statut === "lue" ? "bg-[#3DEFBE]" : d.statut === "erreur" ? "bg-[#C94957]" : d.statut === "illisible" ? "bg-[#FFC65C]" : "bg-[#57D4F5]"}`}
                      />
                      <span className="min-w-0 flex-1">
                        <span className="font-semibold">
                          {new Date(d.le).toLocaleString("fr-FR", {
                            day: "numeric",
                            month: "short",
                            hour: "2-digit",
                            minute: "2-digit",
                          })}{" "}
                          ·{" "}
                          {d.mode === "agent"
                            ? `agent, ${d.etapes ?? 1} étape${(d.etapes ?? 1) > 1 ? "s" : ""}`
                            : "lecture directe"}{" "}
                          · {d.statut}
                        </span>
                        {d.verifications.length > 0 && (
                          <span className="block truncate text-[#5B7189]">
                            Vérifié : {d.verifications.join(" ; ")}
                          </span>
                        )}
                        {d.erreur && (
                          <span className="block truncate text-[#C94957]">{d.erreur}</span>
                        )}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

function Colonne({
  titre,
  sous,
  c,
  accent = false,
}: {
  titre: string;
  sous: string;
  c: ChiffresMode;
  accent?: boolean;
}) {
  const echecs = c.illisibles + c.erreurs;
  const cout =
    c.pages_avec_tokens > 0
      ? coutEuros(c.tokens_entree, c.tokens_sortie) / c.pages_avec_tokens
      : null;
  return (
    <div
      className={`rounded-[16px] border p-[16px] ${accent ? "border-[#3DEFBE] bg-[#F3FEFA]" : "border-[#E9EEF3] bg-white"}`}
    >
      <p className="text-[14px] font-bold">{titre}</p>
      <p className="text-[12px] text-[#7D93A8]">{sous}</p>
      {c.pages === 0 ? (
        <p className="pt-[12px] text-[13px] text-[#9DB0C0]">Aucune page sur cette période.</p>
      ) : (
        <dl className="grid grid-cols-2 gap-[8px] pt-[12px] text-[13px]">
          <Mesure
            label="Pages lues"
            valeur={`${c.lues} / ${c.pages}`}
            aide={
              echecs > 0
                ? `${echecs} illisible${echecs > 1 ? "s" : ""} ou en erreur`
                : "aucun échec"
            }
          />
          <Mesure
            label="Correction humaine"
            valeur={pct(c.champs_corriges, c.champs_proposes)}
            aide={`${c.champs_corriges} champ${c.champs_corriges > 1 ? "s" : ""} corrigé${c.champs_corriges > 1 ? "s" : ""} sur ${c.champs_proposes}`}
          />
          <Mesure
            label="Faux donnés « sûrs »"
            valeur={String(c.faux_surs)}
            aide={`sur ${c.champs_surs} champ${c.champs_surs > 1 ? "s" : ""} « sûrs »`}
            alerte={c.faux_surs > 0}
          />
          <Mesure
            label="Pages vérifiées"
            valeur={pct(c.avec_verification, c.pages)}
            aide={`${c.zooms} zoom${c.zooms > 1 ? "s" : ""}, ${c.pages_voisines} page${c.pages_voisines > 1 ? "s" : ""} voisine${c.pages_voisines > 1 ? "s" : ""}`}
          />
          <Mesure
            label="Étapes par page"
            valeur={
              c.etapes_moyennes !== null ? Number(c.etapes_moyennes).toLocaleString("fr-FR") : "1"
            }
            aide="appels au modèle"
          />
          <Mesure
            label="Coût réel par page"
            valeur={cout !== null ? euros(cout) : "—"}
            aide={
              cout !== null
                ? `${(c.tokens_entree + c.tokens_sortie).toLocaleString("fr-FR")} jetons`
                : "jetons non mesurés"
            }
          />
        </dl>
      )}
    </div>
  );
}

function Mesure({
  label,
  valeur,
  aide,
  alerte = false,
}: {
  label: string;
  valeur: string;
  aide: string;
  alerte?: boolean;
}) {
  return (
    <div className="rounded-[12px] bg-white/70 px-[10px] py-[8px] ring-1 ring-[#EEF2F6]">
      <dt className="text-[11.5px] text-[#7D93A8]">{label}</dt>
      <dd className={`text-[17px] font-bold ${alerte ? "text-[#C94957]" : ""}`}>{valeur}</dd>
      <dd className="text-[11px] leading-snug text-[#9DB0C0]">{aide}</dd>
    </div>
  );
}
