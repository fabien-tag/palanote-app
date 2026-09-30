import { useState } from "react";
import { Eye, EyeOff } from "lucide-react";

export function ChampMotDePasse({
  id,
  value,
  onChange,
  placeholder,
  autoComplete = "current-password",
}: {
  id: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  autoComplete?: string;
}) {
  const [visible, setVisible] = useState(false);
  return (
    <div className="relative mt-2">
      <input
        id={id}
        type={visible ? "text" : "password"}
        required
        autoComplete={autoComplete}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="min-h-[52px] w-full rounded-[14px] border-0 bg-blanc px-4 pr-12 text-base text-foreground outline-none focus:border-lagon"
      />
      <button
        type="button"
        onClick={() => setVisible((v) => !v)}
        aria-label={visible ? "Masquer le mot de passe" : "Afficher le mot de passe"}
        aria-pressed={visible}
        className="absolute top-1/2 right-1 flex min-h-[44px] min-w-[44px] -translate-y-1/2 items-center justify-center text-encre/60"
      >
        {visible ? (
          <EyeOff className="h-5 w-5" aria-hidden />
        ) : (
          <Eye className="h-5 w-5" aria-hidden />
        )}
      </button>
    </div>
  );
}
