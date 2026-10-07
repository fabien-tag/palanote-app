import { useCallback, useEffect, useState } from "react";
import { Plus, Trash2, X } from "lucide-react";
import { carte } from "@/components/admin/Bento";
import { chargerForfaitsAdmin, donnerForfait, OFFRES, retirerForfait, type ForfaitAdmin } from "@/lib/forfait";

// Tableau de bord › Finances : les forfaits (pack et Palanote+), saisis à la main
// tant que le paiement en ligne n'est pas branché. Un forfait à 0 € est un forfait offert.

const champ = "h-[38px] rounded-[10px] border border-[#DCE7F0] bg-white px-[10px] text-[13.5px] outline-none focus:border-[#57D4F5]";
const PRIX = { pack: "4.99", plus: "19" };

export function SectionForfaits() {
  const [liste, setListe] = useState<ForfaitAdmin[] | null>(null);
  const [ajout, setAjout] = useState(false);
  const [email, setEmail] = useState("");
  const [type, setType] = useState<"pack" | "plus">("plus");
  const [montant, setMontant] = useState(PRIX.plus);
  const [note, setNote] = useState("");
  const [erreur, setErreur] = useState<string | null>(null);

  const charger = useCallback(() => {
    void chargerForfaitsAdmin().then(setListe);
  }, []);
  useEffect(charger, [charger]);

  const valider = async () => {
    setErreur(null);
    const m = montant.trim() === "" ? null : Number(montant.replace(",", "."));
    if (m !== null && (!Number.isFinite(m) || m < 0)) return setErreur("Le montant doit être positif ou nul.");
    try {
      await donnerForfait(email, type, m, note);
      setAjout(false);
      setEmail("");
      setNote("");
      charger();
    } catch (e) {
      const msg = String((e as { message?: string })?.message ?? "");
      setErreur(msg.includes("aucun compte") ? "Aucun compte avec cette adresse." : "Le forfait n'a pas pu être enregistré.");
    }
  };

  // Script SQL pas encore lancé : on n'affiche rien.
  if (liste === null) return null;

  const actifsPlus = liste.filter((f) => f.type === "plus" && f.actif).length;
  const packs = liste.filter((f) => f.type === "pack").length;

  return (
    <div className={`${carte} p-[20px]`}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="text-[15px] font-semibold">Forfaits</h2>
          <p className="text-[12.5px] text-[#7D93A8]">
            {actifsPlus} Palanote+ actif{actifsPlus > 1 ? "s" : ""} · {packs} pack{packs > 1 ? "s" : ""} « {OFFRES.pack.nom} »
          </p>
        </div>
        <button type="button" onClick={() => setAjout(true)} className="flex h-[34px] items-center gap-[6px] rounded-full bg-[#0F2A4A] px-[14px] text-[12.5px] font-semibold text-white">
          <Plus className="h-[14px] w-[14px]" /> Ajouter un forfait
        </button>
      </div>

      {ajout && (
        <div className="mt-[12px] flex flex-wrap items-end gap-[8px] rounded-[14px] bg-[#F6F8FA] p-[12px]">
          <input className={`${champ} min-w-[200px] flex-1`} placeholder="E-mail du compte" value={email} onChange={(e) => setEmail(e.target.value)} />
          <select
            className={champ}
            value={type}
            onChange={(e) => {
              const t = e.target.value as "pack" | "plus";
              setType(t);
              setMontant(PRIX[t]);
            }}
          >
            <option value="plus">Palanote+ (1 an)</option>
            <option value="pack">Pack 200 pages</option>
          </select>
          <input className={`${champ} w-[80px]`} inputMode="decimal" value={montant} onChange={(e) => setMontant(e.target.value)} aria-label="Montant en euros" />
          <input className={`${champ} w-[160px]`} placeholder="Note" value={note} onChange={(e) => setNote(e.target.value)} />
          <button type="button" onClick={() => void valider()} className="h-[38px] rounded-[10px] bg-[#0F2A4A] px-[14px] text-[13px] font-semibold text-white">
            Ajouter
          </button>
          <button type="button" onClick={() => setAjout(false)} aria-label="Annuler" className="flex h-[38px] w-[38px] items-center justify-center rounded-[10px] text-[#7D93A8] hover:bg-white">
            <X className="h-[16px] w-[16px]" />
          </button>
          <p className="w-full text-[12px] text-[#7D93A8]">Montant à 0 : forfait offert (testeur, ami, geste commercial).</p>
          {erreur && <p className="w-full text-[12.5px] text-[#8A2A1A]">{erreur}</p>}
        </div>
      )}

      {liste.length === 0 ? (
        <p className="py-[20px] text-[13.5px] text-[#9DB0C0]">
          Aucun forfait pour l'instant. Les plongeurs intéressés apparaissent dans les retours (sujet « Forfait »).
        </p>
      ) : (
        <table className="mt-[10px] w-full text-left text-[13.5px]">
          <tbody>
            {liste.map((f) => (
              <tr key={f.id} className={`border-t border-[#EDF2F7] first:border-t-0 ${f.actif ? "" : "opacity-50"}`}>
                <td className="py-[10px] font-semibold">{f.email}</td>
                <td className="py-[10px] text-[#7D93A8]">{f.type === "plus" ? "Palanote+" : `Pack ${f.pages ?? 200} pages`}</td>
                <td className="py-[10px] text-[#7D93A8]">
                  {f.type === "plus" && f.fin ? `jusqu'au ${new Date(f.fin).toLocaleDateString("fr-FR")}` : new Date(f.debut).toLocaleDateString("fr-FR")}
                </td>
                <td className="py-[10px] text-[12px] text-[#9DB0C0]">{f.source === "offert" ? "offert" : f.source === "stripe" ? "Stripe" : "saisi à la main"}</td>
                <td className="py-[10px] text-right font-semibold text-[#14805F]">{f.montant ? `+${String(f.montant).replace(".", ",")} €` : "—"}</td>
                <td className="w-[44px] py-[10px] text-right">
                  <button
                    type="button"
                    aria-label="Retirer ce forfait"
                    onClick={() => {
                      if (window.confirm("Retirer ce forfait ?")) void retirerForfait(f.id).then(charger).catch((e) => console.error("Forfait non retiré", e));
                    }}
                    className="rounded-[8px] p-[6px] text-[#C94957] hover:bg-[#FFF1EE]"
                  >
                    <Trash2 className="h-[14px] w-[14px]" />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
