import { useCallback, useEffect, useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { ChevronRight, Search, UserPlus } from "lucide-react";
import { BarreNavigation } from "@/components/BarreNavigation";
import { BandeauConfirmation } from "@/components/BandeauConfirmation";
import {
  accepterInvitationGardee,
  ajouterPlongeeIdentifiee,
  chiffresPlongee,
  compterPlongeesEnsemble,
  couleurAvatar,
  dateCourte,
  initiales,
  mesBinomes,
  plongeesAConfirmer,
  plongeesEnsembleTexte,
  refuserIdentification,
  type PlongeeAConfirmer,
  type Plongeur,
} from "@/lib/amis";
import { effacerMessageAccueil, lireMessageAccueil } from "@/lib/message-accueil";
import { utilisateurConnecte } from "@/lib/plongees";

export const Route = createFileRoute("/amis")({
  head: () => ({ meta: [{ title: "Palanote — Amis" }, { name: "description", content: "Tes binômes de plongée." }] }),
  component: PageAmis,
});

// Deux masques de plongée (pictogramme de l'écran vide)
function Masques() {
  return (
    <svg width="44" height="44" viewBox="0 0 48 48" fill="none" stroke="#1176A8" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="5" y="13" width="20" height="13" rx="6.5" />
      <rect x="23" y="22" width="20" height="13" rx="6.5" />
    </svg>
  );
}

function PageAmis() {
  const navigate = useNavigate();
  const [connecte, setConnecte] = useState<boolean | null>(null);
  const [binomes, setBinomes] = useState<Plongeur[] | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [aConfirmer, setAConfirmer] = useState<PlongeeAConfirmer[]>([]);
  const [comptes, setComptes] = useState<Record<string, number>>({});
  const [reponseEnCours, setReponseEnCours] = useState<string | null>(null);
  const finMessage = useCallback(() => {
    effacerMessageAccueil();
    setMessage(null);
  }, []);

  useEffect(() => {
    let actif = true;
    (async () => {
      const user = await utilisateurConnecte();
      if (!actif) return;
      setConnecte(Boolean(user));
      if (!user) return;
      // Une invitation scannée avant de se connecter ? On l'accepte maintenant.
      const accepte = await accepterInvitationGardee();
      const recu = accepte ?? lireMessageAccueil();
      if (recu && actif) setMessage(recu);
      try {
        const [liste, attente, nb] = await Promise.all([
          mesBinomes(),
          plongeesAConfirmer().catch(() => []),
          compterPlongeesEnsemble().catch(() => ({})),
        ]);
        if (!actif) return;
        setBinomes(liste);
        setAConfirmer(attente);
        setComptes(nb);
      } catch (e) {
        console.error(e);
        if (actif) {
          setBinomes([]);
          setErreur("Tes binômes n'ont pas pu être chargés.");
        }
      }
    })();
    return () => {
      actif = false;
    };
  }, []);

  const vide = binomes !== null && binomes.length === 0;

  const repondre = async (p: PlongeeAConfirmer, ajouter: boolean) => {
    setReponseEnCours(p.id);
    try {
      if (ajouter) {
        await ajouterPlongeeIdentifiee(p.id);
        setMessage("La plongée a été ajoutée à ton carnet");
      } else {
        await refuserIdentification(p.id);
        setComptes((c) => ({ ...c, [p.de.id]: Math.max(0, (c[p.de.id] ?? 1) - 1) }));
      }
      setAConfirmer((l) => l.filter((x) => x.id !== p.id));
    } catch (e) {
      console.error(e);
      setMessage(null);
      setErreur(`Ça n'a pas marché, réessaie.${e && typeof e === "object" && "message" in e ? ` (détail : ${String(e.message)})` : ""}`);
    } finally {
      setReponseEnCours(null);
    }
  };

  return (
    <div className="flex h-screen flex-col overflow-hidden bg-[#F1F6FC] text-[#123A63] supports-[height:100dvh]:h-[100dvh]">
      {message && <BandeauConfirmation texte={message} onFin={finMessage} />}
      <div className="mx-auto flex min-h-0 w-full max-w-[430px] flex-1 flex-col">
        <div className="flex shrink-0 items-center justify-between px-[22px] pt-[clamp(14px,2.6svh,22px)]">
          <h1 className="text-[clamp(24px,3.6svh,28px)] font-bold">Amis</h1>
          {binomes && binomes.length > 0 && (
            <button
              type="button"
              aria-label="Inviter un binôme"
              onClick={() => navigate({ to: "/amis/ajouter" })}
              className="flex h-[42px] w-[42px] items-center justify-center rounded-full bg-[#3DEFBE] text-[#0B3B63] shadow-[0_4px_12px_rgba(61,239,190,.35)]"
            >
              <UserPlus className="h-[20px] w-[20px]" strokeWidth={2.2} />
            </button>
          )}
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-[22px] pb-[20px]">
          {connecte === false ? (
            <div className="flex flex-col items-center gap-4 pt-[18svh] text-center">
              <p className="text-[15px] text-[#5B7189]">Connecte-toi pour retrouver tes binômes.</p>
              <button
                type="button"
                onClick={() => navigate({ to: "/connexion" })}
                className="flex h-[52px] w-full items-center justify-center galet-moyen bg-[#3DEFBE] text-[14px] font-bold text-[#0B3B63]"
              >
                ME CONNECTER
              </button>
            </div>
          ) : vide ? (
            <div className="flex min-h-full flex-col items-center justify-center pb-[4svh] text-center">
              <div className="flex h-[88px] w-[88px] items-center justify-center galet bg-[#D6EEF9]">
                <Masques />
              </div>
              <h2 className="pt-[22px] text-[21px] font-bold">Personne ici pour l'instant</h2>
              <p className="pt-[8px] text-[14px] leading-normal text-[#5B7189]">
                Quand tu ajoutes tes binômes, ils apparaissent ici — et vos plongées communes pourront se remplir des deux côtés.
              </p>
              <div className="flex w-full flex-col gap-[11px] pt-[24px]">
                <button
                  type="button"
                  onClick={() => navigate({ to: "/amis/ajouter" })}
                  className="flex h-[54px] items-center justify-center galet-moyen bg-[#3DEFBE] text-[14px] font-bold text-[#0B3B63] shadow-[0_4px_12px_#123A630D]"
                >
                  INVITER UN BINÔME
                </button>
                <button
                  type="button"
                  disabled
                  className="relative flex h-[52px] items-center justify-center gap-2 galet-moyen border border-[#57D4F5] bg-white text-[14px] font-bold text-[#1176A8] opacity-60"
                >
                  <Search className="h-[17px] w-[17px]" strokeWidth={2.4} aria-hidden="true" />
                  RECHERCHER QUELQU'UN
                  <span className="absolute right-[12px] rounded-[10px] bg-[#FFE6CC] px-[8px] py-[2px] text-[10px] font-semibold text-[#C2570C]">Bientôt</span>
                </button>
              </div>
            </div>
          ) : binomes ? (
            <>
              {aConfirmer.length > 0 && (
                <>
                  <div className="flex items-center gap-[8px] pb-[10px] pt-[22px]">
                    <h2 className="text-[17px] font-bold">À confirmer</h2>
                    <span className="flex h-[22px] min-w-[22px] items-center justify-center rounded-full bg-[#FF8A75] px-[6px] text-[12px] font-bold text-white">
                      {aConfirmer.length}
                    </span>
                  </div>
                  <div className="flex flex-col gap-[10px]">
                    {aConfirmer.map((p) => (
                      <div key={p.id} className="galet-b border border-[#FFD3C8] bg-white p-[14px] shadow-[0_4px_14px_#123A6308]">
                        <div className="flex items-center gap-[11px]">
                          <span
                            className="flex h-[40px] w-[40px] shrink-0 items-center justify-center rounded-full text-[13.5px] font-bold text-[#0F3D70]"
                            style={{ background: couleurAvatar(p.de.id) }}
                          >
                            {initiales(p.de.prenom)}
                          </span>
                          <span className="min-w-0 text-[13.5px] leading-snug text-[#5B7189]">
                            <b className="text-[#123A63]">{p.de.prenom}</b> a noté votre plongée
                          </span>
                        </div>
                        <div className="mt-[11px] galet-moyen bg-[#F1F6FC] px-[12px] py-[10px]">
                          <div className="truncate text-[14.5px] font-bold">
                            {p.site || "Site non renseigné"} · {dateCourte(p.date)}
                          </div>
                          {(p.lieu || chiffresPlongee(p)) && (
                            <div className="truncate pt-[2px] text-[12.5px] text-[#5B7189]">{[p.lieu, chiffresPlongee(p)].filter(Boolean).join(" · ")}</div>
                          )}
                        </div>
                        <div className="mt-[11px] flex items-center gap-[12px]">
                          <button
                            type="button"
                            disabled={reponseEnCours === p.id}
                            onClick={() => navigate({ to: "/amis/proposition", search: { id: p.id } })}
                            className="flex h-[42px] flex-1 items-center justify-center galet-moyen bg-[#3DEFBE] text-[13px] font-bold text-[#0B3B63] disabled:opacity-60"
                          >
                            VOIR ET AJOUTER
                          </button>
                          <button
                            type="button"
                            disabled={reponseEnCours === p.id}
                            onClick={() => void repondre(p, false)}
                            className="px-[4px] text-[12.5px] font-semibold text-[#5B7189] underline underline-offset-4 disabled:opacity-60"
                          >
                            Pas moi
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </>
              )}
              <div className="flex items-baseline justify-between pb-[10px] pt-[22px]">
                <h2 className="text-[17px] font-bold">Mes binômes</h2>
                <span className="text-[12.5px] text-[#9DB0C0]">
                  {binomes.length} personne{binomes.length > 1 ? "s" : ""}
                </span>
              </div>
              <div className="overflow-hidden galet-c border border-[#DCE7F0] bg-white shadow-[0_4px_14px_#123A6308]">
                {binomes.map((b) => (
                  <button
                    key={b.id}
                    type="button"
                    onClick={() => navigate({ to: "/amis/binome", search: { id: b.id } })}
                    className="flex w-full items-center gap-[12px] border-t border-[#EDF2F7] px-[14px] py-[12px] text-left first:border-t-0"
                  >
                    <span
                      className="flex h-[42px] w-[42px] shrink-0 items-center justify-center rounded-full text-[14px] font-bold text-[#0F3D70]"
                      style={{ background: couleurAvatar(b.id) }}
                    >
                      {initiales(b.prenom)}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[15.5px] font-bold">{b.prenom}</span>
                      <span className="block truncate text-[12.5px] text-[#5B7189]">
                        {[plongeesEnsembleTexte(comptes[b.id] ?? 0), b.niveau].filter(Boolean).join(" · ")}
                      </span>
                    </span>
                    <ChevronRight className="h-[18px] w-[18px] shrink-0 text-[#9DB0C0]" aria-hidden="true" />
                  </button>
                ))}
              </div>
              <button
                type="button"
                onClick={() => navigate({ to: "/amis/ajouter" })}
                className="mt-[16px] flex h-[52px] w-full items-center justify-center galet-moyen bg-[#3DEFBE] text-[14px] font-bold text-[#0B3B63]"
              >
                INVITER UN BINÔME
              </button>
              {erreur && <p className="pt-3 text-center text-[13px] text-[#8A2A1A]">{erreur}</p>}
            </>
          ) : null}
        </div>
      </div>
      <div className="mx-auto w-full max-w-[430px] shrink-0">
        <BarreNavigation actif="amis" />
      </div>
    </div>
  );
}
