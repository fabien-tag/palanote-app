import { useEffect, useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { LogOut } from "lucide-react";
import logoCorail from "@/assets/palanote-logo-cigle.png";
import { signOut } from "@/lib/auth";
import { supabase } from "@/lib/supabase";
import { BarreNavigation } from "@/components/BarreNavigation";

export const Route = createFileRoute("/moi")({
  head: () => ({ meta: [{ title: "Palanote — Moi" }] }),
  component: Moi,
});

// Page « Moi » provisoire : juste de quoi se déconnecter pour tester l'inscription et la connexion.
function Moi() {
  const navigate = useNavigate();
  const [email, setEmail] = useState<string | null>(null);
  const [connecte, setConnecte] = useState<boolean | null>(null);
  const [enCours, setEnCours] = useState(false);

  useEffect(() => {
    void supabase.auth.getSession().then(({ data }) => {
      setConnecte(Boolean(data.session));
      setEmail(data.session?.user.email ?? null);
    });
  }, []);

  const deconnecter = async () => {
    setEnCours(true);
    try {
      await signOut();
    } finally {
      navigate({ to: "/connexion", replace: true });
    }
  };

  return (
    <div className="flex min-h-screen flex-col bg-[#F5F9FC]">
      <div className="mx-auto flex w-full max-w-[430px] flex-grow flex-col">
        <div className="rounded-b-[34px] bg-[linear-gradient(180deg,#0E3D72,#0A2A50)] px-[22px] pb-[28px] pt-[18px]">
          <img src={logoCorail} alt="Palanote" className="h-[30px] w-auto" />
          <h1 className="pt-[22px] text-[24px] font-bold text-white">Moi</h1>
          <p className="pt-1 text-[14px] text-white/85">
            {connecte === null ? " " : connecte ? `Connecté avec ${email}` : "Tu n'es pas connecté."}
          </p>
        </div>

        <div className="flex flex-col gap-3 px-[22px] pt-[24px]">
          {connecte ? (
            <button
              type="button"
              onClick={() => void deconnecter()}
              disabled={enCours}
              className="flex h-14 items-center justify-center gap-[10px] rounded-2xl border-[1.5px] border-[#FF8A75] bg-white text-[14px] font-bold text-[#B23A26] disabled:opacity-50"
            >
              <LogOut className="h-[18px] w-[18px]" strokeWidth={2.2} aria-hidden="true" />
              {enCours ? "Déconnexion…" : "SE DÉCONNECTER"}
            </button>
          ) : connecte === false ? (
            <button
              type="button"
              onClick={() => navigate({ to: "/connexion" })}
              className="flex h-14 items-center justify-center rounded-2xl bg-[#3DEFBE] text-[14px] font-bold text-[#0B3B63]"
            >
              ME CONNECTER
            </button>
          ) : null}
          <p className="text-center text-[12.5px] text-[#9DB0C0]">Le profil et les réglages arrivent bientôt sur cette page.</p>
        </div>

        <div className="flex-grow" />
        <BarreNavigation actif="moi" />
      </div>
    </div>
  );
}
