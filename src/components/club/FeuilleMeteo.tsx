import { useEffect, useState } from "react";
import { CalendarClock, CloudRain, X } from "lucide-react";
import { Feuille, MessageErreur, detailErreur } from "@/components/club/Ui";
import { heureCourte } from "@/lib/club";
import { annulerReporterSorties, MOTIFS_CHANGEMENT, planningCentre, type SortiePlanning } from "@/lib/planning";

// Météo, mer, bateau : le DP annule ou reporte une ou plusieurs sorties du même jour,
// et tous les inscrits (et la liste d'attente) sont prévenus avec le motif.
export function FeuilleMeteo({
  sortie,
  onFermer,
  onFait,
}: {
  sortie: { id: string; date: string; centre: string | null; site: string; heure: string | null; inscrits: number };
  onFermer: () => void;
  onFait: (message: string) => void;
}) {
  const [jour, setJour] = useState<SortiePlanning[] | null>(null);
  const [choisies, setChoisies] = useState<string[]>([sortie.id]);
  const [action, setAction] = useState<"annuler" | "reporter">("annuler");
  const [motif, setMotif] = useState("Météo");
  const [message, setMessage] = useState("");
  const [date, setDate] = useState("");
  const [heure, setHeure] = useState(sortie.heure?.slice(0, 5) ?? "");
  const [enCours, setEnCours] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);

  // Les autres sorties prévues du même jour : souvent, la météo les touche toutes
  useEffect(() => {
    if (!sortie.centre) return;
    void planningCentre(sortie.centre, sortie.date, sortie.date)
      .then((p) => setJour(p.sorties.filter((s) => s.statut === "prevue")))
      .catch(() => setJour(null));
  }, [sortie.centre, sortie.date]);

  const liste = jour && jour.length > 1 ? jour : null;
  const prevenus = liste ? liste.filter((s) => choisies.includes(s.id)).reduce((t, s) => t + s.nb_inscrits, 0) : sortie.inscrits;

  const valider = async () => {
    setEnCours(true);
    setErreur(null);
    try {
      const nb = await annulerReporterSorties(choisies, action, motif, message.trim() || null, action === "reporter" ? date : null, action === "reporter" && heure ? heure : null);
      const n = choisies.length;
      onFait(
        `${n > 1 ? `${n} sorties` : "Sortie"} ${action === "annuler" ? `annulée${n > 1 ? "s" : ""}` : `reportée${n > 1 ? "s" : ""}`} · ${nb} plongeur${nb > 1 ? "s" : ""} prévenu${nb > 1 ? "s" : ""}.`,
      );
    } catch (e) {
      console.error(e);
      setErreur(detailErreur(e, "Le changement n'a pas pu être enregistré."));
    } finally {
      setEnCours(false);
    }
  };

  const puce = (actif: boolean) => `h-[34px] rounded-[10px] px-[12px] text-[13px] font-bold ${actif ? "bg-[#0F3D70] text-white" : "border border-[#D8E5EE] bg-white text-[#5B7189]"}`;

  return (
    <Feuille titre="Annuler ou reporter" onFermer={onFermer}>
      <div className="grid grid-cols-2 gap-[8px]">
        {(
          [
            ["annuler", "Annuler", X],
            ["reporter", "Reporter", CalendarClock],
          ] as const
        ).map(([id, libelle, Icone]) => (
          <button
            key={id}
            type="button"
            onClick={() => setAction(id)}
            className={`flex h-[46px] items-center justify-center gap-[6px] rounded-[10px] text-[14px] font-bold ${action === id ? "bg-[#0F3D70] text-white" : "border border-[#D8E5EE] bg-white text-[#5B7189]"}`}
          >
            <Icone className="h-[16px] w-[16px]" /> {libelle}
          </button>
        ))}
      </div>

      {liste && (
        <>
          <p className="pb-[6px] pt-[16px] text-[12px] font-bold uppercase tracking-[.06em] text-[#7D93A8]">Sorties de la journée</p>
          <div className="flex flex-col gap-[6px]">
            {liste.map((s) => {
              const coche = choisies.includes(s.id);
              return (
                <label key={s.id} className={`flex cursor-pointer items-center gap-[10px] rounded-[10px] border px-[12px] py-[9px] ${coche ? "border-[#57D4F5] bg-[#F3FAFE]" : "border-[#E4EBF1]"}`}>
                  <input
                    type="checkbox"
                    checked={coche}
                    onChange={() => setChoisies((c) => (coche ? c.filter((x) => x !== s.id) : [...c, s.id]))}
                    className="h-[18px] w-[18px] accent-[#0F3D70]"
                  />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[14px] font-bold">{s.site}</span>
                    <span className="block text-[12px] text-[#7D93A8]">
                      {[s.heure ? heureCourte(s.heure) : null, `${s.nb_inscrits} inscrit${s.nb_inscrits > 1 ? "s" : ""}`, s.mienne ? null : `DP ${s.dp}`].filter(Boolean).join(" · ")}
                    </span>
                  </span>
                </label>
              );
            })}
          </div>
        </>
      )}

      <p className="pb-[6px] pt-[16px] text-[12px] font-bold uppercase tracking-[.06em] text-[#7D93A8]">Motif</p>
      <div className="flex flex-wrap gap-[6px]">
        {MOTIFS_CHANGEMENT.map((m) => (
          <button key={m} type="button" onClick={() => setMotif(m)} className={puce(motif === m)}>
            {m}
          </button>
        ))}
      </div>

      {action === "reporter" && (
        <div className="grid grid-cols-2 gap-[10px] pt-[14px]">
          <label className="text-[12px] font-bold text-[#5B7189]">
            Nouvelle date
            <input type="date" value={date} min={new Date().toISOString().slice(0, 10)} onChange={(e) => setDate(e.target.value)} className="mt-[4px] block h-[42px] w-full rounded-[10px] border border-[#E4EBF1] px-[10px] text-[14px] text-[#123A63]" />
          </label>
          <label className="text-[12px] font-bold text-[#5B7189]">
            Heure
            <input type="time" value={heure} onChange={(e) => setHeure(e.target.value)} className="mt-[4px] block h-[42px] w-full rounded-[10px] border border-[#E4EBF1] px-[10px] text-[14px] text-[#123A63]" />
          </label>
        </div>
      )}

      <label className="block pt-[14px] text-[12px] font-bold text-[#5B7189]">
        Message aux plongeurs (facultatif)
        <textarea
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          maxLength={400}
          rows={3}
          placeholder={action === "annuler" ? "Ex. : vent d'est à 30 nœuds, mer formée. On se retrouve dimanche !" : "Ex. : même heure, même rendez-vous au port."}
          className="mt-[4px] block w-full rounded-[10px] border border-[#E4EBF1] px-[12px] py-[10px] text-[14px] font-normal text-[#123A63] outline-none focus:border-[#57D4F5]"
        />
      </label>

      <MessageErreur texte={erreur} />
      <button
        type="button"
        disabled={enCours || choisies.length === 0 || (action === "reporter" && !date)}
        onClick={() => void valider()}
        className="mt-[16px] flex h-[52px] w-full items-center justify-center gap-[8px] rounded-[10px] bg-[#123A63] text-[14px] font-bold text-white disabled:opacity-50"
      >
        <CloudRain className="h-[17px] w-[17px]" />
        {enCours
          ? "ENVOI…"
          : `${action === "annuler" ? "ANNULER" : "REPORTER"} ET PRÉVENIR ${prevenus} PLONGEUR${prevenus > 1 ? "S" : ""}`}
      </button>
      <p className="pt-[8px] text-center text-[11.5px] text-[#9DB0C0]">Les plongeurs en liste d'attente sont prévenus aussi.</p>
    </Feuille>
  );
}
