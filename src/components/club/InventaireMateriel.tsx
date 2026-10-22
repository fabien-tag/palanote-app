import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { AlertTriangle, CheckCircle2, Search, X } from "lucide-react";
import { MessageErreur } from "@/components/club/Ui";
import {
  CATEGORIES,
  chargerInventaire,
  dateFr,
  echeance,
  ETATS,
  LIBELLES_CARAC,
  modifierArticle,
  type Article,
  type CategorieArticle,
  type EtatArticle,
} from "@/lib/inventaire";

// L'inventaire du club, pièce par pièce : un onglet par famille (bateaux, blocs, détendeurs…),
// un tableau adapté à chacune, et la fiche complète d'une pièce en cliquant sur sa ligne.

type Colonne = { titre: string; valeur: (a: Article) => ReactNode; classe?: string };
const c = (a: Article, k: string) => a.caracteristiques?.[k] ?? "—";
const nomComplet = (a: Article) => [a.marque, a.modele].filter(Boolean).join(" ") || a.libelle || "—";

function Echeance({ a, date }: { a: Article; date: string | null }) {
  if (!date) return <span className="text-[#C9D5E0]">—</span>;
  const e = echeance({ ...a, prochain_controle: date, prochaine_requalif: null });
  return (
    <span
      className={`inline-flex items-center gap-[4px] rounded-[8px] px-[7px] py-[2px] text-[12px] font-bold ${
        e.etat === "depasse" ? "bg-[#FFE9E2] text-[#B8432F]" : e.etat === "bientot" ? "bg-[#FFF1D6] text-[#8A5A10]" : "text-[#3F5B76]"
      }`}
    >
      {e.etat !== "ok" && <AlertTriangle className="h-[12px] w-[12px]" />}
      {dateFr(date)}
    </span>
  );
}

function PastilleEtat({ etat }: { etat: EtatArticle }) {
  const e = ETATS.find((x) => x.id === etat) ?? ETATS[0]!;
  return <span className={`inline-block whitespace-nowrap rounded-[8px] px-[8px] py-[2px] text-[11.5px] font-bold ${e.classe}`}>{e.libelle}</span>;
}

const COLONNES: Record<CategorieArticle, Colonne[]> = {
  bateau: [
    { titre: "Nom", valeur: (a) => <b>{a.libelle}</b> },
    { titre: "Type", valeur: (a) => `${c(a, "type")} · ${nomComplet(a)}` },
    { titre: "Immatriculation", valeur: (a) => c(a, "immatriculation") },
    { titre: "Capacité", valeur: (a) => c(a, "places") },
    { titre: "Moteur", valeur: (a) => c(a, "moteur") },
    { titre: "Prochaine visite", valeur: (a) => <Echeance a={a} date={a.prochain_controle} /> },
  ],
  bloc: [
    { titre: "Volume", valeur: (a) => <b>{c(a, "volume")}</b> },
    { titre: "Marque", valeur: (a) => nomComplet(a) },
    { titre: "N° de série", valeur: (a) => a.numero_serie ?? "—", classe: "font-mono text-[12px]" },
    { titre: "Gaz", valeur: (a) => c(a, "gaz") },
    { titre: "Robinetterie", valeur: (a) => c(a, "robinetterie") },
    { titre: "Dernier TIV", valeur: (a) => dateFr(a.dernier_controle) },
    { titre: "Prochain TIV", valeur: (a) => <Echeance a={a} date={a.prochain_controle} /> },
    { titre: "Requalification", valeur: (a) => <Echeance a={a} date={a.prochaine_requalif} /> },
  ],
  detendeur: [
    { titre: "Modèle", valeur: (a) => <b>{nomComplet(a)}</b> },
    { titre: "Raccord", valeur: (a) => c(a, "raccord") },
    { titre: "Eau froide", valeur: (a) => c(a, "eau_froide") },
    { titre: "Nitrox", valeur: (a) => c(a, "usage_nitrox") },
    { titre: "N° de série", valeur: (a) => a.numero_serie ?? "—", classe: "font-mono text-[12px]" },
    { titre: "Dernière révision", valeur: (a) => dateFr(a.dernier_controle) },
    { titre: "Prochaine révision", valeur: (a) => <Echeance a={a} date={a.prochain_controle} /> },
  ],
  combinaison: [
    { titre: "Type", valeur: (a) => <b>{c(a, "type")}</b> },
    { titre: "Modèle", valeur: (a) => nomComplet(a) },
    { titre: "Taille", valeur: (a) => a.taille ?? "—" },
    { titre: "Coupe / matière", valeur: (a) => (a.caracteristiques?.["matiere"] ?? a.caracteristiques?.["genre"] ?? "—") as string },
    { titre: "Épaisseur / manchons", valeur: (a) => (a.caracteristiques?.["epaisseur"] ?? a.caracteristiques?.["manchons"] ?? "—") as string },
    { titre: "Prochaine révision", valeur: (a) => <Echeance a={a} date={a.prochain_controle} /> },
  ],
  recycleur: [
    { titre: "Modèle", valeur: (a) => <b>{nomComplet(a)}</b> },
    { titre: "Contrôleur", valeur: (a) => c(a, "controleur") },
    { titre: "Blocs", valeur: (a) => c(a, "blocs") },
    { titre: "Heures", valeur: (a) => c(a, "heures") },
    { titre: "Dernière révision", valeur: (a) => dateFr(a.dernier_controle) },
    { titre: "Prochaine révision", valeur: (a) => <Echeance a={a} date={a.prochain_controle} /> },
  ],
  gilet: [
    { titre: "Modèle", valeur: (a) => <b>{nomComplet(a)}</b> },
    { titre: "Taille", valeur: (a) => a.taille ?? "—" },
    { titre: "Lestage intégré", valeur: (a) => c(a, "lestage_integre") },
    { titre: "Dernière révision", valeur: (a) => dateFr(a.dernier_controle) },
    { titre: "Prochaine révision", valeur: (a) => <Echeance a={a} date={a.prochain_controle} /> },
  ],
  ordinateur: [
    { titre: "Modèle", valeur: (a) => <b>{nomComplet(a)}</b> },
    { titre: "Algorithme", valeur: (a) => c(a, "algorithme") },
    { titre: "Nitrox", valeur: (a) => c(a, "nitrox") },
    { titre: "Pile", valeur: (a) => c(a, "pile") },
    { titre: "N° de série", valeur: (a) => a.numero_serie ?? "—", classe: "font-mono text-[12px]" },
  ],
  autre: [
    { titre: "Désignation", valeur: (a) => <b>{a.libelle ?? nomComplet(a)}</b> },
    { titre: "Prochain contrôle", valeur: (a) => <Echeance a={a} date={a.prochain_controle} /> },
  ],
};

export function InventaireMateriel({ centre }: { centre: string }) {
  const [articles, setArticles] = useState<Article[] | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);
  const [cat, setCat] = useState<CategorieArticle>("bloc");
  const [filtre, setFiltre] = useState<"tous" | "controler" | "hors">("tous");
  const [q, setQ] = useState("");
  const [ouvert, setOuvert] = useState<Article | null>(null);

  const charger = useCallback(async () => {
    try {
      const l = await chargerInventaire(centre);
      setArticles(l);
      setOuvert((o) => (o ? (l.find((x) => x.id === o.id) ?? null) : null));
      setErreur(null);
    } catch (e) {
      console.error(e);
      setArticles([]);
      setErreur("L'inventaire n'est pas encore installé : lance le script palanote-inventaire-materiel.sql dans Supabase.");
    }
  }, [centre]);
  useEffect(() => {
    void charger();
  }, [charger]);

  const tous = useMemo(() => articles ?? [], [articles]);
  const parCat = useMemo(() => {
    const m = new Map<CategorieArticle, Article[]>();
    for (const a of tous) m.set(a.categorie, [...(m.get(a.categorie) ?? []), a]);
    return m;
  }, [tous]);
  const presentes = CATEGORIES.filter((x) => (parCat.get(x.id)?.length ?? 0) > 0);
  useEffect(() => {
    if (presentes.length && !presentes.some((x) => x.id === cat)) setCat(presentes[0]!.id);
  }, [presentes, cat]);

  const aControler = (a: Article) => a.etat === "a_controler" || ["depasse", "bientot"].includes(echeance(a).etat);
  const s = q.trim().toLowerCase();
  const liste = (parCat.get(cat) ?? [])
    .filter((a) => (filtre === "tous" ? true : filtre === "controler" ? aControler(a) : a.etat === "hors_service" || a.etat === "en_reparation"))
    .filter(
      (a) =>
        !s ||
        `${a.reference} ${a.libelle ?? ""} ${a.marque ?? ""} ${a.modele ?? ""} ${a.taille ?? ""} ${a.numero_serie ?? ""} ${Object.values(a.caracteristiques ?? {}).join(" ")}`
          .toLowerCase()
          .includes(s),
    );
  const colonnes = COLONNES[cat];

  return (
    <>
      <MessageErreur texte={erreur} />
      {articles && articles.length === 0 && !erreur && (
        <p className="mt-[12px] rounded-[10px] border border-dashed border-[#D5E1EC] bg-white/60 px-[15px] py-[16px] text-[13.5px] text-[#566B82]">
          Aucune pièce dans l'inventaire pour l'instant.
        </p>
      )}
      {presentes.length > 0 && (
        <>
          {/* Une famille de matériel par onglet */}
          <div className="mt-[8px] flex gap-[4px] overflow-x-auto border-b border-[#DFEAF2]" role="tablist">
            {presentes.map((x) => {
              const l = parCat.get(x.id) ?? [];
              const alerte = l.filter(aControler).length;
              return (
                <button
                  key={x.id}
                  type="button"
                  role="tab"
                  aria-selected={cat === x.id}
                  onClick={() => setCat(x.id)}
                  className={`-mb-px flex shrink-0 items-center gap-[7px] border-b-[2.5px] px-[12px] pb-[10px] pt-[6px] text-[14px] font-bold ${
                    cat === x.id ? "border-[#0F3D70] text-[#123A63]" : "border-transparent text-[#566B82] hover:text-[#123A63]"
                  }`}
                >
                  {x.libelle}
                  <span className={`rounded-[8px] px-[6px] text-[11.5px] ${cat === x.id ? "bg-[#0F3D70] text-white" : "bg-[#EEF3F8] text-[#566B82]"}`}>{l.length}</span>
                  {alerte > 0 && <span className="h-[7px] w-[7px] rounded-full bg-[#FF8A75]" aria-label={`${alerte} à contrôler`} />}
                </button>
              );
            })}
          </div>

          <div className="flex flex-wrap items-center gap-[10px] pt-[14px]">
            <label className="flex h-[40px] min-w-[220px] flex-1 items-center gap-[8px] rounded-[10px] border border-[#E4EBF1] bg-white px-[12px] focus-within:border-[#57D4F5] lg:max-w-[340px]">
              <Search className="h-[16px] w-[16px] text-[#566B82]" />
              <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Référence, marque, n° de série, taille…" aria-label="Chercher dans l'inventaire" className="min-w-0 flex-1 bg-transparent text-[14px] outline-none" />
              {q && (
                <button type="button" aria-label="Effacer" onClick={() => setQ("")}>
                  <X className="h-[14px] w-[14px] text-[#566B82]" />
                </button>
              )}
            </label>
            <div className="flex rounded-[10px] bg-[#E3EDF6] p-[3px]">
              {(
                [
                  ["tous", "Tout"],
                  ["controler", "À contrôler"],
                  ["hors", "Indisponible"],
                ] as const
              ).map(([id, l]) => (
                <button
                  key={id}
                  type="button"
                  onClick={() => setFiltre(id)}
                  className={`h-[34px] rounded-[8px] px-[12px] text-[12.5px] font-bold ${filtre === id ? "bg-white text-[#123A63] shadow-[0_2px_6px_#123A6314]" : "text-[#566B82]"}`}
                >
                  {l}
                </button>
              ))}
            </div>
            <span className="ml-auto text-[12.5px] text-[#566B82]">
              {liste.length} pièce{liste.length > 1 ? "s" : ""} · clique sur une ligne pour la fiche
            </span>
          </div>

          <div className="mt-[10px] overflow-x-auto rounded-[10px] border border-[#E4EBF1] bg-white">
            <table className="w-full min-w-[820px] border-collapse text-[13px]">
              <thead>
                <tr className="border-b border-[#E4EBF1] text-left text-[11px] font-bold uppercase tracking-[.06em] text-[#566B82]">
                  <th className="px-[12px] py-[10px]">Réf.</th>
                  {colonnes.map((col) => (
                    <th key={col.titre} className="px-[8px] py-[10px]">
                      {col.titre}
                    </th>
                  ))}
                  <th className="px-[12px] py-[10px] text-right">État</th>
                </tr>
              </thead>
              <tbody>
                {liste.map((a) => (
                  <tr
                    key={a.id}
                    tabIndex={0}
                    onClick={() => setOuvert(a)}
                    onKeyDown={(e) => e.key === "Enter" && setOuvert(a)}
                    className={`cursor-pointer border-b border-[#F0F4F8] last:border-0 hover:bg-[#F5F9FD] ${ouvert?.id === a.id ? "bg-[#EEF6FC]" : ""}`}
                  >
                    <td className="whitespace-nowrap px-[12px] py-[10px] font-mono text-[12px] font-bold text-[#106F9F]">{a.reference}</td>
                    {colonnes.map((col) => (
                      <td key={col.titre} className={`px-[8px] py-[10px] ${col.classe ?? ""}`}>
                        {col.valeur(a)}
                      </td>
                    ))}
                    <td className="px-[12px] py-[10px] text-right">
                      <PastilleEtat etat={a.etat} />
                    </td>
                  </tr>
                ))}
                {liste.length === 0 && (
                  <tr>
                    <td colSpan={colonnes.length + 2} className="px-[12px] py-[20px] text-center text-[13px] text-[#566B82]">
                      Rien ne correspond.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </>
      )}
      {ouvert && <FicheArticle a={ouvert} onFermer={() => setOuvert(null)} onChange={() => void charger()} />}
    </>
  );
}

// La fiche d'une pièce, dans un panneau qui glisse depuis la droite
function FicheArticle({ a, onFermer, onChange }: { a: Article; onFermer: () => void; onChange: () => void }) {
  const [entre, setEntre] = useState(false);
  const [enCours, setEnCours] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);
  const cat = CATEGORIES.find((x) => x.id === a.categorie) ?? CATEGORIES[0]!;
  useEffect(() => {
    requestAnimationFrame(() => requestAnimationFrame(() => setEntre(true)));
    const k = (e: KeyboardEvent) => e.key === "Escape" && fermer();
    window.addEventListener("keydown", k);
    return () => window.removeEventListener("keydown", k);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  const fermer = () => {
    setEntre(false);
    setTimeout(onFermer, 260);
  };
  const agir = async (champs: Parameters<typeof modifierArticle>[1]) => {
    setEnCours(true);
    setErreur(null);
    try {
      await modifierArticle(a.id, champs);
      onChange();
    } catch (e) {
      console.error(e);
      setErreur("La modification n'a pas pu être enregistrée.");
    } finally {
      setEnCours(false);
    }
  };
  const auj = new Date().toISOString().slice(0, 10);
  const dansUnAn = (() => {
    const d = new Date();
    d.setFullYear(d.getFullYear() + 1);
    return d.toISOString().slice(0, 10);
  })();
  const ligne = (l: string, v: ReactNode) => (
    <div key={l} className="flex items-start justify-between gap-[16px] border-b border-[#F0F4F8] py-[9px] text-[13.5px] last:border-0">
      <span className="shrink-0 text-[#566B82]">{l}</span>
      <span className="text-right font-semibold">{v}</span>
    </div>
  );
  const caracs = Object.entries(a.caracteristiques ?? {}).filter(([k]) => k !== "demo");

  if (typeof document === "undefined") return null;
  return createPortal(
    <div className="bureau fixed inset-0 z-[60] flex justify-end" role="dialog" aria-modal="true" aria-label={`Fiche ${a.reference}`}>
      <button type="button" aria-label="Fermer" onClick={fermer} className={`absolute inset-0 bg-[#0B2540]/30 transition-opacity duration-300 ${entre ? "opacity-100" : "opacity-0"}`} />
      <aside
        className={`relative flex h-full w-full max-w-[520px] flex-col bg-white text-[#123A63] shadow-[-16px_0_48px_#0B254033] transition-transform duration-300 ease-out ${
          entre ? "translate-x-0" : "translate-x-full"
        }`}
      >
        <header className="flex items-start gap-[12px] border-b border-[#DFEAF2] px-[32px] py-[18px]">
          <span className="min-w-0 flex-1">
            <span className="block font-mono text-[12.5px] font-bold text-[#106F9F]">
              {a.reference} · {cat.libelle.replace(/s$/, "")}
            </span>
            <span className="block pt-[2px] text-[21px] font-bold leading-tight">{a.libelle ?? nomComplet(a)}</span>
            <span className="block pt-[2px] text-[13px] text-[#566B82]">{nomComplet(a)}</span>
          </span>
          <PastilleEtat etat={a.etat} />
          <button type="button" aria-label="Fermer" onClick={fermer} className="flex h-[36px] w-[36px] shrink-0 items-center justify-center rounded-[10px] bg-[#EEF3F8]">
            <X className="h-[17px] w-[17px]" />
          </button>
        </header>
        <div className="flex-1 overflow-y-auto px-[32px] pb-[24px]">
          <MessageErreur texte={erreur} />
          <p className="pb-[6px] pt-[18px] text-[11.5px] font-bold uppercase tracking-[.1em] text-[#566B82]">Contrôles</p>
          <div className="rounded-[10px] border border-[#E4EBF1] px-[14px]">
            {ligne(`${cat.controle} : dernier`, dateFr(a.dernier_controle))}
            {ligne(`${cat.controle} : prochain`, <Echeance a={a} date={a.prochain_controle} />)}
            {cat.requalif && ligne(`${cat.requalif} : dernière`, dateFr(a.derniere_requalif))}
            {cat.requalif && ligne(`${cat.requalif} : prochaine`, <Echeance a={a} date={a.prochaine_requalif} />)}
          </div>
          <div className="flex flex-wrap gap-[8px] pt-[10px]">
            <button
              type="button"
              disabled={enCours}
              onClick={() => void agir({ dernier_controle: auj, prochain_controle: dansUnAn, etat: "ok" })}
              className="flex h-[38px] items-center gap-[6px] rounded-[10px] bg-[#0F3D70] px-[12px] text-[12.5px] font-bold text-white disabled:opacity-50"
            >
              <CheckCircle2 className="h-[15px] w-[15px]" /> Contrôle fait aujourd'hui (prochain dans 1 an)
            </button>
          </div>

          <p className="pb-[6px] pt-[20px] text-[11.5px] font-bold uppercase tracking-[.1em] text-[#566B82]">État</p>
          <div className="flex flex-wrap gap-[6px]">
            {ETATS.map((e) => (
              <button
                key={e.id}
                type="button"
                disabled={enCours}
                onClick={() => a.etat !== e.id && void agir({ etat: e.id })}
                className={`h-[34px] rounded-[10px] px-[11px] text-[12.5px] font-bold ${a.etat === e.id ? "bg-[#0F3D70] text-white" : "border border-[#D8E5EE] bg-white text-[#566B82]"}`}
              >
                {e.libelle}
              </button>
            ))}
          </div>

          <p className="pb-[6px] pt-[20px] text-[11.5px] font-bold uppercase tracking-[.1em] text-[#566B82]">Identité</p>
          <div className="rounded-[10px] border border-[#E4EBF1] px-[14px]">
            {ligne("Marque", a.marque ?? "—")}
            {ligne("Modèle", a.modele ?? "—")}
            {a.taille && ligne("Taille", a.taille)}
            {ligne("N° de série", <span className="font-mono">{a.numero_serie ?? "—"}</span>)}
            {ligne("Mise en service", dateFr(a.mise_en_service))}
          </div>

          {caracs.length > 0 && (
            <>
              <p className="pb-[6px] pt-[20px] text-[11.5px] font-bold uppercase tracking-[.1em] text-[#566B82]">Caractéristiques</p>
              <div className="rounded-[10px] border border-[#E4EBF1] px-[14px]">{caracs.map(([k, v]) => ligne(LIBELLES_CARAC[k] ?? k, v))}</div>
            </>
          )}
          {a.note && (
            <>
              <p className="pb-[6px] pt-[20px] text-[11.5px] font-bold uppercase tracking-[.1em] text-[#566B82]">Note</p>
              <p className="rounded-[10px] bg-[#F7FAFD] px-[14px] py-[10px] text-[13.5px] leading-snug">{a.note}</p>
            </>
          )}
        </div>
      </aside>
    </div>,
    document.body,
  );
}
