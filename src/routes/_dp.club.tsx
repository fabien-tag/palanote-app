import { useEffect, useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import {
  AlertTriangle,
  Anchor,
  ArrowUpRight,
  CalendarDays,
  CheckCircle2,
  ChevronRight,
  Clock,
  FileText,
  LifeBuoy,
  Map as IconeCarte,
  PenLine,
  Plus,
  QrCode,
  Settings,
  Stamp,
  UserRound,
  Users,
  UsersRound,
  Waves,
} from "lucide-react";
import { useConnexionRequise } from "@/components/numerisation/Ui";
import { ClocheDp } from "@/components/club/ClocheDp";
import { BoutonRecherche } from "@/components/club/RechercheDp";
import { NavigationDpMobile } from "@/components/club/NavigationDp";
import { Avatar, detailErreur, LigneSortie, MessageErreur, PageClub, Titre } from "@/components/club/Ui";
import {
  accueilDp,
  centreChoisi,
  choisirCentre,
  heureCourte,
  mesCentres,
  relanceRecente,
  relancerFiches,
  scriptManquant,
  sortiesDp,
  type AccueilDp,
  type ActionDp,
  type Centre,
  type ProchaineSortie,
  type SortieResume,
} from "@/lib/club";
import { monProfil } from "@/lib/amis";
import { adherentsCentre, ajouterJours, alertesSortie, aujourdhui, controleProche, depuisIso, lundi, planningCentre, type Planning } from "@/lib/planning";

// Onglet « Sorties » : l'accueil du directeur de plongée (parcours 15).
// Le jour J (prochaine sortie), ce qu'il reste à faire, sa saison et les gens du centre.
// Sur ordinateur, la page s'élargit en tableau de bord à deux colonnes.
export const Route = createFileRoute("/_dp/club")({
  head: () => ({ meta: [{ title: "Palanote — Espace club" }] }),
  component: EspaceClub,
});

function EspaceClub() {
  const navigate = useNavigate();
  const { pret, ecran } = useConnexionRequise();
  const [centres, setCentres] = useState<Centre[] | null>(null);
  const [sorties, setSorties] = useState<SortieResume[]>([]);
  const [erreur, setErreur] = useState<string | null>(null);
  const [accueil, setAccueil] = useState<AccueilDp | null>(null);
  const [relances, setRelances] = useState<Record<string, string>>({});
  const [toutVoir, setToutVoir] = useState(false);
  const [plan, setPlan] = useState<Planning | null>(null); // 2 semaines à partir de lundi : frise et voyants
  const [prenom, setPrenom] = useState<string | null>(null);
  const [certificats, setCertificats] = useState({ expires: 0, proches: 0 });

  useEffect(() => {
    if (!pret) return;
    void (async () => {
      try {
        const [c, s] = await Promise.all([mesCentres(), sortiesDp()]);
        setCentres(c);
        setSorties(s);
      } catch (e) {
        console.error(e);
        setCentres([]);
        setErreur(detailErreur(e, "L'espace club n'a pas pu être chargé."));
      }
    })();
  }, [pret]);

  // Le tableau de bord du centre choisi (silencieux si le script SQL n'est pas encore lancé)
  useEffect(() => {
    if (!centres || centres.length === 0) return;
    const id = centres.find((c) => c.id === centreChoisi())?.id ?? centres[0]!.id;
    let actif = true;
    setAccueil(null);
    accueilDp(id)
      .then((a) => actif && setAccueil(a))
      .catch((e) => {
        if (!scriptManquant(e)) console.error(e);
      });
    const debut = lundi(aujourdhui());
    planningCentre(id, debut, ajouterJours(debut, 13))
      .then((p) => actif && setPlan(p))
      .catch((e) => {
        if (!scriptManquant(e)) console.error(e);
      });
    void monProfil().then((m) => actif && setPrenom(m?.prenom ?? null));
    adherentsCentre(id)
      .then((l) => {
        if (!actif) return;
        const etats = l.map((a) => controleProche(a.certificat_fin));
        setCertificats({ expires: etats.filter((e) => e === "depasse").length, proches: etats.filter((e) => e === "proche").length });
      })
      .catch(() => undefined);
    return () => {
      actif = false;
    };
  }, [centres]);

  if (ecran) return ecran;

  const idCentre = centres?.find((c) => c.id === centreChoisi())?.id ?? centres?.[0]?.id;
  const centre = centres?.find((c) => c.id === idCentre) ?? null;
  const relancer = async (sortie: string) => {
    setRelances((r) => ({ ...r, [sortie]: "envoi" }));
    try {
      const nb = await relancerFiches(sortie);
      setRelances((r) => ({ ...r, [sortie]: nb > 0 ? `${nb} relancé${nb > 1 ? "s" : ""}` : "Personne à relancer" }));
    } catch (e) {
      const deja = /déjà relancé/i.test(String((e as { message?: string })?.message ?? ""));
      setRelances((r) => ({ ...r, [sortie]: deja ? "Déjà relancé aujourd'hui" : "Échec, réessaie" }));
    }
  };
  const duCentre = sorties.filter((s) => !centre || s.centre_id === centre.id);
  const aTamponner = duCentre.filter((s) => s.statut === "terminee");
  const aVenir = duCentre.filter((s) => s.statut === "prevue").sort((a, b) => a.date.localeCompare(b.date));
  const passees = duCentre.filter((s) => s.statut === "validee" || s.statut === "annulee");
  const ouvrir = (s: SortieResume) => navigate({ to: "/club/sortie", search: { id: s.id } });

  return (
    <PageClub
      titre={prenom ? `Bonjour ${prenom}` : "Tableau de bord"}
      titreBureau={prenom ? `Bonjour ${prenom}` : "Tableau de bord"}
      sousTitreBureau={[centre?.nom, depuisIso(aujourdhui()).toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long" })].filter(Boolean).join(" · ")}
      large
      navigation={<NavigationDpMobile />}
      droite={
        <span className="flex items-center gap-[8px] lg:hidden">
          <BoutonRecherche />
          <ClocheDp />
        </span>
      }
      bas={
        centre ? (
          <button
            type="button"
            onClick={() => navigate({ to: "/club/nouvelle-sortie", search: { centre: centre.id } })}
            className="flex h-14 w-full items-center justify-center gap-2 galet-moyen bg-[#3DEFBE] text-[14px] font-bold text-[#0B3B63] shadow-[0_4px_12px_#123A630D]"
          >
            <Plus className="h-[18px] w-[18px]" strokeWidth={2.6} aria-hidden="true" />
            NOUVELLE SORTIE
          </button>
        ) : null
      }
    >
      <MessageErreur texte={erreur} />

      {centres && centres.length === 0 && !erreur && (
        <>
          <div className="pt-[18px]">
            <h2 className="text-[24px] font-bold leading-tight">Tes sorties de club, sans papier</h2>
            <p className="pt-[8px] text-[14px] leading-normal text-[#5B7189]">
              Tu es directeur de plongée ? Prépare la sortie, ajoute tes plongeurs en un scan, et valide leurs carnets d'un geste.
            </p>
          </div>
          <div className="flex flex-col gap-[14px] pt-[22px]">
            {[
              { Icone: QrCode, t: "Ajoute les plongeurs à la volée", x: "Ils scannent le QR sur le bateau, ou tu les cherches par leur nom." },
              { Icone: Users, t: "Ils reçoivent la sortie dans l'app", x: "Date, heure, site, bateau, consignes. Et leur palanquée." },
              { Icone: Stamp, t: "Tu poses le tampon numérique", x: "Leurs fiches arrivent préremplies ; tu valides toute la sortie d'un geste." },
            ].map(({ Icone, t, x }) => (
              <div key={t} className="flex items-start gap-[13px]">
                <span className="flex h-[42px] w-[42px] shrink-0 items-center justify-center goutte bg-[#E3F2FB]">
                  <Icone className="h-[20px] w-[20px] text-[#1176A8]" strokeWidth={2.1} aria-hidden="true" />
                </span>
                <span>
                  <span className="block text-[14.5px] font-bold leading-snug">{t}</span>
                  <span className="block pt-[2px] text-[13px] leading-normal text-[#5B7189]">{x}</span>
                </span>
              </div>
            ))}
          </div>
          <div className="flex-grow" />
          <button
            type="button"
            onClick={() => navigate({ to: "/club/centre" })}
            className="mt-[28px] flex h-14 w-full items-center justify-center galet-moyen bg-[#3DEFBE] text-[14px] font-bold text-[#0B3B63]"
          >
            CHOISIR MON CENTRE
          </button>
        </>
      )}

      {centre && (
        <>
          <div className="lg:grid lg:grid-cols-[minmax(0,1fr)_360px] lg:items-start lg:gap-x-[36px]">
            {/* Colonne principale : le jour J et ce qu'il reste à faire */}
            <div className="lg:col-start-1 lg:row-start-1">
              {accueil ? (
                <>
                  <Titre>Prochaine sortie</Titre>
                  <div className="lg:grid lg:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)] lg:gap-[16px]">
                  {accueil.prochaine ? (
                    <CarteProchaine
                      p={accueil.prochaine}
                      onOuvrir={() => navigate({ to: "/club/sortie", search: { id: accueil.prochaine!.id } })}
                      onQr={() => navigate({ to: "/club/sortie", search: { id: accueil.prochaine!.id, qr: true } })}
                      onFiche={() => navigate({ to: "/club/fiche-securite", search: { id: accueil.prochaine!.id } })}
                    />
                  ) : (
                    <p className="galet-b border border-dashed border-[#D5E1EC] bg-white/60 px-[15px] py-[16px] text-[13.5px] leading-normal text-[#5B7189]">
                      Aucune sortie prévue. Crée la prochaine : tes plongeurs la recevront dans leur app.
                    </p>
                  )}
                    {/* Sur ordinateur : la saison en deux grandes tuiles */}
                    <div className="hidden grid-rows-2 gap-[16px] lg:grid">
                      <TuileDegrade
                        fond="linear-gradient(140deg,#FFF1EC 0%,#FFC2B4 55%,#FF8A75 100%)"
                        Icone={Anchor}
                        titre={`Sorties encadrées en ${accueil.stats.annee}`}
                        valeur={accueil.stats.sorties}
                        details={[accueil.stats.sorties_mois > 0 ? `${accueil.stats.sorties_mois} ce mois-ci` : "aucune ce mois-ci", `${accueil.stats.tampons} tampons posés`]}
                      />
                      <TuileDegrade
                        fond="linear-gradient(140deg,#E9FBFF 0%,#9FE6F7 50%,#57B8F5 100%)"
                        Icone={Users}
                        titre="Plongeurs encadrés"
                        valeur={accueil.stats.plongeurs}
                        details={[`${accueil.stats.plongees} plongées`, `${heuresMinutes(accueil.stats.minutes)} sous l'eau`]}
                      />
                    </div>
                  </div>

                  {plan && <FriseSemaine plan={plan} onOuvrir={(id, date) => navigate({ to: "/club/planning", search: { semaine: date, sortie: id } })} onPlanning={() => navigate({ to: "/club/planning" })} />}

                  <Titre aide={accueil.a_faire.length > 0 ? `${accueil.a_faire.length} action${accueil.a_faire.length > 1 ? "s" : ""}` : undefined}>À faire</Titre>
                  {accueil.a_faire.length === 0 ? (
                    <div className="flex items-center gap-[11px] galet-b bg-[#E2F8EF] px-[14px] py-[13px] text-[13.5px] font-semibold text-[#14805F]">
                      <CheckCircle2 className="h-[19px] w-[19px] shrink-0" aria-hidden="true" />
                      Rien en attente : tout est tamponné.
                    </div>
                  ) : (
                    <div className="flex flex-col gap-[8px]">
                      {accueil.a_faire.map((a) => (
                        <LigneAction
                          key={`${a.type}-${a.sortie_id}`}
                          a={a}
                          relance={relances[a.sortie_id]}
                          onOuvrir={() => navigate({ to: "/club/sortie", search: { id: a.sortie_id } })}
                          onRelancer={() => void relancer(a.sortie_id)}
                        />
                      ))}
                    </div>
                  )}
                </>
              ) : (
                aTamponner.length > 0 && (
                  <>
                    <Titre aide="les fiches arrivent">À tamponner</Titre>
                    <div className="flex flex-col gap-[10px]">
                      {aTamponner.map((s) => (
                        <LigneSortie key={s.id} s={s} onClick={() => ouvrir(s)} />
                      ))}
                    </div>
                  </>
                )
              )}
            </div>

            {/* Colonne de droite sur ordinateur : la saison et les gens */}
            {accueil && (
              <div className="lg:col-start-2 lg:row-span-2 lg:row-start-1">
                {plan && <PointsAttention plan={plan} accueil={accueil} certificats={certificats} />}
                <div className="lg:hidden">
                <Titre>Ta saison {accueil.stats.annee}</Titre>
                <div className="grid grid-cols-2 gap-[10px]">
                  <Tuile Icone={Anchor} valeur={accueil.stats.sorties} libelle={`sortie${accueil.stats.sorties > 1 ? "s" : ""} encadrée${accueil.stats.sorties > 1 ? "s" : ""}`} detail={accueil.stats.sorties_mois > 0 ? `dont ${accueil.stats.sorties_mois} ce mois-ci` : "aucune ce mois-ci"} />
                  <Tuile Icone={Users} valeur={accueil.stats.plongeurs} libelle={`plongeur${accueil.stats.plongeurs > 1 ? "s" : ""}`} detail={`${accueil.stats.plongees} plongée${accueil.stats.plongees > 1 ? "s" : ""} encadrée${accueil.stats.plongees > 1 ? "s" : ""}`} />
                  <Tuile Icone={Stamp} valeur={accueil.stats.tampons} libelle={`tampon${accueil.stats.tampons > 1 ? "s" : ""} posé${accueil.stats.tampons > 1 ? "s" : ""}`} detail="carnets validés" corail />
                  <Tuile Icone={Clock} valeur={heuresMinutes(accueil.stats.minutes)} libelle="d'encadrement" detail="sous l'eau" />
                </div>
                </div>

                {accueil.habitues.length > 0 && (
                  <>
                    <Titre aide="avec le centre">Les habitués</Titre>
                    <div className="-mx-[22px] flex gap-[10px] overflow-x-auto px-[22px] pb-[4px] lg:mx-0 lg:flex-wrap lg:px-0">
                      {accueil.habitues.map((h) => (
                        <div key={h.id} className="flex w-[96px] shrink-0 flex-col items-center galet-b border border-[#E4EBF1] bg-white px-[8px] pb-[10px] pt-[12px] text-center">
                          <span className="relative">
                            <Avatar id={h.id} prenom={h.prenom} taille={44} />
                            <span className="absolute -bottom-[3px] -right-[8px] rounded-[9px] bg-[#0F3D70] px-[6px] py-[1px] text-[11px] font-bold text-white">×{h.nb}</span>
                          </span>
                          <span className="block w-full truncate pt-[7px] text-[13.5px] font-bold">{h.prenom}</span>
                          <span className="block w-full truncate text-[11.5px] text-[#5B7189]">{h.niveau ?? "—"}</span>
                        </div>
                      ))}
                    </div>
                  </>
                )}

                {accueil.nouveaux.length > 0 && (
                  <>
                    <Titre aide="30 derniers jours">Les nouveaux</Titre>
                    <div className="flex flex-col gap-[6px]">
                      {accueil.nouveaux.slice(0, 5).map((n) => (
                        <div key={n.id} className="flex items-center gap-[11px] galet-petit bg-white px-[12px] py-[9px]">
                          <Avatar id={n.id} prenom={n.prenom} taille={34} />
                          <span className="min-w-0 flex-1">
                            <span className="block truncate text-[14px] font-bold">
                              {n.prenom}
                              {n.niveau ? <span className="font-semibold text-[#5B7189]"> · {n.niveau}</span> : null}
                            </span>
                            <span className="block truncate text-[12px] text-[#5B7189]">1re sortie : {n.premiere ? dateCourte(n.premiere) : ""}{n.site ? ` · ${n.site}` : ""}</span>
                          </span>
                          <span className="shrink-0 rounded-[9px] bg-[#FFF1D6] px-[7px] py-[2px] text-[11px] font-bold text-[#8A5A10]">Nouveau</span>
                        </div>
                      ))}
                    </div>
                  </>
                )}

                {accueil.sites.length > 0 && (
                  <>
                    <Titre>Tes sites</Titre>
                    <div className="flex flex-col gap-[10px] galet-b border border-[#E4EBF1] bg-white px-[14px] py-[13px]">
                      {accueil.sites.map((t) => (
                        <div key={t.site}>
                          <div className="flex items-baseline justify-between gap-2">
                            <span className="truncate text-[14px] font-bold">{t.site}</span>
                            <span className="shrink-0 text-[12px] text-[#5B7189]">
                              {t.nb} sortie{t.nb > 1 ? "s" : ""}
                              {t.duree_moy ? ` · ${t.duree_moy} min` : ""}
                              {t.prof_max ? ` · ${String(t.prof_max).replace(".0", "").replace(".", ",")} m` : ""}
                            </span>
                          </div>
                          <div className="mt-[5px] h-[6px] overflow-hidden rounded-[3px] bg-[#EEF4F9]">
                            <div className="h-full rounded-[3px] bg-[#57D4F5]" style={{ width: `${Math.max(8, (t.nb / accueil.sites[0]!.nb) * 100)}%` }} />
                          </div>
                        </div>
                      ))}
                    </div>
                  </>
                )}
              </div>
            )}

            {/* Toutes les sorties */}
            <div className="lg:col-start-1 lg:row-start-2">
              <Titre>À venir</Titre>
              {aVenir.length === 0 ? (
                <p className="galet-b border border-dashed border-[#D5E1EC] bg-white/60 px-[15px] py-[16px] text-[13.5px] leading-normal text-[#5B7189]">
                  Aucune sortie prévue. Crée la prochaine : tes plongeurs la recevront dans leur app.
                </p>
              ) : (
                <div className="flex flex-col gap-[10px]">
                  {aVenir.map((s) => (
                    <LigneSortie key={s.id} s={s} onClick={() => ouvrir(s)} />
                  ))}
                </div>
              )}

              {passees.length > 0 && (
                <>
                  <Titre aide={`${passees.length}`}>Passées</Titre>
                  <div className="flex flex-col gap-[10px]">
                    {passees.slice(0, toutVoir ? 60 : 5).map((s) => (
                      <LigneSortie key={s.id} s={s} onClick={() => ouvrir(s)} />
                    ))}
                  </div>
                  {passees.length > 5 && !toutVoir && (
                    <button type="button" onClick={() => setToutVoir(true)} className="mx-auto mt-[12px] block text-[13px] font-bold text-[#1176A8]">
                      Voir les {passees.length} sorties passées
                    </button>
                  )}
                </>
              )}
            </div>
          </div>
        </>
      )}

    </PageClub>
  );
}

const majuscule = (t: string) => t.charAt(0).toUpperCase() + t.slice(1);

function heuresMinutes(min: number) {
  if (!min) return "0 h";
  const h = Math.floor(min / 60);
  const m = min % 60;
  return h === 0 ? `${m} min` : m === 0 ? `${h} h` : `${h} h ${String(m).padStart(2, "0")}`;
}

function dateCourte(d: string) {
  const x = new Date(`${d}T12:00:00`);
  return isNaN(x.getTime()) ? d : x.toLocaleDateString("fr-FR", { day: "numeric", month: "short" });
}

function quand(p: ProchaineSortie) {
  const j = p.dans_jours;
  const jour = j === 0 ? "Aujourd'hui" : j === 1 ? "Demain" : j < 7 ? p.date_texte : `Dans ${j} jours · ${p.date_texte}`;
  return [jour, heureCourte(p.heure)].filter(Boolean).join(" · ");
}

// La carte du jour J : remplissage, alertes palanquées, QR en un geste
function CarteProchaine({ p, onOuvrir, onQr, onFiche }: { p: ProchaineSortie; onOuvrir: () => void; onQr: () => void; onFiche: () => void }) {
  const alertes = [
    p.sans_guide > 0 ? `${p.sans_guide} palanquée${p.sans_guide > 1 ? "s" : ""} sans guide` : null,
    p.sans_palanquee > 0 ? `${p.sans_palanquee} plongeur${p.sans_palanquee > 1 ? "s" : ""} sans palanquée` : null,
  ].filter(Boolean) as string[];
  return (
    <div className="galet border border-[#E4EBF1] bg-white p-[16px] shadow-[0_4px_14px_#123A6306]">
      <button type="button" onClick={onOuvrir} className="block w-full text-left">
        <p className="text-[12.5px] font-bold uppercase tracking-[.07em] text-[#1176A8]">{quand(p)}</p>
        <h3 className="pt-[3px] text-[23px] font-bold leading-tight">{p.site}</h3>
        <p className="truncate text-[13.5px] text-[#5B7189]">{[p.lieu, p.bateau, p.mienne ? null : "un autre DP"].filter(Boolean).join(" · ")}</p>
        <div className="grid grid-cols-3 gap-[8px] pt-[13px]">
          {[
            { v: p.nb_inscrits, l: `inscrit${p.nb_inscrits > 1 ? "s" : ""}` },
            { v: p.nb_prevus, l: "en attente" },
            { v: p.nb_palanquees, l: `palanquée${p.nb_palanquees > 1 ? "s" : ""}` },
          ].map(({ v, l }) => (
            <span key={l} className="galet-petit bg-[#F1F6FC] px-[10px] py-[8px]">
              <span className="block text-[20px] font-bold leading-none">{v}</span>
              <span className="block pt-[3px] text-[11.5px] text-[#5B7189]">{l}</span>
            </span>
          ))}
        </div>
      </button>
      {alertes.length > 0 && (
        <div className="mt-[10px] flex flex-wrap gap-[6px]">
          {alertes.map((a) => (
            <span key={a} className="flex items-center gap-[5px] rounded-[10px] bg-[#FFE9E2] px-[9px] py-[4px] text-[12px] font-bold text-[#D9573F]">
              <AlertTriangle className="h-[13px] w-[13px]" strokeWidth={2.4} aria-hidden="true" />
              {a}
            </span>
          ))}
        </div>
      )}
      <div className="grid grid-cols-2 gap-[8px] pt-[13px]">
        <button type="button" onClick={onQr} className="flex h-[46px] items-center justify-center gap-2 galet-moyen bg-[#0F3D70] text-[13px] font-bold text-white">
          <QrCode className="h-[17px] w-[17px]" strokeWidth={2.2} aria-hidden="true" />
          QR CODE
        </button>
        <button type="button" onClick={onOuvrir} className="flex h-[46px] items-center justify-center gap-2 galet-moyen border border-[#57D4F5] bg-white text-[13px] font-bold text-[#1176A8]">
          <Users className="h-[17px] w-[17px]" strokeWidth={2.2} aria-hidden="true" />
          PALANQUÉES
        </button>
      </div>
      <button type="button" onClick={onFiche} className="mt-[10px] flex w-full items-center justify-center gap-[6px] text-[12.5px] font-bold text-[#5B7189]">
        <FileText className="h-[14px] w-[14px]" aria-hidden="true" />
        Fiche de sécurité
      </button>
    </div>
  );
}

const STYLE_ACTION = {
  tampon: { Icone: Stamp, fond: "bg-[#FFE9E2]", couleur: "text-[#D9573F]" },
  fiches: { Icone: PenLine, fond: "bg-[#E2F8EF]", couleur: "text-[#14805F]" },
  noms: { Icone: UserRound, fond: "bg-[#EEF2F6]", couleur: "text-[#5B7189]" },
} as const;

function LigneAction({ a, relance, onOuvrir, onRelancer }: { a: ActionDp; relance: string | undefined; onOuvrir: () => void; onRelancer: () => void }) {
  const { Icone, fond, couleur } = STYLE_ACTION[a.type];
  const titre =
    a.type === "tampon"
      ? `Tamponner ${majuscule(a.site.trim())}`
      : a.type === "fiches"
        ? `${a.nb} fiche${a.nb > 1 ? "s" : ""} pas remplie${a.nb > 1 ? "s" : ""}`
        : `${a.nb} prénom${a.nb > 1 ? "s" : ""} jamais réclamé${a.nb > 1 ? "s" : ""}`;
  const detail =
    a.type === "tampon"
      ? `${a.date_texte} · ${a.nb}/${a.total ?? 0} fiche${(a.total ?? 0) > 1 ? "s" : ""} remplie${a.nb > 1 ? "s" : ""}`
      : a.type === "fiches"
        ? `${majuscule(a.site.trim())} · ${a.date_texte}`
        : `${majuscule(a.site.trim())} · rattache-les ou retire-les`;
  const aRelancer = a.type === "fiches" ? a.nb : a.type === "tampon" ? (a.manquantes ?? 0) : 0;
  const dejaRelance = relanceRecente(a.relance_le);
  const etat = relance ?? (dejaRelance ? "Relancé aujourd'hui" : null);
  return (
    <div className="flex items-center gap-[11px] galet-b border border-[#E4EBF1] bg-white px-[12px] py-[10px]">
      <button type="button" onClick={onOuvrir} className="flex min-w-0 flex-1 items-center gap-[11px] text-left">
        <span className={`flex h-[38px] w-[38px] shrink-0 items-center justify-center goutte ${fond}`}>
          <Icone className={`h-[18px] w-[18px] ${couleur}`} strokeWidth={2.2} aria-hidden="true" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[14.5px] font-bold">{titre}</span>
          <span className="block truncate text-[12px] text-[#5B7189]">{detail}</span>
        </span>
      </button>
      {aRelancer > 0 &&
        (etat ? (
          <span className="shrink-0 text-right text-[11.5px] font-semibold leading-tight text-[#14805F]">{etat === "envoi" ? "Envoi…" : etat}</span>
        ) : (
          <button type="button" onClick={onRelancer} className="shrink-0 rounded-[14px] border border-[#57D4F5] px-[11px] py-[6px] text-[12px] font-bold text-[#1176A8]">
            Relancer
          </button>
        ))}
      {aRelancer === 0 && <ChevronRight className="h-[16px] w-[16px] shrink-0 text-[#9DB0C0]" aria-hidden="true" />}
    </div>
  );
}

function Tuile({ Icone, valeur, libelle, detail, corail = false }: { Icone: typeof Anchor; valeur: number | string; libelle: string; detail: string; corail?: boolean }) {
  return (
    <div className="galet-b border border-[#E4EBF1] bg-white px-[13px] py-[12px]">
      <Icone className={`h-[18px] w-[18px] ${corail ? "text-[#FF8A75]" : "text-[#1176A8]"}`} strokeWidth={2.2} aria-hidden="true" />
      <span className="block pt-[7px] text-[26px] font-bold leading-none">{valeur}</span>
      <span className="block pt-[3px] text-[13px] font-semibold leading-tight">{libelle}</span>
      <span className="block pt-[2px] text-[11.5px] text-[#7D93A8]">{detail}</span>
    </div>
  );
}

// Grande tuile en dégradé (tableau de bord sur ordinateur), aux couleurs de Palanote
function TuileDegrade({ fond, Icone, titre, valeur, details }: { fond: string; Icone: typeof Anchor; titre: string; valeur: number; details: string[] }) {
  return (
    <div className="relative flex flex-col justify-between overflow-hidden rounded-[10px] px-[20px] py-[16px] text-[#123A63]" style={{ background: fond }}>
      <div className="flex items-start justify-between gap-2">
        <span className="text-[14px] font-semibold leading-snug">{titre}</span>
        <span className="flex h-[34px] w-[34px] items-center justify-center rounded-[10px] bg-white/55">
          <Icone className="h-[17px] w-[17px]" strokeWidth={2.2} aria-hidden="true" />
        </span>
      </div>
      <div className="pt-[10px]">
        <span className="block text-[44px] font-bold leading-none tracking-[-.02em]">{valeur}</span>
        <span className="block pt-[6px] text-[12.5px] font-semibold text-[#123A63]/75">{details.join(" · ")}</span>
      </div>
    </div>
  );
}

// Les deux semaines du centre en frise : un coup d'œil sur les palanquées de chaque jour
const JOURS_COURTS = ["Lun", "Mar", "Mer", "Jeu", "Ven", "Sam", "Dim"];
function FriseSemaine({ plan, onOuvrir, onPlanning }: { plan: Planning; onOuvrir: (id: string, date: string) => void; onPlanning: () => void }) {
  const auj = aujourdhui();
  const debut = lundi(auj);
  const jours = Array.from({ length: 7 }, (_, i) => ajouterJours(debut, i));
  return (
    <div className="hidden lg:block">
      <div className="flex items-baseline justify-between pb-[9px] pt-[22px]">
        <h2 className="text-[13px] font-bold uppercase tracking-[.08em] text-[#5B7189]">Cette semaine</h2>
        <button type="button" onClick={onPlanning} className="flex items-center gap-[4px] text-[12.5px] font-bold text-[#1176A8]">
          Ouvrir le planning <ArrowUpRight className="h-[14px] w-[14px]" />
        </button>
      </div>
      <div className="grid grid-cols-7 gap-[6px] rounded-[10px] border border-[#E4EBF1] bg-white p-[8px]">
        {jours.map((d, i) => {
          const liste = plan.sorties.filter((s) => s.date === d && s.statut !== "annulee");
          const pal = liste.reduce((t, s) => t + s.nb_palanquees, 0);
          return (
            <div key={d} className={`flex min-h-[112px] flex-col gap-[4px] rounded-[10px] p-[6px] ${d === auj ? "bg-[#E3F2FB]" : d < auj ? "bg-[#F7FAFD]" : ""}`}>
              <div className="flex items-baseline justify-between">
                <span className={`text-[12px] font-bold ${d === auj ? "text-[#1176A8]" : d < auj ? "text-[#9DB0C0]" : ""}`}>
                  {JOURS_COURTS[i]} {depuisIso(d).getDate()}
                </span>
                {pal > 0 && <span className="text-[10.5px] font-bold text-[#5B7189]">{pal} pal.</span>}
              </div>
              {liste.map((s) => {
                const alerte = alertesSortie(s, plan.sorties, plan.materiel).length > 0;
                return (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => onOuvrir(s.id, s.date)}
                    className={`rounded-[8px] border-l-[3px] bg-white px-[6px] py-[4px] text-left shadow-[0_1px_4px_#123A6314] ${
                      s.statut === "prevue" ? "border-l-[#57D4F5]" : s.statut === "terminee" ? "border-l-[#FF8A75]" : "border-l-[#3DEFBE]"
                    }`}
                  >
                    <span className="flex items-center gap-[4px] text-[10.5px] font-bold text-[#1176A8]">
                      {heureCourte(s.heure)}
                      {alerte && <span className="h-[6px] w-[6px] rounded-full bg-[#FF8A75]" aria-label="point à régler" />}
                    </span>
                    <span className="block truncate text-[11.5px] font-bold">{s.site}</span>
                    <span className="block text-[10.5px] text-[#7D93A8]">{s.nb_inscrits + s.nb_prevus} plong.</span>
                  </button>
                );
              })}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// Points d'attention : les voyants du centre (sorties à risque, matériel à contrôler, tampons)
type Voyant = { niveau: "rouge" | "orange" | "bleu"; titre: string; sous: string; aller: () => void };
function PointsAttention({ plan, accueil, certificats }: { plan: Planning; accueil: AccueilDp; certificats: { expires: number; proches: number } }) {
  const navigate = useNavigate();
  const auj = aujourdhui();
  const jour = (d: string) => depuisIso(d).toLocaleDateString("fr-FR", { weekday: "short", day: "numeric", month: "short" });
  const voyants: Voyant[] = [];
  for (const s of plan.sorties.filter((x) => x.date >= auj)) {
    for (const a of alertesSortie(s, plan.sorties, plan.materiel)) {
      voyants.push({
        niveau: /plein|:/.test(a) ? "rouge" : "orange",
        titre: a,
        sous: `${jour(s.date)} · ${s.site}`,
        aller: () => navigate({ to: "/club/planning", search: { semaine: s.date, sortie: s.id } }),
      });
    }
  }
  for (const m of plan.materiel) {
    const etat = controleProche(m.prochain_controle);
    if (etat)
      voyants.push({
        niveau: etat === "depasse" ? "rouge" : "orange",
        titre: `${m.libelle} : contrôle ${etat === "depasse" ? "dépassé" : "à prévoir"}`,
        sous: `Prévu le ${depuisIso(m.prochain_controle!).toLocaleDateString("fr-FR", { day: "numeric", month: "long" })}`,
        aller: () => navigate({ to: "/club/materiel" }),
      });
  }
  if (certificats.expires > 0)
    voyants.push({
      niveau: "rouge",
      titre: `${certificats.expires} certificat${certificats.expires > 1 ? "s" : ""} médica${certificats.expires > 1 ? "ux" : "l"} expiré${certificats.expires > 1 ? "s" : ""}`,
      sous: "Adhérents à relancer avant leur prochaine plongée",
      aller: () => navigate({ to: "/club/membres" }),
    });
  if (certificats.proches > 0)
    voyants.push({
      niveau: "orange",
      titre: `${certificats.proches} certificat${certificats.proches > 1 ? "s" : ""} à renouveler`,
      sous: "Expire dans les 30 jours",
      aller: () => navigate({ to: "/club/membres" }),
    });
  for (const a of accueil.a_faire.filter((x) => x.type === "tampon"))
    voyants.push({ niveau: "bleu", titre: `${a.site.trim().charAt(0).toUpperCase()}${a.site.trim().slice(1)} à tamponner`, sous: `${a.date_texte} · ${a.nb}/${a.total ?? 0} fiches`, aller: () => navigate({ to: "/club/sortie", search: { id: a.sortie_id } }) });
  const ordre = { rouge: 0, orange: 1, bleu: 2 };
  voyants.sort((a, b) => ordre[a.niveau] - ordre[b.niveau]);
  const couleur = { rouge: "#FF6B57", orange: "#F5B544", bleu: "#57B8F5" };

  return (
    <>
      <Titre aide={voyants.length > 0 ? `${voyants.length} point${voyants.length > 1 ? "s" : ""}` : undefined}>Points d'attention</Titre>
      {voyants.length === 0 ? (
        <div className="flex items-center gap-[11px] galet-b bg-[#E2F8EF] px-[14px] py-[13px] text-[13.5px] font-semibold text-[#14805F]">
          <CheckCircle2 className="h-[19px] w-[19px] shrink-0" aria-hidden="true" />
          Tout est en ordre pour les deux semaines à venir.
        </div>
      ) : (
        <div className="galet-b border border-[#E4EBF1] bg-white">
          {voyants.slice(0, 8).map((v, i) => (
            <button
              key={i}
              type="button"
              onClick={v.aller}
              className={`flex w-full items-start gap-[12px] px-[14px] py-[11px] text-left hover:bg-[#F7FAFD] ${i > 0 ? "border-t border-[#EEF3F8]" : ""}`}
            >
              <span className="relative mt-[5px] flex h-[10px] w-[10px] shrink-0">
                {v.niveau === "rouge" && <span className="absolute inset-0 animate-ping rounded-full opacity-60" style={{ background: couleur[v.niveau] }} />}
                <span className="relative h-[10px] w-[10px] rounded-full" style={{ background: couleur[v.niveau], boxShadow: `0 0 0 3px ${couleur[v.niveau]}33` }} />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-[13.5px] font-bold leading-snug">{v.titre}</span>
                <span className="block text-[12px] text-[#7D93A8] first-letter:uppercase">{v.sous}</span>
              </span>
              <ArrowUpRight className="mt-[2px] h-[15px] w-[15px] shrink-0 text-[#9DB0C0]" />
            </button>
          ))}
          {voyants.length > 8 && <p className="border-t border-[#EEF3F8] px-[14px] py-[9px] text-[12px] text-[#7D93A8]">et {voyants.length - 8} de plus dans le planning</p>}
        </div>
      )}
    </>
  );
}
