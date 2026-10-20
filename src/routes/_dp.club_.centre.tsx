import { useEffect, useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { Plus } from "lucide-react";
import { useConnexionRequise } from "@/components/numerisation/Ui";
import { ChampTexte, detailErreur, MessageErreur, PageClub, Titre } from "@/components/club/Ui";
import { LigneCentre, RechercheCentre } from "@/components/club/RechercheCentre";
import {
  choisirCentre,
  creerCentre,
  garderOngletSorties,
  mesCentres,
  oublierVerificationDp,
  type Centre,
} from "@/lib/club";

// Choisir ou créer son centre de plongée (parcours 15, écran 2)
export const Route = createFileRoute("/_dp/club_/centre")({
  head: () => ({ meta: [{ title: "Palanote — Mon centre" }] }),
  component: ChoixCentre,
});

function ChoixCentre() {
  const navigate = useNavigate();
  const { pret, ecran } = useConnexionRequise();
  const [q, setQ] = useState("");
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

  if (ecran) return ecran;

  const fini = (c: Centre) => {
    choisirCentre(c.id);
    // Membre d'un centre : l'onglet « Sorties » apparaît dans la barre du bas
    garderOngletSorties(true);
    oublierVerificationDp();
    navigate({ to: "/club" });
  };

  const creer = async () => {
    if (nom.trim().length < 2)
      return setErreur("Donne le nom de ton centre, par exemple « Aqua Club Hyères ».");
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

  return (
    <PageClub titre="Mon centre" large onRetour={() => navigate({ to: "/club" })}>
      <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_380px] lg:items-start lg:gap-[40px] xl:max-w-[1200px]">
        <div className="min-w-0">
          <p className="pt-[6px] text-[14px] leading-normal text-[#5B7189]">
            Choisis le club ou le centre où tu organises les sorties. Tes plongeurs le verront sur
            leur tampon.
          </p>
          <MessageErreur texte={erreur} />

          {miens.length > 0 && (
            <>
              <Titre>Tes centres</Titre>
              <div className="grid grid-cols-1 gap-[8px] lg:grid-cols-2">
                {miens.map((c) => (
                  <LigneCentre key={c.id} c={c} membre onClick={() => fini(c)} />
                ))}
              </div>
            </>
          )}

          <Titre>Trouver ton centre</Titre>
          <RechercheCentre onFini={fini} exclure={miens.map((m) => m.id)} onRecherche={setQ} />
        </div>

        <div className="lg:sticky lg:top-[150px] lg:pt-[22px]">
          {!creation ? (
            <button
              type="button"
              onClick={() => {
                setCreation(true);
                setNom(q.trim());
              }}
              className="mt-[16px] flex h-[52px] w-full items-center justify-center gap-2 galet-moyen border border-[#57D4F5] bg-white text-[14px] font-bold text-[#1176A8] lg:mt-0"
            >
              <Plus className="h-[17px] w-[17px]" strokeWidth={2.6} aria-hidden="true" />
              MON CENTRE N'EST PAS DANS LA LISTE
            </button>
          ) : (
            <div className="mt-[18px] flex flex-col gap-[14px] galet border lg:mt-0 border-[#E4EBF1] bg-white p-[16px]">
              <h2 className="text-[16px] font-bold">Ajouter ton centre</h2>
              <ChampTexte
                label="Nom du centre"
                value={nom}
                onChange={(e) => setNom(e.target.value)}
                placeholder="Aqua Club Hyères"
                autoFocus
              />
              <ChampTexte
                label="Ville"
                value={ville}
                onChange={(e) => setVille(e.target.value)}
                placeholder="Hyères"
              />
              <p className="text-[12px] leading-snug text-[#9DB0C0]">
                Tu en deviens le directeur de plongée. Pour protéger les données de tes plongeurs,
                personne d'autre ne peut le rejoindre seul : l'ajout passe par Palanote.
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
        </div>
      </div>
    </PageClub>
  );
}
