import type { ReactNode } from "react";
import { ChevronRight } from "lucide-react";
import { BoutonRetourCarre } from "@/components/numerisation/Ui";
import { couleurAvatar, initiales } from "@/lib/amis";
import { heureCourte, LIBELLE_STATUT, type SortieResume, type StatutSortie } from "@/lib/club";

// Éléments communs aux écrans « sortie club » (parcours 15).

// Page interne : fond clair, titre et retour en haut (pas de bandeau bleu).
export function PageClub({
  titre,
  onRetour,
  droite,
  children,
  bas,
  navigation,
  large = false,
  titreBureau,
  sousTitreBureau,
}: {
  titre: string;
  onRetour?: () => void; // absent : page d'onglet (titre en grand, pas de retour)
  droite?: ReactNode;
  children: ReactNode;
  bas?: ReactNode;
  navigation?: ReactNode; // barre d'onglets du bas
  titreBureau?: string | undefined; // titre affiché à la place sur ordinateur ; avec lui, le sous-titre s'affiche partout
  sousTitreBureau?: string | undefined;
  large?: boolean | "plein"; // tableau de bord : s'élargit sur ordinateur ; « plein » = toute la largeur (planning)
}) {
  return (
    <div className="min-h-screen bg-[#F1F6FC] text-[#123A63]">
      <div className={`cascade mx-auto flex min-h-screen w-full max-w-[430px] flex-col ${large === "plein" ? "lg:max-w-none" : large ? "lg:max-w-[1120px]" : ""}`}>
        <div className={`sticky top-0 z-10 flex items-center gap-3 bg-[#F1F6FC]/95 px-[22px] ${large ? "lg:px-[40px]" : ""} pb-[10px] pt-[clamp(14px,2.6svh,22px)] backdrop-blur`}>
          {onRetour && (
            <span className={large ? "lg:hidden" : ""}>
              <BoutonRetourCarre onClick={onRetour} />
            </span>
          )}
          {titreBureau ? (
            // Accueil du DP : « Bonjour Marc », avec le centre et la date dessous (téléphone et ordinateur)
            <div className="min-w-0 flex-1">
              <h1 className="truncate text-[clamp(24px,3.6svh,28px)] font-bold leading-tight lg:text-[26px]">
                <span className="lg:hidden">{titre}</span>
                <span className="hidden lg:inline">{titreBureau}</span>
              </h1>
              {sousTitreBureau && <p className="truncate pt-[2px] text-[13.5px] text-[#5B7189] first-letter:uppercase">{sousTitreBureau}</p>}
            </div>
          ) : (
            <h1 className={`min-w-0 flex-1 truncate font-bold ${onRetour ? "text-[17px]" : "text-[clamp(24px,3.6svh,28px)]"} ${large ? "lg:text-[26px]" : ""}`}>{titre}</h1>
          )}
          {droite}
        </div>
        <div className={`flex flex-grow flex-col px-[22px] pb-[24px] ${large ? "lg:px-[40px]" : ""}`}>{children}</div>
        {bas && (
          <div
            className={`sticky z-10 bg-gradient-to-t from-[#F1F6FC] via-[#F1F6FC] to-transparent px-[22px] pt-[18px] ${large ? "lg:hidden" : ""} ${
              navigation ? "bottom-[calc(76px+env(safe-area-inset-bottom))] pb-[12px]" : "bottom-0 pb-[max(16px,env(safe-area-inset-bottom))]"
            }`}
          >
            {bas}
          </div>
        )}
        {navigation}
      </div>
    </div>
  );
}

export function Titre({ children, aide }: { children: ReactNode; aide?: ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-2 pb-[9px] pt-[22px]">
      <h2 className="text-[13px] font-bold uppercase tracking-[.08em] text-[#5B7189]">{children}</h2>
      {aide && <span className="text-[12px] text-[#9DB0C0]">{aide}</span>}
    </div>
  );
}

// prevu : prénom noté par le DP, pas encore rattaché à un compte (avatar en pointillés)
export function Avatar({ id, prenom, taille = 38, prevu = false }: { id: string | null; prenom: string; taille?: number; prevu?: boolean | undefined }) {
  return (
    <span
      className={`flex shrink-0 items-center justify-center rounded-full font-bold ${prevu ? "border-[1.5px] border-dashed border-[#9DB0C0] text-[#7D93A8]" : "text-[#0F3D70]"}`}
      style={{ background: prevu ? "#F4F8FB" : couleurAvatar(id ?? prenom), width: taille, height: taille, fontSize: Math.round(taille * 0.36) }}
      aria-hidden="true"
    >
      {initiales(prenom)}
    </span>
  );
}

const COULEURS_STATUT: Record<StatutSortie, string> = {
  prevue: "bg-[#E3F2FB] text-[#1176A8]",
  terminee: "bg-[#FFE8C7] text-[#8A5A10]",
  validee: "bg-[#3DEFBE] text-[#0B3B63]",
  annulee: "bg-[#EEF2F6] text-[#7D93A8]",
};

export function PastilleStatut({ statut }: { statut: StatutSortie }) {
  return <span className={`shrink-0 rounded-[10px] px-[9px] py-[3px] text-[11.5px] font-bold ${COULEURS_STATUT[statut]}`}>{LIBELLE_STATUT[statut]}</span>;
}

// La date en gros, comme un éphéméride
export function BlocDate({ date }: { date: string }) {
  const d = new Date(`${date}T12:00:00`);
  const jour = isNaN(d.getTime()) ? "" : String(d.getDate());
  const mois = isNaN(d.getTime()) ? "" : d.toLocaleDateString("fr-FR", { month: "short" }).replace(".", "");
  return (
    <span className="flex h-[50px] w-[46px] shrink-0 flex-col items-center justify-center goutte bg-[#0F3D70] leading-none text-white">
      <span className="text-[18px] font-bold">{jour}</span>
      <span className="pt-[2px] text-[10.5px] uppercase tracking-[.05em] text-white/75">{mois}</span>
    </span>
  );
}

export function LigneSortie({ s, onClick, pourDp = true }: { s: SortieResume; onClick: () => void; pourDp?: boolean }) {
  const details = pourDp
    ? `${s.nb_inscrits ?? 0} plongeur${(s.nb_inscrits ?? 0) > 1 ? "s" : ""}${s.statut === "prevue" && s.nb_prevus ? ` · ${s.nb_prevus} en attente` : ""}${s.statut !== "prevue" && s.nb_inscrits ? ` · ${s.nb_completees ?? 0} fiche${(s.nb_completees ?? 0) > 1 ? "s" : ""} complétée${(s.nb_completees ?? 0) > 1 ? "s" : ""}` : ""}`
    : [s.centre, s.dp ? `DP ${s.dp}` : null].filter(Boolean).join(" · ");
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex w-full items-center gap-[12px] galet-b border border-[#E4EBF1] bg-white px-[13px] py-[11px] text-left shadow-[0_3px_12px_#123A6306]"
    >
      <BlocDate date={s.date} />
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[15px] font-bold">{s.site}</span>
        <span className="block truncate text-[12.5px] text-[#5B7189]">
          {[heureCourte(s.heure), s.lieu].filter(Boolean).join(" · ")}
        </span>
        <span className="block truncate pt-[1px] text-[12px] text-[#7D93A8]">{details}</span>
      </span>
      <PastilleStatut statut={s.statut} />
      <ChevronRight className="h-[16px] w-[16px] shrink-0 text-[#9DB0C0]" aria-hidden="true" />
    </button>
  );
}

// Les 3 temps d'une sortie, pour que le DP sache toujours où il en est
export function Etapes({ statut, entreAmis = false }: { statut: StatutSortie; entreAmis?: boolean | undefined }) {
  // Entre amis : pas de tampon, la sortie s'arrête aux fiches envoyées
  const actuelle = statut === "prevue" ? 0 : entreAmis ? 2 : statut === "terminee" ? 2 : 3;
  const noms = entreAmis ? ["Inviter", "Après la plongée"] : ["Inscrire", "Après la plongée", "Tamponner"];
  return (
    <ol className="flex items-center gap-[6px] pt-[14px]" aria-label="Étapes de la sortie">
      {noms.map((n, i) => {
        const fait = i < actuelle;
        const courant = i === actuelle || (actuelle === 2 && i === 1);
        return (
          <li key={n} className="flex flex-1 flex-col gap-[5px]">
            <span className={`h-[5px] rounded-full ${fait ? "bg-[#3DEFBE]" : courant ? "bg-[#57D4F5]" : "bg-[#DCE7F0]"}`} />
            <span className={`text-[11px] font-semibold ${fait || courant ? "text-[#123A63]" : "text-[#9DB0C0]"}`}>
              {i + 1}. {n}
            </span>
          </li>
        );
      })}
    </ol>
  );
}

// Le tampon numérique : rond comme un tampon de club, posé un peu de travers.
export function TamponNumerique({
  centre,
  ville,
  dp,
  niveau,
  date,
  verifie,
  taille = 132,
  anime = false,
}: {
  centre: string;
  ville?: string | null | undefined;
  dp?: string | null | undefined;
  niveau?: string | null | undefined;
  date?: string | null | undefined;
  verifie?: boolean | undefined;
  taille?: number;
  anime?: boolean;
}) {
  const haut = centre.toUpperCase().slice(0, 28);
  const bas = (ville ?? "PLONGÉE VALIDÉE").toUpperCase().slice(0, 24);
  const d = date ? new Date(`${date.slice(0, 10)}T12:00:00`) : null;
  const dateTexte = d && !isNaN(d.getTime()) ? d.toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit", year: "numeric" }) : "";
  return (
    <svg
      viewBox="0 0 200 200"
      width={taille}
      height={taille}
      role="img"
      aria-label={`Tampon numérique : ${centre}${dp ? `, validé par ${dp}` : ""}${dateTexte ? ` le ${dateTexte}` : ""}`}
      className={`shrink-0 -rotate-[9deg] ${anime ? "tampon-pose" : ""}`}
    >
      <defs>
        <path id="tampon-haut" d="M 30 100 A 70 70 0 0 1 170 100" />
        <path id="tampon-bas" d="M 36 108 A 64 64 0 0 0 164 108" />
      </defs>
      <g fill="none" stroke="#D9573F" strokeWidth="5">
        <circle cx="100" cy="100" r="92" />
        <circle cx="100" cy="100" r="58" strokeWidth="2.5" />
      </g>
      <g fill="#D9573F" fontFamily="inherit" fontWeight="800">
        <text fontSize="15" letterSpacing="2">
          <textPath href="#tampon-haut" startOffset="50%" textAnchor="middle">
            {haut}
          </textPath>
        </text>
        <text fontSize="13" letterSpacing="2">
          <textPath href="#tampon-bas" startOffset="50%" textAnchor="middle">
            {bas}
          </textPath>
        </text>
        <text x="100" y="94" fontSize="21" textAnchor="middle" letterSpacing="1">
          VALIDÉE
        </text>
        {dateTexte && (
          <text x="100" y="114" fontSize="13" textAnchor="middle" fontWeight="700">
            {dateTexte}
          </text>
        )}
        {dp && (
          <text x="100" y="132" fontSize="11" textAnchor="middle" fontWeight="700">
            {`DP ${dp}${niveau ? ` · ${niveau}` : ""}`.slice(0, 22)}
          </text>
        )}
        {verifie && (
          <text x="100" y="66" fontSize="11" textAnchor="middle">
            ★ ★ ★
          </text>
        )}
      </g>
    </svg>
  );
}

export function Feuille({ titre, onFermer, children }: { titre: string; onFermer: () => void; children: ReactNode }) {
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center lg:items-center" role="dialog" aria-modal="true" aria-label={titre}>
      <button type="button" aria-label="Fermer" onClick={onFermer} className="absolute inset-0 bg-[#06203F]/45" />
      <div className="relative max-h-[92svh] w-full max-w-[430px] overflow-y-auto rounded-t-[34px] bg-white px-[24px] lg:rounded-[30px] pb-[max(24px,env(safe-area-inset-bottom))] pt-[14px] text-[#123A63] shadow-[0_-10px_30px_rgba(6,32,63,.18)]">
        <div className="mx-auto mb-[14px] h-[5px] w-[44px] rounded-full bg-[#DCE7F0]" aria-hidden="true" />
        <h2 className="pb-[10px] text-[20px] font-bold leading-tight">{titre}</h2>
        {children}
      </div>
    </div>
  );
}

export function ChampTexte({
  label,
  aide,
  ...props
}: { label: string; aide?: string } & React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <label className="block">
      <span className="block pb-[7px] text-[13px] font-semibold text-[#5B7189]">{label}</span>
      <input
        {...props}
        className="block h-[52px] w-full min-w-0 galet-moyen border-[1.5px] border-[#E4EBF1] bg-white px-[16px] text-[15px] text-[#123A63] outline-none placeholder:text-[#B5C4D1] focus:border-[#57D4F5]"
      />
      {aide && <span className="block pt-[6px] text-[12px] text-[#9DB0C0]">{aide}</span>}
    </label>
  );
}

export function MessageErreur({ texte }: { texte: string | null }) {
  if (!texte) return null;
  return (
    <p role="alert" className="mt-[12px] galet-petit bg-[#FFE4DE] px-3 py-2 text-[13px] text-[#8A2A1A]">
      {texte}
    </p>
  );
}

export function detailErreur(e: unknown, defaut: string) {
  const m = e && typeof e === "object" && "message" in e ? String((e as { message: unknown }).message) : "";
  if (/Could not find the function|does not exist|PGRST202/i.test(m))
    return "Le script « palanote-sorties-club.sql » n'est pas encore lancé dans Supabase.";
  return m ? `${defaut} (détail : ${m})` : defaut;
}
