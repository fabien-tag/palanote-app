import { useEffect, useRef, useState } from "react";
import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { Check } from "lucide-react";
import { signOut } from "@/lib/auth";
import { accepterConditions, verifierConditions } from "@/lib/legal";
import { supabase } from "@/lib/supabase";

// Pages où on ne demande rien : on n'est pas encore entré dans l'app.
const PAGES_LIBRES = [
  "/",
  "/connexion",
  "/creer-un-compte",
  "/profil-plongeur",
  "/compte-cree",
  "/mot-de-passe-oublie",
  "/nouveau-mot-de-passe",
  "/desabonnement",
  "/mentions-legales",
  "/politique-de-confidentialite",
  "/conditions-utilisation",
];

// Demande d'accepter les conditions à ceux qui ne l'ont pas encore fait :
// comptes créés avant les pages légales, connexion Google directe, nouvelle version des conditions.
// Ceux qui ont coché la case à l'inscription ne voient rien : l'accord est enregistré en silence.
export function FeuilleConditions() {
  const navigate = useNavigate();
  const chemin = useRouterState({ select: (s) => s.location.pathname });
  const [aDemander, setADemander] = useState(false);
  const [cochee, setCochee] = useState(false);
  const [envoi, setEnvoi] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);
  const verifie = useRef<string | null>(null);

  useEffect(() => {
    const { data } = supabase.auth.onAuthStateChange((evenement, session) => {
      if (!session) {
        verifie.current = null;
        setADemander(false);
        return;
      }
      if (evenement !== "INITIAL_SESSION" && evenement !== "SIGNED_IN") return;
      if (verifie.current === session.user.id) return;
      verifie.current = session.user.id;
      const meta = session.user.user_metadata as Record<string, unknown> | undefined;
      // Hors du rappel : on ne bloque pas le client d'authentification
      setTimeout(() => {
        void verifierConditions(meta)
          .then(setADemander)
          .catch(() => undefined);
      }, 0);
    });
    return () => data.subscription.unsubscribe();
  }, []);

  if (!aDemander || PAGES_LIBRES.includes(chemin) || chemin.startsWith("/clubs/")) return null; // le site d'un club est public

  const accepter = async () => {
    setEnvoi(true);
    setErreur(null);
    try {
      await accepterConditions();
      setADemander(false);
    } catch {
      setErreur("L'enregistrement n'a pas abouti. Réessaie.");
    } finally {
      setEnvoi(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center" role="dialog" aria-modal="true" aria-labelledby="titre-conditions">
      <div className="absolute inset-0 bg-[#06203F]/55" aria-hidden="true" />
      <div className="relative w-full max-w-[430px] rounded-t-[34px] bg-white px-[24px] pb-[max(26px,env(safe-area-inset-bottom))] pt-[14px] text-[#123A63] shadow-[0_-10px_30px_rgba(6,32,63,.18)]">
        <div className="mx-auto mb-[16px] h-[5px] w-[44px] rounded-full bg-[#DCE7F0]" aria-hidden="true" />
        <h2 id="titre-conditions" className="text-[22px] font-bold leading-tight">
          Avant de continuer
        </h2>
        <p className="pt-[8px] text-[14px] leading-normal text-[#5B7189]">
          Palanote a maintenant ses conditions d'utilisation et sa politique de confidentialité. Prends une minute pour les lire : elles
          disent ce qu'on fait de ton carnet, et surtout ce qu'on n'en fait pas.
        </p>

        <label className="mt-[18px] flex cursor-pointer items-start gap-[10px] text-[14px] leading-snug">
          <input type="checkbox" checked={cochee} onChange={(e) => setCochee(e.target.checked)} className="peer sr-only" />
          <span
            aria-hidden="true"
            className={`mt-[1px] flex h-[22px] w-[22px] shrink-0 items-center justify-center rounded-[7px] border-[1.5px] transition-colors peer-focus-visible:ring-2 peer-focus-visible:ring-[#57B8E6] ${
              cochee ? "border-[#3DEFBE] bg-[#3DEFBE]" : "border-[#C9D9E6] bg-white"
            }`}
          >
            {cochee && <Check className="h-[15px] w-[15px] text-[#0B3B63]" strokeWidth={3} />}
          </span>
          <span>
            J'accepte les{" "}
            <Link to="/conditions-utilisation" className="font-semibold text-[#1176A8] underline underline-offset-2">
              conditions d'utilisation
            </Link>{" "}
            et j'ai lu la{" "}
            <Link to="/politique-de-confidentialite" className="font-semibold text-[#1176A8] underline underline-offset-2">
              politique de confidentialité
            </Link>
            .
          </span>
        </label>

        {erreur && (
          <p role="alert" className="pt-[10px] text-[13px] font-medium text-[#8A2A1A]">
            {erreur}
          </p>
        )}

        <button
          type="button"
          disabled={!cochee || envoi}
          onClick={() => void accepter()}
          className="mt-[20px] flex h-[56px] w-full items-center justify-center galet-moyen bg-[#3DEFBE] text-[14px] font-bold tracking-wide text-[#0B3B63] disabled:opacity-50"
        >
          {envoi ? "UN INSTANT…" : "CONTINUER"}
        </button>
        <button
          type="button"
          onClick={() => void signOut().then(() => navigate({ to: "/" }))}
          className="mx-auto mt-[10px] block px-[8px] py-[8px] text-[14px] font-semibold text-[#5B7189]"
        >
          Me déconnecter
        </button>
      </div>
    </div>
  );
}
