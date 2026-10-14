import { useCallback, useEffect, useRef, useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { Check, Clock, CreditCard, Globe, Sparkles } from "lucide-react";
import { useConnexionRequise } from "@/components/numerisation/Ui";
import { NavigationDpMobile } from "@/components/club/NavigationDp";
import { detailErreur, MessageErreur, PageClub } from "@/components/club/Ui";
import { useCentre } from "@/components/club/useCentre";
import { BOUTON_PRINCIPAL, BOUTON_SECONDAIRE } from "@/components/club/parametres/Commun";
import { chargerOffre, confirmerPaiement, OFFRES, ouvrirPaiement, ouvrirPortail, type CleOffre, type OffreClub } from "@/lib/offres";

// « Mon offre » : Starter (compris), Premium et Advanced, payés par abonnement Stripe.
export const Route = createFileRoute("/_dp/club_/offre")({
  validateSearch: (s: Record<string, unknown>): { abonnement?: "ok" | "annule"; session_id?: string } => ({
    ...(s["abonnement"] === "ok" || s["abonnement"] === "annule" ? { abonnement: s["abonnement"] } : {}),
    ...(typeof s["session_id"] === "string" ? { session_id: s["session_id"] } : {}),
  }),
  head: () => ({ meta: [{ title: "Palanote — Mon offre" }] }),
  component: PageOffre,
});

const RANG: Record<CleOffre, number> = { starter: 0, premium: 1, advanced: 2 };

function PageOffre() {
  const navigate = useNavigate();
  const { abonnement, session_id } = Route.useSearch();
  const { pret, ecran } = useConnexionRequise();
  const { centre, erreur: erreurCentre } = useCentre(pret);
  const [o, setO] = useState<OffreClub | null | undefined>(undefined);
  const [enCours, setEnCours] = useState<string | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const confirme = useRef(false);

  const charger = useCallback(async () => {
    if (!centre) return;
    try {
      setO(await chargerOffre(centre.id));
    } catch (e) {
      const m = String((e as { message?: string })?.message ?? "");
      setErreur(m.includes("offre_site_club") || (e as { code?: string })?.code === "PGRST202" ? "Lance d'abord le script « palanote-offres-domaine.sql » dans Supabase." : detailErreur(e, "L'offre n'a pas pu être chargée."));
      setO(null);
    }
  }, [centre]);

  useEffect(() => {
    void charger();
  }, [charger]);

  // Retour de Stripe : on confirme le paiement, puis on nettoie l'adresse
  useEffect(() => {
    if (!centre || confirme.current) return;
    if (abonnement === "annule") {
      confirme.current = true;
      setMessage("Paiement annulé : ton offre n'a pas changé.");
      navigate({ to: "/club/offre", search: {}, replace: true });
      return;
    }
    if (abonnement === "ok" && session_id) {
      confirme.current = true;
      setEnCours("confirmation");
      confirmerPaiement(centre.id, session_id)
        .then((r) => {
          setMessage(`Bienvenue dans l'offre ${OFFRES.find((x) => x.cle === r.offre)?.nom ?? r.offre} : elle est active.`);
          return charger();
        })
        .catch((e) => setErreur(detailErreur(e, "Le paiement n'a pas pu être confirmé.")))
        .finally(() => {
          setEnCours(null);
          navigate({ to: "/club/offre", search: {}, replace: true });
        });
    }
  }, [centre, abonnement, session_id, charger, navigate]);

  if (ecran) return ecran;

  const retour = typeof window === "undefined" ? "" : `${window.location.origin}/club/offre`;
  const choisir = async (cle: CleOffre) => {
    if (!centre || !o) return;
    setErreur(null);
    setEnCours(cle);
    try {
      // Déjà abonné : on change ou on résilie depuis le portail Stripe
      const r = o.avec_stripe && o.offre !== "starter" ? await ouvrirPortail(centre.id, retour) : await ouvrirPaiement(centre.id, cle, retour);
      window.location.assign(r.url);
    } catch (e) {
      const m = String((e as Error)?.message ?? "");
      setErreur(
        m.includes("STRIPE_SECRET_KEY")
          ? "Le paiement n'est pas encore branché : ajoute la clé Stripe (STRIPE_SECRET_KEY) dans les secrets Supabase."
          : m.includes("Failed to send") || m.includes("FunctionsFetchError") || m.includes("404")
            ? "La fonction de paiement « abonnement-club » n'est pas encore installée dans Supabase."
            : detailErreur(e, "Le paiement n'a pas pu s'ouvrir."),
      );
      setEnCours(null);
    }
  };

  const actuelle = OFFRES.find((x) => x.cle === o?.offre) ?? OFFRES[0]!;

  return (
    <PageClub titre="Mon offre" large navigation={<NavigationDpMobile />}>
      <MessageErreur texte={erreurCentre ?? erreur} />
      {message && <p className="mb-[12px] rounded-[10px] bg-[#E2F8EF] px-[14px] py-[10px] text-[13.5px] font-semibold text-[#14805F]">{message}</p>}
      {o === undefined ? (
        <div className="h-[420px] animate-pulse rounded-[14px] bg-white/60" />
      ) : (
        <>
          {o && (
            <div className="flex flex-wrap items-center gap-[14px] rounded-[14px] border border-[#E4EBF1] bg-white px-[18px] py-[16px]">
              <span className="flex h-[44px] w-[44px] items-center justify-center rounded-[10px] bg-[#E3F2FB] text-[#1176A8]">
                <Sparkles className="h-[20px] w-[20px]" aria-hidden="true" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-[16px] font-bold">Offre {actuelle.nom}</span>
                <span className="block text-[13px] text-[#7D93A8]">
                  {o.offre === "starter"
                    ? "Compris avec Palanote, sans abonnement."
                    : o.abonnement_statut === "impaye"
                      ? "Paiement en attente : mets à jour ta carte pour garder ton offre."
                      : o.abonnement_statut === "annule"
                        ? "Abonnement résilié."
                        : `${actuelle.prix} € par mois${o.abonnement_fin ? `, prochain renouvellement le ${new Date(o.abonnement_fin).toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" })}` : ""}.`}
                </span>
              </span>
              {o.avec_stripe && (
                <button type="button" disabled={enCours !== null} onClick={() => void choisir(o.offre)} className={BOUTON_SECONDAIRE}>
                  <CreditCard className="h-[16px] w-[16px]" aria-hidden="true" /> Gérer mon abonnement
                </button>
              )}
            </div>
          )}

          <div className="grid grid-cols-1 gap-[16px] pt-[18px] lg:grid-cols-3">
            {OFFRES.map((x) => {
              const courante = o?.offre === x.cle;
              const superieure = o ? RANG[x.cle] > RANG[o.offre] : false;
              return (
                <section
                  key={x.cle}
                  className={`flex flex-col rounded-[14px] border bg-white p-[22px] ${courante ? "border-[#3DEFBE] ring-2 ring-[#3DEFBE]/40" : x.cle === "premium" ? "border-[#57D4F5]" : "border-[#E4EBF1]"}`}
                >
                  <div className="flex items-start justify-between gap-[10px]">
                    <div>
                      <h2 className="text-[20px] font-bold">{x.nom}</h2>
                      <p className="text-[13px] text-[#7D93A8]">{x.accroche}</p>
                    </div>
                    {courante && <span className="rounded-[8px] bg-[#E2F8EF] px-[10px] py-[5px] text-[12px] font-bold text-[#14805F]">Ton offre</span>}
                  </div>
                  <p className="pt-[16px]">
                    {x.prix === 0 ? (
                      <span className="text-[34px] font-bold tracking-[-0.02em]">Compris</span>
                    ) : (
                      <>
                        <span className="text-[34px] font-bold tracking-[-0.02em]">{x.prix} €</span>
                        <span className="text-[14px] text-[#7D93A8]"> par mois, sans engagement</span>
                      </>
                    )}
                  </p>
                  <ul className="flex flex-col gap-[8px] pt-[16px]">
                    {x.inclus.map((t) => (
                      <li key={t} className="flex gap-[8px] text-[13.5px] leading-snug">
                        <Check className="mt-[2px] h-[16px] w-[16px] shrink-0 text-[#14805F]" strokeWidth={2.6} aria-hidden="true" />
                        {t}
                      </li>
                    ))}
                    {x.bientot.map((t) => (
                      <li key={t} className="flex gap-[8px] text-[13.5px] leading-snug text-[#7D93A8]">
                        <Clock className="mt-[2px] h-[16px] w-[16px] shrink-0" aria-hidden="true" />
                        <span>
                          {t} <span className="rounded-[6px] bg-[#FFF1D6] px-[6px] py-[1px] text-[11px] font-bold text-[#8A5A10]">bientôt</span>
                        </span>
                      </li>
                    ))}
                  </ul>
                  <div className="mt-auto pt-[22px]">
                    {courante ? (
                      <span className="block text-center text-[13px] font-semibold text-[#7D93A8]">C'est ton offre actuelle</span>
                    ) : x.cle === "starter" ? (
                      o?.avec_stripe ? (
                        <button type="button" disabled={enCours !== null} onClick={() => void choisir(x.cle)} className={`${BOUTON_SECONDAIRE} w-full`}>
                          Revenir au Starter
                        </button>
                      ) : null
                    ) : (
                      <button
                        type="button"
                        disabled={enCours !== null || !o}
                        onClick={() => void choisir(x.cle)}
                        className={`${superieure ? BOUTON_PRINCIPAL : BOUTON_SECONDAIRE} w-full`}
                      >
                        {enCours === x.cle ? "OUVERTURE DU PAIEMENT…" : superieure ? `PASSER AU ${x.nom.toUpperCase()}` : `Passer au ${x.nom}`}
                      </button>
                    )}
                  </div>
                </section>
              );
            })}
          </div>

          <div className="mt-[16px] flex flex-wrap items-start gap-[12px] rounded-[14px] border border-[#BFE3F4] bg-[#E3F2FB] px-[18px] py-[14px] text-[13px] leading-normal text-[#3F5B76]">
            <CreditCard className="mt-[1px] h-[18px] w-[18px] shrink-0 text-[#1176A8]" aria-hidden="true" />
            <span className="min-w-0 flex-1">
              <b className="text-[#123A63]">Paiement sécurisé par Stripe, en mode test pour la démonstration.</b> Carte de test : 4242 4242 4242 4242, une date future, n'importe quel code. Aucune somme n'est débitée.
            </span>
            <button type="button" onClick={() => navigate({ to: "/club/site" })} className="flex items-center gap-[6px] font-bold text-[#1176A8]">
              <Globe className="h-[15px] w-[15px]" aria-hidden="true" /> Mon site internet
            </button>
          </div>
        </>
      )}
    </PageClub>
  );
}
