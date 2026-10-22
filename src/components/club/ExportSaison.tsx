import { useState } from "react";
import { FileSpreadsheet } from "lucide-react";
import { Feuille, MessageErreur, detailErreur } from "@/components/club/Ui";
import { chargerExport, periodesProposees, telechargerExport, type Periode } from "@/lib/exportSaison";

// Le DP télécharge le bilan de la saison en Excel : sorties, plongées, plongeurs
export function ExportSaison({ centre, onFermer }: { centre: string; onFermer: () => void }) {
  const periodes = periodesProposees();
  const [p, setP] = useState<Periode>(periodes[0]!);
  const [libre, setLibre] = useState(false);
  const [debut, setDebut] = useState(periodes[0]!.debut);
  const [fin, setFin] = useState(periodes[0]!.fin);
  const [enCours, setEnCours] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);
  const [fait, setFait] = useState<string | null>(null);

  const exporter = async () => {
    setEnCours(true);
    setErreur(null);
    setFait(null);
    const periode: Periode = libre
      ? { id: "libre", libelle: `${new Date(`${debut}T12:00:00`).toLocaleDateString("fr-FR")} au ${new Date(`${fin}T12:00:00`).toLocaleDateString("fr-FR")}`, debut, fin }
      : p;
    try {
      const e = await chargerExport(centre, periode.debut, periode.fin);
      await telechargerExport(e, periode);
      setFait(`${e.sorties.length} sortie${e.sorties.length > 1 ? "s" : ""}, ${e.plongees.length} plongée${e.plongees.length > 1 ? "s" : ""}, ${e.plongeurs.length} plongeur${e.plongeurs.length > 1 ? "s" : ""} exportés.`);
    } catch (x) {
      console.error(x);
      setErreur(detailErreur(x, "L'export n'a pas pu être préparé."));
    } finally {
      setEnCours(false);
    }
  };

  return (
    <Feuille titre="Exporter la saison" onFermer={onFermer}>
      <p className="pb-[12px] text-[13.5px] leading-snug text-[#566B82]">
        Un fichier Excel avec 4 onglets : le résumé, les sorties, toutes les plongées (y compris l'historique importé) et le bilan de chaque plongeur.
      </p>
      <div className="flex flex-wrap gap-[6px]">
        {periodes.map((x) => (
          <button
            key={x.id}
            type="button"
            onClick={() => {
              setP(x);
              setLibre(false);
            }}
            className={`h-[36px] rounded-[10px] px-[12px] text-[13px] font-bold ${!libre && p.id === x.id ? "bg-[#0F3D70] text-white" : "border border-[#D8E5EE] bg-white text-[#566B82]"}`}
          >
            {x.libelle}
          </button>
        ))}
        <button
          type="button"
          onClick={() => setLibre(true)}
          className={`h-[36px] rounded-[10px] px-[12px] text-[13px] font-bold ${libre ? "bg-[#0F3D70] text-white" : "border border-[#D8E5EE] bg-white text-[#566B82]"}`}
        >
          Autre période
        </button>
      </div>
      {libre && (
        <div className="grid grid-cols-2 gap-[10px] pt-[12px]">
          <label className="text-[12px] font-bold text-[#566B82]">
            Du
            <input type="date" value={debut} onChange={(e) => setDebut(e.target.value)} className="mt-[4px] block h-[42px] w-full rounded-[10px] border border-[#E4EBF1] px-[10px] text-[14px] text-[#123A63]" />
          </label>
          <label className="text-[12px] font-bold text-[#566B82]">
            Au
            <input type="date" value={fin} onChange={(e) => setFin(e.target.value)} className="mt-[4px] block h-[42px] w-full rounded-[10px] border border-[#E4EBF1] px-[10px] text-[14px] text-[#123A63]" />
          </label>
        </div>
      )}
      <MessageErreur texte={erreur} />
      {fait && <p className="pt-[12px] text-[13px] font-semibold text-[#137758]">{fait}</p>}
      <button
        type="button"
        disabled={enCours || (libre && (!debut || !fin || fin < debut))}
        onClick={() => void exporter()}
        className="mt-[16px] flex h-[52px] w-full items-center justify-center gap-[8px] rounded-[10px] bg-[#3DEFBE] text-[14px] font-bold text-[#0B3B63] disabled:opacity-50"
      >
        <FileSpreadsheet className="h-[18px] w-[18px]" />
        {enCours ? "PRÉPARATION…" : "TÉLÉCHARGER LE FICHIER EXCEL"}
      </button>
    </Feuille>
  );
}
