import { useEffect, useState } from "react";
import { CloudOff, RefreshCw, UploadCloud } from "lucide-react";
import { envoyerEnAttente, EVENEMENT_ATTENTE, plongeesEnAttente, type PlongeeEnAttente } from "@/lib/hors-ligne";

// Accueil du carnet : « pas de réseau » et les plongées gardées sur le téléphone,
// en attente d'envoi. Elles partent toutes seules dès que le réseau revient.
export function BandeauHorsLigne() {
  const [horsLigne, setHorsLigne] = useState(false);
  const [attente, setAttente] = useState<PlongeeEnAttente[]>([]);
  const [envoi, setEnvoi] = useState(false);

  useEffect(() => {
    const maj = () => {
      setHorsLigne(navigator.onLine === false);
      void plongeesEnAttente().then(setAttente);
    };
    maj();
    window.addEventListener("online", maj);
    window.addEventListener("offline", maj);
    window.addEventListener(EVENEMENT_ATTENTE, maj);
    return () => {
      window.removeEventListener("online", maj);
      window.removeEventListener("offline", maj);
      window.removeEventListener(EVENEMENT_ATTENTE, maj);
    };
  }, []);

  if (!horsLigne && attente.length === 0) return null;

  const envoyer = async () => {
    setEnvoi(true);
    try {
      await envoyerEnAttente();
    } finally {
      setEnvoi(false);
    }
  };

  const n = attente.length;
  return (
    <div className="mx-[22px] mt-[16px] galet-b border border-[#CFE0EE] bg-white px-[15px] py-[13px] shadow-[0_4px_14px_#123A6308]">
      <div className="flex items-start gap-[12px]">
        <span className="flex h-[38px] w-[38px] shrink-0 items-center justify-center goutte bg-[#E3EDF6]">
          {horsLigne ? (
            <CloudOff className="h-[18px] w-[18px] text-[#5B7189]" strokeWidth={2} aria-hidden="true" />
          ) : (
            <UploadCloud className="h-[18px] w-[18px] text-[#1176A8]" strokeWidth={2} aria-hidden="true" />
          )}
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-[14.5px] font-bold text-[#123A63]">
            {horsLigne ? "Pas de réseau" : `${n} plongée${n > 1 ? "s" : ""} à envoyer`}
          </p>
          <p className="pt-[2px] text-[12.5px] leading-snug text-[#5B7189]">
            {horsLigne
              ? n > 0
                ? `${n} plongée${n > 1 ? "s" : ""} gardée${n > 1 ? "s" : ""} sur ton téléphone. Elle${n > 1 ? "s" : ""} partir${n > 1 ? "ont" : "a"} toute${n > 1 ? "s" : ""} seule${n > 1 ? "s" : ""} au retour du réseau.`
                : "Tu vois la dernière copie de ton carnet. Tu peux noter une plongée : elle partira au retour du réseau."
              : "Le réseau est revenu : elles partent maintenant."}
          </p>
        </div>
      </div>

      {n > 0 && (
        <ul className="mt-[10px] flex flex-col gap-[6px] border-t border-[#EDF2F7] pt-[10px]">
          {attente.map((p) => (
            <li key={p.id} className="flex items-baseline justify-between gap-2 text-[13px]">
              <span className="min-w-0 truncate font-semibold text-[#123A63]">{p.ligne.site_name || "Plongée sans site"}</span>
              <span className="shrink-0 text-[12px] text-[#9DB0C0]">
                {p.ligne.dive_date ? new Date(p.ligne.dive_date).toLocaleDateString("fr-FR", { day: "numeric", month: "short" }) : ""}
                {p.photos.length ? ` · ${p.photos.length} photo${p.photos.length > 1 ? "s" : ""}` : ""}
                {p.erreur ? " · refusée" : " · en attente"}
              </span>
            </li>
          ))}
        </ul>
      )}

      {!horsLigne && n > 0 && (
        <button
          type="button"
          onClick={() => void envoyer()}
          disabled={envoi}
          className="mt-[10px] flex h-[40px] w-full items-center justify-center gap-[8px] galet-moyen bg-[#3DEFBE] text-[13px] font-bold text-[#0B3B63] disabled:opacity-60"
        >
          <RefreshCw className={`h-[15px] w-[15px] ${envoi ? "animate-spin" : ""}`} strokeWidth={2.4} aria-hidden="true" />
          {envoi ? "ENVOI EN COURS…" : "ENVOYER MAINTENANT"}
        </button>
      )}
    </div>
  );
}
