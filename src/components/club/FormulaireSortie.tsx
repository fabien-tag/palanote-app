import { useState } from "react";
import { Minus, Plus, Star, X } from "lucide-react";
import { ChampTexte, detailErreur, MessageErreur, Titre } from "@/components/club/Ui";
import { ajouterNomsPrevus, creerSortie } from "@/lib/club";
import { localiserSite } from "@/lib/numerisation";
import { definirSortiePrivilegies, MELANGES } from "@/lib/planning";

// Le formulaire « Nouvelle sortie » (parcours 15, écran 3), utilisé dans le panneau
// qui glisse depuis la droite (ordinateur) et dans la page /club/nouvelle-sortie.
function demain() {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export function FormulaireNouvelleSortie({
  centre,
  dateInitiale,
  onCree,
}: {
  centre: string;
  dateInitiale?: string | undefined;
  onCree: (id: string, date: string) => void;
}) {
  const [date, setDate] = useState(() => dateInitiale ?? demain());
  const [heure, setHeure] = useState("09:00");
  const [site, setSite] = useState("");
  const [lieu, setLieu] = useState("");
  const [bateau, setBateau] = useState("");
  const [profondeur, setProfondeur] = useState("");
  const [consignes, setConsignes] = useState("");
  const [reservee, setReservee] = useState(false);
  const [melange, setMelange] = useState<string | null>(null);
  const [palanquees, setPalanquees] = useState(2);
  // Prénoms préparés pour chaque palanquée (facultatif) : rattachés au plongeur quand il scanne le QR
  const [noms, setNoms] = useState<string[][]>([[], []]);
  const [saisie, setSaisie] = useState<string[]>(["", ""]);
  const changerNombre = (n: number) => {
    setPalanquees(n);
    setNoms((l) => Array.from({ length: n }, (_, i) => l[i] ?? []));
    setSaisie((l) => Array.from({ length: n }, (_, i) => l[i] ?? ""));
  };
  const ajouterPrenoms = (i: number) => {
    const nouveaux = (saisie[i] ?? "")
      .split(/[,;\n]/)
      .map((x) => x.trim())
      .filter((x) => x.length > 0 && x.length <= 60);
    if (nouveaux.length === 0) return;
    setNoms((l) => l.map((x, j) => (j === i ? [...x, ...nouveaux] : x)));
    setSaisie((l) => l.map((x, j) => (j === i ? "" : x)));
  };
  const [enCours, setEnCours] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);

  const creer = async () => {
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
      // Prénoms en cours de frappe : ajoutés aussi
      const complets = noms.map((l, i) => [...l, ...(saisie[i] ?? "").split(/[,;\n]/).map((x) => x.trim()).filter(Boolean)]);
      if (complets.some((l) => l.length > 0)) await ajouterNomsPrevus(r.id, complets);
      if (reservee || melange) {
        try {
          await definirSortiePrivilegies(r.id, reservee, melange);
        } catch (e) {
          console.error(e); // script des privilégiés pas encore lancé : la sortie existe quand même
        }
      }
      onCree(r.id, date);
    } catch (e) {
      console.error(e);
      setErreur(detailErreur(e, "La sortie n'a pas pu être créée."));
      setEnCours(false);
    }
  };

  return (
    <>
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
      <div className="flex items-center justify-between galet-moyen border-[1.5px] border-[#7B8FA3] bg-white px-[14px] py-[10px]">
        <span className="text-[15px] font-semibold">
          {palanquees} palanquée{palanquees > 1 ? "s" : ""}
        </span>
        <span className="flex items-center gap-[8px]">
          <button
            type="button"
            aria-label="Une palanquée de moins"
            onClick={() => changerNombre(Math.max(1, palanquees - 1))}
            className="flex h-[36px] w-[36px] items-center justify-center rounded-full bg-[#E3EDF6]"
          >
            <Minus className="h-[16px] w-[16px]" strokeWidth={2.6} />
          </button>
          <button
            type="button"
            aria-label="Une palanquée de plus"
            onClick={() => changerNombre(Math.min(12, palanquees + 1))}
            className="flex h-[36px] w-[36px] items-center justify-center rounded-full bg-[#E3EDF6]"
          >
            <Plus className="h-[16px] w-[16px]" strokeWidth={2.6} />
          </button>
        </span>
      </div>

      <p className="pt-[12px] text-[12.5px] leading-snug text-[#566B82]">
        Tu connais déjà ton monde ? Note les prénoms : en scannant le QR, chacun retrouve sa place et sa palanquée. Facultatif.
      </p>
      <div className="flex flex-col gap-[8px] pt-[10px]">
        {noms.map((liste, i) => (
          <div key={i} className="galet-b border border-[#E4EBF1] bg-white px-[12px] py-[10px]">
            <p className="pb-[6px] text-[13px] font-bold">Palanquée {i + 1}</p>
            <div className="flex flex-wrap items-center gap-[6px]">
              {liste.map((nom, k) => (
                <span key={`${nom}-${k}`} className="flex h-[30px] items-center gap-[4px] rounded-[15px] bg-[#E3F2FB] pl-[11px] pr-[6px] text-[13px] font-semibold text-[#123A63]">
                  {nom}
                  <button
                    type="button"
                    aria-label={`Retirer ${nom}`}
                    onClick={() => setNoms((l) => l.map((x, j) => (j === i ? x.filter((_, m) => m !== k) : x)))}
                    className="flex h-[20px] w-[20px] items-center justify-center rounded-full text-[#566B82]"
                  >
                    <X className="h-[12px] w-[12px]" strokeWidth={2.6} />
                  </button>
                </span>
              ))}
              <input
                value={saisie[i] ?? ""}
                onChange={(e) => setSaisie((l) => l.map((x, j) => (j === i ? e.target.value : x)))}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === ",") {
                    e.preventDefault();
                    ajouterPrenoms(i);
                  }
                }}
                onBlur={() => ajouterPrenoms(i)}
                placeholder={liste.length ? "+ prénom" : "Léa, Paul…"}
                aria-label={`Prénoms de la palanquée ${i + 1}`}
                className="h-[36px] min-w-[90px] flex-1 bg-transparent text-[14px] outline-none placeholder:text-[#B5C4D1]"
              />
            </div>
          </div>
        ))}
      </div>

      <Titre aide="facultatif">Mélange et accès</Titre>
      <div className="flex flex-wrap gap-[6px]">
        {MELANGES.map((g) => (
          <button
            key={g}
            type="button"
            onClick={() => setMelange(melange === g ? null : g)}
            className={`h-[34px] rounded-[17px] px-[12px] text-[12.5px] font-bold ${melange === g ? "bg-[#0F3D70] text-white" : "border border-[#D8E5EE] bg-white text-[#566B82]"}`}
          >
            {g}
          </button>
        ))}
      </div>
      <label className={`mt-[10px] flex cursor-pointer items-center gap-[12px] galet-b border px-[14px] py-[11px] ${reservee ? "border-[#F2D49A] bg-[#FFF8E8]" : "border-[#E4EBF1] bg-white"}`}>
        <Star className="h-[19px] w-[19px] shrink-0" fill={reservee ? "#E9A93A" : "none"} stroke={reservee ? "#E9A93A" : "#5B7189"} />
        <span className="min-w-0 flex-1">
          <span className="block text-[14px] font-bold">Réservée aux membres privilégiés</span>
          <span className="block text-[12px] text-[#566B82]">Épave, plongée profonde… seuls les privilégiés s'inscrivent avec le QR ou le lien</span>
        </span>
        <input type="checkbox" checked={reservee} onChange={(e) => setReservee(e.target.checked)} className="h-[18px] w-[18px] accent-[#E9A93A]" />
      </label>

      <Titre>Consignes</Titre>
      <textarea
        value={consignes}
        onChange={(e) => setConsignes(e.target.value)}
        rows={3}
        placeholder="Rendez-vous au ponton à 8h45, Nitrox disponible…"
        aria-label="Consignes pour les plongeurs"
        className="w-full galet-moyen border-[1.5px] border-[#7B8FA3] bg-white px-[16px] py-[12px] text-[15px] outline-none placeholder:text-[#B5C4D1] focus:border-[#57D4F5]"
      />
      <p className="pt-[8px] text-[12px] leading-snug text-[#566B82]">Les plongeurs inscrits reçoivent tout ça dans leur app.</p>
      <MessageErreur texte={erreur} />
      <div className="sticky bottom-0 -mx-[2px] mt-[18px] bg-gradient-to-t from-white via-white to-white/0 px-[2px] pb-[4px] pt-[14px]">
        <button
          type="button"
          disabled={enCours}
          onClick={() => void creer()}
          className="flex h-14 w-full items-center justify-center galet-moyen bg-[#3DEFBE] text-[14px] font-bold text-[#0B3B63] shadow-[0_4px_12px_#123A630D] disabled:opacity-60"
        >
          {enCours ? "CRÉATION…" : "CRÉER LA SORTIE"}
        </button>
      </div>
    </>
  );
}
