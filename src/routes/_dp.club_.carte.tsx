import { useEffect, useMemo, useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { ChevronRight, MapPin } from "lucide-react";
import { useConnexionRequise } from "@/components/numerisation/Ui";
import { NavigationDpMobile } from "@/components/club/NavigationDp";
import { MessageErreur, PageClub } from "@/components/club/Ui";
import { CarteSpots, type ApiCarteSpots } from "@/components/carte/CarteSpots";
import { messagePlanning, useCentre } from "@/components/club/useCentre";
import type { CartePlongee } from "@/lib/plongees";
import { regrouperEnSpots } from "@/lib/spots";
import { carteCentre, depuisIso, type SortieCarte } from "@/lib/planning";

// Carte du club : tous les sites plongés par le centre (sorties clôturées), avec le nombre
// de plongées par site. Positions déjà floutées de 100 à 150 m à la création des sorties.
export const Route = createFileRoute("/_dp/club_/carte")({
  head: () => ({ meta: [{ title: "Palanote — Carte du club" }] }),
  component: PageCarteClub,
});

function PageCarteClub() {
  const navigate = useNavigate();
  const { pret, ecran } = useConnexionRequise();
  const { centre, erreur: erreurCentre } = useCentre(pret);
  const [sorties, setSorties] = useState<SortieCarte[] | null>(null);
  const [choisi, setChoisi] = useState<string | null>(null);
  const [api, setApi] = useState<ApiCarteSpots | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);

  useEffect(() => {
    if (!centre) return;
    carteCentre(centre.id)
      .then(setSorties)
      .catch((e) => {
        console.error(e);
        setSorties([]);
        setErreur(messagePlanning(e, "La carte du club n'a pas pu être chargée.").replace("palanote-planning-club.sql", "palanote-espace-club.sql"));
      });
  }, [centre]);

  // Une entrée par plongée (participant), pour que chaque bulle compte les plongées du site
  const spots = useMemo(() => {
    const plongees: CartePlongee[] = [];
    for (const s of sorties ?? []) {
      for (let i = 0; i < Math.max(1, s.nb); i++) {
        plongees.push({
          id: `${s.id}-${i}`,
          date: s.date,
          siteNom: s.site,
          siteLieu: s.lieu ?? "",
          profMax: s.profondeur ? String(s.profondeur) : "",
          duree: s.duree ? String(s.duree) : "",
          tempFond: "",
          melange: "",
          note: 0,
          binomes: [],
          coords: s.coords,
        });
      }
    }
    return regrouperEnSpots(plongees).sort((a, b) => b.plongees.length - a.plongees.length);
  }, [sorties]);

  if (ecran) return ecran;

  const spot = spots.find((s) => s.id === choisi) ?? null;
  const sortiesDuSpot = spot ? (sorties ?? []).filter((s) => spot.plongees.some((p) => p.id.startsWith(s.id))) : [];
  const total = spots.reduce((t, s) => t + s.plongees.length, 0);

  return (
    <PageClub titre="Carte du club" large="plein" navigation={<NavigationDpMobile />}>
      <MessageErreur texte={erreurCentre ?? erreur} />
      {sorties && (
        <>
          <p className="pt-[2px] text-[13.5px] text-[#5B7189]">
            {spots.length} site{spots.length > 1 ? "s" : ""} · {sorties.length} sortie{sorties.length > 1 ? "s" : ""} · {total} plongée{total > 1 ? "s" : ""} encadrée{total > 1 ? "s" : ""}
          </p>
          <div className="grid grid-cols-1 gap-[16px] pt-[12px] lg:grid-cols-[minmax(0,1fr)_340px]">
            <div className="h-[360px] overflow-hidden rounded-[10px] border border-[#E4EBF1] bg-white lg:h-[calc(100svh-150px)]">
              {spots.length > 0 ? (
                <CarteSpots spots={spots} choisi={choisi} onChoisir={setChoisi} onPrete={setApi} className="h-full w-full" />
              ) : (
                <div className="flex h-full flex-col items-center justify-center gap-[8px] px-[30px] text-center text-[13.5px] text-[#5B7189]">
                  <MapPin className="h-[26px] w-[26px] text-[#9DB0C0]" />
                  Les sites apparaissent ici dès qu'une sortie est clôturée.
                </div>
              )}
            </div>
            <div className="flex flex-col gap-[8px] lg:max-h-[calc(100svh-150px)] lg:overflow-y-auto">
              {spot ? (
                <>
                  <button type="button" onClick={() => setChoisi(null)} className="self-start text-[12.5px] font-bold text-[#1176A8]">
                    ← Tous les sites
                  </button>
                  <div className="rounded-[10px] border border-[#E4EBF1] bg-white px-[14px] py-[12px]">
                    <p className="text-[18px] font-bold first-letter:uppercase">{spot.nom}</p>
                    <p className="text-[13px] text-[#5B7189]">
                      {spot.lieu} · {spot.plongees.length} plongée{spot.plongees.length > 1 ? "s" : ""}
                      {spot.profMax ? ` · ${String(spot.profMax).replace(".", ",")} m max` : ""}
                    </p>
                  </div>
                  {sortiesDuSpot.map((s) => (
                    <button
                      key={s.id}
                      type="button"
                      onClick={() => navigate({ to: "/club/planning", search: { semaine: s.date, sortie: s.id } })}
                      className="flex items-center gap-[10px] rounded-[10px] border border-[#E4EBF1] bg-white px-[12px] py-[10px] text-left"
                    >
                      <span className="min-w-0 flex-1">
                        <span className="block text-[13.5px] font-bold first-letter:uppercase">
                          {depuisIso(s.date).toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}
                        </span>
                        <span className="block text-[12px] text-[#5B7189]">
                          {s.nb} plongeur{s.nb > 1 ? "s" : ""} · DP {s.dp}
                          {s.duree ? ` · ${s.duree} min` : ""}
                        </span>
                      </span>
                      <ChevronRight className="h-[16px] w-[16px] text-[#9DB0C0]" />
                    </button>
                  ))}
                </>
              ) : (
                spots.map((s) => (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => {
                      setChoisi(s.id);
                      api?.allerA(s.coords.lat, s.coords.lng);
                    }}
                    className="flex items-center gap-[12px] rounded-[10px] border border-[#E4EBF1] bg-white px-[12px] py-[10px] text-left hover:border-[#57D4F5]"
                  >
                    <span className="flex h-[34px] w-[34px] shrink-0 items-center justify-center rounded-[10px] bg-[#D5FAF0] text-[13px] font-bold text-[#0B3B63]">
                      {s.plongees.length}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[14px] font-bold first-letter:uppercase">{s.nom}</span>
                      <span className="block truncate text-[12px] text-[#5B7189]">
                        {s.lieu}
                        {s.derniere ? ` · dernière ${s.derniere.toLocaleDateString("fr-FR", { day: "numeric", month: "short" })}` : ""}
                      </span>
                    </span>
                    <ChevronRight className="h-[16px] w-[16px] text-[#9DB0C0]" />
                  </button>
                ))
              )}
            </div>
          </div>
        </>
      )}
    </PageClub>
  );
}
