import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { useNavigate } from "@tanstack/react-router";
import { ChevronLeft } from "lucide-react";
import { chargerLot, type Extraction, type Lot, type Page } from "@/lib/numerisation";
import { utilisateurConnecte } from "@/lib/plongees";

// Éléments communs aux écrans de numérisation (maquettes 12 à 17).

// « fixe » : la page prend exactement la hauteur visible de l'écran (le contenu du milieu
// défile, les boutons du bas restent visibles).
export function FondNumerisation({
  children,
  className = "",
  fixe = false,
}: {
  children: ReactNode;
  className?: string;
  fixe?: boolean;
}) {
  return (
    <div
      className={`relative w-full overflow-x-hidden bg-[#F1F6FC] text-[#123A63] ${
        fixe ? "h-screen overflow-y-hidden supports-[height:100dvh]:h-[100dvh]" : "min-h-screen"
      } ${className}`}
    >
      <svg
        aria-hidden="true"
        viewBox="0 0 430 1140"
        preserveAspectRatio="none"
        className="pointer-events-none absolute inset-0 h-full w-full opacity-40"
      >
        <path fill="#E7F1FA" d="M0 0H430V181C352 155 324 197 271 219C174 260 89 212 0 271Z" />
        <path fill="#DCEBF7" opacity=".72" d="M430 111C353 164 389 253 307 278C223 304 93 227 0 293V407C90 345 169 401 270 362C342 334 372 330 430 350Z" />
        <path fill="#DFEDF9" opacity=".65" d="M0 504C85 458 122 491 192 511C285 537 352 451 430 481V647C340 581 244 635 169 601C93 567 62 608 0 632Z" />
        <path fill="#E5F0FA" d="M430 693C308 646 208 743 98 702L0 681V835C132 795 220 826 309 800L430 759Z" />
      </svg>
      <div className={`cascade relative mx-auto flex w-full max-w-[430px] flex-col ${fixe ? "h-full" : "min-h-screen"}`}>{children}</div>
    </div>
  );
}

export function BoutonPrincipal({
  children,
  onClick,
  disabled,
}: {
  children: ReactNode;
  onClick?: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="flex h-14 w-full items-center justify-center rounded-2xl bg-[#3DEFBE] px-4 text-center text-[14px] font-bold uppercase text-[#0B3B63] shadow-[0_4px_12px_#123A630D] disabled:opacity-50"
    >
      {children}
    </button>
  );
}

export function BoutonSecondaire({ children, onClick }: { children: ReactNode; onClick?: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex h-[52px] w-full items-center justify-center rounded-2xl border border-[#57D4F5] bg-white px-4 text-[14px] font-bold uppercase text-[#1176A8]"
    >
      {children}
    </button>
  );
}

export function LienDiscret({ children, onClick }: { children: ReactNode; onClick?: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="mx-auto block text-[13.5px] font-semibold text-[#5B7189] underline underline-offset-4"
    >
      {children}
    </button>
  );
}

export function BoutonRetourCarre({ onClick, label = "Retour" }: { onClick: () => void; label?: string }) {
  return (
    <button
      type="button"
      aria-label={label}
      onClick={onClick}
      className="flex h-10 w-10 items-center justify-center rounded-[14px] bg-[#E3EDF6]"
    >
      <ChevronLeft className="h-[18px] w-[18px] text-[#123A63]" strokeWidth={2.4} />
    </button>
  );
}

export function Meduse({ className = "" }: { className?: string }) {
  return (
    <span aria-hidden="true" className={`pointer-events-none absolute h-[44px] w-[24px] ${className}`}>
      <svg viewBox="0 0 48 87" className="h-full w-full">
        <path d="M5 26C5 11 13 4 24 4S43 12 43 26Q39 29 35 26Q30 31 25 26Q20 30 15 26Q9 30 5 26" fill="#6FD7BF" />
        <g fill="none" stroke="#6FD7BF" strokeWidth={3.6} strokeLinecap="round">
          <path d="M12 27C12 44 3 44 8 59S11 69 6 79" />
          <path d="M20 28C23 45 12 48 17 64S17 76 15 84" />
          <path d="M28 28C33 44 22 47 28 62S34 72 30 80" />
          <path d="M36 28C42 38 31 47 38 55S42 65 40 69" />
        </g>
      </svg>
    </span>
  );
}

// La numérisation enregistre dans le compte : il faut être connecté.
export function useConnexionRequise() {
  const navigate = useNavigate();
  const [ok, setOk] = useState<boolean | null>(null);
  useEffect(() => {
    void utilisateurConnecte().then((u) => setOk(Boolean(u)));
  }, []);
  const ecran =
    ok === false ? (
      <FondNumerisation>
        <div className="flex flex-grow flex-col items-center justify-center gap-4 px-8 text-center">
          <h1 className="text-[22px] font-bold">Connecte-toi pour numériser</h1>
          <p className="text-[14px] leading-normal text-[#5B7189]">
            Les pages et les plongées lues sont enregistrées dans ton compte, pour que rien ne se perde.
          </p>
          <div className="w-full pt-2">
            <BoutonPrincipal onClick={() => navigate({ to: "/connexion" })}>Me connecter</BoutonPrincipal>
          </div>
          <LienDiscret onClick={() => navigate({ to: "/carnet" })}>Revenir à l'accueil</LienDiscret>
        </div>
      </FondNumerisation>
    ) : null;
  return { pret: ok === true, ecran };
}

// Charge un carnet et se met à jour régulièrement tant que des pages sont en lecture.
export function useLot(lotId: string | undefined, suivre = true) {
  const [donnees, setDonnees] = useState<{ lot: Lot; pages: Page[]; extractions: Extraction[] } | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);
  const actif = useRef(true);

  const recharger = useCallback(async () => {
    if (!lotId) return;
    try {
      const d = await chargerLot(lotId);
      if (actif.current) setDonnees(d);
    } catch (e) {
      console.error(e);
      if (actif.current) setErreur("Ce carnet n'a pas pu être chargé.");
    }
  }, [lotId]);

  useEffect(() => {
    actif.current = true;
    void recharger();
    return () => {
      actif.current = false;
    };
  }, [recharger]);

  const enLecture = donnees?.pages.some((p) => p.statut === "en_attente" || p.statut === "en_cours") ?? false;
  useEffect(() => {
    if (!suivre || !enLecture) return;
    const t = setInterval(() => void recharger(), 3000);
    return () => clearInterval(t);
  }, [suivre, enLecture, recharger]);

  return { donnees, erreur, recharger };
}

// Valide le paramètre ?lot= des routes de numérisation.
export const rechercheLot = (search: Record<string, unknown>): { lot?: string } =>
  typeof search["lot"] === "string" && search["lot"] ? { lot: search["lot"] } : {};
