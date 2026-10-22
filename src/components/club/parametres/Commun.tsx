import type { ReactNode } from "react";

// Briques des Paramètres du DP, pensées pour l'ordinateur :
// une carte par sujet, des rangées « libellé à gauche, réglage à droite »,
// qui se replient en colonne sur téléphone.

export const CHAMP =
  "block h-[44px] w-full min-w-0 rounded-[10px] border-[1.5px] border-[#7B8FA3] bg-white px-[13px] text-[14px] text-[#123A63] outline-none placeholder:text-[#B5C4D1] focus:border-[#57D4F5] disabled:bg-[#F5F8FB] disabled:text-[#566B82]";

export const BOUTON_PRINCIPAL =
  "inline-flex h-[42px] items-center justify-center gap-[6px] rounded-[10px] bg-[#3DEFBE] px-[18px] text-[13px] font-bold text-[#0B3B63] hover:bg-[#34E0B1] disabled:opacity-40";

export const BOUTON_SECONDAIRE =
  "inline-flex h-[42px] items-center justify-center gap-[6px] rounded-[10px] border border-[#D8E5EE] bg-white px-[16px] text-[13px] font-bold text-[#566B82] hover:border-[#57D4F5] hover:text-[#106F9F] disabled:opacity-40";

export function Carte({
  titre,
  texte,
  droite,
  children,
  pied,
  danger = false,
}: {
  titre: string;
  texte?: ReactNode;
  droite?: ReactNode;
  children: ReactNode;
  pied?: ReactNode;
  danger?: boolean;
}) {
  return (
    <section className={`overflow-hidden rounded-[14px] border bg-white ${danger ? "border-[#F5C9BF]" : "border-[#E4EBF1]"}`}>
      <header className="flex flex-wrap items-start gap-[12px] border-b border-[#EDF2F7] px-[18px] py-[16px] lg:px-[24px]">
        <div className="min-w-0 flex-1">
          <h2 className={`text-[16px] font-bold ${danger ? "text-[#B8432F]" : ""}`}>{titre}</h2>
          {texte && <p className="pt-[3px] text-[13px] leading-normal text-[#566B82]">{texte}</p>}
        </div>
        {droite}
      </header>
      <div className="px-[18px] lg:px-[24px]">{children}</div>
      {pied && <footer className="flex flex-wrap items-center gap-[12px] border-t border-[#EDF2F7] bg-[#FAFCFE] px-[18px] py-[14px] lg:px-[24px]">{pied}</footer>}
    </section>
  );
}

// Une rangée : libellé et explication à gauche, le réglage à droite (ordinateur)
export function Rang({ titre, texte, children }: { titre: string; texte?: ReactNode; children: ReactNode }) {
  return (
    <div className="grid grid-cols-1 gap-[10px] border-t border-[#EDF2F7] py-[18px] first:border-t-0 lg:grid-cols-[minmax(200px,280px)_1fr] lg:gap-[32px]">
      <div>
        <div className="text-[14px] font-bold">{titre}</div>
        {texte && <div className="pt-[3px] text-[12.5px] leading-normal text-[#566B82]">{texte}</div>}
      </div>
      <div className="min-w-0">{children}</div>
    </div>
  );
}

export function Libelle({ texte, children }: { texte: string; children: ReactNode }) {
  return (
    <label className="block min-w-0">
      <span className="block pb-[6px] text-[12.5px] font-semibold text-[#566B82]">{texte}</span>
      {children}
    </label>
  );
}

export function Puces<T extends string>({
  options,
  choisies,
  onChange,
}: {
  options: { valeur: T; label: string }[];
  choisies: T[];
  onChange: (valeur: T) => void;
}) {
  return (
    <div className="flex flex-wrap gap-[8px]">
      {options.map((o) => {
        const actif = choisies.includes(o.valeur);
        return (
          <button
            key={o.valeur}
            type="button"
            aria-pressed={actif}
            onClick={() => onChange(o.valeur)}
            className={`h-[36px] rounded-[10px] border-[1.5px] px-[13px] text-[13px] font-semibold ${
              actif ? "border-[#3DEFBE] bg-[#E2F8EF] text-[#0B3B63]" : "border-[#E4EBF1] bg-white text-[#566B82] hover:border-[#B8D9EA]"
            }`}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

export function Bascule({ actif, onChange, label }: { actif: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={actif}
      aria-label={label}
      onClick={() => onChange(!actif)}
      className={`relative h-[26px] w-[44px] shrink-0 rounded-full transition-colors ${actif ? "bg-[#3DEFBE]" : "bg-[#D5DFE8]"}`}
    >
      <span className={`absolute top-[3px] h-[20px] w-[20px] rounded-full bg-white shadow-[0_2px_5px_rgba(15,61,112,.25)] transition-all ${actif ? "left-[21px]" : "left-[3px]"}`} />
    </button>
  );
}
