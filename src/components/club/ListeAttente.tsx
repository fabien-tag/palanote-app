import { useCallback, useEffect, useState } from "react";
import { Hourglass } from "lucide-react";
import { Avatar } from "@/components/club/Ui";
import { ajouterParticipant, attenteSortie, quitterAttente, type EnAttente } from "@/lib/club";

// Pour le DP : les plongeurs en liste d'attente (bateau complet), dans l'ordre d'arrivée.
// Le premier passe automatiquement dès qu'une place se libère ; le DP peut aussi en inscrire un.
export function ListeAttente({ sortie, onChange, modifiable }: { sortie: string; onChange: () => void; modifiable: boolean }) {
  const [liste, setListe] = useState<EnAttente[]>([]);
  const [enCours, setEnCours] = useState<string | null>(null);
  const charger = useCallback(() => {
    void attenteSortie(sortie)
      .then((r) => setListe(r.liste ?? []))
      .catch(() => setListe([])); // script pas encore lancé
  }, [sortie]);
  useEffect(() => charger(), [charger]);

  if (liste.length === 0) return null;
  const agir = async (id: string, f: () => Promise<unknown>) => {
    setEnCours(id);
    try {
      await f();
    } catch (e) {
      console.error(e);
    }
    setEnCours(null);
    charger();
    onChange();
  };
  return (
    <div className="mt-[12px] rounded-[10px] border border-[#F2D49A] bg-[#FFF8E8] p-[12px]">
      <p className="flex items-center gap-[6px] text-[13.5px] font-bold text-[#6B5320]">
        <Hourglass className="h-[15px] w-[15px]" /> Liste d'attente · {liste.length}
      </p>
      <p className="pb-[8px] text-[12px] text-[#8A6A2A]">Le bateau est complet. Le premier est inscrit automatiquement dès qu'une place se libère.</p>
      <div className="flex flex-col gap-[6px]">
        {liste.map((p, i) => (
          <div key={p.id} className="flex items-center gap-[10px] rounded-[10px] bg-white px-[10px] py-[7px]">
            <span className="w-[18px] text-center text-[12px] font-bold text-[#B07A12]">{i + 1}</span>
            <Avatar id={p.id} prenom={p.prenom} taille={28} />
            <span className="min-w-0 flex-1">
              <span className="block truncate text-[13.5px] font-bold">{p.prenom}</span>
              <span className="block truncate text-[11.5px] text-[#7D93A8]">
                {[p.niveau, `depuis le ${new Date(p.depuis).toLocaleDateString("fr-FR", { day: "numeric", month: "short" })}`].filter(Boolean).join(" · ")}
              </span>
            </span>
            {modifiable && (
              <>
                <button
                  type="button"
                  disabled={enCours === p.id}
                  onClick={() => void agir(p.id, () => ajouterParticipant(sortie, p.id))}
                  className="h-[30px] rounded-[10px] bg-[#0F3D70] px-[10px] text-[12px] font-bold text-white disabled:opacity-50"
                >
                  Inscrire quand même
                </button>
                <button
                  type="button"
                  disabled={enCours === p.id}
                  onClick={() => void agir(p.id, () => quitterAttente(sortie, p.id))}
                  className="h-[30px] px-[6px] text-[12px] font-semibold text-[#9DB0C0]"
                >
                  Retirer
                </button>
              </>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
