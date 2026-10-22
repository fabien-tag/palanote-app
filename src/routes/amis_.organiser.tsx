import { useEffect, useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { Check } from "lucide-react";
import { useConnexionRequise } from "@/components/numerisation/Ui";
import { Avatar, ChampTexte, detailErreur, MessageErreur, PageClub, Titre } from "@/components/club/Ui";
import { mesBinomes, monProfil, type Plongeur } from "@/lib/amis";
import { creerSortieAmis } from "@/lib/club";
import { localiserSite } from "@/lib/numerisation";

// Organiser une sortie entre amis (onglet Amis) : choisir ses binômes et les ranger en palanquées.
// Même suite que la sortie club (fiches préremplies), mais sans centre ni tampon.
export const Route = createFileRoute("/amis_/organiser")({
  head: () => ({ meta: [{ title: "Palanote — Organiser une sortie" }] }),
  component: Organiser,
});

const NB_PALANQUEES = 4;

function demain() {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function Organiser() {
  const navigate = useNavigate();
  const { pret, ecran } = useConnexionRequise();
  const [binomes, setBinomes] = useState<Plongeur[] | null>(null);
  const [moi, setMoi] = useState<{ prenom: string } | null>(null);
  // Qui vient, et dans quelle palanquée (1 à 4). « moi » = l'organisateur.
  const [choix, setChoix] = useState<Record<string, number>>({ moi: 1 });
  const [date, setDate] = useState(demain);
  const [heure, setHeure] = useState("09:30");
  const [site, setSite] = useState("");
  const [lieu, setLieu] = useState("");
  const [profondeur, setProfondeur] = useState("");
  const [consignes, setConsignes] = useState("");
  const [enCours, setEnCours] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);

  useEffect(() => {
    if (!pret) return;
    void mesBinomes().then(setBinomes).catch(() => setBinomes([]));
    void monProfil().then((p) => setMoi(p ? { prenom: p.prenom } : null));
  }, [pret]);

  if (ecran) return ecran;

  const basculer = (id: string) =>
    setChoix((c) => {
      const n = { ...c };
      if (n[id]) delete n[id];
      else n[id] = 1;
      return n;
    });
  const placer = (id: string, p: number) => setChoix((c) => ({ ...c, [id]: p }));
  const invites = Object.keys(choix).filter((k) => k !== "moi").length;

  const creer = async () => {
    if (!site.trim()) return setErreur("Indique le site de plongée.");
    if (invites === 0) return setErreur("Choisis au moins un binôme.");
    setEnCours(true);
    setErreur(null);
    try {
      const max = Math.max(...Object.values(choix));
      const palanquees: string[][] = Array.from({ length: max }, () => []);
      for (const [id, p] of Object.entries(choix)) palanquees[p - 1]!.push(id);
      const position = await localiserSite(site.trim(), lieu.trim() || null);
      const r = await creerSortieAmis(
        { date, heure, site: site.trim(), lieu: lieu.trim() || position?.lieu || "", coords: position?.coords ?? "", profondeur, consignes },
        palanquees,
      );
      navigate({ to: "/club/sortie", search: { id: r.id }, replace: true });
    } catch (e) {
      console.error(e);
      setErreur(detailErreur(e, "La sortie n'a pas pu être créée."));
      setEnCours(false);
    }
  };

  const ligne = (id: string, prenom: string, sousTitre: string) => {
    const choisi = Boolean(choix[id]);
    const estMoi = id === "moi";
    return (
      <div key={id} className={`galet-b border bg-white px-[12px] py-[10px] ${choisi ? "border-[#3DEFBE]" : "border-[#E4EBF1]"}`}>
        <button
          type="button"
          role="checkbox"
          aria-checked={choisi}
          disabled={estMoi}
          onClick={() => basculer(id)}
          className="flex w-full items-center gap-[11px] text-left"
        >
          <Avatar id={estMoi ? null : id} prenom={prenom} taille={38} />
          <span className="min-w-0 flex-1">
            <span className="block truncate text-[15px] font-bold">{estMoi ? `${prenom} (toi)` : prenom}</span>
            <span className="block truncate text-[12px] text-[#566B82]">{sousTitre}</span>
          </span>
          <span className={`flex h-[26px] w-[26px] items-center justify-center rounded-[8px] ${choisi ? "bg-[#3DEFBE]" : "border-2 border-[#D5E1EC]"}`}>
            {choisi && <Check className="h-[16px] w-[16px] text-[#0B3B63]" strokeWidth={3} />}
          </span>
        </button>
        {choisi && (
          <div className="flex items-center gap-[6px] pl-[49px] pt-[8px]" role="radiogroup" aria-label={`Palanquée de ${prenom}`}>
            {Array.from({ length: NB_PALANQUEES }, (_, i) => i + 1).map((p) => (
              <button
                key={p}
                type="button"
                role="radio"
                aria-checked={choix[id] === p}
                onClick={() => placer(id, p)}
                className={`h-[30px] w-[42px] rounded-[15px] text-[12.5px] font-bold ${choix[id] === p ? "bg-[#0F3D70] text-white" : "border border-[#D8E5EE] text-[#566B82]"}`}
              >
                P{p}
              </button>
            ))}
          </div>
        )}
      </div>
    );
  };

  return (
    <PageClub
      titre="Organiser une sortie"
      onRetour={() => navigate({ to: "/amis" })}
      bas={
        <button
          type="button"
          disabled={enCours}
          onClick={() => void creer()}
          className="flex h-14 w-full items-center justify-center galet-moyen bg-[#3DEFBE] text-[14px] font-bold text-[#0B3B63] shadow-[0_4px_12px_#123A630D] disabled:opacity-60"
        >
          {enCours ? "CRÉATION…" : invites > 0 ? `INVITER ${invites} BINÔME${invites > 1 ? "S" : ""}` : "CHOISIS TES BINÔMES"}
        </button>
      }
    >
      <p className="pt-[4px] text-[13.5px] leading-normal text-[#566B82]">
        Tes binômes reçoivent la sortie dans leur app. Après la plongée, chacun a sa fiche préremplie.
      </p>

      <Titre>Quand</Titre>
      <div className="grid grid-cols-[1.4fr_1fr] gap-[12px]">
        <ChampTexte label="Date" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        <ChampTexte label="Heure" type="time" value={heure} onChange={(e) => setHeure(e.target.value)} />
      </div>

      <Titre>Où</Titre>
      <div className="flex flex-col gap-[14px]">
        <ChampTexte label="Site de plongée" value={site} onChange={(e) => setSite(e.target.value)} placeholder="Cap Lardier" />
        <div className="grid grid-cols-2 gap-[12px]">
          <ChampTexte label="Lieu" value={lieu} onChange={(e) => setLieu(e.target.value)} placeholder="La Croix-Valmer" />
          <ChampTexte
            label="Profondeur (m)"
            inputMode="decimal"
            value={profondeur}
            onChange={(e) => setProfondeur(e.target.value.replace(/[^\d,.]/g, "").slice(0, 5))}
            placeholder="20"
          />
        </div>
      </div>

      <Titre aide="et dans quelle palanquée">Qui vient</Titre>
      <div className="flex flex-col gap-[8px]">
        {moi && ligne("moi", moi.prenom || "Moi", "Tu organises, tu plonges aussi")}
        {(binomes ?? []).map((b) => ligne(b.id, b.prenom, [b.niveau, b.club].filter(Boolean).join(" · ") || "Binôme"))}
        {binomes && binomes.length === 0 && (
          <p className="galet-b border border-dashed border-[#D5E1EC] bg-white/60 px-[15px] py-[14px] text-[13.5px] leading-normal text-[#566B82]">
            Ajoute d'abord tes binômes dans Amis (QR code ou recherche). Tu pourras aussi montrer le QR de la sortie sur place.
          </p>
        )}
      </div>

      <Titre>Un mot pour tes binômes</Titre>
      <textarea
        value={consignes}
        onChange={(e) => setConsignes(e.target.value)}
        rows={2}
        placeholder="On part du port à 9h, je prends le bateau de Marc…"
        aria-label="Un mot pour tes binômes"
        className="w-full galet-moyen border-[1.5px] border-[#7B8FA3] bg-white px-[16px] py-[12px] text-[15px] outline-none placeholder:text-[#B5C4D1] focus:border-[#57D4F5]"
      />
      <p className="pt-[8px] text-[12px] leading-snug text-[#566B82]">
        Une sortie entre amis n'a pas de tampon : seul le directeur de plongée d'un centre peut en poser un.
      </p>
      <MessageErreur texte={erreur} />
    </PageClub>
  );
}
