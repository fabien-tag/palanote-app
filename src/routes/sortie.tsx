import { useEffect, useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { Anchor, BadgeCheck, Clock, Hourglass, PenLine, Ship, Thermometer, Star, Users, Waves } from "lucide-react";
import { Meduse } from "@/components/numerisation/Ui";
import { Avatar, BlocDate, detailErreur, MessageErreur, PageClub, PastilleStatut, TamponNumerique, Titre } from "@/components/club/Ui";
import {
  detailSortie,
  garderSortie,
  heureCourte,
  placesSortie,
  quitterAttente,
  rejoindreSortie,
  retirerParticipant,
  voirSortie,
  type ApercuSortie,
  type DetailSortie,
  type PlacesSortie,
} from "@/lib/club";
import { annoncerSurAccueil } from "@/lib/message-accueil";
import { utilisateurConnecte } from "@/lib/plongees";
import { reservationSortie } from "@/lib/planning";

// La sortie vue par le plongeur (parcours 15, écrans 7 et 8)
//   ?code=… : ouvert en scannant le QR du DP ou par le lien reçu (même sans compte)
//   ?id=…   : ouvert depuis une notification ou l'accueil du carnet
export const Route = createFileRoute("/sortie")({
  validateSearch: (search: Record<string, unknown>): { code?: string; id?: string; via?: "lien" } => {
    const r: { code?: string; id?: string; via?: "lien" } = {};
    if (typeof search["code"] === "string") r.code = search["code"];
    if (typeof search["id"] === "string") r.id = search["id"];
    if (search["via"] === "lien") r.via = "lien";
    return r;
  },
  head: () => ({ meta: [{ title: "Palanote — Sortie" }, { name: "description", content: "Ton club t'invite à une sortie de plongée." }] }),
  component: PageSortie,
});

function PageSortie() {
  const navigate = useNavigate();
  const { code, id, via } = Route.useSearch();
  const [connecte, setConnecte] = useState<boolean | null>(null);
  const [apercu, setApercu] = useState<ApercuSortie | null>(null);
  const [detail, setDetail] = useState<DetailSortie | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);
  const [enCours, setEnCours] = useState(false);
  // « Qui es-tu ? » : la place préparée par le DP (null = je ne suis pas dans la liste)
  const [place, setPlace] = useState<string | null | undefined>(undefined);
  // Sortie réservée aux membres privilégiés du club, et mélange prévu
  const [reservation, setReservation] = useState<{ reservee: boolean; melange: string | null; privilegie: boolean } | null>(null);
  // Bateau complet : liste d'attente
  const [places, setPlaces] = useState<PlacesSortie | null>(null);

  const chargerDetail = async (idSortie: string) => {
    try {
      setDetail(await detailSortie(idSortie));
    } catch (e) {
      setErreur(detailErreur(e, "La sortie n'a pas pu être chargée."));
    }
  };

  useEffect(() => {
    let actif = true;
    void (async () => {
      const u = await utilisateurConnecte();
      if (!actif) return;
      setConnecte(Boolean(u));
      if (id && u) return void chargerDetail(id);
      if (!code) return setApercu({ etat: "introuvable" });
      try {
        const a = await voirSortie(code);
        if (!actif) return;
        // Déjà inscrit : on montre directement sa sortie
        if (a.deja_inscrit && a.id) return void chargerDetail(a.id);
        setApercu(a);
        void reservationSortie(code)
          .then((r) => actif && setReservation(r))
          .catch(() => undefined);
        void placesSortie(code)
          .then((p) => actif && setPlaces(p))
          .catch(() => undefined); // script de la liste d'attente pas encore lancé
        // Le prénom du compte correspond à une place préparée : présélectionnée
        const mien = (a.noms_libres ?? []).filter((n) => n.le_mien);
        if (mien.length === 1) setPlace(mien[0]!.id);
      } catch (e) {
        if (actif) setErreur(detailErreur(e, "La sortie n'a pas pu être chargée."));
      }
    })();
    return () => {
      actif = false;
    };
  }, [code, id]);

  const participer = async () => {
    if (!code) return;
    setEnCours(true);
    setErreur(null);
    try {
      const r = await rejoindreSortie(code, via === "lien" ? "lien" : "qr", place ?? null);
      if (r.attente) {
        setPlaces((p) => ({ restantes: 0, complet: true, en_attente: p?.en_attente ?? r.attente!, mon_rang: r.attente! }));
        return;
      }
      await chargerDetail(r.id);
      setApercu(null);
    } catch (e) {
      const m = String((e as { message?: string })?.message ?? "");
      setErreur(
        /réservée aux membres privilégiés/.test(m)
          ? "Cette plongée est réservée aux membres privilégiés du club. Demande au directeur de plongée de t'ajouter."
          : detailErreur(e, "L'inscription n'a pas marché. Vérifie ta connexion et réessaie."),
      );
    } finally {
      setEnCours(false);
    }
  };

  const quitter = async () => {
    if (!apercu?.id) return;
    setEnCours(true);
    try {
      await quitterAttente(apercu.id);
      setPlaces((p) => (p ? { ...p, mon_rang: null, en_attente: Math.max(0, p.en_attente - 1) } : p));
    } catch (e) {
      setErreur(detailErreur(e, "Tu n'as pas pu quitter la liste d'attente."));
    } finally {
      setEnCours(false);
    }
  };

  const sansCompte = (vers: "/creer-un-compte" | "/connexion") => {
    if (code) garderSortie(code, via === "lien" ? "lien" : "qr");
    navigate({ to: vers });
  };

  // ---------- Invitation (QR ou lien) ----------
  if (!detail) {
    const a = apercu;
    const libres = a?.noms_libres ?? [];
    // Sortie déjà tamponnée : on peut encore prendre la place que le DP avait préparée
    const ouverte = a?.etat === "ouverte" || (a?.etat === "validee" && libres.length > 0);
    const choixRequis = libres.length > 0 && place === undefined;
    return (
      <PageClub titre="Sortie de plongée" onRetour={() => navigate({ to: connecte ? "/carnet" : "/" })}>
        <MessageErreur texte={erreur} />
        {a && !ouverte && (
          <div className="mt-[16px] galet-c border border-[#FFD3C8] bg-[#FFF3EF] p-[16px]">
            <p className="text-[15px] font-bold">
              {a.etat === "annulee" ? "Cette sortie est annulée" : a.etat === "validee" ? "Cette sortie est terminée" : "Sortie introuvable"}
            </p>
            <p className="pt-[4px] text-[13.5px] leading-normal text-[#5B7189]">
              {a.etat === "introuvable" ? "Le lien est peut-être incomplet. Demande au directeur de plongée de te montrer à nouveau son QR code." : "Les inscriptions sont fermées."}
            </p>
          </div>
        )}
        {a && ouverte && (
          <>
            <div className="relative mt-[10px] galet border border-[#E4EBF1] bg-white p-[18px] shadow-[0_4px_14px_#123A6306]">
              <div className="flex items-center gap-[12px]">
                <span className="flex h-[46px] w-[46px] shrink-0 items-center justify-center goutte bg-[#0F3D70]">
                  <Anchor className="h-[22px] w-[22px] text-white" strokeWidth={2.1} aria-hidden="true" />
                </span>
                <span className="min-w-0">
                  <span className="flex items-center gap-[5px] text-[15px] font-bold">
                    <span className="truncate">{a.centre ?? `Sortie entre amis`}</span>
                    {a.centre_verifie && <BadgeCheck className="h-[15px] w-[15px] shrink-0 text-[#1176A8]" aria-label="Centre vérifié" />}
                  </span>
                  <span className="block text-[12.5px] text-[#5B7189]">{[a.ville, a.dp ? (a.centre ? `DP ${a.dp}` : `organisée par ${a.dp}`) : null].filter(Boolean).join(" · ")}</span>
                </span>
              </div>
              <p className="pt-[16px] text-[12.5px] font-bold uppercase tracking-[.07em] text-[#1176A8]">
                {a.date_texte}
                {a.heure ? ` · ${heureCourte(a.heure)}` : ""}
              </p>
              <h1 className="pt-[2px] text-[25px] font-bold leading-tight">{a.site}</h1>
              {a.lieu && <p className="text-[13.5px] text-[#5B7189]">{a.lieu}</p>}
              <div className="flex flex-wrap gap-[6px] pt-[12px]">
                {a.bateau && <Info Icone={Ship} texte={a.bateau} />}
                {a.profondeur_prevue ? <Info Icone={Waves} texte={`${String(a.profondeur_prevue).replace(".", ",")} m prévus`} /> : null}
                {reservation?.melange && <Info Icone={Waves} texte={reservation.melange} />}
                <Info Icone={Users} texte={`${a.nb_inscrits ?? 0} inscrit${(a.nb_inscrits ?? 0) > 1 ? "s" : ""}`} />
              </div>
              {reservation?.reservee && (
                <p className={`mt-[12px] flex items-start gap-[8px] rounded-[14px] px-[12px] py-[9px] text-[13px] leading-snug ${reservation.privilegie ? "bg-[#FFF8E8] text-[#6B5320]" : "bg-[#FFF3EF] text-[#8A2A1A]"}`}>
                  <Star className="mt-[1px] h-[16px] w-[16px] shrink-0" fill="#E9A93A" stroke="#E9A93A" aria-hidden="true" />
                  <span>
                    <b>Réservée aux membres privilégiés du club.</b>{" "}
                    {reservation.privilegie ? "Tu en fais partie : tu peux t'inscrire." : connecte ? "Tu n'en fais pas partie pour l'instant : demande au directeur de plongée de t'ajouter." : "Connecte-toi pour vérifier ton accès."}
                  </span>
                </p>
              )}
              {places?.mon_rang ? (
                <p className="mt-[12px] flex items-start gap-[8px] rounded-[14px] bg-[#FFF8E8] px-[12px] py-[9px] text-[13px] leading-snug text-[#6B5320]">
                  <Hourglass className="mt-[1px] h-[16px] w-[16px] shrink-0" aria-hidden="true" />
                  <span>
                    <b>Tu es {places.mon_rang === 1 ? "1er" : `${places.mon_rang}e`} sur la liste d'attente.</b> Dès qu'une place se libère, tu es inscrit
                    automatiquement et prévenu dans ta cloche.
                  </span>
                </p>
              ) : places?.complet && !place ? (
                <p className="mt-[12px] flex items-start gap-[8px] rounded-[14px] bg-[#FFF3EF] px-[12px] py-[9px] text-[13px] leading-snug text-[#8A2A1A]">
                  <Hourglass className="mt-[1px] h-[16px] w-[16px] shrink-0" aria-hidden="true" />
                  <span>
                    <b>Le bateau est complet.</b>{" "}
                    {places.en_attente > 0 ? `${places.en_attente} plongeur${places.en_attente > 1 ? "s" : ""} en attente. ` : ""}Inscris-toi sur la liste
                    d'attente : tu passes dès qu'une place se libère.
                  </span>
                </p>
              ) : null}
              <Meduse className="-right-[6px] -top-[14px]" />
            </div>

            {/* Qui es-tu ? Les prénoms préparés par le DP */}
            {connecte && libres.length > 0 && (
              <div className="pt-[20px]">
                <p className="text-[16px] font-bold">Qui es-tu ?</p>
                <p className="pb-[10px] text-[12.5px] leading-snug text-[#5B7189]">
                  {a.dp ?? "L'organisateur"} a déjà préparé les palanquées. Choisis ton prénom : tu rejoins directement la tienne.
                </p>
                <div className="flex flex-wrap gap-[8px]" role="radiogroup" aria-label="Ton prénom dans les palanquées">
                  {libres.map((n) => (
                    <button
                      key={n.id}
                      type="button"
                      role="radio"
                      aria-checked={place === n.id}
                      onClick={() => setPlace(n.id)}
                      className={`flex h-[40px] items-center gap-[7px] rounded-[20px] px-[14px] text-[14px] font-bold ${
                        place === n.id ? "bg-[#0F3D70] text-white" : "border border-[#D8E5EE] bg-white text-[#123A63]"
                      }`}
                    >
                      {n.nom}
                      {n.palanquee && <span className={`text-[11.5px] font-semibold ${place === n.id ? "text-white/70" : "text-[#9DB0C0]"}`}>P{n.palanquee}</span>}
                    </button>
                  ))}
                  <button
                    type="button"
                    role="radio"
                    aria-checked={place === null}
                    onClick={() => setPlace(null)}
                    className={`flex h-[40px] items-center rounded-[20px] px-[14px] text-[13px] font-semibold ${
                      place === null ? "bg-[#0F3D70] text-white" : "border border-dashed border-[#BFD7E8] text-[#5B7189]"
                    }`}
                  >
                    Je ne suis pas dans la liste
                  </button>
                </div>
              </div>
            )}

            <div className="flex flex-col gap-[13px] pt-[22px]">
              {[
                { Icone: Users, t: "Ta palanquée dans l'app", x: "Tu vois avec qui tu plonges, et les consignes du DP." },
                { Icone: PenLine, t: "Ta fiche arrive préremplie", x: "Site, date, durée, bateau : tu ajoutes seulement ta profondeur et ton air." },
                a.centre
                  ? { Icone: BadgeCheck, t: "Le tampon numérique du club", x: "Ta plongée est validée par le DP, sans chercher le tampon à la sortie de l'eau." }
                  : { Icone: BadgeCheck, t: "Vos carnets se remplissent ensemble", x: "Chacun garde ses propres mesures : profondeur, air, note." },
              ].map(({ Icone, t, x }) => (
                <div key={t} className="flex items-start gap-[12px]">
                  <span className="flex h-[38px] w-[38px] shrink-0 items-center justify-center goutte bg-[#E3F2FB]">
                    <Icone className="h-[18px] w-[18px] text-[#1176A8]" strokeWidth={2.2} aria-hidden="true" />
                  </span>
                  <span>
                    <span className="block text-[14px] font-bold leading-snug">{t}</span>
                    <span className="block text-[12.5px] leading-normal text-[#5B7189]">{x}</span>
                  </span>
                </div>
              ))}
            </div>
            <div className="min-h-[22px] flex-grow" />
            {connecte && places?.mon_rang ? (
              <>
                <button
                  type="button"
                  onClick={() => navigate({ to: "/carnet" })}
                  className="flex h-14 w-full items-center justify-center galet-moyen bg-[#3DEFBE] text-[14px] font-bold text-[#0B3B63]"
                >
                  REVENIR À MON CARNET
                </button>
                <button
                  type="button"
                  disabled={enCours}
                  onClick={() => void quitter()}
                  className="mx-auto mt-[12px] block text-[13.5px] font-semibold text-[#9DB0C0] underline underline-offset-4"
                >
                  Quitter la liste d'attente
                </button>
              </>
            ) : connecte && reservation?.reservee && !reservation.privilegie && !place ? (
              <button
                type="button"
                onClick={() => navigate({ to: "/carnet" })}
                className="flex h-14 w-full items-center justify-center galet-moyen border border-[#D8E5EE] bg-white text-[14px] font-bold text-[#5B7189]"
              >
                REVENIR À MON CARNET
              </button>
            ) : connecte ? (
              <button
                type="button"
                disabled={enCours || choixRequis}
                onClick={() => void participer()}
                className="flex h-14 w-full items-center justify-center galet-moyen bg-[#3DEFBE] text-[14px] font-bold text-[#0B3B63] disabled:opacity-50"
              >
                {enCours
                  ? "UN INSTANT…"
                  : choixRequis
                    ? "CHOISIS TON PRÉNOM"
                    : place
                      ? `JE SUIS ${(libres.find((n) => n.id === place)?.nom ?? "").toUpperCase()}`
                      : places?.complet
                        ? "ME METTRE EN LISTE D'ATTENTE"
                        : "JE PARTICIPE"}
              </button>
            ) : connecte === false ? (
              <>
                <button
                  type="button"
                  onClick={() => sansCompte("/creer-un-compte")}
                  className="flex h-14 w-full items-center justify-center galet-moyen bg-[#3DEFBE] text-[14px] font-bold text-[#0B3B63]"
                >
                  CRÉER MON CARNET ET M'INSCRIRE
                </button>
                <button
                  type="button"
                  onClick={() => sansCompte("/connexion")}
                  className="mx-auto mt-[12px] block text-[13.5px] font-semibold text-[#1176A8] underline underline-offset-4"
                >
                  J'ai déjà un compte
                </button>
                <p className="pt-[12px] text-center text-[11.5px] leading-normal text-[#9DB0C0]">
                  Ton inscription est gardée le temps de créer ton compte. Carnet gratuit, sans publicité.
                </p>
              </>
            ) : null}
          </>
        )}
      </PageClub>
    );
  }

  // ---------- Ma sortie (inscrit) ----------
  const d = detail;
  const maPalanquee = d.palanquees.find((p) => p.id === d.moi?.palanquee_id);
  const coequipiers = d.participants.filter((p) => !p.moi);
  const tamponnee = Boolean(d.moi?.tamponne_le) && !d.moi?.exclu_tampon;
  const aCompleter = !d.moi?.dive_id && (d.statut === "terminee" || d.statut === "validee");

  const bas = aCompleter ? (
    <button
      type="button"
      onClick={() => navigate({ to: "/nouvelle-plongee", search: { sortie: d.id } })}
      className="flex h-14 w-full items-center justify-center galet-moyen bg-[#3DEFBE] text-[14px] font-bold text-[#0B3B63] shadow-[0_4px_12px_#123A630D]"
    >
      COMPLÉTER MA PLONGÉE
    </button>
  ) : d.moi?.dive_id ? (
    <button
      type="button"
      onClick={() => navigate({ to: "/nouvelle-plongee", search: { id: d.moi!.dive_id! } })}
      className="flex h-14 w-full items-center justify-center galet-moyen border border-[#57D4F5] bg-white text-[14px] font-bold text-[#1176A8]"
    >
      VOIR MA PLONGÉE
    </button>
  ) : null;

  return (
    <PageClub titre="Ma sortie" onRetour={() => navigate({ to: "/carnet" })} droite={<PastilleStatut statut={d.statut} />} bas={bas}>
      <MessageErreur texte={erreur} />
      <div className="relative mt-[8px] galet border border-[#E4EBF1] bg-white p-[16px] shadow-[0_4px_14px_#123A6306]">
        <div className="flex items-start gap-[12px]">
          <BlocDate date={d.date} />
          <span className="min-w-0">
            <span className="block text-[12.5px] font-bold uppercase tracking-[.07em] text-[#1176A8]">
              {d.date_texte}
              {d.heure ? ` · ${heureCourte(d.heure)}` : ""}
            </span>
            <span className="block text-[22px] font-bold leading-tight">{d.site}</span>
            <span className="block text-[13px] text-[#5B7189]">{[d.lieu, d.centre.nom].filter(Boolean).join(" · ")}</span>
          </span>
        </div>
        <div className="flex flex-wrap gap-[6px] pt-[12px]">
          {d.bateau && <Info Icone={Ship} texte={d.bateau} />}
          {d.profondeur_prevue ? <Info Icone={Waves} texte={`${String(d.profondeur_prevue).replace(".", ",")} m prévus`} /> : null}
          {d.duree_min ? <Info Icone={Clock} texte={`${d.duree_min} min`} /> : null}
          {d.temp_fond_c !== null ? <Info Icone={Thermometer} texte={`${String(d.temp_fond_c).replace(".", ",")} °C`} /> : null}
        </div>
        <p className="pt-[10px] text-[12.5px] text-[#5B7189]">
          {d.entre_amis ? "Organisée par " : "Directeur de plongée : "}
          <b className="text-[#123A63]">{d.dp.prenom}</b>
          {d.dp.niveau ? ` (${d.dp.niveau})` : ""}
        </p>
        <Meduse className="-right-[6px] -top-[14px]" />
      </div>

      {d.consignes && (
        <>
          <Titre>{d.entre_amis ? "Le mot de l'organisateur" : "Consignes du DP"}</Titre>
          <p className="galet-b border border-[#CFE6F3] bg-[#E3F2FB] px-[15px] py-[13px] text-[14px] leading-normal">« {d.consignes} »</p>
        </>
      )}

      <Titre>{maPalanquee ? `Ta palanquée · P${maPalanquee.numero}` : "Ta palanquée"}</Titre>
      {maPalanquee && coequipiers.length > 0 ? (
        <div className="flex flex-col gap-[6px]">
          {coequipiers.map((p) => (
            <div key={p.participant_id} className="flex items-center gap-[11px] galet-petit bg-white px-[12px] py-[9px]">
              <Avatar id={p.id} prenom={p.prenom} taille={34} prevu={p.prevu} />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[14.5px] font-bold">{p.prenom}</span>
                <span className="block truncate text-[12px] text-[#5B7189]">{p.prevu ? "pas encore sur Palanote" : (p.niveau ?? "Plongeur")}</span>
              </span>
              {p.id && maPalanquee.guide_id === p.id && <span className="text-[12px] font-bold text-[#1176A8]">Guide</span>}
            </div>
          ))}
        </div>
      ) : (
        <p className="galet-b border border-dashed border-[#D5E1EC] bg-white/60 px-[15px] py-[14px] text-[13.5px] text-[#5B7189]">
          {d.entre_amis ? "L'organisateur compose les palanquées" : "Le DP compose les palanquées"} : elle apparaîtra ici.
        </p>
      )}

      {/* Où en est ma fiche */}
      <Titre>Ta plongée</Titre>
      {tamponnee && d.moi?.dive_id ? (
        <div className="flex items-center gap-[14px] galet border border-[#FFD3C8] bg-[#FFF3EF] p-[14px]">
          <TamponNumerique centre={d.centre.nom ?? "Club"} ville={d.centre.ville} dp={d.dp.prenom} niveau={d.dp.niveau} date={d.date} verifie={Boolean(d.centre.verifie)} taille={92} />
          <p className="text-[13.5px] leading-snug">
            <b>Plongée validée</b> par {d.dp.prenom}. Le tampon est sur ta fiche.
          </p>
        </div>
      ) : (
        <p className="galet-b border border-[#E4EBF1] bg-white px-[15px] py-[13px] text-[13.5px] leading-normal text-[#5B7189]">
          {d.statut === "prevue"
            ? "Après la plongée, ta fiche arrivera préremplie : site, date, durée, bateau et palanquée. Tu ajouteras ta profondeur et ton air."
            : d.statut === "annulee"
              ? "Cette sortie est annulée."
              : d.moi?.dive_id
                ? d.entre_amis
                  ? "Ta fiche est complétée. Bonne plongée !"
                  : "Ta fiche est complétée. Le DP va poser le tampon."
                : tamponnee
                  ? "Le DP a validé la sortie : complète ta fiche, le tampon s'y posera tout seul."
                  : "La plongée est finie : ta fiche est prête, il ne manque que ta profondeur et ton air."}
        </p>
      )}

      {d.statut === "prevue" && d.moi && (
        <button
          type="button"
          disabled={enCours}
          onClick={async () => {
            setEnCours(true);
            try {
              await retirerParticipant(d.moi!.participant_id);
              annoncerSurAccueil("Tu ne participes plus à cette sortie");
              navigate({ to: "/carnet" });
            } catch (e) {
              setErreur(detailErreur(e, "Ça n'a pas marché."));
            } finally {
              setEnCours(false);
            }
          }}
          className="mx-auto mt-[24px] block text-[13px] font-semibold text-[#9DB0C0] underline underline-offset-4"
        >
          Je ne participe plus
        </button>
      )}
    </PageClub>
  );
}

function Info({ Icone, texte }: { Icone: typeof Ship; texte: string }) {
  return (
    <span className="flex h-[28px] items-center gap-[5px] rounded-[14px] bg-[#EEF4F9] px-[10px] text-[12.5px] font-semibold text-[#3F5B76]">
      <Icone className="h-[13px] w-[13px]" strokeWidth={2.3} aria-hidden="true" />
      {texte}
    </span>
  );
}
