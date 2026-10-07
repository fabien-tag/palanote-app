import { Link } from "@tanstack/react-router";
import { Check } from "lucide-react";

// Case à cocher de l'inscription (non cochée par défaut).
// Les liens ne cochent pas la case : seul le texte autour le fait.
export function CaseConditions({
  cochee,
  onChange,
  erreur,
  avantLien,
}: {
  cochee: boolean;
  onChange: (v: boolean) => void;
  erreur?: boolean;
  avantLien?: () => void;
}) {
  return (
    <div>
      <label className="flex cursor-pointer items-start gap-[10px] text-[13px] leading-snug text-blanc/85">
        <input type="checkbox" checked={cochee} onChange={(e) => onChange(e.target.checked)} className="peer sr-only" />
        <span
          aria-hidden="true"
          className={`mt-[1px] flex h-[22px] w-[22px] shrink-0 items-center justify-center rounded-[7px] border-[1.5px] transition-colors peer-focus-visible:ring-2 peer-focus-visible:ring-lagon ${
            cochee ? "border-menthe bg-menthe" : erreur ? "border-corail bg-blanc/10" : "border-blanc/50 bg-blanc/10"
          }`}
        >
          {cochee && <Check className="h-[15px] w-[15px] text-abyss" strokeWidth={3} />}
        </span>
        <span>
          J'accepte les{" "}
          <Link to="/conditions-utilisation" onClick={avantLien} className="font-semibold text-blanc underline underline-offset-2">
            conditions d'utilisation
          </Link>{" "}
          et j'ai lu la{" "}
          <Link to="/politique-de-confidentialite" onClick={avantLien} className="font-semibold text-blanc underline underline-offset-2">
            politique de confidentialité
          </Link>
          .
        </span>
      </label>
      {erreur && (
        <p role="alert" className="mt-2 pl-[32px] text-xs font-medium text-corail">
          Coche la case pour créer ton compte.
        </p>
      )}
    </div>
  );
}
