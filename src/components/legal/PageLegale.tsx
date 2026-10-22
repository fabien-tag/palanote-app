import type { ReactNode } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { ChevronLeft } from "lucide-react";
import { DATE_CONDITIONS, EDITEUR } from "@/lib/legal";

// Gabarit commun des pages légales : page interne (pas de bandeau bleu),
// lisible sur téléphone, accessible sans être connecté.
export function PageLegale({ titre, intro, children }: { titre: string; intro?: string; children: ReactNode }) {
  const navigate = useNavigate();
  const retour = () => (window.history.length > 1 ? window.history.back() : navigate({ to: "/" }));
  return (
    <div className="min-h-screen bg-[#F1F6FC] text-[#123A63]">
      <div className="mx-auto flex min-h-screen w-full max-w-[430px] flex-col px-[22px] pb-[max(32px,env(safe-area-inset-bottom))] pt-[clamp(14px,2.6svh,22px)]">
        <div className="flex items-center">
          <button type="button" aria-label="Retour" onClick={retour} className="flex h-10 w-10 items-center justify-center goutte bg-[#E3EDF6]">
            <ChevronLeft className="h-[18px] w-[18px]" strokeWidth={2.4} />
          </button>
        </div>
        <h1 className="pt-[12px] text-[26px] font-bold leading-tight">{titre}</h1>
        <p className="pt-[4px] text-[12.5px] text-[#566B82]">Mise à jour le {DATE_CONDITIONS}</p>
        {intro && <p className="pt-[12px] text-[14.5px] leading-relaxed text-[#3F5B76]">{intro}</p>}
        <div className="mt-[16px] flex flex-col gap-[12px]">{children}</div>
        <nav className="mt-[22px] flex flex-wrap justify-center gap-x-[14px] gap-y-[6px] text-[12.5px] font-semibold text-[#106F9F]">
          <Link to="/mentions-legales">Mentions légales</Link>
          <Link to="/politique-de-confidentialite">Confidentialité</Link>
          <Link to="/conditions-utilisation">Conditions d'utilisation</Link>
        </nav>
      </div>
    </div>
  );
}

export function Bloc({ titre, children }: { titre: string; children: ReactNode }) {
  return (
    <section className="galet-b border border-[#DCE7F0] bg-white px-[16px] py-[14px] shadow-[0_4px_14px_#123A6308]">
      <h2 className="text-[15.5px] font-bold">{titre}</h2>
      <div className="flex flex-col gap-[8px] pt-[6px] text-[14px] leading-relaxed text-[#3F5B76] [&_b]:text-[#123A63]">{children}</div>
    </section>
  );
}

export function Puces({ items }: { items: ReactNode[] }) {
  return (
    <ul className="flex flex-col gap-[5px]">
      {items.map((it, i) => (
        <li key={i} className="flex gap-[8px]">
          <span aria-hidden="true" className="mt-[9px] h-[5px] w-[5px] shrink-0 rounded-full bg-[#57B8E6]" />
          <span>{it}</span>
        </li>
      ))}
    </ul>
  );
}

// L'adresse de contact, ou ce qu'on affiche tant qu'elle n'existe pas
export function Contact() {
  return EDITEUR.email ? (
    <a href={`mailto:${EDITEUR.email}`} className="font-semibold text-[#106F9F] underline underline-offset-2">
      {EDITEUR.email}
    </a>
  ) : (
    <span>
      depuis l'app, <b>Moi › Dis-moi ce qui manque</b> (adresse e-mail bientôt disponible)
    </span>
  );
}
