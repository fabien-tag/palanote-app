// Pictos de la barre d'onglets, dessinés pour Palanote (trait arrondi, univers plongée).
// Carnet : un carnet relié avec deux bulles. Carte : un repère posé sur les vagues.
// Amis : deux masques de plongée. Moi : un masque de plongée.

type Props = { className?: string };

const trait = { fill: "none", stroke: "currentColor", strokeWidth: 1.8, strokeLinecap: "round", strokeLinejoin: "round" } as const;

export function IconeCarnet({ className }: Props) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden="true">
      <rect x="5" y="3" width="14.5" height="18" rx="2.6" {...trait} />
      <path d="M8.6 3.2v17.6" {...trait} />
      <circle cx="13.6" cy="9" r="1.15" fill="currentColor" />
      <circle cx="15.9" cy="11.7" r="0.75" fill="currentColor" />
    </svg>
  );
}

export function IconeCarte({ className }: Props) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden="true">
      <path d="M12 15.6s5-4.5 5-8.5a5 5 0 0 0-10 0c0 4 5 8.5 5 8.5Z" {...trait} />
      <circle cx="12" cy="7.2" r="1.8" {...trait} />
      <path d="M3.8 19.6c1.37 0 1.37 1 2.74 1s1.37-1 2.74-1 1.37 1 2.72 1 1.37-1 2.74-1 1.37 1 2.74 1 1.37-1 2.72-1" {...trait} />
    </svg>
  );
}

// Un masque : deux verres reliés par le pont du nez, et les attaches de la sangle.
const MASQUE =
  "M5.2 8h13.6a2.7 2.7 0 0 1 2.7 2.7v2.1a2.9 2.9 0 0 1-2.9 2.9h-2.5a1.9 1.9 0 0 1-1.6-.9l-.6-.9a1.1 1.1 0 0 0-1.8 0l-.6.9a1.9 1.9 0 0 1-1.6.9H5.4a2.9 2.9 0 0 1-2.9-2.9v-2.1A2.7 2.7 0 0 1 5.2 8Z";

export function IconeMoi({ className }: Props) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden="true">
      <path d={MASQUE} {...trait} />
      <path d="M2.5 11.5H1.2M21.5 11.5h1.3" {...trait} />
    </svg>
  );
}

export function IconeAmis({ className }: Props) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden="true">
      <g transform="translate(-0.4 0.4) scale(0.74)">
        <path d={MASQUE} {...trait} strokeWidth={2.6} />
      </g>
      <g transform="translate(6.6 8) scale(0.74)">
        <path d={MASQUE} {...trait} strokeWidth={2.6} />
      </g>
    </svg>
  );
}

// Sorties (directeurs de plongée) : une ancre, avec sa barre et ses deux pattes.
export function IconeSorties({ className }: Props) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden="true">
      <circle cx="12" cy="4.6" r="1.9" {...trait} />
      <path d="M12 6.5v14.2" {...trait} />
      <path d="M8.2 10h7.6" {...trait} />
      <path d="M4.4 13.6c.4 4 3.6 7.1 7.6 7.1s7.2-3.1 7.6-7.1" {...trait} />
      <path d="M2.9 15.1l1.5-1.5 1.5 1.5M18.1 15.1l1.5-1.5 1.5 1.5" {...trait} />
    </svg>
  );
}
