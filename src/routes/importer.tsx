import { useEffect, useRef, useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { Check, FileUp, ShieldCheck } from "lucide-react";
import { useConnexionRequise } from "@/components/numerisation/Ui";
import { MessageErreur, PageClub, Titre } from "@/components/club/Ui";
import { importerPlongees, lireFichier, plongeesDAvant, separerDoublons, type PlongeeImportee } from "@/lib/import-plongees";
import { annoncerSurAccueil } from "@/lib/message-accueil";

// Importer ses plongées depuis une autre app (fichier UDDF ou Subsurface)
export const Route = createFileRoute("/importer")({
  validateSearch: (search: Record<string, unknown>): { depuis?: "moi" | "numeriser" } =>
    search["depuis"] === "moi" || search["depuis"] === "numeriser" ? { depuis: search["depuis"] } : {},
  head: () => ({ meta: [{ title: "Palanote — Importer mes plongées" }] }),
  component: Importer,
});

const APPS = [
  { nom: "Subsurface", ou: "Fichier › Exporter › UDDF, ou le fichier .ssrf directement" },
  { nom: "MacDive", ou: "Fichier › Exporter › UDDF" },
  { nom: "Shearwater Cloud", ou: "sélectionne tes plongées › Exporter › UDDF" },
  { nom: "Une autre app", ou: "cherche « Exporter » puis « UDDF » : c'est le format standard des carnets" },
];

function Importer() {
  const navigate = useNavigate();
  const { depuis } = Route.useSearch();
  const { pret, ecran } = useConnexionRequise();
  const champ = useRef<HTMLInputElement>(null);
  const [nomFichier, setNomFichier] = useState<string | null>(null);
  const [format, setFormat] = useState<string | null>(null);
  const [nouvelles, setNouvelles] = useState<PlongeeImportee[] | null>(null);
  const [doublons, setDoublons] = useState(0);
  const [avant, setAvant] = useState(0);
  const [ajuster, setAjuster] = useState(true);
  const [enCours, setEnCours] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);

  useEffect(() => {
    if (pret) void plongeesDAvant().then(setAvant);
  }, [pret]);

  if (ecran) return ecran;

  const retour = () => navigate({ to: depuis === "moi" ? "/moi" : depuis === "numeriser" ? "/numeriser" : "/carnet" });

  const choisir = async (f: File) => {
    setErreur(null);
    setNouvelles(null);
    setNomFichier(f.name);
    setEnCours(true);
    try {
      const r = await lireFichier(f);
      if (r.plongees.length === 0) throw new Error("vide");
      const s = await separerDoublons(r.plongees);
      setFormat(r.format);
      setNouvelles(s.nouvelles.sort((a, b) => (b.dive_date ?? "").localeCompare(a.dive_date ?? "")));
      setDoublons(s.doublons.length);
    } catch (e) {
      const m = String((e as Error)?.message ?? "");
      setErreur(
        m === "vide"
          ? "Aucune plongée trouvée dans ce fichier."
          : m === "format_inconnu" || m === "fichier_illisible"
            ? "Ce fichier n'est pas un carnet UDDF ou Subsurface. Exporte tes plongées au format UDDF depuis ton app, puis réessaie."
            : "Le fichier n'a pas pu être lu. Vérifie ta connexion et réessaie.",
      );
    } finally {
      setEnCours(false);
    }
  };

  const importer = async () => {
    if (!nouvelles?.length) return;
    setEnCours(true);
    setErreur(null);
    try {
      await importerPlongees(nouvelles, ajuster && avant > 0);
      annoncerSurAccueil(`${nouvelles.length} plongée${nouvelles.length > 1 ? "s" : ""} importée${nouvelles.length > 1 ? "s" : ""} dans ton carnet`);
      navigate({ to: "/carnet" });
    } catch (e) {
      console.error(e);
      setErreur(`L'import n'a pas abouti. Vérifie ta connexion et réessaie.${e && typeof e === "object" && "message" in e ? ` (détail : ${String(e.message)})` : ""}`);
      setEnCours(false);
    }
  };

  const n = nouvelles?.length ?? 0;
  const dates = (nouvelles ?? []).map((p) => p.dive_date).filter((d): d is string => Boolean(d)).sort();
  const [an1, an2] = [dates[0]?.slice(0, 4), dates[dates.length - 1]?.slice(0, 4)];
  const periode = an1 ? (an1 === an2 ? `en ${an1}` : `de ${an1} à ${an2}`) : "";

  return (
    <PageClub
      titre="Importer mes plongées"
      onRetour={retour}
      bas={
        nouvelles && n > 0 ? (
          <button
            type="button"
            disabled={enCours}
            onClick={() => void importer()}
            className="flex h-14 w-full items-center justify-center galet-moyen bg-[#3DEFBE] text-[14px] font-bold text-[#0B3B63] shadow-[0_4px_12px_#123A630D] disabled:opacity-60"
          >
            {enCours ? "IMPORT EN COURS…" : `IMPORTER ${n} PLONGÉE${n > 1 ? "S" : ""}`}
          </button>
        ) : null
      }
    >
      <input
        ref={champ}
        type="file"
        accept=".uddf,.udcf,.xml,.ssrf,application/xml,text/xml"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) void choisir(f);
          e.target.value = "";
        }}
      />

      {!nouvelles && (
        <>
          <p className="pt-[6px] text-[14px] leading-normal text-[#566B82]">
            Tes plongées sont dans une autre app ou dans ton ordinateur de plongée ? Exporte-les dans un fichier, et Palanote les range dans ton carnet.
          </p>
          <button
            type="button"
            disabled={enCours}
            onClick={() => champ.current?.click()}
            className="mt-[18px] flex w-full flex-col items-center gap-[10px] galet border-2 border-dashed border-[#9ACDEB] bg-white px-[20px] py-[26px] text-center disabled:opacity-60"
          >
            <span className="flex h-[52px] w-[52px] items-center justify-center goutte bg-[#E3F2FB]">
              <FileUp className="h-[24px] w-[24px] text-[#106F9F]" strokeWidth={2} aria-hidden="true" />
            </span>
            <span className="text-[16px] font-bold">{enCours ? "Lecture du fichier…" : "Choisir mon fichier"}</span>
            <span className="text-[12.5px] text-[#566B82]">{nomFichier ?? "UDDF (.uddf, .xml) ou Subsurface (.ssrf)"}</span>
          </button>
          <MessageErreur texte={erreur} />

          <Titre>Où trouver ce fichier</Titre>
          <div className="flex flex-col gap-[8px]">
            {APPS.map((a) => (
              <div key={a.nom} className="galet-petit bg-white px-[14px] py-[11px]">
                <p className="text-[14px] font-bold">{a.nom}</p>
                <p className="text-[12.5px] leading-snug text-[#566B82]">{a.ou}</p>
              </div>
            ))}
          </div>
          <p className="flex items-start gap-[8px] pt-[16px] text-[12px] leading-snug text-[#566B82]">
            <ShieldCheck className="mt-[1px] h-[15px] w-[15px] shrink-0" aria-hidden="true" />
            Le fichier est lu sur ton téléphone, il n'est envoyé nulle part. Seules les plongées que tu importes rejoignent ton carnet, privées comme les autres.
          </p>
        </>
      )}

      {nouvelles && (
        <>
          <div className="mt-[8px] galet border border-[#B8E4D8] bg-[#E2F8EF] p-[16px]">
            <p className="text-[12.5px] font-bold uppercase tracking-[.07em] text-[#137758]">
              Fichier {format} lu
            </p>
            <p className="pt-[4px] text-[24px] font-bold leading-tight">
              {n} plongée{n > 1 ? "s" : ""} à importer
            </p>
            <p className="text-[13px] text-[#3F5B76]">
              {[periode, doublons > 0 ? `${doublons} déjà dans ton carnet, laissée${doublons > 1 ? "s" : ""} de côté` : null].filter(Boolean).join(" · ")}
            </p>
          </div>

          {n > 0 && avant > 0 && (
            <button
              type="button"
              role="checkbox"
              aria-checked={ajuster}
              onClick={() => setAjuster((x) => !x)}
              className="mt-[12px] flex w-full items-start gap-[12px] galet-b border border-[#E4EBF1] bg-white px-[14px] py-[12px] text-left"
            >
              <span className={`mt-[1px] flex h-[24px] w-[24px] shrink-0 items-center justify-center rounded-[7px] ${ajuster ? "bg-[#3DEFBE]" : "border-2 border-[#D5E1EC]"}`}>
                {ajuster && <Check className="h-[15px] w-[15px] text-[#0B3B63]" strokeWidth={3} />}
              </span>
              <span className="text-[13px] leading-snug text-[#3F5B76]">
                Tu avais indiqué <b className="text-[#123A63]">{avant} plongées avant Palanote</b>. Les retirer de ce nombre, pour ne pas les compter deux fois ?
                {ajuster && <span className="block pt-[2px] text-[#137758]">Il deviendra {Math.max(0, avant - n)}.</span>}
              </span>
            </button>
          )}

          {n > 0 && (
            <>
              <Titre aide={n > 8 ? `les 8 plus récentes sur ${n}` : undefined}>Aperçu</Titre>
              <div className="flex flex-col gap-[6px]">
                {(nouvelles ?? []).slice(0, 8).map((p, i) => (
                  <div key={i} className="flex items-center gap-[12px] galet-petit bg-white px-[13px] py-[10px]">
                    <span className="w-[78px] shrink-0 text-[12.5px] font-semibold text-[#566B82]">
                      {p.dive_date ? new Date(`${p.dive_date}T12:00:00`).toLocaleDateString("fr-FR", { day: "numeric", month: "short", year: "numeric" }) : "sans date"}
                    </span>
                    <span className="min-w-0 flex-1 truncate text-[14px] font-bold">{p.site_name ?? "Site inconnu"}</span>
                    <span className="shrink-0 text-[12.5px] text-[#566B82]">
                      {[p.max_depth_m !== null ? `${String(p.max_depth_m).replace(".", ",")} m` : null, p.duration_min ? `${p.duration_min} min` : null].filter(Boolean).join(" · ")}
                    </span>
                  </div>
                ))}
              </div>
            </>
          )}
          <MessageErreur texte={erreur} />
          <button type="button" onClick={() => champ.current?.click()} className="mx-auto mt-[18px] block text-[13.5px] font-semibold text-[#106F9F] underline underline-offset-4">
            Choisir un autre fichier
          </button>
        </>
      )}
    </PageClub>
  );
}
