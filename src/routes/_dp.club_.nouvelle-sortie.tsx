import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useConnexionRequise } from "@/components/numerisation/Ui";
import { PageClub } from "@/components/club/Ui";
import { FormulaireNouvelleSortie } from "@/components/club/FormulaireSortie";

// Préparer une sortie (parcours 15, écran 3) — page pleine, surtout pour le téléphone.
// Sur ordinateur, le même formulaire s'ouvre dans un panneau qui glisse depuis la droite.
export const Route = createFileRoute("/_dp/club_/nouvelle-sortie")({
  validateSearch: (search: Record<string, unknown>): { centre?: string; date?: string; retour?: "planning" } => ({
    ...(typeof search["centre"] === "string" ? { centre: search["centre"] } : {}),
    ...(typeof search["date"] === "string" && /^\d{4}-\d{2}-\d{2}$/.test(search["date"]) ? { date: search["date"] } : {}),
    ...(search["retour"] === "planning" ? { retour: "planning" as const } : {}),
  }),
  head: () => ({ meta: [{ title: "Palanote — Nouvelle sortie" }] }),
  component: NouvelleSortie,
});

function NouvelleSortie() {
  const navigate = useNavigate();
  const { centre, date: dateChoisie, retour } = Route.useSearch(); // date : jour cliqué dans le planning
  const { ecran } = useConnexionRequise();
  if (ecran) return ecran;
  return (
    <PageClub
      titre="Nouvelle sortie"
      onRetour={() => (retour === "planning" ? navigate({ to: "/club/planning", search: dateChoisie ? { semaine: dateChoisie } : {} }) : navigate({ to: "/club" }))}
    >
      {centre ? (
        <FormulaireNouvelleSortie
          centre={centre}
          dateInitiale={dateChoisie}
          onCree={(id, date) =>
            retour === "planning"
              ? navigate({ to: "/club/planning", search: { sortie: id, semaine: date }, replace: true })
              : navigate({ to: "/club/sortie", search: { id }, replace: true })
          }
        />
      ) : (
        <p className="pt-[20px] text-[14px] text-[#566B82]">Choisis d'abord ton centre dans Paramètres.</p>
      )}
    </PageClub>
  );
}
