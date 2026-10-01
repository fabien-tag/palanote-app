import { useState, type ReactNode } from "react";
import { useNavigate } from "@tanstack/react-router";
import { ChevronLeft, ChevronRight, type LucideIcon } from "lucide-react";

// Briques communes aux écrans de l'onglet Moi (maquettes 48 à 50).

export function PageMoi({ titre, children }: { titre: string; children: ReactNode }) {
  const navigate = useNavigate();
  return (
    <div className="min-h-screen bg-[#F5F9FC] text-[#123A63]">
      <div className="cascade mx-auto flex min-h-screen w-full max-w-[430px] flex-col px-[22px] pb-[max(28px,env(safe-area-inset-bottom))] pt-[clamp(14px,2.6svh,22px)]">
        <div className="flex items-center gap-[14px]">
          <button
            type="button"
            aria-label="Retour"
            onClick={() => navigate({ to: "/moi" })}
            className="flex h-10 w-10 items-center justify-center rounded-[13px] bg-[#E3EDF6]"
          >
            <ChevronLeft className="h-[18px] w-[18px]" strokeWidth={2.4} />
          </button>
          <h1 className="text-[24px] font-bold">{titre}</h1>
        </div>
        {children}
      </div>
    </div>
  );
}

export function TitreSection({ children }: { children: ReactNode }) {
  return <h2 className="pb-[10px] pt-[26px] text-[11px] font-bold uppercase tracking-[.08em] text-[#7D93A8]">{children}</h2>;
}

export function Bloc({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <div className={`overflow-hidden rounded-[20px] border border-[#E4EBF1] bg-white px-[16px] shadow-[0_4px_14px_#123A6306] ${className}`}>
      {children}
    </div>
  );
}

export function Note({ children }: { children: ReactNode }) {
  return <p className="pt-[10px] text-[12.5px] leading-normal text-[#5B7189]">{children}</p>;
}

export function TagBientot() {
  return <span className="rounded-[10px] bg-[#FFE6CC] px-[8px] py-[2px] text-[10.5px] font-semibold text-[#C2570C]">Bientôt</span>;
}

export function Ligne({
  icone: Icone,
  label,
  valeur,
  onClick,
  bientot,
  danger,
  chevron = true,
}: {
  icone?: LucideIcon;
  label: ReactNode;
  valeur?: ReactNode | undefined;
  onClick?: (() => void) | undefined;
  bientot?: boolean;
  danger?: boolean;
  chevron?: boolean;
}) {
  const contenu = (
    <>
      {Icone && (
        <span className="flex h-[36px] w-[36px] shrink-0 items-center justify-center rounded-[11px] bg-[#EEF4F9]">
          <Icone className={`h-[17px] w-[17px] ${danger ? "text-[#C94957]" : "text-[#123A63]"}`} strokeWidth={2} aria-hidden="true" />
        </span>
      )}
      <span className={`min-w-0 flex-1 text-[14.5px] font-bold ${danger ? "text-[#C94957]" : ""}`}>{label}</span>
      {valeur !== undefined && <span className="max-w-[45%] truncate text-[12.5px] text-[#9DB0C0]">{valeur}</span>}
      {bientot && <TagBientot />}
      {onClick && chevron && !bientot && <ChevronRight className="h-[16px] w-[16px] shrink-0 text-[#9DB0C0]" aria-hidden="true" />}
    </>
  );
  const classe = "flex min-h-[64px] w-full items-center gap-[12px] border-t border-[#EDF2F7] py-[12px] text-left first:border-t-0";
  if (!onClick || bientot) return <div className={`${classe} ${bientot ? "opacity-70" : ""}`}>{contenu}</div>;
  return (
    <button type="button" onClick={onClick} className={classe}>
      {contenu}
    </button>
  );
}

export function Interrupteur({
  titre,
  texte,
  actif,
  onChange,
  desactive,
}: {
  titre: string;
  texte?: ReactNode;
  actif: boolean;
  onChange: (v: boolean) => void;
  desactive?: boolean;
}) {
  return (
    <div className="flex items-center gap-[14px] border-t border-[#EDF2F7] py-[15px] first:border-t-0">
      <div className="min-w-0 flex-1">
        <div className="text-[14.5px] font-bold leading-snug">{titre}</div>
        {texte && <div className="pt-[3px] text-[12.5px] leading-normal text-[#5B7189]">{texte}</div>}
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={actif}
        aria-label={titre}
        disabled={desactive}
        onClick={() => onChange(!actif)}
        className={`relative h-[30px] w-[50px] shrink-0 rounded-full transition-colors disabled:opacity-50 ${actif ? "bg-[#3DEFBE]" : "bg-[#D5DFE8]"}`}
      >
        <span
          className={`absolute top-[3px] h-[24px] w-[24px] rounded-full bg-white shadow-[0_2px_5px_rgba(15,61,112,.25)] transition-all ${actif ? "left-[23px]" : "left-[3px]"}`}
        />
      </button>
    </div>
  );
}

// Confirmation forte avant de supprimer le compte : il faut taper SUPPRIMER.
export function ModaleSuppressionCompte({
  onAnnuler,
  onConfirmer,
  enCours,
  erreur,
}: {
  onAnnuler: () => void;
  onConfirmer: () => void;
  enCours: boolean;
  erreur: string | null;
}) {
  const [saisie, setSaisie] = useState("");
  const ok = saisie.trim().toUpperCase() === "SUPPRIMER";
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-[#0A2A50]/55 px-4 pb-[max(16px,env(safe-area-inset-bottom))] sm:items-center">
      <div role="dialog" aria-modal="true" className="w-full max-w-[398px] rounded-[24px] bg-white p-[20px] text-[#123A63] shadow-[0_18px_40px_rgba(10,42,80,.35)]">
        <h2 className="text-[19px] font-bold">Supprimer ton compte ?</h2>
        <p className="pt-[8px] text-[13.5px] leading-normal text-[#5B7189]">
          Tes plongées, tes photos, tes positions, tes binômes et ton compte seront effacés. Rien n'est gardé, rien n'est récupérable.
        </p>
        <label className="block pt-[14px] text-[12.5px] font-semibold text-[#5B7189]">
          Pour confirmer, tape <b className="text-[#C94957]">SUPPRIMER</b>
          <input
            value={saisie}
            onChange={(e) => setSaisie(e.target.value)}
            autoCapitalize="characters"
            className="mt-[6px] block h-[48px] w-full rounded-[14px] border-[1.5px] border-[#E4EBF1] px-[14px] text-[15px] font-semibold outline-none focus:border-[#C94957]"
          />
        </label>
        {erreur && <p className="pt-[10px] text-[13px] text-[#8A2A1A]">{erreur}</p>}
        <div className="flex flex-col gap-[10px] pt-[16px]">
          <button
            type="button"
            disabled={!ok || enCours}
            onClick={onConfirmer}
            className="flex h-[50px] items-center justify-center rounded-[16px] bg-[#C94957] text-[14px] font-bold text-white disabled:opacity-40"
          >
            {enCours ? "SUPPRESSION…" : "SUPPRIMER DÉFINITIVEMENT"}
          </button>
          <button type="button" onClick={onAnnuler} disabled={enCours} className="h-[44px] text-[14px] font-bold text-[#1176A8]">
            Annuler
          </button>
        </div>
      </div>
    </div>
  );
}
