import { useEffect, useState } from "react";
import { createFileRoute, Outlet, useRouterState } from "@tanstack/react-router";
import { NavigationDp } from "@/components/club/NavigationDp";
import { estDirecteurDePlongee, ongletSortiesGarde } from "@/lib/club";
import { genererRappelsDp } from "@/lib/notifications";

// Mise en page commune aux écrans du directeur de plongée (/club…).
// Le DP n'a pas l'app du plongeur : son app, c'est ce tableau de bord, responsive.
// · Sur ordinateur, la colonne de navigation reste en place d'un écran à l'autre ;
//   seul le contenu change, avec un fondu.
// · Sur téléphone, chaque écran porte la barre du bas du DP (NavigationDpMobile).
// Un plongeur qui organise une sortie entre amis passe aussi par /club/sortie, sans la colonne.
export const Route = createFileRoute("/_dp")({
  component: LayoutDp,
});

function LayoutDp() {
  const chemin = useRouterState({ select: (s) => s.location.pathname });
  const [dp, setDp] = useState(() => ongletSortiesGarde());
  useEffect(() => {
    void estDirecteurDePlongee().then((oui) => oui !== null && setDp(oui));
  }, []);
  // Rappels du DP (matériel, certificats, sorties) : créés à l'ouverture, au plus toutes les 30 min
  useEffect(() => {
    if (dp) void genererRappelsDp();
  }, [dp, chemin]);
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
