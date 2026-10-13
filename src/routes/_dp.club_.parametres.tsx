import { useCallback, useEffect, useRef, useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { Anchor, BadgeCheck, Bell, CheckCircle2, ChevronDown, CircleHelp, FileSpreadsheet, MessageCircle, Plus, ShieldCheck, UserRound } from "lucide-react";
import logoCorail from "@/assets/palanote-logo-cigle.png";
import { ExportSaison } from "@/components/club/ExportSaison";
import { useConnexionRequise } from "@/components/numerisation/Ui";
import { NavigationDpMobile } from "@/components/club/NavigationDp";
import { Avatar, MessageErreur, PageClub } from "@/components/club/Ui";
import { messagePlanning, useCentre } from "@/components/club/useCentre";
import { BOUTON_PRINCIPAL, BOUTON_SECONDAIRE, Carte, CHAMP, Libelle, Rang } from "@/components/club/parametres/Commun";
import { OngletCompte, OngletNotifications } from "@/components/club/parametres/OngletCompte";
import { OngletProfil } from "@/components/club/parametres/OngletProfil";
import { QUESTIONS } from "@/lib/aide";
import { envoyerRetour, RAISONS_RETOUR } from "@/lib/suivi";
import { choisirCentre, oublierVerificationDp, quitterCentre } from "@/lib/club";
import { EDITEUR } from "@/lib/legal";
import { compteConnecte, type Compte } from "@/lib/moi";
import { depuisIso, modifierCentre, parametresCentre, type ParametresCentre } from "@/lib/planning";

// Paramètres de l'espace DP, pensés pour l'ordinateur : un menu à gauche
// (mon compte / le club / assistance) et le réglage choisi à droite.
// Sur téléphone, le menu devient une rangée d'onglets qui défile.
type Onglet = "profil" | "securite" | "notifications" | "centre" | "exports" | "aide";
const ONGLETS: Onglet[] = ["profil", "securite", "notifications", "centre", "exports", "aide"];

export const Route = createFileRoute("/_dp/club_/parametres")({
  validateSearch: (search: Record<string, unknown>): { onglet?: Onglet } =>
    typeof search["onglet"] === "string" && (ONGLETS as string[]).includes(search["onglet"]) ? { onglet: search["onglet"] as Onglet } : {},
  head: () => ({ meta: [{ title: "Palanote — Paramètres" }] }),
  component: PageParametres,
});

const MENU: { groupe: string; entrees: { id: Onglet; label: string; texte: string; Icone: typeof UserRound }[] }[] = [
  {
    groupe: "Mon compte",
    entrees: [
      { id: "profil", label: "Mon profil", texte: "Nom, niveau, certificat", Icone: UserRound },
      { id: "securite", label: "Connexion et sécurité", texte: "E-mail, mot de passe", Icone: ShieldCheck },
      { id: "notifications", label: "Notifications", texte: "Rappels et alertes", Icone: Bell },
    ],
  },
  {
    groupe: "Le club",
    entrees: [
      { id: "centre", label: "Le centre", texte: "Nom, ville, directeurs", Icone: Anchor },
      { id: "exports", label: "Exports", texte: "Bilan de la saison", Icone: FileSpreadsheet },
    ],
  },
  {
    groupe: "Assistance",
    entrees: [{ id: "aide", label: "Aide", texte: "Questions, nous écrire", Icone: CircleHelp }],
  },
];

function PageParametres() {
  const navigate = useNavigate();
  const { onglet = "profil" } = Route.useSearch();
  const { pret, ecran } = useConnexionRequise();
  const [compte, setCompte] = useState<Compte | null>(null);
  const bande = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (pret) void compteConnecte().then(setCompte);
  }, [pret]);

  // Téléphone : l'onglet choisi reste visible dans la bande qui défile
  useEffect(() => {
    const b = bande.current;
    const el = b?.querySelector<HTMLElement>(`[data-onglet="${onglet}"]`);
    if (b && el) b.scrollTo({ left: el.offsetLeft - (b.clientWidth - el.clientWidth) / 2 });
  }, [onglet, ecran]);

  if (ecran) return ecran;

  const aller = (o: Onglet) => navigate({ to: "/club/parametres", search: { onglet: o }, replace: true });
  const entree = MENU.flatMap((g) => g.entrees).find((e) => e.id === onglet)!;

  return (
    <PageClub titre="Paramètres" large navigation={<NavigationDpMobile />}>
      <div className="grid grid-cols-1 gap-[20px] pt-[6px] lg:grid-cols-[250px_minmax(0,1fr)] lg:gap-[32px] xl:grid-cols-[270px_minmax(0,960px)]">
        {/* Menu : colonne sur ordinateur, onglets qui défilent sur téléphone */}
        <nav aria-label="Rubriques des paramètres" className="-mx-[22px] lg:sticky lg:top-[150px] lg:mx-0 lg:self-start">
          <div ref={bande} className="flex gap-[8px] overflow-x-auto px-[22px] pb-[2px] lg:hidden">
            {MENU.flatMap((g) => g.entrees).map((e) => (
              <button
                key={e.id}
                type="button"
                data-onglet={e.id}
                onClick={() => aller(e.id)}
                className={`flex h-[38px] shrink-0 items-center gap-[7px] rounded-[10px] px-[13px] text-[13px] font-bold ${
                  e.id === onglet ? "bg-[#0F3D70] text-white" : "border border-[#D8E5EE] bg-white text-[#5B7189]"
                }`}
              >
                <e.Icone className="h-[15px] w-[15px]" aria-hidden="true" />
                {e.label}
              </button>
            ))}
          </div>
          <div className="hidden rounded-[14px] border border-[#E4EBF1] bg-white p-[10px] lg:block">
            {MENU.map((g) => (
              <div key={g.groupe} className="border-t border-[#EDF2F7] pt-[8px] first:border-t-0 first:pt-0 [&+&]:mt-[8px]">
                <p className="px-[10px] pb-[4px] pt-[6px] text-[11px] font-bold uppercase tracking-[.08em] text-[#9DB0C0]">{g.groupe}</p>
                {g.entrees.map((e) => {
                  const actif = e.id === onglet;
                  return (
                    <button
                      key={e.id}
                      type="button"
                      aria-current={actif ? "page" : undefined}
                      onClick={() => aller(e.id)}
                      className={`flex w-full items-center gap-[11px] rounded-[10px] px-[10px] py-[9px] text-left ${actif ? "bg-[#E3F2FB]" : "hover:bg-[#F1F6FC]"}`}
                    >
                      <e.Icone className={`h-[18px] w-[18px] shrink-0 ${actif ? "text-[#1176A8]" : "text-[#7D93A8]"}`} strokeWidth={2.1} aria-hidden="true" />
                      <span className="min-w-0">
                        <span className={`block text-[13.5px] font-bold ${actif ? "text-[#0F3D70]" : "text-[#3F5B76]"}`}>{e.label}</span>
                        <span className="block truncate text-[11.5px] text-[#9DB0C0]">{e.texte}</span>
                      </span>
                    </button>
                  );
                })}
              </div>
            ))}
          </div>
        </nav>

        <div className="min-w-0">
          <div className="hidden pb-[16px] lg:block">
            <h2 className="text-[20px] font-bold">{entree.label}</h2>
          </div>
          {onglet === "profil" && <OngletProfil compte={compte} />}
          {onglet === "securite" && <OngletCompte compte={compte} />}
          {onglet === "notifications" && <OngletNotifications onVoir={() => navigate({ to: "/club/notifications" })} />}
          {(onglet === "centre" || onglet === "exports") && <OngletClub vue={onglet} pret={pret} />}
          {onglet === "aide" && <OngletAide />}
        </div>
      </div>
    </PageClub>
  );
}

// Le centre (nom, ville, DP, mes centres) et les exports
function OngletClub({ vue, pret }: { vue: "centre" | "exports"; pret: boolean }) {
  const navigate = useNavigate();
  const { centre, centres, erreur: erreurCentre } = useCentre(pret);
  const [p, setP] = useState<ParametresCentre | null>(null);
  const [nom, setNom] = useState("");
  const [ville, setVille] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);
  const [quitter, setQuitter] = useState(false);
  const [exporter, setExporter] = useState(false);

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

  if (!p) return erreurCentre || erreur ? <MessageErreur texte={erreurCentre ?? erreur} /> : <div className="h-[320px] animate-pulse rounded-[14px] bg-white/60" />;

  const depuis = (iso: string) => depuisIso(iso.slice(0, 10)).toLocaleDateString("fr-FR", { month: "long", year: "numeric" });

  if (vue === "exports")
    return (
      <div className="flex flex-col gap-[20px]">
        <Carte titre="Exporter la saison" texte="Un fichier Excel pour le bilan annuel, l'assurance ou la fédération.">
          <div className="grid grid-cols-1 gap-[20px] py-[20px] md:grid-cols-[1fr_auto] md:items-center">
            <ul className="grid grid-cols-1 gap-[8px] text-[13px] text-[#5B7189] sm:grid-cols-2">
              {["Un résumé : sorties, plongées, plongeurs", "Chaque sortie, annulations et reports compris", "Chaque plongée, tamponnée ou non", "Le bilan de chaque plongeur sur la saison"].map((t) => (
                <li key={t} className="flex gap-[8px]">
                  <span className="mt-[6px] h-[6px] w-[6px] shrink-0 rounded-full bg-[#3DEFBE]" aria-hidden="true" />
                  {t}
                </li>
              ))}
            </ul>
            <button type="button" onClick={() => setExporter(true)} className={BOUTON_PRINCIPAL}>
              <FileSpreadsheet className="h-[16px] w-[16px]" aria-hidden="true" /> CHOISIR LA PÉRIODE
            </button>
          </div>
        </Carte>
        {exporter && centre && <ExportSaison centre={centre.id} onFermer={() => setExporter(false)} />}
      </div>
    );

  const modifie = nom.trim() !== p.nom || ville.trim() !== (p.ville ?? "");
  const enregistrer = async () => {
    setErreur(null);
    try {
      await modifierCentre(p.id, nom, ville);
      setMessage("Enregistré.");
      await charger();
    } catch (e) {
      setErreur(messagePlanning(e, "Le centre n'a pas pu être modifié."));
    }
  };

  return (
    <div className="flex flex-col gap-[20px]">
      <MessageErreur texte={erreur} />
      <Carte
        titre={p.nom}
        texte={`${p.nb_sorties} sortie${p.nb_sorties > 1 ? "s" : ""} organisée${p.nb_sorties > 1 ? "s" : ""} · sur Palanote depuis ${depuis(p.cree_le)}`}
        droite={
          p.verifie ? (
            <span className="flex items-center gap-[6px] rounded-[8px] bg-[#E2F8EF] px-[10px] py-[5px] text-[12px] font-bold text-[#14805F]">
              <BadgeCheck className="h-[15px] w-[15px]" aria-hidden="true" /> Centre vérifié
            </span>
          ) : undefined
        }
      >
        <Rang titre="Identité du centre" texte={p.verifie ? "Vérifié par Palanote : son nom ne se change plus." : "Visible par les plongeurs qui rejoignent tes sorties et sur leurs tampons."}>
          <div className="grid grid-cols-1 gap-[12px] sm:grid-cols-2">
            <Libelle texte="Nom du centre">
              <input className={CHAMP} value={nom} disabled={p.verifie} onChange={(e) => { setNom(e.target.value); setMessage(null); }} />
            </Libelle>
            <Libelle texte="Ville">
              <input className={CHAMP} value={ville} onChange={(e) => { setVille(e.target.value); setMessage(null); }} />
            </Libelle>
          </div>
          <div className="flex items-center gap-[12px] pt-[14px]">
            <button type="button" disabled={!modifie || !nom.trim()} onClick={() => void enregistrer()} className={BOUTON_PRINCIPAL}>
              ENREGISTRER
            </button>
            {modifie && (
              <button type="button" onClick={() => { setNom(p.nom); setVille(p.ville ?? ""); }} className={BOUTON_SECONDAIRE}>
                Annuler
              </button>
            )}
            {message && !modifie && <span className="text-[13px] font-semibold text-[#14805F]">{message}</span>}
          </div>
        </Rang>
      </Carte>

      <Carte titre="Directeurs de plongée" texte={`Un autre DP rejoint le centre depuis son app : Choisir mon centre, puis il cherche « ${p.nom} ».`} droite={<span className="text-[13px] font-bold text-[#7D93A8]">{p.dp.length}</span>}>
        <div className="grid grid-cols-1 gap-[10px] py-[16px] md:grid-cols-2 xl:grid-cols-3">
          {p.dp.map((d) => (
            <div key={d.id} className="flex items-center gap-[10px] rounded-[10px] border border-[#EDF2F7] px-[12px] py-[10px]">
              <Avatar id={d.id} prenom={d.prenom} taille={36} />
              <span className="min-w-0">
                <span className="block truncate text-[14px] font-bold">
                  {d.prenom}
                  {d.moi && <span className="font-semibold text-[#7D93A8]"> (toi)</span>}
                </span>
                <span className="block truncate text-[12px] text-[#7D93A8]">{[d.niveau, `depuis ${depuis(d.depuis)}`].filter(Boolean).join(" · ")}</span>
              </span>
            </div>
          ))}
        </div>
      </Carte>

      <Carte
        titre="Mes centres"
        texte="Si tu encadres dans plusieurs clubs, passe de l'un à l'autre."
        droite={
          <button type="button" onClick={() => navigate({ to: "/club/centre" })} className={`${BOUTON_SECONDAIRE} h-[36px]`}>
            <Plus className="h-[15px] w-[15px]" aria-hidden="true" /> Rejoindre ou créer
          </button>
        }
      >
        <div className="flex flex-wrap gap-[8px] py-[16px]">
          {(centres ?? []).map((c) => (
            <button
              key={c.id}
              type="button"
              onClick={() => {
                if (c.id === p.id) return;
                choisirCentre(c.id);
                window.location.assign("/club");
              }}
              className={`flex h-[38px] items-center gap-[7px] rounded-[10px] px-[14px] text-[13px] font-bold ${c.id === p.id ? "bg-[#0F3D70] text-white" : "border border-[#D8E5EE] bg-white text-[#5B7189] hover:border-[#57D4F5]"}`}
            >
              <Anchor className="h-[14px] w-[14px]" aria-hidden="true" />
              {c.nom}
              {c.id === p.id && <span className="font-semibold text-white/70">· actuel</span>}
            </button>
          ))}
        </div>
      </Carte>

      <Carte titre="Quitter le centre" texte={`Tu ne verras plus le planning ni les sorties de ${p.nom}. Les plongées déjà tamponnées gardent leur tampon.`} danger>
        <div className="flex flex-wrap items-center gap-[10px] py-[18px]">
          {quitter ? (
            <>
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
                className="inline-flex h-[42px] items-center rounded-[10px] bg-[#C94957] px-[16px] text-[13px] font-bold text-white"
              >
                CONFIRMER : QUITTER {p.nom.toUpperCase()}
              </button>
              <button type="button" onClick={() => setQuitter(false)} className={BOUTON_SECONDAIRE}>
                Annuler
              </button>
            </>
          ) : (
            <button type="button" onClick={() => setQuitter(true)} className="inline-flex h-[42px] items-center rounded-[10px] border border-[#F0B3A6] bg-white px-[16px] text-[13px] font-bold text-[#C94957] hover:bg-[#FFF4F1]">
              Quitter {p.nom}…
            </button>
          )}
        </div>
      </Carte>
    </div>
  );
}

function OngletAide() {
  const navigate = useNavigate();
  const [ouverte, setOuverte] = useState<number | null>(0);
  return (
    <div className="grid grid-cols-1 gap-[20px] xl:grid-cols-[minmax(0,1fr)_300px] xl:items-start">
      <Carte titre="Questions fréquentes">
        <div className="py-[6px]">
          {QUESTIONS.map((x, i) => {
            const ouvert = ouverte === i;
            return (
              <div key={x.q} className="border-t border-[#EDF2F7] first:border-t-0">
                <button type="button" aria-expanded={ouvert} onClick={() => setOuverte(ouvert ? null : i)} className="flex w-full items-center gap-[10px] py-[14px] text-left">
                  <span className="flex-1 text-[14px] font-bold leading-snug">{x.q}</span>
                  <ChevronDown className={`h-[17px] w-[17px] shrink-0 text-[#9DB0C0] transition-transform ${ouvert ? "rotate-180" : ""}`} aria-hidden="true" />
                </button>
                {ouvert && <p className="max-w-[720px] pb-[16px] text-[13.5px] leading-normal text-[#5B7189]">{x.r}</p>}
              </div>
            );
          })}
        </div>
      </Carte>
      <div className="flex flex-col gap-[20px]">
        <NousEcrire />
        <div className="rounded-[14px] border border-[#E4EBF1] bg-white p-[18px]">
          <div className="flex items-center gap-[12px]">
            <span className="flex h-[44px] w-[44px] shrink-0 items-center justify-center rounded-[12px] bg-[#0F3D70] p-[9px]">
              <img src={logoCorail} alt="" className="h-full w-auto" />
            </span>
            <span>
              <b className="block text-[15px]">Palanote</b>
              <span className="text-[12px] text-[#9DB0C0]">V2 · octobre 2026</span>
            </span>
          </div>
          <p className="pt-[10px] text-[12.5px] leading-normal text-[#5B7189]">Conçu par {EDITEUR.nom}, designer UX/UI et plongeur. Gratuit, sans publicité.</p>
          <div className="flex flex-wrap gap-x-[14px] gap-y-[6px] pt-[12px] text-[12.5px] font-semibold text-[#1176A8]">
            <button type="button" onClick={() => navigate({ to: "/conditions-utilisation" })} className="underline underline-offset-4">
              Conditions
            </button>
            <button type="button" onClick={() => navigate({ to: "/politique-de-confidentialite" })} className="underline underline-offset-4">
              Données
            </button>
            <button type="button" onClick={() => navigate({ to: "/mentions-legales" })} className="underline underline-offset-4">
              Mentions légales
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// Écrire à l'auteur sans quitter l'espace DP (même envoi que Moi › Dis-moi ce qui manque)
function NousEcrire() {
  const [raison, setRaison] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  const [enCours, setEnCours] = useState(false);
  const [envoye, setEnvoye] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);

  const envoyer = async () => {
    if (!message.trim()) return setErreur("Écris quelques mots : c'est ça qui m'aide.");
    setEnCours(true);
    setErreur(null);
    try {
      await envoyerRetour({ raison, message, joindreEmail: true });
      setEnvoye(true);
    } catch {
      setErreur("Le message n'est pas parti. Vérifie ta connexion et réessaie.");
    } finally {
      setEnCours(false);
    }
  };

  return (
    <div className="rounded-[14px] border border-[#B8E4D8] bg-[#E2F8EF] p-[18px]">
      {envoye ? (
        <div className="flex flex-col items-start gap-[6px]">
          <CheckCircle2 className="h-[26px] w-[26px] text-[#14B88A]" aria-hidden="true" />
          <p className="text-[14px] font-bold">Merci, c'est parti.</p>
          <p className="text-[13px] leading-normal text-[#3F5B76]">Je te réponds par e-mail.</p>
        </div>
      ) : (
        <>
          <MessageCircle className="h-[22px] w-[22px] text-[#14805F]" strokeWidth={2.2} aria-hidden="true" />
          <p className="pt-[8px] text-[14px] font-bold">Pas trouvé ta réponse ?</p>
          <p className="pb-[12px] pt-[3px] text-[13px] leading-normal text-[#3F5B76]">Écris-moi : je lis chaque message.</p>
          <div className="flex flex-wrap gap-[6px] pb-[10px]">
            {RAISONS_RETOUR.filter((r) => r !== "La numérisation lit mal").map((r) => (
              <button
                key={r}
                type="button"
                aria-pressed={raison === r}
                onClick={() => setRaison(raison === r ? null : r)}
                className={`h-[30px] rounded-[8px] px-[10px] text-[12px] font-semibold ${raison === r ? "bg-[#0F3D70] text-white" : "bg-white text-[#5B7189]"}`}
              >
                {r}
              </button>
            ))}
          </div>
          <textarea
            value={message}
            onChange={(e) => setMessage(e.target.value.slice(0, 1000))}
            rows={4}
            placeholder="Ce qui manque, ce qui bloque…"
            className="block w-full resize-none rounded-[10px] border border-[#B8E4D8] bg-white p-[10px] text-[13.5px] leading-normal outline-none placeholder:text-[#9DB0C0] focus:border-[#3DEFBE]"
          />
          {erreur && <p className="pt-[8px] text-[12.5px] font-semibold text-[#8A2A1A]">{erreur}</p>}
          <button type="button" disabled={enCours} onClick={() => void envoyer()} className={`${BOUTON_PRINCIPAL} mt-[10px] w-full`}>
            {enCours ? "ENVOI…" : "ENVOYER"}
          </button>
          <p className="pt-[8px] text-[11.5px] leading-normal text-[#5B7189]">Ton adresse e-mail part avec le message, pour que je puisse te répondre.</p>
        </>
      )}
    </div>
  );
}
