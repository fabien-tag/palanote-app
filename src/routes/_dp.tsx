import { useEffect, useState } from "react";
import { createFileRoute, Outlet, useRouterState } from "@tanstack/react-router";
import { NavigationDp } from "@/components/club/NavigationDp";
import { BarreHautDp } from "@/components/club/BarreHautDp";
import { PanneauNouvelleSortie } from "@/components/club/PanneauNouvelleSortie";
import { estDirecteurDePlongee, ongletSortiesGarde } from "@/lib/club";
import { genererRappelsDp, genererRappelsFormations } from "@/lib/notifications";

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
    if (dp) {
      void genererRappelsDp();
      void genererRappelsFormations(); // le DP moniteur : la veille des cours qu'il encadre
    }
  }, [dp, chemin]);
  return (
    <div className={dp ? "bureau" : ""}>
      {dp && <NavigationDp />}
      {dp && <PanneauNouvelleSortie />}
      <div className={dp ? "lg:pl-[232px]" : ""}>
        {dp && <BarreHautDp />}
        <main
          key={chemin}
          data-contenu
          tabIndex={-1}
          className={`outline-none ${dp ? "fondu" : ""}`}
        >
          <Outlet />
        </main>
      </div>
    </div>
  );
}
