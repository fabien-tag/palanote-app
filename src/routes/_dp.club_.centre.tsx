import { useEffect, useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { Anchor, BadgeCheck, Check, Plus, Search } from "lucide-react";
import { useConnexionRequise } from "@/components/numerisation/Ui";
import { ChampTexte, detailErreur, MessageErreur, PageClub, Titre } from "@/components/club/Ui";
import { chercherCentres, choisirCentre, creerCentre, garderOngletSorties, mesCentres, oublierVerificationDp, rejoindreCentre, type Centre } from "@/lib/club";

// Choisir ou créer son centre de plongée (parcours 15, écran 2)
export const Route = createFileRoute("/_dp/club_/centre")({
  head: () => ({ meta: [{ title: "Palanote — Mon centre" }] }),
  component: ChoixCentre,
});

function ChoixCentre() {
  const navigate = useNavigate();
  const { pret, ecran } = useConnexionRequise();
  const [q, setQ] = useState("");
  const [resultats, setResultats] = useState<Centre[]>([]);
  const [miens, setMiens] = useState<Centre[]>([]);
  const [creation, setCreation] = useState(false);
  const [nom, setNom] = useState("");
  const [ville, setVille] = useState("");
  const [enCours, setEnCours] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);

  useEffect(() => {
    if (!pret) return;
    void mesCentres()
      .then(setMiens)
      .catch((e) => setErreur(detailErreur(e, "Tes centres n'ont pas pu être chargés.")));
  }, [pret]);

  // Recherche au fil de la frappe
  useEffect(() => {
    if (!pret) return;
    const t = setTimeout(() => {
      void chercherCentres(q)
        .then(setResultats)
        .catch(() => setResultats([]));
    }, 220);
    return () => clearTimeout(t);
  }, [q, pret]);

  if (ecran) return ecran;

  const fini = (c: Centre) => {
    choisirCentre(c.id);
    // Membre d'un centre : l'onglet « Sorties » apparaît dans la barre du bas
    garderOngletSorties(true);
    oublierVerificationDp();
    navigate({ to: "/club" });
  };

  const rejoindre = async (c: Centre) => {
    if (c.membre) return fini(c);
    setEnCours(true);
    setErreur(null);
    try {
      fini(await rejoindreCentre(c.id));
    } catch (e) {
      setErreur(detailErreur(e, "Tu n'as pas pu rejoindre ce centre."));
    } finally {
      setEnCours(false);
    }
  };

  const creer = async () => {
    if (nom.trim().length < 2) return setErreur("Donne le nom de ton centre, par exemple « Aqua Club Hyères ».");
    setEnCours(true);
    setErreur(null);
    try {
      fini(await creerCentre(nom.trim(), ville.trim()));
    } catch (e) {
      setErreur(detailErreur(e, "Le centre n'a pas pu être créé."));
    } finally {
      setEnCours(false);
    }
  };

  const autres = resultats.filter((r) => !miens.some((m) => m.id === r.id));

  return (
    <PageClub titre="Mon centre" onRetour={() => navigate({ to: "/club" })}>
      <p className="pt-[6px] text-[14px] leading-normal text-[#5B7189]">
        Choisis le club ou le centre où tu organises les sorties. Tes plongeurs le verront sur leur tampon.
      </p>
      <MessageErreur texte={erreur} />

      {miens.length > 0 && (
        <>
          <Titre>Tes centres</Titre>
          <div className="flex flex-col gap-[8px]">
            {miens.map((c) => (
              <LigneCentre key={c.id} c={c} membre onClick={() => fini(c)} />
            ))}
          </div>
        </>
      )}

      <Titre>Trouver ton centre</Titre>
      <label className="flex h-[52px] items-center gap-[10px] galet-moyen border-[1.5px] border-[#E4EBF1] bg-white px-[16px] focus-within:border-[#57D4F5]">
        <Search className="h-[18px] w-[18px] shrink-0 text-[#9DB0C0]" aria-hidden="true" />
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Nom du club ou ville"
          aria-label="Rechercher un centre"
          className="min-w-0 flex-1 bg-transparent text-[15px] outline-none placeholder:text-[#B5C4D1]"
        />
      </label>
      <div className="flex flex-col gap-[8px] pt-[10px]">
        {autres.map((c) => (
          <LigneCentre key={c.id} c={c} onClick={() => void rejoindre(c)} desactive={enCours} />
        ))}
        {autres.length === 0 && q.trim().length >= 2 && (
          <p className="px-[4px] text-[13px] text-[#9DB0C0]">Aucun centre ne s'appelle comme ça pour l'instant.</p>
        )}
      </div>

      {!creation ? (
        <button
          type="button"
          onClick={() => {
            setCreation(true);
            setNom(q.trim());
          }}
          className="mt-[16px] flex h-[52px] w-full items-center justify-center gap-2 galet-moyen border border-[#57D4F5] bg-white text-[14px] font-bold text-[#1176A8]"
        >
          <Plus className="h-[17px] w-[17px]" strokeWidth={2.6} aria-hidden="true" />
          MON CENTRE N'EST PAS DANS LA LISTE
        </button>
      ) : (
        <div className="mt-[18px] flex flex-col gap-[14px] galet border border-[#E4EBF1] bg-white p-[16px]">
          <h2 className="text-[16px] font-bold">Ajouter ton centre</h2>
          <ChampTexte label="Nom du centre" value={nom} onChange={(e) => setNom(e.target.value)} placeholder="Aqua Club Hyères" autoFocus />
          <ChampTexte label="Ville" value={ville} onChange={(e) => setVille(e.target.value)} placeholder="Hyères" />
          <p className="text-[12px] leading-snug text-[#9DB0C0]">
            Les autres directeurs de plongée de ton club pourront le rejoindre. Palanote vérifie les centres ajoutés.
          </p>
          <button
            type="button"
            disabled={enCours}
            onClick={() => void creer()}
            className="flex h-[52px] w-full items-center justify-center galet-moyen bg-[#3DEFBE] text-[14px] font-bold text-[#0B3B63] disabled:opacity-60"
          >
            {enCours ? "UN INSTANT…" : "CRÉER ET CHOISIR CE CENTRE"}
          </button>
        </div>
      )}
    </PageClub>
  );
}

function LigneCentre({ c, onClick, membre = false, desactive = false }: { c: Centre; onClick: () => void; membre?: boolean; desactive?: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={desactive}
      className="flex w-full items-center gap-[12px] galet-b border border-[#E4EBF1] bg-white px-[13px] py-[11px] text-left disabled:opacity-60"
    >
      <span className="flex h-[38px] w-[38px] shrink-0 items-center justify-center goutte bg-[#E3F2FB]">
        <Anchor className="h-[18px] w-[18px] text-[#1176A8]" strokeWidth={2.1} aria-hidden="true" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-[5px] text-[15px] font-bold">
          <span className="truncate">{c.nom}</span>
          {c.verifie && <BadgeCheck className="h-[15px] w-[15px] shrink-0 text-[#1176A8]" aria-label="Centre vérifié" />}
        </span>
        <span className="block truncate text-[12.5px] text-[#5B7189]">
          {[c.ville, `${c.nb_dp ?? 0} directeur${(c.nb_dp ?? 0) > 1 ? "s" : ""} de plongée`].filter(Boolean).join(" · ")}
        </span>
      </span>
      {membre || c.membre ? (
        <Check className="h-[18px] w-[18px] shrink-0 text-[#14805F]" strokeWidth={2.6} aria-label="Ton centre" />
      ) : (
        <span className="shrink-0 text-[13px] font-bold text-[#1176A8]">Rejoindre</span>
      )}
    </button>
  );
}
