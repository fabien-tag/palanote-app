import { useEffect, useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { Check, Clock, Search, UserPlus, X } from "lucide-react";
import { useConnexionRequise } from "@/components/numerisation/Ui";
import { Avatar, MessageErreur, PageClub } from "@/components/club/Ui";
import { chercherPlongeur, demanderBinome, type PlongeurTrouve, type Relation } from "@/lib/amis";

// « Rechercher quelqu'un » (onglet Amis)
export const Route = createFileRoute("/amis_/rechercher")({
  head: () => ({ meta: [{ title: "Palanote — Rechercher un plongeur" }] }),
  component: Rechercher,
});

function Rechercher() {
  const navigate = useNavigate();
  const { pret, ecran } = useConnexionRequise();
  const [q, setQ] = useState("");
  const [trouves, setTrouves] = useState<PlongeurTrouve[] | null>(null);
  const [enCours, setEnCours] = useState<string | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);

  useEffect(() => {
    if (!pret) return;
    const v = q.trim();
    if (v.length < 2) return setTrouves(null);
    const t = setTimeout(() => {
      void chercherPlongeur(v)
        .then(setTrouves)
        .catch((e) => {
          console.error(e);
          setTrouves([]);
          setErreur(/Could not find the function|PGRST202/.test(String(e?.message)) ? "Le script « palanote-demandes-binome.sql » n'est pas encore lancé dans Supabase." : null);
        });
    }, 280);
    return () => clearTimeout(t);
  }, [q, pret]);

  if (ecran) return ecran;

  const demander = async (p: PlongeurTrouve) => {
    setEnCours(p.id);
    setErreur(null);
    try {
      const r = await demanderBinome(p.id);
      setTrouves((l) => (l ?? []).map((x) => (x.id === p.id ? { ...x, relation: r } : x)));
    } catch (e) {
      setErreur(/trop de demandes/.test(String((e as Error)?.message)) ? "Tu as envoyé beaucoup de demandes aujourd'hui : réessaie demain." : "La demande n'a pas pu être envoyée.");
    } finally {
      setEnCours(null);
    }
  };

  const etat = (r: Relation) =>
    r === "binome" ? (
      <span className="flex items-center gap-1 text-[12.5px] font-bold text-[#14805F]">
        <Check className="h-[14px] w-[14px]" strokeWidth={3} aria-hidden="true" />
        Binôme
      </span>
    ) : r === "demande_envoyee" ? (
      <span className="flex items-center gap-1 text-[12.5px] font-semibold text-[#7D93A8]">
        <Clock className="h-[13px] w-[13px]" strokeWidth={2.4} aria-hidden="true" />
        Demande envoyée
      </span>
    ) : null;

  const email = q.includes("@");

  return (
    <PageClub titre="Rechercher un plongeur" onRetour={() => navigate({ to: "/amis" })}>
      <label className="mt-[6px] flex h-[52px] items-center gap-[10px] galet-moyen border-[1.5px] border-[#E4EBF1] bg-white px-[16px] focus-within:border-[#57D4F5]">
        <Search className="h-[18px] w-[18px] shrink-0 text-[#9DB0C0]" aria-hidden="true" />
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Prénom ou e-mail exact"
          aria-label="Rechercher un plongeur"
          autoCapitalize="off"
          className="min-w-0 flex-1 bg-transparent text-[15px] outline-none placeholder:text-[#B5C4D1]"
        />
        {q && (
          <button type="button" aria-label="Effacer" onClick={() => setQ("")}>
            <X className="h-[16px] w-[16px] text-[#9DB0C0]" />
          </button>
        )}
      </label>
      <MessageErreur texte={erreur} />

      {trouves === null && (
        <div className="pt-[18px] text-[13.5px] leading-normal text-[#5B7189]">
          <p>
            <b className="text-[#123A63]">Par e-mail</b> : tape son adresse exacte, tu le trouveras même si vous n'avez rien en commun.
          </p>
          <p className="pt-[10px]">
            <b className="text-[#123A63]">Par prénom</b> : parmi les binômes de tes binômes et les plongeurs croisés en sortie club.
          </p>
          <p className="pt-[10px] text-[12.5px] text-[#9DB0C0]">Palanote n'a pas d'annuaire : personne ne peut parcourir la liste des plongeurs.</p>
        </div>
      )}

      {trouves && trouves.length > 0 && (
        <div className="flex flex-col gap-[8px] pt-[14px]">
          {trouves.map((p) => (
            <div key={p.id} className="flex items-center gap-[12px] galet-b border border-[#E4EBF1] bg-white px-[13px] py-[11px]">
              <Avatar id={p.id} prenom={p.prenom} taille={40} />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[15px] font-bold">{p.prenom}</span>
                <span className="block truncate text-[12.5px] text-[#5B7189]">{[p.niveau, p.club].filter(Boolean).join(" · ") || "Plongeur Palanote"}</span>
              </span>
              {p.relation === "binome" || p.relation === "demande_envoyee" ? (
                etat(p.relation)
              ) : (
                <button
                  type="button"
                  disabled={enCours === p.id}
                  onClick={() => void demander(p)}
                  className="flex h-[36px] shrink-0 items-center gap-[5px] rounded-[18px] bg-[#3DEFBE] px-[13px] text-[12.5px] font-bold text-[#0B3B63] disabled:opacity-60"
                >
                  {p.relation === "demande_recue" ? <Check className="h-[14px] w-[14px]" strokeWidth={3} aria-hidden="true" /> : <UserPlus className="h-[14px] w-[14px]" strokeWidth={2.6} aria-hidden="true" />}
                  {p.relation === "demande_recue" ? "Accepter" : "Demander"}
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      {trouves && trouves.length === 0 && !erreur && (
        <p className="pt-[18px] text-[13.5px] leading-normal text-[#5B7189]">
          {email
            ? "Aucun plongeur Palanote avec cette adresse. Invite-le plutôt : il créera son compte en scannant ton QR code."
            : "Personne de ce prénom parmi les binômes de tes binômes et tes sorties club. Essaie son e-mail exact, ou montre-lui ton QR code."}
        </p>
      )}

      <div className="flex-grow" />
      <button
        type="button"
        onClick={() => navigate({ to: "/amis/ajouter" })}
        className="mt-[24px] flex h-[52px] w-full items-center justify-center galet-moyen border border-[#57D4F5] bg-white text-[14px] font-bold text-[#1176A8]"
      >
        PLUTÔT MONTRER MON QR CODE
      </button>
    </PageClub>
  );
}
