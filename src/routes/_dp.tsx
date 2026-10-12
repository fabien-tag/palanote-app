import { useEffect, useState } from "react";
import { createFileRoute, Outlet, useRouterState } from "@tanstack/react-router";
import { NavigationDp } from "@/components/club/NavigationDp";
import { estDirecteurDePlongee, ongletSortiesGarde } from "@/lib/club";

// Mise en page commune aux écrans du directeur de plongée (/club…).
// Sur ordinateur, la colonne de navigation reste en place d'un écran à l'autre :
// seul le contenu change, avec un fondu. Sur téléphone, rien ne change (barre du bas).
// Un plongeur qui organise une sortie entre amis n'a pas la colonne du club.
export const Route = createFileRoute("/_dp")({
  component: LayoutDp,
});

function LayoutDp() {
  const chemin = useRouterState({ select: (s) => s.location.pathname });
  const [dp, setDp] = useState(() => ongletSortiesGarde());
  useEffect(() => {
    void estDirecteurDePlongee().then((oui) => oui !== null && setDp(oui));
  }, []);
  return (
    <div className={dp ? "bureau" : ""}>
      {dp && <NavigationDp />}
      <div className={dp ? "lg:pl-[232px]" : ""}>
        <div key={chemin} className={dp ? "fondu" : ""}>
          <Outlet />
        </div>
      </div>
    </div>
  );
}
