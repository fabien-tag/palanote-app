import { useEffect, useState } from "react";
import { Share2 } from "lucide-react";
import { reglagePartagePhotos, reglerPartagePhotos } from "@/lib/galerie";

// Demandé une seule fois : dès qu'on ajoute une photo à une plongée faite avec des binômes.
// La réponse vaut pour la suite ; elle se change dans Moi › Confidentialité.
export function DemandePartagePhotos({ avecQui }: { avecQui: string[] }) {
  const [reglage, setReglage] = useState<boolean | null | undefined>(undefined);
  const [envoi, setEnvoi] = useState(false);
  useEffect(() => {
    void reglagePartagePhotos().then(setReglage);
  }, []);
  if (reglage !== null) return null;
  const qui = avecQui.length === 0 ? "ta palanquée" : avecQui.length === 1 ? avecQui[0] : `${avecQui.slice(0, -1).join(", ")} et ${avecQui[avecQui.length - 1]}`;
  const repondre = async (v: boolean) => {
    setEnvoi(true);
    try {
      await reglerPartagePhotos(v);
      setReglage(v);
    } catch (e) {
      console.error("Réglage du partage non enregistré", e);
      setEnvoi(false);
    }
  };
  return (
    <div className="mt-[12px] galet-b border border-[#BFE6F5] bg-[#E3F4FC] p-[14px] text-[13px] leading-normal text-[#123A63]">
      <div className="flex items-start gap-[10px]">
        <Share2 className="mt-[2px] h-[17px] w-[17px] shrink-0 text-[#106F9F]" strokeWidth={2.2} aria-hidden="true" />
        <p>
          <b>Partager tes photos avec {qui} ?</b> Les binômes qui ont cette plongée dans leur carnet verront tes photos, et seulement eux. Ta réponse
          vaut pour tes prochaines plongées ; tu peux la changer dans Moi › Confidentialité.
        </p>
      </div>
      <div className="flex gap-[10px] pt-[12px]">
        <button
          type="button"
          disabled={envoi}
          onClick={() => void repondre(true)}
          className="h-[40px] flex-1 rounded-full bg-[#3DEFBE] text-[13px] font-bold text-[#0B3B63] disabled:opacity-60"
        >
          Oui, partager
        </button>
        <button
          type="button"
          disabled={envoi}
          onClick={() => void repondre(false)}
          className="h-[40px] flex-1 rounded-full bg-white text-[13px] font-bold text-[#566B82] disabled:opacity-60"
        >
          Non, garder privées
        </button>
      </div>
    </div>
  );
}
