import { useEffect, useState } from "react";
import { createFileRoute, Link, Outlet, useRouterState } from "@tanstack/react-router";
import { Check, Copy, Monitor } from "lucide-react";
import logoSigle from "@/assets/palanote-logo-cigle.png";
import { NavigationDp } from "@/components/club/NavigationDp";
import { estDirecteurDePlongee, ongletSortiesGarde } from "@/lib/club";

// Mise en page commune aux écrans du directeur de plongée (/club…).
// L'espace club est un outil d'ordinateur : le DP n'a pas d'app mobile.
// · Sur ordinateur, la colonne de navigation reste en place d'un écran à l'autre ;
//   seul le contenu change, avec un fondu.
// · Sur téléphone, les écrans du club affichent « à ouvrir sur ordinateur ».
//   Seule exception : la page d'une sortie (/club/sortie), qui sert aussi aux sorties
//   entre amis des plongeurs et à montrer le QR code sur le bateau.
export const Route = createFileRoute("/_dp")({
  component: LayoutDp,
});

function LayoutDp() {
  const chemin = useRouterState({ select: (s) => s.location.pathname });
  const [dp, setDp] = useState(() => ongletSortiesGarde());
  useEffect(() => {
    void estDirecteurDePlongee().then((oui) => oui !== null && setDp(oui));
  }, []);
  const aussiSurMobile = chemin.startsWith("/club/sortie");
  return (
    <div className={dp ? "bureau" : ""}>
      {dp && <NavigationDp />}
      {!aussiSurMobile && <SurOrdinateur />}
      <div className={`${dp ? "lg:pl-[232px]" : ""} ${aussiSurMobile ? "" : "hidden lg:block"}`}>
        <div key={chemin} className={dp ? "fondu" : ""}>
          <Outlet />
        </div>
      </div>
    </div>
  );
}

// Téléphone et petite tablette : l'espace club s'ouvre sur un grand écran
function SurOrdinateur() {
  const [copie, setCopie] = useState(false);
  const lien = typeof window === "undefined" ? "/club" : `${window.location.origin}/club`;
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-[#F1F6FC] px-[28px] py-[40px] text-center text-[#123A63] lg:hidden">
      <span className="flex h-[56px] w-[56px] items-center justify-center rounded-[16px] bg-[#0F3D70]">
        <img src={logoSigle} alt="" className="h-[34px] w-[34px] object-contain" />
      </span>
      <span className="mt-[22px] flex h-[44px] w-[44px] items-center justify-center rounded-full bg-[#E3F2FB]">
        <Monitor className="h-[22px] w-[22px] text-[#1176A8]" />
      </span>
      <h1 className="pt-[14px] text-[22px] font-bold leading-tight">L'espace club s'ouvre sur ordinateur</h1>
      <p className="max-w-[340px] pt-[10px] text-[14px] leading-normal text-[#5B7189]">
        Tableau de bord, planning, palanquées, équipe, matériel, membres et import Excel : l'outil du directeur de plongée est pensé pour un grand écran.
      </p>
      <div className="mt-[20px] flex w-full max-w-[340px] items-center gap-[8px] rounded-[14px] border border-[#D8E5EE] bg-white px-[14px] py-[10px]">
        <span className="min-w-0 flex-1 truncate text-left text-[13.5px] font-semibold">{lien.replace(/^https?:\/\//, "")}</span>
        <button
          type="button"
          onClick={() => {
            void navigator.clipboard?.writeText(lien).then(() => setCopie(true));
          }}
          className="flex h-[34px] items-center gap-[5px] rounded-[10px] bg-[#0F3D70] px-[10px] text-[12.5px] font-bold text-white"
        >
          {copie ? <Check className="h-[14px] w-[14px]" /> : <Copy className="h-[14px] w-[14px]" />}
          {copie ? "Copié" : "Copier"}
        </button>
      </div>
      <Link to="/carnet" className="mt-[22px] text-[13.5px] font-bold text-[#1176A8]">
        Revenir à l'app
      </Link>
    </div>
  );
}
