import { useEffect, useState } from "react";
import { createFileRoute, useNavigate, useRouter } from "@tanstack/react-router";
import { Bell } from "lucide-react";
import { useConnexionRequise } from "@/components/numerisation/Ui";
import { PageClub, Titre } from "@/components/club/Ui";
import { NavigationDpMobile } from "@/components/club/NavigationDp";
import { LigneNotification } from "@/components/LigneNotification";
import { chargerNotifications, EVENEMENT_NOTIFICATIONS, genererRappelsDp, marquerLues, type Notification } from "@/lib/notifications";

// La cloche du directeur de plongée : rappels du club (contrôles du matériel, certificats,
// sorties à préparer, à clôturer, à tamponner) et inscriptions à ses sorties.
export const Route = createFileRoute("/_dp/club_/notifications")({
  head: () => ({ meta: [{ title: "Palanote — Notifications" }] }),
  component: NotificationsDp,
});

const FILTRES = [
  { id: "tout", libelle: "Tout" },
  { id: "rappels", libelle: "Rappels" },
  { id: "sorties", libelle: "Inscriptions et sorties" },
] as const;

function NotificationsDp() {
  const navigate = useNavigate();
  const router = useRouter();
  const { pret, ecran } = useConnexionRequise();
  const [liste, setListe] = useState<Notification[] | null>(null);
  const [filtre, setFiltre] = useState<(typeof FILTRES)[number]["id"]>("tout");

  useEffect(() => {
    if (!pret) return;
    void genererRappelsDp(true)
      .then(() => chargerNotifications())
      .then(async (l) => {
        setListe(l);
        // Ouvertes = vues : la pastille de la cloche disparaît (les nouvelles restent marquées ici)
        if (l.some((n) => !n.lue_le)) {
          await marquerLues();
          window.dispatchEvent(new Event(EVENEMENT_NOTIFICATIONS));
        }
      });
  }, [pret]);

  if (ecran) return ecran;

  const visibles = (liste ?? []).filter((n) => (filtre === "tout" ? true : filtre === "rappels" ? n.type.startsWith("rappel_") : !n.type.startsWith("rappel_")));
  const nouvelles = visibles.filter((n) => !n.lue_le);
  const anciennes = visibles.filter((n) => n.lue_le);
  const ouvrir = (n: Notification) => n.lien && router.history.push(n.lien);

  return (
    <PageClub
      titre="Notifications"
      titreBureau="Notifications"
      sousTitreBureau="Rappels du club et inscriptions à tes sorties"
      large
      onRetour={() => navigate({ to: "/club" })}
      navigation={<NavigationDpMobile />}
    >
      <div className="max-w-[760px]">
        <div className="flex flex-wrap gap-[6px] pb-[4px]">
          {FILTRES.map((f) => (
            <button
              key={f.id}
              type="button"
              onClick={() => setFiltre(f.id)}
              className={`h-[34px] rounded-[10px] px-[13px] text-[13px] font-bold ${filtre === f.id ? "bg-[#0F3D70] text-white" : "border border-[#D8E5EE] bg-white text-[#5B7189]"}`}
            >
              {f.libelle}
            </button>
          ))}
        </div>
        {liste && visibles.length === 0 && (
          <div className="flex flex-col items-center gap-[10px] pt-[12svh] text-center">
            <span className="flex h-[56px] w-[56px] items-center justify-center rounded-[10px] bg-[#E3EDF6]">
              <Bell className="h-[24px] w-[24px] text-[#9DB0C0]" aria-hidden="true" />
            </span>
            <p className="text-[16px] font-bold">Rien à signaler</p>
            <p className="max-w-[320px] text-[13.5px] leading-normal text-[#5B7189]">
              Les contrôles du matériel, les certificats à renouveler et les sorties à préparer arriveront ici.
            </p>
          </div>
        )}
        {nouvelles.length > 0 && (
          <>
            <Titre>Nouvelles</Titre>
            <div className="flex flex-col gap-[8px]">
              {nouvelles.map((n) => (
                <LigneNotification key={n.id} n={n} onOuvrir={ouvrir} />
              ))}
            </div>
          </>
        )}
        {anciennes.length > 0 && (
          <>
            <Titre>Plus tôt</Titre>
            <div className="flex flex-col gap-[8px]">
              {anciennes.map((n) => (
                <LigneNotification key={n.id} n={n} onOuvrir={ouvrir} />
              ))}
            </div>
          </>
        )}
      </div>
    </PageClub>
  );
}
