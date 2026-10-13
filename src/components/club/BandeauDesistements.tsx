import { useCallback, useEffect, useState } from "react";
import { UserMinus } from "lucide-react";
import { desistementsSortie, validerDesistement, type Desistement } from "@/lib/club";
import { ilYA } from "@/lib/notifications";

// Pour le DP : les plongeurs qui se désistent. Un geste pour les retirer de la sortie
// (et de leur palanquée) ; la place libérée profite à la liste d'attente.
export function BandeauDesistements({
  sortie,
  onChange,
  onListe,
}: {
  sortie: string;
  onChange: () => void;
  onListe?: (ids: Set<string>) => void;
}) {
  const [liste, setListe] = useState<Desistement[]>([]);
  const [enCours, setEnCours] = useState<string | null>(null);
  const charger = useCallback(() => {
    void desistementsSortie(sortie)
      .then((l) => {
        setListe(l);
        onListe?.(new Set(l.map((d) => d.participant_id)));
      })
      .catch(() => setListe([])); // script pas encore lancé
  }, [sortie]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => charger(), [charger]);

  if (liste.length === 0) return null;
  return (
    <div className="mb-[10px] rounded-[10px] border border-[#FFD2C7] bg-[#FFF4F0] p-[12px]">
      <p className="flex items-center gap-[6px] pb-[8px] text-[13.5px] font-bold text-[#8A2A1A]">
        <UserMinus className="h-[15px] w-[15px]" /> {liste.length} désistement{liste.length > 1 ? "s" : ""} à valider
      </p>
      <div className="flex flex-col gap-[6px]">
        {liste.map((d) => (
          <div key={d.participant_id} className="flex items-center gap-[10px] rounded-[10px] bg-white px-[10px] py-[8px]">
            <span className="min-w-0 flex-1">
              <span className="block truncate text-[13.5px] font-bold">
                {d.prenom}
                {d.palanquee ? <span className="font-normal text-[#7D93A8]"> · P{d.palanquee}</span> : null}
              </span>
              <span className="block truncate text-[12px] text-[#7D93A8]">{[d.motif, ilYA(d.le)].filter(Boolean).join(" · ")}</span>
            </span>
            <button
              type="button"
              disabled={enCours === d.participant_id}
              onClick={async () => {
                setEnCours(d.participant_id);
                try {
                  await validerDesistement(d.participant_id);
                } catch (e) {
                  console.error(e);
                }
                setEnCours(null);
                charger();
                onChange();
              }}
              className="h-[32px] shrink-0 rounded-[10px] bg-[#0F3D70] px-[12px] text-[12.5px] font-bold text-white disabled:opacity-50"
            >
              {enCours === d.participant_id ? "…" : "Retirer de la sortie"}
            </button>
          </div>
        ))}
      </div>
      <p className="pt-[8px] text-[11.5px] text-[#8A6A5A]">Le plongeur est prévenu ; s'il y a une liste d'attente, le premier prend sa place.</p>
    </div>
  );
}
