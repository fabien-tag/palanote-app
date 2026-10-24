import { useEffect } from "react";
import { useNavigate } from "@tanstack/react-router";
import { utilisateurConnecte } from "@/lib/plongees";

// Écrans du carnet réservés à un compte : sans session, on renvoie vers la connexion
// (au lieu d'afficher les plongées de démonstration gardées sur l'appareil).
export function useReserveAuxConnectes() {
  const navigate = useNavigate();
  useEffect(() => {
    let actif = true;
    void utilisateurConnecte().then((u) => {
      if (actif && !u) void navigate({ to: "/connexion", replace: true });
    });
    return () => {
      actif = false;
    };
  }, [navigate]);
}
