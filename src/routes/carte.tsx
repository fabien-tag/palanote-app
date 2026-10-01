import { useEffect, useMemo, useRef, useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { ChevronRight, MapPin, Search, Star, X } from "lucide-react";
import { BarreNavigation } from "@/components/BarreNavigation";
import { filtresDisponibles, FiltresPlongees } from "@/components/AccueilCarnet";
import { CarteSpots, type ApiCarteSpots } from "@/components/carte/CarteSpots";
import { rechercherLieux, type Lieu } from "@/lib/carte";
import { cleSpot, ilYA, moisAnnee, pluriel, regrouperEnSpots, resumeSpots, spotsParPays, type Spot } from "@/lib/spots";
import { usePlongees } from "@/lib/usePlongees";

export const Route = createFileRoute("/carte")({
  head: () => ({ meta: [{ title: "Palanote — Carte" }, { name: "description", content: "Tous tes spots de plongée sur une carte." }] }),
  component: PageCarte,
});

type Vue = "carte" | "liste";

const sansAccents = (t: string) =>
  t
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase();

function IconeCarte({ actif }: { actif: boolean }) {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={actif ? "#0F3D70" : "#9DB0C0"} strokeWidth={actif ? 2.2 : 1.9} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M3 6.5 9 4l6 2.5 6-2.5v13.5L15 20l-6-2.5L3 20V6.5Z" />
      <path d="M9 4v13.5M15 6.5V20" />
    </svg>
  );
}
function IconeListe({ actif }: { actif: boolean }) {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={actif ? "#0F3D70" : "#9DB0C0"} strokeWidth={actif ? 2.2 : 1.9} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="3.2" y="4.6" width="4" height="4" rx="1.2" />
      <rect x="3.2" y="10" width="4" height="4" rx="1.2" />
      <rect x="3.2" y="15.4" width="4" height="4" rx="1.2" />
      <path d="M10 6.6h10.8M10 12h10.8M10 17.4h10.8" />
    </svg>
  );
}

function Etoiles({ note }: { note: number | null }) {
  if (!note) return null;
  const n = Math.round(note);
  return (
    <span className="flex shrink-0 gap-[1px]" aria-label={`Note ${note.toFixed(1).replace(".", ",")} sur 5`}>
      {[1, 2, 3, 4, 5].map((i) => (
        <Star key={i} className={`h-[11px] w-[11px] ${i <= n ? "fill-[#FFC65C] text-[#FFC65C]" : "fill-transparent text-[#D5DFE8]"}`} />
      ))}
    </span>
  );
}

function PastilleProfondeur({ m }: { m: number | null }) {
  if (m === null) return null;
  return (
    <span className="flex h-[20px] shrink-0 items-center rounded-[10px] bg-[#3DEFBE] px-[8px] text-[11px] font-bold text-[#0B3B63]">
      {String(m).replace(".", ",")} m
    </span>
  );
}

function PageCarte() {
  const navigate = useNavigate();
  const plongees = usePlongees();
  const [vue, setVue] = useState<Vue>("carte");
  const [filtre, setFiltre] = useState("toutes");
  const [recherche, setRecherche] = useState("");
  const [lieux, setLieux] = useState<Lieu[]>([]);
  const [rechercheOuverte, setRechercheOuverte] = useState(false);
  const [choisi, setChoisi] = useState<string | null>(null);
  const [paysOuverts, setPaysOuverts] = useState<Set<string>>(new Set());
  const api = useRef<ApiCarteSpots | null>(null);

  const toutes = plongees ?? [];
  const filtres = filtresDisponibles(toutes);
  const filtreActif = filtres.find((f) => f.id === filtre) ?? filtres[0]!;
  const spots = useMemo(() => regrouperEnSpots(toutes.filter((p) => filtreActif.teste(p))), [plongees, filtre]); // eslint-disable-line react-hooks/exhaustive-deps
  const tousLesSpots = useMemo(() => regrouperEnSpots(toutes), [plongees]); // eslint-disable-line react-hooks/exhaustive-deps
  const resume = resumeSpots(spots);
  const spotChoisi = spots.find((s) => s.id === choisi) ?? null;
  const sansLieu = toutes.filter((p) => !p.coords).length;

  // Recherche : d'abord tes spots, puis les lieux du monde (ville, île…)
  const q = sansAccents(recherche.trim());
  const spotsTrouves = q ? tousLesSpots.filter((s) => sansAccents(`${s.nom} ${s.lieu}`).includes(q)).slice(0, 5) : [];
  useEffect(() => {
    if (recherche.trim().length < 3) {
      setLieux([]);
      return;
    }
    const ctrl = new AbortController();
    const t = setTimeout(() => {
      void rechercherLieux(recherche, ctrl.signal)
        .then((l) => setLieux(l.slice(0, 4)))
        .catch(() => undefined);
    }, 700);
    return () => {
      clearTimeout(t);
      ctrl.abort();
    };
  }, [recherche]);

  const ouvrirSpot = (s: Spot) => {
    setRecherche("");
    setRechercheOuverte(false);
    setFiltre("toutes");
    setVue("carte");
    setChoisi(s.id);
    setTimeout(() => api.current?.allerA(s.coords.lat, s.coords.lng, 13), 50);
  };
  const ficheSpot = (s: Spot) => navigate({ to: "/site", search: { cle: cleSpot(s) } });

  const vide = plongees !== null && toutes.length === 0;
  const aucunLieu = plongees !== null && toutes.length > 0 && tousLesSpots.length === 0;

  return (
    <div className="flex h-screen flex-col overflow-hidden bg-[#F1F6FC] supports-[height:100dvh]:h-[100dvh]">
      <div className="mx-auto flex min-h-0 w-full max-w-[430px] flex-1 flex-col">
        {/* Titre */}
        <div className="flex shrink-0 items-center justify-between px-[22px] pt-[clamp(14px,2.6svh,22px)]">
          <h1 className="text-[clamp(24px,3.6svh,28px)] font-bold text-[#123A63]">Carte</h1>
          {!vide && (
            <div role="group" aria-label="Affichage" className="flex gap-[3px] rounded-[13px] bg-[#E7EFF6] p-[3px]">
              {(
                [
                  ["carte", "Vue carte", IconeCarte],
                  ["liste", "Vue liste", IconeListe],
                ] as const
              ).map(([v, label, Icone]) => (
                <button
                  key={v}
                  type="button"
                  aria-label={label}
                  aria-pressed={vue === v}
                  onClick={() => setVue(v)}
                  className={`flex h-8 w-[38px] items-center justify-center rounded-[10px] ${vue === v ? "bg-white shadow-[0_2px_6px_rgba(15,61,112,.14)]" : ""}`}
                >
                  <Icone actif={vue === v} />
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Recherche */}
        <div className="relative z-[1100] shrink-0 px-[22px] pt-[12px]">
          <div className="flex h-[48px] items-center gap-2 rounded-[16px] border border-[#DCE7F0] bg-white px-[14px] shadow-[0_2px_8px_#123A6306]">
            <Search className="h-[18px] w-[18px] shrink-0 text-[#9DB0C0]" strokeWidth={2.2} aria-hidden="true" />
            <input
              value={recherche}
              onChange={(e) => {
                setRecherche(e.target.value);
                setRechercheOuverte(true);
              }}
              onFocus={() => setRechercheOuverte(true)}
              placeholder="Chercher un site, un lieu"
              aria-label="Chercher un site ou un lieu"
              enterKeyHint="search"
              className="w-full min-w-0 bg-transparent text-[15px] text-[#123A63] outline-none placeholder:text-[#9AAAB9]"
            />
            {recherche && (
              <button type="button" aria-label="Effacer" onClick={() => setRecherche("")} className="text-[#9DB0C0]">
                <X className="h-[17px] w-[17px]" />
              </button>
            )}
          </div>
          {rechercheOuverte && (spotsTrouves.length > 0 || lieux.length > 0) && (
            <ul className="absolute inset-x-[22px] top-[64px] max-h-[50svh] overflow-y-auto rounded-[16px] border border-[#E4EBF1] bg-white shadow-[0_10px_28px_rgba(7,26,48,.18)]">
              {spotsTrouves.map((s) => (
                <li key={s.id} className="border-t border-[#EDF2F7] first:border-t-0">
                  <button type="button" onClick={() => ouvrirSpot(s)} className="flex w-full items-center gap-3 px-[14px] py-[10px] text-left">
                    <span className="flex h-[28px] w-[28px] shrink-0 items-center justify-center rounded-full bg-[#3DEFBE] text-[12px] font-bold text-[#0B3B63]">
                      {s.plongees.length}
                    </span>
                    <span className="min-w-0">
                      <span className="block truncate text-[14.5px] font-semibold text-[#123A63]">{s.nom}</span>
                      <span className="block truncate text-[12.5px] text-[#5B7189]">Ton spot · {s.lieu || "lieu inconnu"}</span>
                    </span>
                  </button>
                </li>
              ))}
              {lieux.map((l, i) => (
                <li key={`${l.coords.lat}-${i}`} className="border-t border-[#EDF2F7] first:border-t-0">
                  <button
                    type="button"
                    onClick={() => {
                      setRecherche("");
                      setRechercheOuverte(false);
                      setVue("carte");
                      setTimeout(() => api.current?.allerA(l.coords.lat, l.coords.lng, 11), 50);
                    }}
                    className="flex w-full items-center gap-3 px-[14px] py-[10px] text-left"
                  >
                    <MapPin className="h-[18px] w-[18px] shrink-0 text-[#9DB0C0]" strokeWidth={2} aria-hidden="true" />
                    <span className="min-w-0">
                      <span className="block truncate text-[14.5px] font-semibold text-[#123A63]">{l.nom}</span>
                      <span className="block truncate text-[12.5px] text-[#5B7189]">{l.lieu}</span>
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        {!vide && !aucunLieu && (
          <FiltresPlongees
            filtres={filtres}
            actif={filtreActif.id}
            onChange={(id) => {
              setFiltre(id);
              setChoisi(null);
            }}
            className="px-[22px] pt-[12px]"
          />
        )}

        {vue === "carte" || vide || aucunLieu ? (
          <>
            {/* Carte */}
            <div className="min-h-[180px] flex-1 px-[16px] pt-[12px]" onClick={() => setRechercheOuverte(false)}>
              <CarteSpots
                spots={spots}
                choisi={choisi}
                onChoisir={setChoisi}
                onPrete={(a) => (api.current = a)}
                className="h-full rounded-[22px] border border-[#DCE7F0] shadow-[0_4px_14px_#123A6308]"
              />
            </div>

            {/* Bas : résumé, spot choisi, ou carte vide */}
            <div className="shrink-0 px-[16px] pb-[12px] pt-[12px]">
              {vide || aucunLieu ? (
                <div className="px-[6px]">
                  <h2 className="text-[18px] font-bold text-[#123A63]">{vide ? "Ta carte est vide, pour l'instant" : "Tes plongées n'ont pas encore de lieu"}</h2>
                  <p className="pt-1 text-[13.5px] leading-snug text-[#5B7189]">
                    {vide
                      ? "Chaque plongée à laquelle tu donnes un lieu viendra se poser ici."
                      : `Ouvre une plongée, touche « Modifier » puis « Choisir sur la carte » : elle apparaîtra ici.`}
                  </p>
                  {vide && (
                    <div className="flex flex-col gap-[10px] pt-[14px]">
                      <button
                        type="button"
                        onClick={() => navigate({ to: "/numeriser" })}
                        className="flex h-[50px] items-center justify-center rounded-2xl bg-[#3DEFBE] text-[14px] font-bold text-[#0B3B63]"
                      >
                        NUMÉRISER MES CARNETS
                      </button>
                      <button
                        type="button"
                        onClick={() => navigate({ to: "/nouvelle-plongee" })}
                        className="flex h-[50px] items-center justify-center rounded-2xl border border-[#57D4F5] bg-white text-[14px] font-bold text-[#1176A8]"
                      >
                        AJOUTER MA PREMIÈRE PLONGÉE
                      </button>
                    </div>
                  )}
                </div>
              ) : spotChoisi ? (
                <div className="rounded-[20px] border border-[#DCE7F0] bg-white p-[14px] shadow-[0_4px_14px_#123A6308]">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="truncate text-[17px] font-bold text-[#123A63]">{spotChoisi.nom}</div>
                      <div className="truncate text-[12.5px] text-[#5B7189]">
                        {[spotChoisi.ville, spotChoisi.pays].filter(Boolean).join(" · ") || "Lieu inconnu"}
                      </div>
                    </div>
                    {spotChoisi.noteMoyenne !== null && (
                      <span className="flex h-[26px] shrink-0 items-center gap-[4px] rounded-[13px] bg-[#FFF1D9] px-[9px] text-[12.5px] font-bold text-[#123A63]">
                        <Star className="h-[12px] w-[12px] fill-[#FFC65C] text-[#FFC65C]" aria-hidden="true" />
                        {spotChoisi.noteMoyenne.toFixed(1).replace(".0", "").replace(".", ",")}
                        <span className="font-semibold text-[#9DB0C0]">/5</span>
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-2 pt-[8px] text-[12.5px] text-[#5B7189]">
                    <PastilleProfondeur m={spotChoisi.profMax} />
                    <span className="truncate">
                      {pluriel(spotChoisi.plongees.length, "plongée")} ici{spotChoisi.derniere ? ` · la dernière ${ilYA(spotChoisi.derniere)}` : ""}
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => ficheSpot(spotChoisi)}
                    className="mt-[12px] flex h-[48px] w-full items-center justify-center gap-2 rounded-[14px] bg-[#3DEFBE] text-[13.5px] font-bold text-[#0B3B63]"
                  >
                    {spotChoisi.plongees.length > 1 ? `VOIR MES ${spotChoisi.plongees.length} PLONGÉES` : "VOIR MA PLONGÉE"}
                    <ChevronRight className="h-[17px] w-[17px]" strokeWidth={2.6} aria-hidden="true" />
                  </button>
                </div>
              ) : (
                <div className="flex items-center justify-between gap-3 rounded-[20px] border border-[#DCE7F0] bg-white px-[16px] py-[12px] shadow-[0_4px_14px_#123A6308]">
                  <div className="min-w-0">
                    <div className="text-[15px] font-bold text-[#123A63]">
                      {spots.length === 0
                        ? "Aucun spot pour ce filtre"
                        : `${pluriel(resume.nbPlongees, "plongée")} · ${pluriel(resume.nbSites, "site")}`}
                    </div>
                    <div className="truncate text-[12.5px] text-[#5B7189]">
                      {spots.length === 0
                        ? "Choisis « Toutes » pour tout revoir."
                        : [resume.nbPays > 0 ? `${resume.nbPays} pays` : "", resume.periode].filter(Boolean).join(", ")}
                      {sansLieu > 0 && filtre === "toutes" ? ` · ${sansLieu} sans lieu` : ""}
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => api.current?.toutVoir()}
                    className="flex h-[36px] shrink-0 items-center gap-1 rounded-[18px] bg-[#E7EFF6] px-[14px] text-[13px] font-bold text-[#123A63]"
                  >
                    Tout voir
                    <ChevronRight className="h-[15px] w-[15px]" strokeWidth={2.4} aria-hidden="true" />
                  </button>
                </div>
              )}
            </div>
          </>
        ) : (
          /* Vue liste : tes spots, par pays */
          <div className="min-h-0 flex-1 overflow-y-auto px-[22px] pb-[16px]" onClick={() => setRechercheOuverte(false)}>
            {spotsParPays(spots).map((g) => {
              const ouvert = paysOuverts.has(g.pays);
              const visibles = ouvert ? g.spots : g.spots.slice(0, 4);
              return (
                <section key={g.pays} className="pt-[18px]">
                  <div className="flex items-baseline justify-between pb-[10px]">
                    <h2 className="text-[17px] font-bold text-[#123A63]">{g.pays}</h2>
                    <span className="text-[12.5px] text-[#9DB0C0]">{pluriel(g.spots.length, "site")}</span>
                  </div>
                  <div className="overflow-hidden rounded-[20px] border border-[#DCE7F0] bg-white shadow-[0_4px_14px_#123A6308]">
                    {visibles.map((s) => (
                      <button
                        key={s.id}
                        type="button"
                        onClick={() => ficheSpot(s)}
                        className="flex w-full items-center gap-[12px] border-t border-[#EDF2F7] px-[14px] py-[12px] text-left first:border-t-0"
                      >
                        <span className="flex h-[34px] w-[34px] shrink-0 items-center justify-center rounded-full bg-[#3DEFBE] text-[13px] font-bold text-[#0B3B63]">
                          {s.plongees.length}
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-[15px] font-bold text-[#123A63]">{s.nom}</span>
                          <span className="block truncate text-[12px] text-[#5B7189]">
                            {[s.ville, s.derniere ? (Date.now() - s.derniere.getTime() < 31 * 86_400_000 ? ilYA(s.derniere) : moisAnnee(s.derniere)) : ""]
                              .filter(Boolean)
                              .join(" · ")}
                          </span>
                        </span>
                        <Etoiles note={s.noteMoyenne} />
                        <PastilleProfondeur m={s.profMax} />
                      </button>
                    ))}
                    {g.spots.length > 4 && (
                      <button
                        type="button"
                        onClick={() =>
                          setPaysOuverts((x) => {
                            const n = new Set(x);
                            if (n.has(g.pays)) n.delete(g.pays);
                            else n.add(g.pays);
                            return n;
                          })
                        }
                        className="w-full border-t border-[#EDF2F7] px-[14px] py-[12px] text-left text-[13.5px] font-bold text-[#1176A8]"
                      >
                        {ouvert ? "Réduire" : `Voir les ${g.spots.length - 4} autres sites${g.pays === "Autres lieux" ? "" : ` en ${g.pays}`}`}
                      </button>
                    )}
                  </div>
                </section>
              );
            })}
            {spots.length === 0 && <p className="pt-10 text-center text-[13.5px] text-[#5B7189]">Aucun spot pour ce filtre.</p>}
          </div>
        )}
      </div>

      <div className="mx-auto w-full max-w-[430px] shrink-0">
        <BarreNavigation actif="carte" />
      </div>
    </div>
  );
}
