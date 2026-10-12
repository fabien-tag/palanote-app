import { useCallback, useEffect, useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { BadgeCheck, BookOpen, ChevronRight, CircleHelp, LogOut, UserRound } from "lucide-react";
import { useConnexionRequise } from "@/components/numerisation/Ui";
import { BarreNavigation } from "@/components/BarreNavigation";
import { Avatar, ChampTexte, MessageErreur, PageClub, Titre } from "@/components/club/Ui";
import { messagePlanning, useCentre } from "@/components/club/useCentre";
import { signOut } from "@/lib/auth";
import { choisirCentre, oublierVerificationDp, quitterCentre } from "@/lib/club";
import { depuisIso, modifierCentre, parametresCentre, type ParametresCentre } from "@/lib/planning";

// Paramètres de l'espace club : le centre (nom, ville), ses directeurs de plongée,
// les autres centres, et le compte (profil, carnet de plongeur, aide, déconnexion).
export const Route = createFileRoute("/_dp/club_/parametres")({
  head: () => ({ meta: [{ title: "Palanote — Paramètres du club" }] }),
  component: PageParametres,
});

function PageParametres() {
  const navigate = useNavigate();
  const { pret, ecran } = useConnexionRequise();
  const { centre, centres, erreur: erreurCentre } = useCentre(pret);
  const [p, setP] = useState<ParametresCentre | null>(null);
  const [nom, setNom] = useState("");
  const [ville, setVille] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);
  const [quitter, setQuitter] = useState(false);

  const charger = useCallback(async () => {
    if (!centre) return;
    try {
      const r = await parametresCentre(centre.id);
      setP(r);
      setNom(r.nom);
      setVille(r.ville ?? "");
    } catch (e) {
      console.error(e);
      setErreur(messagePlanning(e, "Les paramètres n'ont pas pu être chargés.").replace("palanote-planning-club.sql", "palanote-espace-club.sql"));
    }
  }, [centre]);

  useEffect(() => {
    void charger();
  }, [charger]);

  if (ecran) return ecran;

  const modifie = p && (nom.trim() !== p.nom || ville.trim() !== (p.ville ?? ""));
  const enregistrer = async () => {
    if (!p) return;
    setErreur(null);
    try {
      await modifierCentre(p.id, nom, ville);
      setMessage("Enregistré.");
      await charger();
    } catch (e) {
      setErreur(messagePlanning(e, "Le centre n'a pas pu être modifié."));
    }
  };

  const ligne = (Icone: typeof UserRound, titre: string, texte: string, onClick: () => void, danger = false) => (
    <button
      type="button"
      onClick={onClick}
      className="flex w-full items-center gap-[12px] rounded-[10px] border border-[#E4EBF1] bg-white px-[14px] py-[12px] text-left hover:border-[#57D4F5]"
    >
      <Icone className={`h-[19px] w-[19px] shrink-0 ${danger ? "text-[#D9573F]" : "text-[#1176A8]"}`} strokeWidth={2.1} />
      <span className="min-w-0 flex-1">
        <span className={`block text-[14px] font-bold ${danger ? "text-[#D9573F]" : ""}`}>{titre}</span>
        <span className="block text-[12px] text-[#7D93A8]">{texte}</span>
      </span>
      <ChevronRight className="h-[16px] w-[16px] text-[#9DB0C0]" />
    </button>
  );

  return (
    <PageClub titre="Paramètres" large navigation={<BarreNavigation actif="club" cote />} onRetour={() => navigate({ to: "/club" })}>
      <MessageErreur texte={erreurCentre ?? erreur} />
      {p && (
        <div className="grid grid-cols-1 gap-x-[32px] lg:grid-cols-2 lg:items-start">
          <div>
            <Titre aide={p.verifie ? undefined : "visible par les plongeurs qui rejoignent tes sorties"}>Le centre</Titre>
            <div className="flex flex-col gap-[12px] rounded-[10px] border border-[#E4EBF1] bg-white p-[16px]">
              {p.verifie && (
                <span className="flex items-center gap-[6px] text-[12.5px] font-bold text-[#14805F]">
                  <BadgeCheck className="h-[16px] w-[16px]" /> Centre vérifié par Palanote : son nom ne se change plus
                </span>
              )}
              <ChampTexte label="Nom du centre" value={nom} disabled={p.verifie} onChange={(e) => setNom(e.target.value)} />
              <ChampTexte label="Ville" value={ville} onChange={(e) => setVille(e.target.value)} />
              <div className="flex items-center gap-[12px]">
                <button
                  type="button"
                  disabled={!modifie || !nom.trim()}
                  onClick={() => void enregistrer()}
                  className="h-[42px] rounded-[10px] bg-[#3DEFBE] px-[18px] text-[13px] font-bold text-[#0B3B63] disabled:opacity-40"
                >
                  ENREGISTRER
                </button>
                {message && !modifie && <span className="text-[12.5px] font-semibold text-[#14805F]">{message}</span>}
                <span className="ml-auto text-[12px] text-[#7D93A8]">
                  {p.nb_sorties} sortie{p.nb_sorties > 1 ? "s" : ""} · sur Palanote depuis {depuisIso(p.cree_le.slice(0, 10)).toLocaleDateString("fr-FR", { month: "long", year: "numeric" })}
                </span>
              </div>
            </div>

            <Titre aide={`${p.dp.length}`}>Directeurs de plongée</Titre>
            <div className="flex flex-col gap-[6px]">
              {p.dp.map((d) => (
                <div key={d.id} className="flex items-center gap-[10px] rounded-[10px] border border-[#E4EBF1] bg-white px-[14px] py-[10px]">
                  <Avatar id={d.id} prenom={d.prenom} taille={34} />
                  <span className="min-w-0 flex-1">
                    <span className="block text-[14px] font-bold">
                      {d.prenom}
                      {d.moi && <span className="font-semibold text-[#7D93A8]"> (toi)</span>}
                    </span>
                    <span className="block text-[12px] text-[#7D93A8]">
                      {[d.niveau, `depuis ${depuisIso(d.depuis.slice(0, 10)).toLocaleDateString("fr-FR", { month: "long", year: "numeric" })}`].filter(Boolean).join(" · ")}
                    </span>
                  </span>
                </div>
              ))}
              <p className="pt-[4px] text-[12.5px] leading-normal text-[#7D93A8]">
                Un autre DP rejoint le centre depuis son app : onglet Sorties › Choisir mon centre, puis il cherche « {p.nom} ».
              </p>
            </div>

            {(centres?.length ?? 0) > 1 && (
              <>
                <Titre>Mes centres</Titre>
                <div className="flex flex-wrap gap-[8px]">
                  {centres!.map((c) => (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => {
                        choisirCentre(c.id);
                        window.location.assign("/club");
                      }}
                      className={`h-[36px] rounded-[10px] px-[14px] text-[13px] font-bold ${c.id === p.id ? "bg-[#0F3D70] text-white" : "border border-[#D8E5EE] bg-white text-[#5B7189]"}`}
                    >
                      {c.nom}
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>

          <div>
            <Titre>Mon compte</Titre>
            <div className="flex flex-col gap-[8px]">
              {ligne(UserRound, "Mon profil", "Prénom, niveau, rôle, certifications", () => navigate({ to: "/moi/profil" }))}
              {ligne(BookOpen, "Mon carnet de plongeur", "Passer en mode plongeur : mes plongées, ma carte, mes binômes", () => navigate({ to: "/carnet" }))}
              {ligne(CircleHelp, "Aide", "Questions fréquentes, nous écrire", () => navigate({ to: "/moi/aide" }))}
              {ligne(UserRound, "Rejoindre ou créer un autre centre", "Si tu encadres dans plusieurs clubs", () => navigate({ to: "/club/centre" }))}
              {ligne(LogOut, "Se déconnecter", "Sur cet appareil", () => void signOut().then(() => navigate({ to: "/connexion" })))}
            </div>
            <Titre>Zone sensible</Titre>
            {quitter ? (
              <div className="rounded-[10px] border border-[#FF8A75] bg-white p-[14px]">
                <p className="text-[13.5px] leading-normal">
                  Tu ne verras plus le planning ni les sorties de {p.nom}. Les plongées déjà tamponnées gardent leur tampon.
                </p>
                <div className="flex gap-[10px] pt-[12px]">
                  <button
                    type="button"
                    onClick={() =>
                      void quitterCentre(p.id)
                        .then(() => {
                          oublierVerificationDp();
                          navigate({ to: "/club" });
                        })
                        .catch((e) => setErreur(messagePlanning(e, "Impossible de quitter le centre.")))
                    }
                    className="h-[40px] rounded-[10px] bg-[#FF8A75] px-[16px] text-[13px] font-bold text-white"
                  >
                    QUITTER LE CENTRE
                  </button>
                  <button type="button" onClick={() => setQuitter(false)} className="h-[40px] rounded-[10px] border border-[#D8E5EE] px-[16px] text-[13px] font-bold text-[#5B7189]">
                    Annuler
                  </button>
                </div>
              </div>
            ) : (
              <button type="button" onClick={() => setQuitter(true)} className="text-[13px] font-semibold text-[#D9573F] underline underline-offset-4">
                Quitter {p.nom}
              </button>
            )}
          </div>
        </div>
      )}
    </PageClub>
  );
}
