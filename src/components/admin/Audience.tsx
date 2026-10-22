import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { Bloc, carte, GrandNombre, nombre } from "@/components/admin/Bento";

// Onglet « Audience » : les visites du site mesurées par Vercel Web Analytics
// (sans cookie, visiteurs anonymes). Les chiffres passent par la fonction stats-audience,
// qui garde la clé Vercel côté serveur.

type Rang = { nom: string; visiteurs: number; pages: number };
type Audience =
  | { etat: "non_configure" | "desactive" }
  | { etat: "erreur"; code: string }
  | {
      etat: "ok";
      jours: number;
      depuis: string;
      visiteurs: number;
      pagesVues: number;
      parJour: { jour: string; visiteurs: number; pages: number }[];
      pages: Rang[];
      appareils: Rang[];
      pays: Rang[];
      sources: Rang[];
    };

async function chargerAudience(jours: 7 | 30): Promise<Audience> {
  const { data, error } = await supabase.functions.invoke("stats-audience", { body: { jours } });
  if (error) throw error;
  return data as Audience;
}

const APPAREILS: Record<string, string> = {
  mobile: "Téléphone",
  desktop: "Ordinateur",
  tablet: "Tablette",
};
const nomPays = (code: string) => {
  try {
    return new Intl.DisplayNames(["fr"], { type: "region" }).of(code) ?? code;
  } catch {
    return code;
  }
};

// Complète les jours sans visite pour que le graphique garde un pas régulier
function joursComplets(
  depuis: string,
  jours: number,
  lignes: { jour: string; visiteurs: number; pages: number }[],
) {
  const parJour = new Map(lignes.map((l) => [l.jour, l]));
  const debut = new Date(`${depuis}T00:00:00Z`).getTime();
  return Array.from({ length: jours }, (_, i) => {
    const jour = new Date(debut + i * 86_400_000).toISOString().slice(0, 10);
    return parJour.get(jour) ?? { jour, visiteurs: 0, pages: 0 };
  });
}

function Classement({
  titre,
  lignes,
  libelle,
}: {
  titre: string;
  lignes: Rang[];
  libelle?: (n: string) => string;
}) {
  const max = Math.max(1, ...lignes.map((l) => l.visiteurs));
  return (
    <div className={`${carte} p-[20px]`}>
      <h2 className="text-[13px] font-medium text-[#566B82]">{titre}</h2>
      {lignes.length === 0 ? (
        <p className="pt-[12px] text-[12.5px] text-[#566B82]">Pas encore de données.</p>
      ) : (
        <ul className="flex flex-col gap-[8px] pt-[12px]">
          {lignes.map((l) => (
            <li
              key={l.nom}
              className="relative flex items-center gap-[10px] overflow-hidden rounded-[10px] px-[10px] py-[7px] text-[13px]"
            >
              <span
                className="absolute inset-y-0 left-0 rounded-[10px] bg-[#E6F1F8]"
                style={{ width: `${(l.visiteurs / max) * 100}%` }}
                aria-hidden="true"
              />
              <span className="relative min-w-0 flex-1 truncate">
                {libelle ? libelle(l.nom) : l.nom}
              </span>
              <span className="relative shrink-0 tabular-nums text-[#123A63]">
                {nombre(l.visiteurs)}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export function SectionAudience() {
  const [jours, setJours] = useState<7 | 30>(7);
  const [a, setA] = useState<Audience | null>(null);
  const [panne, setPanne] = useState(false);

  useEffect(() => {
    let actif = true;
    setA(null);
    setPanne(false);
    chargerAudience(jours)
      .then((r) => actif && setA(r))
      .catch((e) => {
        console.error("Audience non chargée", e);
        if (actif) setPanne(true);
      });
    return () => {
      actif = false;
    };
  }, [jours]);

  if (panne)
    return (
      <p className="rounded-[16px] bg-[#FFECE8] p-[14px] text-[13.5px] text-[#8A2A1A]">
        L'audience n'a pas pu être chargée. La fonction stats-audience est-elle déployée ?
      </p>
    );
  if (!a) return <p className="text-[13px] text-[#566B82]">Chargement de l'audience…</p>;
  if (a.etat !== "ok")
    return (
      <div className={`${carte} max-w-[640px] p-[22px] text-[13.5px] leading-[1.55]`}>
        <h2 className="text-[16px] font-semibold">Audience pas encore branchée</h2>
        {a.etat === "desactive" && (
          <p className="pt-[8px]">
            Web Analytics n'est pas activé sur le projet Vercel : Vercel › palanote-app › Analytics
            › Enable.
          </p>
        )}
        {a.etat === "non_configure" && (
          <p className="pt-[8px]">
            Il manque le secret VERCEL_TOKEN dans Supabase › Edge Functions › Secrets.
          </p>
        )}
        {a.etat === "erreur" && (
          <p className="pt-[8px]">
            Vercel a répondu par une erreur ({a.code}). Vérifie le jeton d'accès.
          </p>
        )}
      </div>
    );

  const serie = joursComplets(a.depuis, a.jours, a.parJour);
  const max = Math.max(1, ...serie.map((j) => j.visiteurs));
  const pagesParVisiteur = a.visiteurs
    ? (a.pagesVues / a.visiteurs).toLocaleString("fr-FR", { maximumFractionDigits: 1 })
    : "—";
  const jourCourt = (j: string) =>
    new Date(`${j}T12:00:00Z`).toLocaleDateString("fr-FR", { day: "numeric", month: "short" });

  return (
    <div className="flex flex-col gap-[16px]">
      <div className="flex items-center gap-[8px]" role="group" aria-label="Période">
        {([7, 30] as const).map((n) => (
          <button
            key={n}
            type="button"
            aria-pressed={jours === n}
            onClick={() => setJours(n)}
            className={`h-[34px] rounded-full px-[14px] text-[13px] ${jours === n ? "bg-[#0F2A4A] font-semibold text-white" : "bg-white text-[#123A63] hover:bg-[#EDF1F5]"}`}
          >
            {n} jours
          </button>
        ))}
        <span className="ml-auto text-[12px] text-[#566B82]">
          Vercel Web Analytics · sans cookie · production
        </span>
      </div>

      <div className="grid gap-[16px] md:grid-cols-3">
        <Bloc titre="Visiteurs" fond="bg-[#0F2A4A]" sombre>
          <GrandNombre valeur={nombre(a.visiteurs)} unite={`sur ${a.jours} jours`} sombre />
        </Bloc>
        <Bloc titre="Pages vues" fond="bg-[#DDEEF7]">
          <GrandNombre valeur={nombre(a.pagesVues)} />
        </Bloc>
        <Bloc titre="Pages par visiteur" fond="bg-[#FFE3DC]">
          <GrandNombre valeur={pagesParVisiteur} />
        </Bloc>
      </div>

      <div className={`${carte} p-[20px]`}>
        <h2 className="text-[13px] font-medium text-[#566B82]">Visiteurs par jour</h2>
        <div
          className="flex h-[160px] items-end gap-[3px] pt-[16px]"
          role="img"
          aria-label={`Visiteurs par jour sur ${a.jours} jours, au plus ${max} un même jour`}
        >
          {serie.map((j) => (
            <div
              key={j.jour}
              className="group relative flex h-full flex-1 items-end"
              title={`${jourCourt(j.jour)} : ${j.visiteurs} visiteur${j.visiteurs > 1 ? "s" : ""}, ${j.pages} page${j.pages > 1 ? "s" : ""}`}
            >
              <div
                className="w-full rounded-t-[4px] bg-[#1A8FC4] group-hover:bg-[#0F2A4A]"
                style={{ height: `${Math.max(j.visiteurs ? 4 : 1, (j.visiteurs / max) * 100)}%` }}
              />
            </div>
          ))}
        </div>
        <div className="flex justify-between pt-[6px] text-[11.5px] text-[#566B82]">
          <span>{jourCourt(serie[0]!.jour)}</span>
          <span>{jourCourt(serie[serie.length - 1]!.jour)}</span>
        </div>
      </div>

      <div className="grid gap-[16px] md:grid-cols-2">
        <Classement titre="Pages les plus vues" lignes={a.pages} />
        <Classement
          titre="D'où viennent les visiteurs"
          lignes={a.sources}
          libelle={(n) => (n === "—" ? "Accès direct" : n)}
        />
        <Classement titre="Appareils" lignes={a.appareils} libelle={(n) => APPAREILS[n] ?? n} />
        <Classement titre="Pays" lignes={a.pays} libelle={nomPays} />
      </div>
    </div>
  );
}
