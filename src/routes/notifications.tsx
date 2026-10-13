import { useEffect, useState } from "react";
import { createFileRoute, useNavigate, useRouter } from "@tanstack/react-router";
import { Bell } from "lucide-react";
import { LigneNotification } from "@/components/LigneNotification";
import { useConnexionRequise } from "@/components/numerisation/Ui";
import { PageClub, Titre } from "@/components/club/Ui";
import { chargerNotifications, genererRappelsPlongeur, marquerLues, type Notification } from "@/lib/notifications";

// La cloche de l'accueil (parcours 15) : sorties, fiches à compléter, tampons.
export const Route = createFileRoute("/notifications")({
  head: () => ({ meta: [{ title: "Palanote — Notifications" }] }),
  component: PageNotifications,
});

function PageNotifications() {
  const navigate = useNavigate();
  const router = useRouter();
  const { pret, ecran } = useConnexionRequise();
  const [liste, setListe] = useState<Notification[] | null>(null);

  useEffect(() => {
    if (!pret) return;
    void genererRappelsPlongeur(true).then(() => chargerNotifications()).then((l) => {
      setListe(l);
      // Ouvertes = vues : la pastille de la cloche disparaît (les nouvelles restent marquées ici).
      if (l.some((n) => !n.lue_le)) void marquerLues();
    });
  }, [pret]);

  if (ecran) return ecran;

  const nouvelles = (liste ?? []).filter((n) => !n.lue_le);
  const anciennes = (liste ?? []).filter((n) => n.lue_le);

  const ligne = (n: Notification) => <LigneNotification key={n.id} n={n} onOuvrir={(x) => x.lien && router.history.push(x.lien)} />;

  return (
    <PageClub titre="Notifications" onRetour={() => navigate({ to: "/carnet" })}>
      {liste && liste.length === 0 && (
        <div className="flex flex-col items-center gap-[10px] pt-[16svh] text-center">
          <span className="flex h-[56px] w-[56px] items-center justify-center goutte bg-[#E3EDF6]">
            <Bell className="h-[24px] w-[24px] text-[#9DB0C0]" aria-hidden="true" />
          </span>
          <p className="text-[16px] font-bold">Rien de neuf pour l'instant</p>
          <p className="max-w-[280px] text-[13.5px] leading-normal text-[#5B7189]">
            Tes inscriptions aux sorties, tes fiches à compléter et les tampons de ton club arriveront ici.
          </p>
        </div>
      )}
      {nouvelles.length > 0 && (
        <>
          <Titre>Nouvelles</Titre>
          <div className="flex flex-col gap-[8px]">{nouvelles.map(ligne)}</div>
        </>
      )}
      {anciennes.length > 0 && (
        <>
          <Titre>Plus tôt</Titre>
          <div className="flex flex-col gap-[8px]">{anciennes.map(ligne)}</div>
        </>
      )}
    </PageClub>
  );
}
