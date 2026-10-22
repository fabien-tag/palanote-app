import { useEffect, useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { Check, ChevronLeft, Info, Star } from "lucide-react";
import { Meduse, useConnexionRequise } from "@/components/numerisation/Ui";
import {
  ajouterPlongeeIdentifiee,
  chargerProposition,
  completerPlongeeIdentifiee,
  couleurAvatar,
  dateCourte,
  enregistrerChampsPerso,
  heureCourte,
  initiales,
  joursRestants,
  refuserIdentification,
  type ChampsPerso,
  type Plongeur,
  type Proposition,
} from "@/lib/amis";
import { annoncerSurAccueil } from "@/lib/message-accueil";

// Parcours 07 « Compléter les carnets ensemble » :
//   39 — la proposition : ce qui arrive dans ta fiche / ce qui reste à toi
//   40 — la fiche préremplie, et ses trous (après l'ajout, s'il manque tes mesures)
//   41 — la plongée était déjà notée : on ne comble que tes cases vides
export const Route = createFileRoute("/amis_/proposition")({
  validateSearch: (search: Record<string, unknown>): { id?: string | undefined; depuis?: "carnet" | undefined } => ({
    id: typeof search["id"] === "string" ? search["id"] : undefined,
    depuis: search["depuis"] === "carnet" ? "carnet" : undefined,
  }),
  head: () => ({ meta: [{ title: "Palanote — Une plongée pour ton carnet" }] }),
  component: PageProposition,
});

type Ecran = "proposition" | "deja" | "fiche";

const nombre = (v: number | null | undefined) => (v === null || v === undefined ? null : String(Number(v)).replace(".", ","));
const heure = (h: string | null | undefined) => (h ? h.replace(":", " h ") : null);

function Avatar({ p, taille = 30, bord = false }: { p: Plongeur; taille?: number; bord?: boolean }) {
  return (
    <span
      className={`flex shrink-0 items-center justify-center rounded-full font-bold text-[#0F3D70] ${bord ? "border-2 border-white" : ""}`}
      style={{ background: couleurAvatar(p.id), width: taille, height: taille, fontSize: Math.round(taille * 0.36) }}
    >
      {initiales(p.prenom)}
    </span>
  );
}

function Pile({ gens }: { gens: Plongeur[] }) {
  return (
    <span className="flex">
      {gens.slice(0, 4).map((g, i) => (
        <span key={g.id} style={{ marginLeft: i === 0 ? 0 : -8 }}>
          <Avatar p={g} taille={28} bord />
        </span>
      ))}
    </span>
  );
}

function Coche() {
  return (
    <span className="flex h-[22px] w-[22px] shrink-0 items-center justify-center rounded-full bg-[#3DEFBE]/30">
      <Check className="h-[13px] w-[13px] text-[#0B8A68]" strokeWidth={3} aria-hidden="true" />
    </span>
  );
}

function LigneCommune({ label, valeur, aDroite }: { label: string; valeur: React.ReactNode; aDroite?: string | null }) {
  return (
    <div className="flex items-center gap-[12px] border-t border-[#EDF2F7] py-[11px] first:border-t-0">
      <Coche />
      <div className="min-w-0 flex-1">
        <div className="text-[12px] font-semibold text-[#566B82]">{label}</div>
        <div className="text-[15px] font-bold text-[#123A63]">{valeur}</div>
      </div>
      {aDroite && <span className="max-w-[40%] truncate text-[12px] text-[#566B82]">{aDroite}</span>}
    </div>
  );
}

function ChampMesure({
  label,
  unite,
  valeur,
  onChange,
}: {
  label: string;
  unite: string;
  valeur: string;
  onChange: (v: string) => void;
}) {
  return (
    <label className="block min-w-0 flex-1">
      <span className="block pb-[7px] text-[13px] font-semibold text-[#566B82]">{label}</span>
      <span className="relative block">
        <input
          value={valeur}
          onChange={(e) => onChange(e.target.value.replace(/[^\d.,]/g, "").slice(0, 5))}
          inputMode="decimal"
          placeholder="—"
          className="block h-[50px] w-full galet-moyen border-[1.5px] border-[#7B8FA3] bg-white pl-[16px] pr-[44px] text-[15px] text-[#123A63] outline-none placeholder:text-[#C2CFDB] focus:border-[#57D4F5]"
        />
        <span className="pointer-events-none absolute right-[14px] top-1/2 -translate-y-1/2 text-[13px] text-[#566B82]">{unite}</span>
      </span>
    </label>
  );
}

function Etoiles({ valeur, onChange }: { valeur: number; onChange: (n: number) => void }) {
  return (
    <div className="flex h-[50px] items-center gap-[6px] galet-moyen border-[1.5px] border-[#7B8FA3] bg-white px-[14px]">
      {[1, 2, 3, 4, 5].map((n) => (
        <button key={n} type="button" aria-label={`${n} sur 5`} aria-pressed={valeur === n} onClick={() => onChange(valeur === n ? 0 : n)}>
          <Star className={`h-[24px] w-[24px] ${n <= valeur ? "fill-[#FFC65C] text-[#FFC65C]" : "text-[#C9D6E2]"}`} strokeWidth={1.8} />
        </button>
      ))}
    </div>
  );
}

// Les lignes communes, dans l'ordre des maquettes. Seules les infos connues s'affichent.
function lignesCommunes(p: Proposition) {
  const c = p.commun;
  const palanquee = p.palanquee;
  const noms = [...palanquee.map((x) => x.prenom), ...p.noms_libres];
  const l: { cle: string; label: string; valeur: React.ReactNode; aDroite?: string | null }[] = [];
  if (c.site) l.push({ cle: "site", label: "Site", valeur: c.site, aDroite: c.lieu });
  if (c.date || c.heure)
    l.push({ cle: "date", label: "Date et mise à l'eau", valeur: [c.date ? dateCourte(c.date) : null, heure(c.heure)].filter(Boolean).join(", ") });
  if (c.duree) l.push({ cle: "duree", label: "Durée", valeur: `${c.duree} min` });
  if (c.temp_fond !== null && c.temp_fond !== undefined) l.push({ cle: "temp", label: "Température de l'eau", valeur: `${nombre(c.temp_fond)} °C` });
  if (c.visibilite) l.push({ cle: "visi", label: "Visibilité", valeur: `${c.visibilite} m` });
  if (c.bateau || c.club) l.push({ cle: "bateau", label: c.bateau ? "Bateau" : "Club", valeur: (c.bateau || c.club) as string });
  if (noms.length)
    l.push({
      cle: "palanquee",
      label: "Palanquée",
      valeur: (
        <span className="flex items-center gap-[8px] pt-[3px]">
          {palanquee.length > 0 && <Pile gens={palanquee} />}
          <span className="truncate text-[13.5px] font-medium text-[#566B82]">{noms.join(", ")}</span>
        </span>
      ),
    });
  return l;
}

function PageProposition() {
  const navigate = useNavigate();
  const { id, depuis } = Route.useSearch();
  const { pret, ecran: ecranConnexion } = useConnexionRequise();
  const [p, setP] = useState<Proposition | null | undefined>(undefined);
  const [ecran, setEcran] = useState<Ecran>("proposition");
  const [perso, setPerso] = useState<ChampsPerso>({ prof_max: "", pression_debut: "", pression_fin: "", lestage: "", note: 0 });
  const [maPlongee, setMaPlongee] = useState<string | null>(null);
  const [enCours, setEnCours] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);

  const retour = () => navigate({ to: depuis === "carnet" ? "/carnet" : "/amis" });

  useEffect(() => {
    if (!pret || !id) return;
    let actif = true;
    chargerProposition(id)
      .then((r) => {
        if (!actif) return;
        setP(r);
        setEcran(r.deja ? "deja" : "proposition");
      })
      .catch((e) => {
        console.error(e);
        if (actif) {
          setP(null);
          const msg = e && typeof e === "object" && "message" in e ? String(e.message) : "";
          setErreur(
            msg.includes("supprimée")
              ? "Cette plongée a été supprimée par ton binôme."
              : msg.includes("proposition_plongee")
                ? "Lance d'abord le script palanote-carnets-ensemble.sql dans Supabase."
                : "Cette proposition est introuvable.",
          );
        }
      });
    return () => {
      actif = false;
    };
  }, [pret, id]);

  if (ecranConnexion) return ecranConnexion;

  const set = (k: keyof ChampsPerso, v: string | number) => setPerso((x) => ({ ...x, [k]: v }));
  const champsVides = (["prof_max", "pression_debut", "pression_fin", "lestage"] as const).filter((k) => !String(perso[k] ?? "").trim()).length + (perso.note ? 0 : 1);
  const jours = joursRestants(p?.expire_le);
  const detail = (e: unknown) => (e && typeof e === "object" && "message" in e ? ` (détail : ${String(e.message)})` : "");

  const ajouter = async () => {
    if (!p) return;
    setEnCours(true);
    setErreur(null);
    try {
      const dive = await ajouterPlongeeIdentifiee(p.id, perso);
      setMaPlongee(dive);
      // Il manque encore tes mesures : on ouvre la fiche préremplie (écran 40).
      if (champsVides > 0) {
        setEcran("fiche");
        window.scrollTo({ top: 0 });
      } else {
        annoncerSurAccueil("La plongée a été ajoutée à ton carnet");
        navigate({ to: "/carnet" });
      }
    } catch (e) {
      console.error(e);
      setErreur(`La plongée n'a pas pu être ajoutée.${detail(e)}`);
    } finally {
      setEnCours(false);
    }
  };

  const completer = async () => {
    if (!p?.deja) return;
    setEnCours(true);
    setErreur(null);
    try {
      await completerPlongeeIdentifiee(p.id, p.deja.id);
      annoncerSurAccueil("Ta plongée a été complétée");
      navigate({ to: "/carnet" });
    } catch (e) {
      console.error(e);
      setErreur(`Ta plongée n'a pas pu être complétée.${detail(e)}`);
    } finally {
      setEnCours(false);
    }
  };

  const refuser = async () => {
    if (!p) return;
    setEnCours(true);
    try {
      await refuserIdentification(p.id);
      retour();
    } catch (e) {
      console.error(e);
      setErreur(`Ça n'a pas marché, réessaie.${detail(e)}`);
      setEnCours(false);
    }
  };

  const enregistrerFiche = async () => {
    if (!maPlongee) return;
    setEnCours(true);
    setErreur(null);
    try {
      await enregistrerChampsPerso(maPlongee, perso);
      annoncerSurAccueil("Ta plongée a bien été enregistrée");
      navigate({ to: "/carnet" });
    } catch (e) {
      console.error(e);
      setErreur(`Tes mesures n'ont pas pu être enregistrées.${detail(e)}`);
      setEnCours(false);
    }
  };

  const plusTard = () => {
    annoncerSurAccueil("La plongée a été ajoutée à ton carnet");
    navigate({ to: "/carnet" });
  };

  const barreHaut = (droite: React.ReactNode) => (
    <div className="flex items-center justify-between">
      <button type="button" aria-label="Retour" onClick={retour} className="flex h-10 w-10 items-center justify-center goutte bg-[#E3EDF6]">
        <ChevronLeft className="h-[18px] w-[18px]" strokeWidth={2.4} />
      </button>
      {droite}
    </div>
  );
  const disparait = jours !== null && <span className="text-[12.5px] text-[#566B82]">disparaît dans {jours} jour{jours > 1 ? "s" : ""}</span>;
  const boutonPrincipal = "flex h-[56px] w-full items-center justify-center galet-moyen bg-[#3DEFBE] text-[14px] font-bold tracking-wide text-[#0B3B63] shadow-[0_6px_16px_#3DEFBE40] disabled:opacity-60";
  const lienSecondaire = "mx-auto mt-[14px] block px-[8px] py-[8px] text-[14px] font-semibold text-[#566B82]";

  return (
    <div className="min-h-screen bg-[#F1F6FC] text-[#123A63]">
      <div className="cascade mx-auto flex min-h-screen w-full max-w-[430px] flex-col px-[22px] pb-[max(24px,env(safe-area-inset-bottom))] pt-[clamp(14px,2.6svh,22px)]">
        {p === undefined && (
          <>
            {barreHaut(null)}
            <div className="mt-[22px] h-[60px] animate-pulse galet bg-white" />
            <div className="mt-[16px] h-[340px] animate-pulse galet-b bg-white" />
          </>
        )}

        {p === null && (
          <>
            {barreHaut(null)}
            <p className="pt-[18svh] text-center text-[14.5px] text-[#566B82]">{erreur}</p>
          </>
        )}

        {p && p.statut !== "a_confirmer" && ecran !== "fiche" && (
          <>
            {barreHaut(null)}
            <p className="pt-[18svh] text-center text-[14.5px] text-[#566B82]">
              {p.statut === "ajoutee" ? "Cette plongée est déjà dans ton carnet." : "Tu as indiqué que ce n'était pas toi."}
            </p>
          </>
        )}

        {/* ---------- 39 · La proposition ---------- */}
        {p && p.statut === "a_confirmer" && ecran === "proposition" && (
          <>
            {barreHaut(disparait)}
            <div className="flex items-center gap-[14px] pt-[22px]">
              <Avatar p={p.de} taille={54} />
              <div className="min-w-0">
                <h1 className="text-[21px] font-bold leading-tight">{p.de.prenom} a plongé avec toi</h1>
                <p className="pt-[3px] text-[13.5px] text-[#566B82]">
                  {[p.commun.date ? dateCourte(p.commun.date) : null, heure(p.commun.heure) && `à ${heure(p.commun.heure)}`].filter(Boolean).join(" ")}
                  {p.validee_le && ` · fiche validée à ${heureCourte(p.validee_le)}`}
                </p>
              </div>
            </div>

            <div className="relative mt-[20px] galet border border-[#DCE7F0] bg-white px-[16px] pb-[6px] pt-[16px] shadow-[0_4px_14px_#123A6308]">
              <Meduse className="-right-[6px] -top-[14px]" />
              <div className="flex items-center gap-[8px] pb-[4px]">
                <h2 className="text-[15.5px] font-bold">Ce qui arrive dans ta fiche</h2>
                <span className="flex h-[22px] min-w-[22px] items-center justify-center rounded-full bg-[#3DEFBE]/30 px-[6px] text-[12px] font-bold text-[#0B6B52]">
                  {lignesCommunes(p).length}
                </span>
              </div>
              {lignesCommunes(p).map((l) => (
                <LigneCommune key={l.cle} label={l.label} valeur={l.valeur} aDroite={l.aDroite ?? null} />
              ))}
            </div>

            <div className="mt-[16px] galet-b border border-[#DCE7F0] bg-white px-[16px] py-[16px] shadow-[0_4px_14px_#123A6308]">
              <h2 className="text-[15.5px] font-bold">Ce qui reste à toi</h2>
              <p className="pb-[12px] pt-[3px] text-[12.5px] leading-snug text-[#566B82]">Tes mesures ne viennent jamais de ton binôme. Tu peux aussi les remplir plus tard.</p>
              <div className="flex gap-[12px]">
                <ChampMesure label="Profondeur max" unite="m" valeur={perso.prof_max ?? ""} onChange={(v) => set("prof_max", v)} />
                <ChampMesure label="Lestage" unite="kg" valeur={perso.lestage ?? ""} onChange={(v) => set("lestage", v)} />
              </div>
              <div className="flex gap-[12px] pt-[12px]">
                <ChampMesure label="Bloc au départ" unite="bar" valeur={perso.pression_debut ?? ""} onChange={(v) => set("pression_debut", v)} />
                <ChampMesure label="Bloc à l'arrivée" unite="bar" valeur={perso.pression_fin ?? ""} onChange={(v) => set("pression_fin", v)} />
              </div>
            </div>

            <div className="min-h-[22px] flex-grow" />
            {erreur && <p className="pb-[10px] text-center text-[13px] text-[#8A2A1A]">{erreur}</p>}
            <button type="button" disabled={enCours} onClick={() => void ajouter()} className={`mt-[18px] ${boutonPrincipal}`}>
              {enCours ? "AJOUT…" : "AJOUTER À MON CARNET"}
            </button>
            <button type="button" disabled={enCours} onClick={() => void refuser()} className={lienSecondaire}>
              Ce n'était pas moi
            </button>
          </>
        )}

        {/* ---------- 40 · La fiche préremplie, et ses trous ---------- */}
        {p && ecran === "fiche" && (
          <>
            <div className="flex items-center justify-end">
              <button type="button" onClick={plusTard} className="px-[4px] py-[8px] text-[14px] font-bold text-[#106F9F]">
                Plus tard
              </button>
            </div>
            <h1 className="pt-[8px] text-[24px] font-bold leading-tight">{p.commun.site || "Ta plongée"}</h1>
            <p className="pt-[3px] text-[13.5px] text-[#566B82]">
              ajoutée à ton carnet{p.commun.date ? ` · ${dateCourte(p.commun.date)}` : ""}
            </p>

            <div className="mt-[16px] flex items-center gap-[12px] galet-moyen border border-[#BFE6F5] bg-[#E3F4FC] px-[14px] py-[12px]">
              <span className="flex h-[34px] w-[34px] shrink-0 items-center justify-center goutte bg-white/70">
                <Info className="h-[17px] w-[17px] text-[#106F9F]" strokeWidth={2.2} aria-hidden="true" />
              </span>
              <div>
                <div className="text-[14.5px] font-bold">
                  Il te reste {champsVides} champ{champsVides > 1 ? "s" : ""}
                </div>
                <div className="text-[12.5px] text-[#566B82]">Le reste est arrivé de {p.de.prenom}.</div>
              </div>
            </div>

            <h2 className="pb-[10px] pt-[20px] text-[15.5px] font-bold">À toi</h2>
            <div className="flex gap-[12px]">
              <ChampMesure label="Profondeur max" unite="m" valeur={perso.prof_max ?? ""} onChange={(v) => set("prof_max", v)} />
              <ChampMesure label="Lestage" unite="kg" valeur={perso.lestage ?? ""} onChange={(v) => set("lestage", v)} />
            </div>
            <div className="flex gap-[12px] pt-[12px]">
              <ChampMesure label="Bloc au départ" unite="bar" valeur={perso.pression_debut ?? ""} onChange={(v) => set("pression_debut", v)} />
              <ChampMesure label="Bloc à l'arrivée" unite="bar" valeur={perso.pression_fin ?? ""} onChange={(v) => set("pression_fin", v)} />
            </div>
            <span className="block pb-[7px] pt-[12px] text-[13px] font-semibold text-[#566B82]">Ta note</span>
            <Etoiles valeur={perso.note ?? 0} onChange={(n) => set("note", n)} />

            <div className="relative mt-[18px] galet-c border border-[#DCE7F0] bg-white px-[16px] pb-[6px] pt-[16px] shadow-[0_4px_14px_#123A6308]">
              <Meduse className="-right-[6px] -top-[14px]" />
              <div className="flex items-baseline justify-between pb-[4px]">
                <h2 className="text-[15.5px] font-bold">Commun à la palanquée</h2>
                <span className="text-[12px] text-[#566B82]">de {p.de.prenom}</span>
              </div>
              {lignesCommunes(p)
                .filter((l) => l.cle !== "site")
                .map((l) => (
                  <LigneCommune key={l.cle} label={l.label} valeur={l.valeur} />
                ))}
            </div>

            <div className="min-h-[22px] flex-grow" />
            {erreur && <p className="pb-[10px] text-center text-[13px] text-[#8A2A1A]">{erreur}</p>}
            <button type="button" disabled={enCours} onClick={() => void enregistrerFiche()} className={`mt-[18px] ${boutonPrincipal}`}>
              {enCours ? "ENREGISTREMENT…" : "ENREGISTRER MA PLONGÉE"}
            </button>
          </>
        )}

        {/* ---------- 41 · La plongée était déjà notée ---------- */}
        {p && p.statut === "a_confirmer" && ecran === "deja" && p.deja && (
          <EcranDeja
            p={p}
            barre={barreHaut(disparait)}
            enCours={enCours}
            erreur={erreur}
            boutonPrincipal={boutonPrincipal}
            lienSecondaire={lienSecondaire}
            onCompleter={() => void completer()}
            onPasLaMeme={() => setEcran("proposition")}
          />
        )}
      </div>
    </div>
  );
}

function EcranDeja({
  p,
  barre,
  enCours,
  erreur,
  boutonPrincipal,
  lienSecondaire,
  onCompleter,
  onPasLaMeme,
}: {
  p: Proposition;
  barre: React.ReactNode;
  enCours: boolean;
  erreur: string | null;
  boutonPrincipal: string;
  lienSecondaire: string;
  onCompleter: () => void;
  onPasLaMeme: () => void;
}) {
  const m = p.deja!;
  const c = p.commun;
  const vide = (v: unknown) => v === null || v === undefined || v === "";
  // Ce que sa fiche peut combler dans la mienne (cases vides chez moi, remplies chez lui)
  const comblable: { label: string; valeur: React.ReactNode }[] = [];
  if (vide(m.heure) && c.heure) comblable.push({ label: "Mise à l'eau", valeur: heure(c.heure) });
  if (vide(m.site) && c.site) comblable.push({ label: "Site", valeur: c.site });
  if (vide(m.duree) && c.duree) comblable.push({ label: "Durée", valeur: `${c.duree} min` });
  if (vide(m.temp_fond) && !vide(c.temp_fond)) comblable.push({ label: "Température de l'eau", valeur: `${nombre(c.temp_fond)} °C` });
  if (vide(m.visibilite) && c.visibilite) comblable.push({ label: "Visibilité", valeur: `${c.visibilite} m` });
  if (vide(m.bateau) && c.bateau) comblable.push({ label: "Bateau", valeur: c.bateau });
  if (vide(m.club) && c.club) comblable.push({ label: "Club", valeur: c.club });
  comblable.push({ label: "Palanquée", valeur: <Pile gens={p.palanquee} /> });

  const ligne = (label: string, valeur: string | null) => (
    <div className="flex items-baseline justify-between gap-2 py-[3px] text-[12.5px]">
      <span className="text-[#566B82]">{label}</span>
      <b className="text-[13px] text-[#123A63]">{valeur ?? "—"}</b>
    </div>
  );

  return (
    <>
      {barre}
      <div className="flex items-center gap-[14px] pt-[22px]">
        <Avatar p={p.de} taille={54} />
        <div className="min-w-0">
          <h1 className="text-[21px] font-bold leading-tight">Tu as déjà noté cette plongée</h1>
          <p className="pt-[3px] text-[13.5px] text-[#566B82]">{p.de.prenom} parle de la même.</p>
        </div>
      </div>

      <div className="mt-[20px] flex gap-[10px]">
        <div className="min-w-0 flex-1 galet-moyen border-[1.5px] border-[#3DEFBE] bg-white px-[12px] py-[12px]">
          <div className="text-[14px] font-bold">La tienne</div>
          <div className="pb-[6px] text-[11.5px] text-[#566B82]">saisie à {heureCourte(m.saisie_le)}</div>
          {ligne("Profondeur", m.prof_max !== null ? `${nombre(m.prof_max)} m` : null)}
          {ligne("Durée", m.duree ? `${m.duree} min` : null)}
          {ligne("Eau", m.temp_fond !== null ? `${nombre(m.temp_fond)} °C` : null)}
          {ligne("Visibilité", m.visibilite ? `${m.visibilite} m` : null)}
        </div>
        <div className="min-w-0 flex-1 galet-moyen border border-[#DCE7F0] bg-white px-[12px] py-[12px]">
          <div className="truncate text-[14px] font-bold">Celle de {p.de.prenom}</div>
          <div className="pb-[6px] text-[11.5px] text-[#566B82]">validée à {heureCourte(p.validee_le)}</div>
          {ligne("Mise à l'eau", heure(c.heure))}
          {ligne("Durée", c.duree ? `${c.duree} min` : null)}
          {ligne("Eau", c.temp_fond !== null ? `${nombre(c.temp_fond)} °C` : null)}
          {ligne("Visibilité", c.visibilite ? `${c.visibilite} m` : null)}
        </div>
      </div>

      <div className="relative mt-[16px] galet border border-[#DCE7F0] bg-white px-[16px] pb-[6px] pt-[16px] shadow-[0_4px_14px_#123A6308]">
        <Meduse className="-right-[6px] -top-[14px]" />
        <div className="flex items-center justify-between gap-2 pb-[4px]">
          <h2 className="text-[15.5px] font-bold">Ce que sa fiche peut combler</h2>
          {comblable.length > 1 && (
            <span className="shrink-0 rounded-full bg-[#3DEFBE]/30 px-[9px] py-[3px] text-[11px] font-bold uppercase tracking-[.03em] text-[#0B6B52]">
              {comblable.length - 1} case{comblable.length > 2 ? "s" : ""} vide{comblable.length > 2 ? "s" : ""}
            </span>
          )}
        </div>
        {comblable.map((l) => (
          <div key={l.label} className="flex items-center gap-[12px] border-t border-[#EDF2F7] py-[11px] first:border-t-0">
            <Coche />
            <span className="flex-1 text-[14px] text-[#566B82]">{l.label}</span>
            <b className="text-[14px]">{l.valeur}</b>
          </div>
        ))}
        <p className="pb-[10px] text-[12px] leading-snug text-[#566B82]">Tes valeurs ne bougent pas : seules tes cases vides sont remplies.</p>
      </div>

      <div className="min-h-[22px] flex-grow" />
      {erreur && <p className="pb-[10px] text-center text-[13px] text-[#8A2A1A]">{erreur}</p>}
      <button type="button" disabled={enCours} onClick={onCompleter} className={`mt-[18px] ${boutonPrincipal}`}>
        {enCours ? "COMPLÉTION…" : "COMPLÉTER MA PLONGÉE"}
      </button>
      <button type="button" disabled={enCours} onClick={onPasLaMeme} className={lienSecondaire}>
        Ce n'est pas la même plongée
      </button>
    </>
  );
}
