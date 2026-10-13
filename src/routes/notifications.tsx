import { useEffect, useState } from "react";
import { createFileRoute, useNavigate, useRouter } from "@tanstack/react-router";
import { Bell, CalendarCheck, CalendarX, HeartHandshake, PenLine, Stamp, Star, UserPlus, Users } from "lucide-react";
import { useConnexionRequise } from "@/components/numerisation/Ui";
import { PageClub, Titre } from "@/components/club/Ui";
import { chargerNotifications, ilYA, marquerLues, type Notification } from "@/lib/notifications";

// La cloche de l'accueil (parcours 15) : sorties, fiches à compléter, tampons.
export const Route = createFileRoute("/notifications")({
  head: () => ({ meta: [{ title: "Palanote — Notifications" }] }),
  component: PageNotifications,
});

const ICONES: Record<string, { Icone: typeof Bell; fond: string; couleur: string }> = {
  sortie_inscription: { Icone: CalendarCheck, fond: "bg-[#E3F2FB]", couleur: "text-[#1176A8]" },
  sortie_rejointe: { Icone: UserPlus, fond: "bg-[#E3F2FB]", couleur: "text-[#1176A8]" },
  sortie_a_completer: { Icone: PenLine, fond: "bg-[#E2F8EF]", couleur: "text-[#14805F]" },
  sortie_relance: { Icone: PenLine, fond: "bg-[#E2F8EF]", couleur: "text-[#14805F]" },
  tampon: { Icone: Stamp, fond: "bg-[#FFE9E2]", couleur: "text-[#D9573F]" },
  privilegies_invitation: { Icone: Star, fond: "bg-[#FFF3D9]", couleur: "text-[#B07A12]" },
  sortie_modifiee: { Icone: CalendarCheck, fond: "bg-[#FFF1D6]", couleur: "text-[#8A5A10]" },
  sortie_annulee: { Icone: CalendarX, fond: "bg-[#EEF2F6]", couleur: "text-[#7D93A8]" },
  binome_demande: { Icone: Users, fond: "bg-[#E3F2FB]", couleur: "text-[#1176A8]" },
  binome_accepte: { Icone: HeartHandshake, fond: "bg-[#E2F8EF]", couleur: "text-[#14805F]" },
};

function PageNotifications() {
  const navigate = useNavigate();
  const router = useRouter();
  const { pret, ecran } = useConnexionRequise();
  const [liste, setListe] = useState<Notification[] | null>(null);

  useEffect(() => {
    if (!pret) return;
    void chargerNotifications().then((l) => {
      setListe(l);
      // Ouvertes = vues : la pastille de la cloche disparaît (les nouvelles restent marquées ici).
      if (l.some((n) => !n.lue_le)) void marquerLues();
    });
  }, [pret]);

  if (ecran) return ecran;

  const nouvelles = (liste ?? []).filter((n) => !n.lue_le);
  const anciennes = (liste ?? []).filter((n) => n.lue_le);

  const ligne = (n: Notification) => {
    const i = ICONES[n.type] ?? { Icone: Bell, fond: "bg-[#EEF4F9]", couleur: "text-[#5B7189]" };
    return (
      <button
        key={n.id}
        type="button"
        onClick={() => n.lien && router.history.push(n.lien)}
        className={`flex w-full items-start gap-[12px] galet-b border px-[14px] py-[12px] text-left ${n.lue_le ? "border-[#E4EBF1] bg-white" : "border-[#BFE6F5] bg-[#F3FAFE]"}`}
      >
        <span className={`flex h-[40px] w-[40px] shrink-0 items-center justify-center goutte ${i.fond}`}>
          <i.Icone className={`h-[19px] w-[19px] ${i.couleur}`} strokeWidth={2.2} aria-hidden="true" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="flex items-baseline justify-between gap-2">
            <span className="text-[14.5px] font-bold leading-snug">{n.titre}</span>
            <span className="shrink-0 text-[11.5px] text-[#9DB0C0]">{ilYA(n.created_at)}</span>
          </span>
          {n.texte && <span className="block pt-[2px] text-[13px] leading-snug text-[#5B7189]">{n.texte}</span>}
        </span>
        {!n.lue_le && <span className="mt-[6px] h-[9px] w-[9px] shrink-0 rounded-full bg-[#FF8A75]" aria-label="Nouvelle" />}
      </button>
    );
  };

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
