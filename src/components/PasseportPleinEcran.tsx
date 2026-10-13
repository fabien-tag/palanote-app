import { useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { BadgeCheck, X } from "lucide-react";
import { etatCertificat, TYPES_BREVET, type Brevet, type Passeport } from "@/lib/passeport";

const dateLongue = (d: string) => new Date(`${d}T12:00:00`).toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" });
const libelleType = (t: string) => TYPES_BREVET.find((x) => x.id === t)?.libelle ?? t;

// Le passeport en grand, à tendre au DP sur le bateau : gros caractères, cartes en photo
export function PasseportPleinEcran({
  p,
  photos,
  onFermer,
  verification,
  bureau,
}: {
  p: Passeport;
  photos: Record<string, string>;
  onFermer: () => void;
  verification?: ((b: Brevet) => ReactNode) | undefined;
  bureau?: boolean; // côté DP : même radius partout
}) {
  const [zoom, setZoom] = useState<string | null>(null);
  const etat = etatCertificat(p.certificat_fin);
  // Rendu à la racine de la page : le fondu des pages DP ne doit pas l'enfermer
  if (typeof document === "undefined") return null;
  return createPortal(
    <div className={`${bureau ? "bureau " : ""}fixed inset-0 z-[70] overflow-y-auto bg-white text-[#123A63]`} role="dialog" aria-modal="true" aria-label={`Passeport de ${p.prenom}`}>
      <div className="mx-auto max-w-[520px] px-[22px] pb-[30px] pt-[18px]">
        <div className="flex items-center justify-between">
          <span className="text-[12px] font-bold uppercase tracking-[.14em] text-[#1176A8]">Passeport de plongée · Palanote</span>
          <button type="button" aria-label="Fermer" onClick={onFermer} className="flex h-10 w-10 items-center justify-center rounded-full bg-[#EEF3F8]">
            <X className="h-[18px] w-[18px]" />
          </button>
        </div>
        <p className="pt-[16px] text-[34px] font-bold leading-tight">{p.prenom}</p>
        <p className="text-[22px] font-bold text-[#1176A8]">{p.niveau ?? "Niveau non renseigné"}</p>
        <p
          className={`mt-[12px] rounded-[12px] px-[12px] py-[10px] text-[16px] font-bold ${
            etat === "valide" ? "bg-[#E2F8EF] text-[#14805F]" : etat === "bientot" ? "bg-[#FFF1D6] text-[#8A5A10]" : "bg-[#FFE9E2] text-[#D9573F]"
          }`}
        >
          {etat === "absent" ? "Certificat médical : date non renseignée" : etat === "expire" ? `Certificat médical expiré (${dateLongue(p.certificat_fin!)})` : `Certificat médical valable jusqu'au ${dateLongue(p.certificat_fin!)}`}
        </p>
        <div className="flex flex-col gap-[16px] pt-[18px]">
          {p.brevets.map((b) => (
            <div key={b.id} className="rounded-[14px] border border-[#E4EBF1] p-[12px]">
              <div className="flex items-start gap-[8px]">
                <span className="min-w-0 flex-1">
                  <span className="block text-[20px] font-bold leading-tight">{b.intitule}</span>
                  <span className="block text-[14px] text-[#5B7189]">
                    {[libelleType(b.type), b.organisme, b.numero ? `n° ${b.numero}` : null, b.obtenu_le ? dateLongue(b.obtenu_le) : null].filter(Boolean).join(" · ")}
                  </span>
                </span>
                {b.verifie_le && (
                  <span className="flex shrink-0 items-center gap-[4px] rounded-[10px] bg-[#E2F8EF] px-[8px] py-[3px] text-[12px] font-bold text-[#14805F]">
                    <BadgeCheck className="h-[14px] w-[14px]" /> Vérifiée
                  </span>
                )}
              </div>
              {(b.photo_recto || b.photo_verso) && (
                <div className="grid grid-cols-2 gap-[8px] pt-[10px]">
                  {[b.photo_recto, b.photo_verso].map((c, i) =>
                    c && photos[c] ? (
                      <button key={i} type="button" onClick={() => setZoom(photos[c]!)} className="overflow-hidden rounded-[10px] border border-[#E4EBF1]">
                        <img src={photos[c]} alt={`${b.intitule} ${i === 0 ? "recto" : "verso"}`} className="aspect-[1.586] w-full object-cover" />
                      </button>
                    ) : null,
                  )}
                </div>
              )}
              {b.verifie_le && (
                <p className="pt-[8px] text-[12.5px] text-[#14805F]">
                  Vérifiée par {b.verifie_par}
                  {b.verifie_centre ? ` (${b.verifie_centre})` : ""} le {new Date(b.verifie_le).toLocaleDateString("fr-FR")}
                </p>
              )}
              {verification?.(b)}
            </div>
          ))}
          {p.brevets.length === 0 && <p className="text-[15px] text-[#5B7189]">Aucun brevet enregistré.</p>}
        </div>
      </div>
      {zoom && (
        <button type="button" aria-label="Fermer la photo" onClick={() => setZoom(null)} className="fixed inset-0 z-[70] flex items-center justify-center bg-black/85 p-[16px]">
          <img src={zoom} alt="Carte en grand" className="max-h-full max-w-full rounded-[10px]" />
        </button>
      )}
    </div>,
    document.body,
  );
}
