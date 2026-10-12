import { useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { Minus, Plus } from "lucide-react";
import { useConnexionRequise } from "@/components/numerisation/Ui";
import { ChampTexte, detailErreur, MessageErreur, PageClub, Titre } from "@/components/club/Ui";
import { creerSortie } from "@/lib/club";
import { localiserSite } from "@/lib/numerisation";

// Préparer une sortie (parcours 15, écran 3)
export const Route = createFileRoute("/club_/nouvelle-sortie")({
  validateSearch: (search: Record<string, unknown>): { centre?: string } => (typeof search["centre"] === "string" ? { centre: search["centre"] } : {}),
  head: () => ({ meta: [{ title: "Palanote — Nouvelle sortie" }] }),
  component: NouvelleSortie,
});

function demain() {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function NouvelleSortie() {
  const navigate = useNavigate();
  const { centre } = Route.useSearch();
  const { pret, ecran } = useConnexionRequise();
  const [date, setDate] = useState(demain);
  const [heure, setHeure] = useState("09:00");
  const [site, setSite] = useState("");
  const [lieu, setLieu] = useState("");
  const [bateau, setBateau] = useState("");
  const [profondeur, setProfondeur] = useState("");
  const [consignes, setConsignes] = useState("");
  const [palanquees, setPalanquees] = useState(2);
  const [enCours, setEnCours] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);

  if (ecran) return ecran;

  const creer = async () => {
    if (!centre) return navigate({ to: "/club" });
    if (!site.trim()) return setErreur("Indique le site de plongée.");
    if (!date) return setErreur("Indique la date de la sortie.");
    setEnCours(true);
    setErreur(null);
    try {
      // Position du site (floutée), pour que la plongée de chacun apparaisse sur sa carte
      const position = await localiserSite(site.trim(), lieu.trim() || null);
      const r = await creerSortie({
        centre,
        date,
        heure,
        site: site.trim(),
        lieu: lieu.trim() || position?.lieu || "",
        coords: position?.coords ?? "",
        bateau,
        profondeur,
        consignes,
        palanquees,
      });
      navigate({ to: "/club/sortie", search: { id: r.id }, replace: true });
    } catch (e) {
      console.error(e);
      setErreur(detailErreur(e, "La sortie n'a pas pu être créée."));
      setEnCours(false);
    }
  };

  return (
    <PageClub
      titre="Nouvelle sortie"
      onRetour={() => navigate({ to: "/club" })}
      bas={
        <button
          type="button"
          disabled={enCours || !pret}
          onClick={() => void creer()}
          className="flex h-14 w-full items-center justify-center galet-moyen bg-[#3DEFBE] text-[14px] font-bold text-[#0B3B63] shadow-[0_4px_12px_#123A630D] disabled:opacity-60"
        >
          {enCours ? "CRÉATION…" : "CRÉER LA SORTIE"}
        </button>
      }
    >
      <Titre>Quand</Titre>
      <div className="grid grid-cols-[1.4fr_1fr] gap-[12px]">
        <ChampTexte label="Date" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        <ChampTexte label="Heure" type="time" value={heure} onChange={(e) => setHeure(e.target.value)} />
      </div>

      <Titre>Où</Titre>
      <div className="flex flex-col gap-[14px]">
        <ChampTexte label="Site de plongée" value={site} onChange={(e) => setSite(e.target.value)} placeholder="La Gabinière" />
        <div className="grid grid-cols-2 gap-[12px]">
          <ChampTexte label="Lieu" value={lieu} onChange={(e) => setLieu(e.target.value)} placeholder="Port-Cros" />
          <ChampTexte label="Bateau" value={bateau} onChange={(e) => setBateau(e.target.value)} placeholder="facultatif" />
        </div>
        <ChampTexte
          label="Profondeur prévue (m)"
          inputMode="decimal"
          value={profondeur}
          onChange={(e) => setProfondeur(e.target.value.replace(/[^\d,.]/g, "").slice(0, 5))}
          placeholder="35"
        />
      </div>

      <Titre aide="tu pourras en ajouter">Palanquées</Titre>
      <div className="flex items-center justify-between galet-moyen border-[1.5px] border-[#E4EBF1] bg-white px-[14px] py-[10px]">
        <span className="text-[15px] font-semibold">
          {palanquees} palanquée{palanquees > 1 ? "s" : ""}
        </span>
        <span className="flex items-center gap-[8px]">
          <button
            type="button"
            aria-label="Une palanquée de moins"
            onClick={() => setPalanquees((n) => Math.max(1, n - 1))}
            className="flex h-[36px] w-[36px] items-center justify-center rounded-full bg-[#E3EDF6]"
          >
            <Minus className="h-[16px] w-[16px]" strokeWidth={2.6} />
          </button>
          <button
            type="button"
            aria-label="Une palanquée de plus"
            onClick={() => setPalanquees((n) => Math.min(12, n + 1))}
            className="flex h-[36px] w-[36px] items-center justify-center rounded-full bg-[#E3EDF6]"
          >
            <Plus className="h-[16px] w-[16px]" strokeWidth={2.6} />
          </button>
        </span>
      </div>

      <Titre>Consignes</Titre>
      <textarea
        value={consignes}
        onChange={(e) => setConsignes(e.target.value)}
        rows={3}
        placeholder="Rendez-vous au ponton à 8h45, Nitrox disponible…"
        aria-label="Consignes pour les plongeurs"
        className="w-full galet-moyen border-[1.5px] border-[#E4EBF1] bg-white px-[16px] py-[12px] text-[15px] outline-none placeholder:text-[#B5C4D1] focus:border-[#57D4F5]"
      />
      <p className="pt-[8px] text-[12px] leading-snug text-[#9DB0C0]">Les plongeurs inscrits reçoivent tout ça dans leur app.</p>
      <MessageErreur texte={erreur} />
    </PageClub>
  );
}
