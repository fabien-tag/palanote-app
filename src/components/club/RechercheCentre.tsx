import { forwardRef, useEffect, useState } from "react";
import { Anchor, BadgeCheck, Check, Lock, Search } from "lucide-react";
import { chercherCentres, rejoindreCentre, type Centre } from "@/lib/club";
import { detailErreur } from "@/components/club/Ui";

// Un centre qui a déjà un directeur de plongée ne se rejoint pas en un clic (il protège les données de ses plongeurs).
export const MESSAGE_CENTRE_GERE =
  "Ce centre a déjà un directeur de plongée. Pour protéger les données de ses plongeurs, on ne peut pas le rejoindre seul : demande à son directeur de plongée d'écrire à Palanote (Paramètres › Aide) pour t'ajouter.";

// La recherche d'un centre, avec ses résultats : sur la vitrine de l'espace club (grand) et sur « Mon centre »
export const RechercheCentre = forwardRef<
  HTMLInputElement,
  {
    onFini: (c: Centre) => void;
    exclure?: string[]; // les centres déjà affichés ailleurs (« Tes centres »)
    grand?: boolean;
    onRecherche?: (q: string) => void;
  }
>(function RechercheCentre({ onFini, exclure = [], grand = false, onRecherche }, ref) {
  const [q, setQ] = useState("");
  const [resultats, setResultats] = useState<Centre[]>([]);
  const [enCours, setEnCours] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);

  // Recherche au fil de la frappe
  useEffect(() => {
    const t = setTimeout(() => {
      void chercherCentres(q)
        .then(setResultats)
        .catch(() => setResultats([]));
    }, 220);
    return () => clearTimeout(t);
  }, [q]);

  const rejoindre = async (c: Centre) => {
    if (c.membre) return onFini(c);
    if ((c.nb_dp ?? 0) > 0) return setErreur(MESSAGE_CENTRE_GERE);
    setEnCours(true);
    setErreur(null);
    try {
      onFini(await rejoindreCentre(c.id));
    } catch (e) {
      const m =
        e && typeof e === "object" && "message" in e
          ? String((e as { message: unknown }).message)
          : "";
      setErreur(
        m.includes("centre_deja_gere")
          ? MESSAGE_CENTRE_GERE
          : detailErreur(e, "Tu n'as pas pu rejoindre ce centre."),
      );
    } finally {
      setEnCours(false);
    }
  };

  const liste = resultats.filter((r) => !exclure.includes(r.id));
  // Sur la vitrine, la liste n'apparaît qu'une fois qu'on a commencé à chercher
  const montrer = !grand || q.trim().length >= 2;

  return (
    <div>
      <label
        className={
          grand
            ? "flex h-[64px] items-center gap-[14px] galet-moyen bg-white px-[20px] shadow-[0_18px_40px_-18px_#0006] ring-2 ring-transparent transition focus-within:ring-[#3DEFBE]"
            : "flex h-[52px] items-center gap-[10px] galet-moyen border-[1.5px] border-[#7B8FA3] bg-white px-[16px] focus-within:border-[#57D4F5]"
        }
      >
        <Search
          className={
            grand
              ? "h-[22px] w-[22px] shrink-0 text-[#106F9F]"
              : "h-[18px] w-[18px] shrink-0 text-[#566B82]"
          }
          aria-hidden="true"
        />
        <input
          ref={ref}
          value={q}
          onChange={(e) => {
            setQ(e.target.value);
            setErreur(null);
            onRecherche?.(e.target.value);
          }}
          placeholder={grand ? "Cherche ton club : nom ou ville" : "Nom du club ou ville"}
          aria-label="Rechercher un centre de plongée"
          className={`min-w-0 flex-1 bg-transparent text-[#0F3D70] outline-none placeholder:text-[#9DB0C0] ${grand ? "text-[17px] font-medium" : "text-[15px]"}`}
        />
      </label>

      {montrer && (
        <div className={`grid grid-cols-1 gap-[8px] pt-[10px] ${grand ? "" : "lg:grid-cols-2"}`}>
          {liste.map((c) => (
            <LigneCentre
              key={c.id}
              c={c}
              onClick={() => void rejoindre(c)}
              desactive={enCours}
              gere={(c.nb_dp ?? 0) > 0}
            />
          ))}
          {liste.length === 0 && q.trim().length >= 2 && (
            <p
              className={`px-[4px] text-[13.5px] ${grand ? "text-white/75" : "text-[#566B82] lg:col-span-2"}`}
            >
              Aucun centre ne s'appelle comme ça pour l'instant.
            </p>
          )}
        </div>
      )}

      {erreur && (
        <p className="mt-[10px] galet-petit bg-[#FFF3E6] px-[14px] py-[10px] text-[13.5px] leading-snug text-[#8A4A10]">
          {erreur}
        </p>
      )}
    </div>
  );
});

export function LigneCentre({
  c,
  onClick,
  membre = false,
  desactive = false,
  gere = false,
}: {
  c: Centre;
  onClick: () => void;
  membre?: boolean;
  desactive?: boolean;
  gere?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={desactive}
      className="flex w-full items-center gap-[12px] galet-b border border-[#E4EBF1] bg-white px-[13px] py-[11px] text-left text-[#0F3D70] disabled:opacity-60"
    >
      <span className="flex h-[38px] w-[38px] shrink-0 items-center justify-center goutte bg-[#E3F2FB]">
        <Anchor className="h-[18px] w-[18px] text-[#106F9F]" strokeWidth={2.1} aria-hidden="true" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-[5px] text-[15px] font-bold">
          <span className="truncate">{c.nom}</span>
          {c.verifie && (
            <BadgeCheck
              className="h-[15px] w-[15px] shrink-0 text-[#106F9F]"
              aria-label="Centre vérifié"
            />
          )}
        </span>
        <span className="block truncate text-[12.5px] text-[#566B82]">
          {[c.ville, `${c.nb_dp ?? 0} directeur${(c.nb_dp ?? 0) > 1 ? "s" : ""} de plongée`]
            .filter(Boolean)
            .join(" · ")}
        </span>
      </span>
      {membre || c.membre ? (
        <Check
          className="h-[18px] w-[18px] shrink-0 text-[#137758]"
          strokeWidth={2.6}
          aria-label="Ton centre"
        />
      ) : gere ? (
        <span className="flex shrink-0 items-center gap-[4px] text-[12.5px] font-semibold text-[#566B82]">
          <Lock className="h-[13px] w-[13px]" strokeWidth={2.4} aria-hidden="true" />
          Déjà géré
        </span>
      ) : (
        <span className="shrink-0 text-[13px] font-bold text-[#106F9F]">Rejoindre</span>
      )}
    </button>
  );
}
