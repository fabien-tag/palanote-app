import { useCallback, useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { BadgeCheck } from "lucide-react";
import { PasseportPleinEcran } from "@/components/PasseportPleinEcran";
import { chargerPasseport, urlsPhotos, verifierBrevet, type Passeport } from "@/lib/passeport";

// Le DP ouvre le passeport d'un inscrit depuis sa sortie, et marque les cartes qu'il a vues
export function PasseportDp({ userId, onFermer, onChange }: { userId: string; onFermer: () => void; onChange?: () => void }) {
  const [p, setP] = useState<Passeport | null>(null);
  const [photos, setPhotos] = useState<Record<string, string>>({});
  const [erreur, setErreur] = useState<string | null>(null);
  const [enCours, setEnCours] = useState<string | null>(null);

  const charger = useCallback(async () => {
    try {
      const d = await chargerPasseport(userId);
      setP(d);
      setPhotos(await urlsPhotos(d.brevets.flatMap((b) => [b.photo_recto, b.photo_verso])));
    } catch (e) {
      console.error(e);
      setErreur("Ce passeport n'est pas accessible (le script du passeport est-il lancé ?).");
    }
  }, [userId]);

  useEffect(() => {
    void charger();
  }, [charger]);

  useEffect(() => {
    const k = (e: KeyboardEvent) => e.key === "Escape" && onFermer();
    window.addEventListener("keydown", k);
    return () => window.removeEventListener("keydown", k);
  }, [onFermer]);

  if (!p) {
    if (typeof document === "undefined") return null;
    return createPortal(
      <div className="bureau fixed inset-0 z-[70] flex items-center justify-center bg-[#0B2540]/40 p-[20px]" role="dialog" aria-modal="true">
        <div className="w-full max-w-[360px] rounded-[10px] bg-white p-[20px] text-center text-[14px] text-[#566B82]">
          {erreur ?? "Chargement du passeport…"}
          {erreur && (
            <button type="button" onClick={onFermer} className="mt-[14px] block w-full rounded-[10px] bg-[#EEF3F8] py-[10px] font-bold text-[#123A63]">
              Fermer
            </button>
          )}
        </div>
      </div>,
      document.body,
    );
  }

  return (
    <PasseportPleinEcran
      p={p}
      photos={photos}
      onFermer={onFermer}
      bureau
      verification={(b) => (
        <button
          type="button"
          disabled={enCours === b.id}
          onClick={async () => {
            setEnCours(b.id);
            try {
              await verifierBrevet(b.id, !b.verifie_le);
              await charger();
              onChange?.();
            } catch (e) {
              console.error(e);
            }
            setEnCours(null);
          }}
          className={`mt-[10px] flex h-[42px] w-full items-center justify-center gap-[6px] rounded-[10px] text-[14px] font-bold ${
            b.verifie_le ? "border border-[#D8E5EE] bg-white text-[#566B82]" : "bg-[#14805F] text-white"
          }`}
        >
          <BadgeCheck className="h-[17px] w-[17px]" />
          {enCours === b.id ? "…" : b.verifie_le ? "Retirer la vérification" : "J'ai vu la carte : vérifiée"}
        </button>
      )}
    />
  );
}
