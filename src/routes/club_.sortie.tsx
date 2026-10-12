import { useCallback, useEffect, useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { Check, Clock, Plus, QrCode, Search, Share2, Ship, Thermometer, Waves, X } from "lucide-react";
import QRCode from "qrcode";
import logoCorail from "@/assets/palanote-logo-cigle.png";
import { Meduse, useConnexionRequise } from "@/components/numerisation/Ui";
import { Avatar, ChampTexte, detailErreur, Etapes, Feuille, MessageErreur, PageClub, PastilleStatut, TamponNumerique, Titre } from "@/components/club/Ui";
import {
  ajouterNomPrevu,
  ajouterPalanquee,
  ajouterParticipant,
  annulerSortie,
  chercherPlongeurs,
  detailSortie,
  heureCourte,
  lienSortie,
  placerParticipant,
  poserTampon,
  retirerParticipant,
  terminerSortie,
  type DetailSortie,
  type Participant,
} from "@/lib/club";

// La sortie vue par le directeur de plongée (parcours 15, écrans 4 à 6)
//   1. Inscrire : QR code, lien, recherche, palanquées
//   2. Après la plongée : durée, eau, visibilité → les fiches partent préremplies
//   3. Tamponner : toute la sortie d'un geste (on peut décocher quelqu'un)
export const Route = createFileRoute("/club_/sortie")({
  validateSearch: (search: Record<string, unknown>): { id?: string } => (typeof search["id"] === "string" ? { id: search["id"] } : {}),
  head: () => ({ meta: [{ title: "Palanote — Sortie" }] }),
  component: SortieDp,
});

function SortieDp() {
  const navigate = useNavigate();
  const { id } = Route.useSearch();
  const { pret, ecran } = useConnexionRequise();
  const [s, setS] = useState<DetailSortie | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);
  const [qr, setQr] = useState<string | null>(null);
  const [voirQr, setVoirQr] = useState(false);
  const [q, setQ] = useState("");
  const [trouves, setTrouves] = useState<(Participant & { deja_inscrit: boolean })[]>([]);
  const [finie, setFinie] = useState(false);
  const [duree, setDuree] = useState("");
  const [temp, setTemp] = useState("");
  const [visi, setVisi] = useState("");
  const [exclus, setExclus] = useState<string[]>([]);
  const [enCours, setEnCours] = useState(false);
  const [vientDeTamponner, setVientDeTamponner] = useState(false);
  const [partage, setPartage] = useState<string | null>(null);
  const [annuler, setAnnuler] = useState(false);
  // Prénom en cours de saisie dans une palanquée (préparer la palanquée à l'avance)
  const [nouveauNom, setNouveauNom] = useState<{ palanquee: string; nom: string } | null>(null);

  const charger = useCallback(async () => {
    if (!id) return;
    try {
      const d = await detailSortie(id);
      setS(d);
      if (d.jeton && !qr) {
        setQr(await QRCode.toString(lienSortie(d.jeton), { type: "svg", margin: 0, errorCorrectionLevel: "M", color: { dark: "#0F3D70", light: "#FFFFFF" } }));
      }
    } catch (e) {
      console.error(e);
      setErreur(detailErreur(e, "La sortie n'a pas pu être chargée."));
    }
  }, [id, qr]);

  useEffect(() => {
    if (pret) void charger();
  }, [pret]); // eslint-disable-line react-hooks/exhaustive-deps

  // QR affiché : la liste se met à jour toute seule à chaque scan
  useEffect(() => {
    if (!voirQr) return;
    const t = setInterval(() => void charger(), 4000);
    return () => clearInterval(t);
  }, [voirQr, charger]);

  // Recherche au fil de la frappe
  useEffect(() => {
    if (!id || q.trim().length < 2) return setTrouves([]);
    const t = setTimeout(() => {
      void chercherPlongeurs(id, q).then(setTrouves).catch(() => setTrouves([]));
    }, 250);
    return () => clearTimeout(t);
  }, [q, id]);

  if (ecran) return ecran;
  if (!id) return null;

  const agir = async (action: () => Promise<unknown>, defaut: string) => {
    setEnCours(true);
    setErreur(null);
    try {
      await action();
      await charger();
      return true;
    } catch (e) {
      console.error(e);
      setErreur(detailErreur(e, defaut));
      return false;
    } finally {
      setEnCours(false);
    }
  };

  const envoyerLien = async () => {
    if (!s?.jeton) return;
    const lien = lienSortie(s.jeton, "lien");
    const texte = `Sortie ${s.date_texte}${s.heure ? ` à ${heureCourte(s.heure)}` : ""} · ${s.site} avec ${s.centre.nom}. Inscris-toi sur Palanote :`;
    try {
      if (navigator.share) return void (await navigator.share({ title: "Palanote", text: texte, url: lien }));
      await navigator.clipboard.writeText(`${texte} ${lien}`);
      setPartage("Lien copié : colle-le dans ton groupe WhatsApp ou par SMS.");
    } catch {
      /* partage annulé */
    }
  };

  const participants = s?.participants ?? [];
  const sansPalanquee = participants.filter((p) => !p.palanquee_id || !s?.palanquees.some((x) => x.id === p.palanquee_id));
  const aTamponner = participants.filter((p) => !exclus.includes(p.participant_id)).length;
  const completes = participants.filter((p) => p.complete).length;
  const inscrits = participants.filter((p) => !p.prevu).length;
  const prevus = participants.length - inscrits;
  const ajouterNom = (palanquee: string) => {
    const nom = nouveauNom?.palanquee === palanquee ? nouveauNom.nom.trim() : "";
    if (!nom) return setNouveauNom(null);
    void agir(async () => {
      await ajouterNomPrevu(palanquee, nom);
      setNouveauNom({ palanquee, nom: "" });
    }, "Le prénom n'a pas pu être ajouté.");
  };

  const bas =
    s && s.statut === "prevue" ? (
      <button
        type="button"
        disabled={enCours || participants.length === 0}
        onClick={() => {
          setDuree(s.duree_min ? String(s.duree_min) : "");
          setFinie(true);
        }}
        className="flex h-14 w-full items-center justify-center galet-moyen bg-[#3DEFBE] text-[14px] font-bold text-[#0B3B63] shadow-[0_4px_12px_#123A630D] disabled:opacity-50"
      >
        LA PLONGÉE EST FINIE
      </button>
    ) : s && s.statut === "terminee" && !s.entre_amis ? (
      <button
        type="button"
        disabled={enCours || aTamponner === 0}
        onClick={() =>
          void agir(async () => {
            await poserTampon(s.id, exclus);
            setVientDeTamponner(true);
          }, "Le tampon n'a pas pu être posé.")
        }
        className="flex h-14 w-full items-center justify-center galet-moyen bg-[#FF8A75] text-[14px] font-bold text-white shadow-[0_4px_12px_#123A630D] disabled:opacity-50"
      >
        {enCours ? "UN INSTANT…" : `POSER LE TAMPON · ${aTamponner} PLONGEUR${aTamponner > 1 ? "S" : ""}`}
      </button>
    ) : null;

  return (
    <PageClub
      titre={s?.entre_amis ? "Sortie entre amis" : "Sortie"}
      onRetour={() => navigate({ to: s?.entre_amis ? "/amis" : "/club" })}
      droite={s ? (s.entre_amis && s.statut === "terminee" ? <span className="shrink-0 rounded-[10px] bg-[#3DEFBE] px-[9px] py-[3px] text-[11.5px] font-bold text-[#0B3B63]">Fiches envoyées</span> : <PastilleStatut statut={s.statut} />) : null}
      bas={bas}
    >
      <MessageErreur texte={erreur} />
      {s && (
        <>
          {/* Résumé de la sortie */}
          <div className="relative mt-[8px] galet border border-[#E4EBF1] bg-white p-[16px] shadow-[0_4px_14px_#123A6306]">
            <p className="text-[12.5px] font-bold uppercase tracking-[.07em] text-[#1176A8]">
              {s.date_texte}
              {s.heure ? ` · ${heureCourte(s.heure)}` : ""}
            </p>
            <h2 className="pt-[3px] text-[23px] font-bold leading-tight">{s.site}</h2>
            <p className="text-[13.5px] text-[#5B7189]">{[s.lieu, s.entre_amis ? `entre amis · organisée par ${s.est_dp ? "toi" : s.dp.prenom}` : s.centre.nom].filter(Boolean).join(" · ")}</p>
            <div className="flex flex-wrap gap-[6px] pt-[10px]">
              {s.bateau && <Info Icone={Ship} texte={s.bateau} />}
              {s.profondeur_prevue && <Info Icone={Waves} texte={`${String(s.profondeur_prevue).replace(".", ",")} m prévus`} />}
              {s.duree_min && <Info Icone={Clock} texte={`${s.duree_min} min`} />}
              {s.temp_fond_c !== null && <Info Icone={Thermometer} texte={`${String(s.temp_fond_c).replace(".", ",")} °C`} />}
            </div>
            {s.consignes && <p className="pt-[10px] text-[13px] italic leading-snug text-[#5B7189]">« {s.consignes} »</p>}
            <Etapes statut={s.statut} entreAmis={s.entre_amis} />
            <Meduse className="-right-[6px] -top-[14px]" />
          </div>

          {/* 1. Inscrire */}
          {s.statut === "prevue" && (
            <>
              <Titre aide={`${inscrits} inscrit${inscrits > 1 ? "s" : ""}${prevus > 0 ? ` · ${prevus} prénom${prevus > 1 ? "s" : ""} en attente` : ""}`}>Ajouter des plongeurs</Titre>
              <div className="grid grid-cols-2 gap-[10px]">
                <button
                  type="button"
                  onClick={() => setVoirQr(true)}
                  className="flex h-[52px] items-center justify-center gap-2 galet-moyen bg-[#0F3D70] text-[13.5px] font-bold text-white"
                >
                  <QrCode className="h-[18px] w-[18px]" strokeWidth={2.2} aria-hidden="true" />
                  QR CODE
                </button>
                <button
                  type="button"
                  onClick={() => void envoyerLien()}
                  className="flex h-[52px] items-center justify-center gap-2 galet-moyen border border-[#57D4F5] bg-white text-[13.5px] font-bold text-[#1176A8]"
                >
                  <Share2 className="h-[17px] w-[17px]" strokeWidth={2.4} aria-hidden="true" />
                  LIEN
                </button>
              </div>
              {partage && <p className="pt-[8px] text-[12.5px] text-[#14805F]">{partage}</p>}
              <label className="mt-[10px] flex h-[50px] items-center gap-[10px] galet-moyen border-[1.5px] border-[#E4EBF1] bg-white px-[16px] focus-within:border-[#57D4F5]">
                <Search className="h-[18px] w-[18px] shrink-0 text-[#9DB0C0]" aria-hidden="true" />
                <input
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                  placeholder={s.entre_amis ? "Prénom d'un binôme" : "Prénom ou e-mail exact"}
                  aria-label="Chercher un plongeur"
                  className="min-w-0 flex-1 bg-transparent text-[15px] outline-none placeholder:text-[#B5C4D1]"
                />
                {q && (
                  <button type="button" aria-label="Effacer" onClick={() => setQ("")}>
                    <X className="h-[16px] w-[16px] text-[#9DB0C0]" />
                  </button>
                )}
              </label>
              {trouves.length > 0 && (
                <div className="mt-[8px] flex flex-col gap-[6px]">
                  {trouves.map((t) => (
                    <div key={t.id} className="flex items-center gap-[11px] galet-petit bg-white px-[12px] py-[8px]">
                      <Avatar id={t.id} prenom={t.prenom} taille={34} />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-[14.5px] font-bold">{t.prenom}</span>
                        <span className="block truncate text-[12px] text-[#5B7189]">{[t.niveau, t.club].filter(Boolean).join(" · ") || "Plongeur Palanote"}</span>
                      </span>
                      {t.deja_inscrit ? (
                        <span className="text-[12.5px] font-semibold text-[#14805F]">Inscrit</span>
                      ) : (
                        <button
                          type="button"
                          disabled={enCours}
                          onClick={() =>
                            void agir(async () => {
                              await ajouterParticipant(s.id, t.id!);
                              setQ("");
                            }, "Ce plongeur n'a pas pu être ajouté.")
                          }
                          className="flex h-[34px] items-center gap-1 rounded-[17px] bg-[#3DEFBE] px-[12px] text-[12.5px] font-bold text-[#0B3B63]"
                        >
                          <Plus className="h-[14px] w-[14px]" strokeWidth={2.8} aria-hidden="true" />
                          Ajouter
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              )}
              {q.trim().length >= 2 && trouves.length === 0 && (
                <p className="pt-[8px] text-[12.5px] leading-snug text-[#9DB0C0]">
                  {s.entre_amis
                    ? "Personne de ce nom parmi tes binômes. Montre-lui le QR code, ou ajoute-le d'abord comme binôme dans Amis."
                    : "Personne de ce nom parmi tes binômes et les habitués du centre. Essaie son e-mail exact, ou montre-lui le QR code."}
                </p>
              )}

              {/* Palanquées */}
              <Titre aide="prépare-les à l'avance">Palanquées</Titre>
              <p className="-mt-[4px] pb-[10px] text-[12.5px] leading-snug text-[#5B7189]">
                Note les prénoms dès maintenant : quand un plongeur scanne le QR, il retrouve sa place et rejoint sa palanquée.
              </p>
              <div className="flex flex-col gap-[10px]">
                {s.palanquees.map((pal) => {
                  const membres = participants.filter((p) => p.palanquee_id === pal.id);
                  return (
                    <div key={pal.id} className="galet-b border border-[#E4EBF1] bg-white p-[12px]">
                      <p className="pb-[8px] text-[13.5px] font-bold">
                        Palanquée {pal.numero}
                        <span className="font-normal text-[#9DB0C0]"> · {membres.length} plongeur{membres.length > 1 ? "s" : ""}</span>
                      </p>
                      <div className="flex flex-col gap-[6px]">
                        {membres.map((p) => (
                          <LigneParticipant key={p.participant_id} p={p} s={s} onAgir={agir} desactive={enCours} />
                        ))}
                        {membres.length === 0 && nouveauNom?.palanquee !== pal.id && <p className="text-[12.5px] text-[#B5C4D1]">Personne pour l'instant</p>}
                      </div>
                      {nouveauNom?.palanquee === pal.id ? (
                        <form
                          onSubmit={(e) => {
                            e.preventDefault();
                            ajouterNom(pal.id);
                          }}
                          className="mt-[8px] flex items-center gap-[8px]"
                        >
                          <input
                            autoFocus
                            value={nouveauNom.nom}
                            onChange={(e) => setNouveauNom({ palanquee: pal.id, nom: e.target.value })}
                            placeholder="Prénom"
                            aria-label={`Prénom à ajouter à la palanquée ${pal.numero}`}
                            maxLength={60}
                            className="h-[38px] min-w-0 flex-1 rounded-[12px] border-[1.5px] border-[#E4EBF1] bg-[#F7FBFE] px-[12px] text-[14px] outline-none focus:border-[#57D4F5]"
                          />
                          <button type="submit" disabled={enCours} className="h-[38px] rounded-[19px] bg-[#3DEFBE] px-[14px] text-[12.5px] font-bold text-[#0B3B63] disabled:opacity-60">
                            Ajouter
                          </button>
                          <button type="button" aria-label="Fermer" onClick={() => setNouveauNom(null)} className="text-[#9DB0C0]">
                            <X className="h-[16px] w-[16px]" />
                          </button>
                        </form>
                      ) : (
                        <button
                          type="button"
                          onClick={() => setNouveauNom({ palanquee: pal.id, nom: "" })}
                          className="mt-[6px] flex items-center gap-[5px] py-[4px] text-[12.5px] font-bold text-[#1176A8]"
                        >
                          <Plus className="h-[13px] w-[13px]" strokeWidth={2.8} aria-hidden="true" />
                          Ajouter un prénom
                        </button>
                      )}
                    </div>
                  );
                })}
                {sansPalanquee.length > 0 && (
                  <div className="galet-b border border-dashed border-[#BFD7E8] bg-[#F7FBFE] p-[12px]">
                    <p className="pb-[8px] text-[13.5px] font-bold text-[#5B7189]">Sans palanquée</p>
                    <div className="flex flex-col gap-[6px]">
                      {sansPalanquee.map((p) => (
                        <LigneParticipant key={p.participant_id} p={p} s={s} onAgir={agir} desactive={enCours} />
                      ))}
                    </div>
                  </div>
                )}
                <button
                  type="button"
                  disabled={enCours}
                  onClick={() => void agir(() => ajouterPalanquee(s.id), "La palanquée n'a pas pu être ajoutée.")}
                  className="flex h-[44px] items-center justify-center gap-[6px] text-[13.5px] font-bold text-[#1176A8]"
                >
                  <Plus className="h-[15px] w-[15px]" strokeWidth={2.6} aria-hidden="true" />
                  Ajouter une palanquée
                </button>
              </div>
            </>
          )}

          {/* Entre amis : pas de tampon, on suit les fiches */}
          {s.statut === "terminee" && s.entre_amis && (
            <>
              <Titre aide={`${completes}/${inscrits} fiches complétées`}>Les fiches</Titre>
              <div className="flex flex-col gap-[6px]">
                {participants.map((p) => (
                  <div key={p.participant_id} className="flex items-center gap-[11px] galet-petit bg-white px-[12px] py-[9px]">
                    <Avatar id={p.id} prenom={p.prenom} taille={34} prevu={p.prevu} />
                    <span className="min-w-0 flex-1 truncate text-[14.5px] font-bold">{p.moi ? `${p.prenom} (toi)` : p.prenom}</span>
                    <span className={`text-[12px] font-semibold ${p.complete ? "text-[#14805F]" : "text-[#9DB0C0]"}`}>
                      {p.complete ? "Complétée" : p.prevu ? "Pas encore sur Palanote" : "Pas encore complétée"}
                    </span>
                  </div>
                ))}
              </div>
              <p className="pt-[10px] text-[12.5px] leading-snug text-[#5B7189]">
                Chacun a reçu sa fiche préremplie. Une sortie entre amis n'a pas de tampon : seul un directeur de plongée d'un centre peut en poser un.
              </p>
              {participants.find((p) => p.moi && !p.complete) && (
                <button
                  type="button"
                  onClick={() => navigate({ to: "/nouvelle-plongee", search: { sortie: s.id } })}
                  className="mt-[14px] flex h-[52px] w-full items-center justify-center galet-moyen bg-[#3DEFBE] text-[14px] font-bold text-[#0B3B63]"
                >
                  COMPLÉTER MA PLONGÉE
                </button>
              )}
            </>
          )}

          {/* 3. Tamponner */}
          {s.statut === "terminee" && !s.entre_amis && (
            <>
              <Titre aide={`${completes}/${participants.length} fiches complétées`}>Qui reçoit le tampon</Titre>
              <div className="flex flex-col gap-[6px]">
                {participants.map((p) => {
                  const coche = !exclus.includes(p.participant_id);
                  return (
                    <button
                      key={p.participant_id}
                      type="button"
                      role="checkbox"
                      aria-checked={coche}
                      onClick={() => setExclus((x) => (coche ? [...x, p.participant_id] : x.filter((y) => y !== p.participant_id)))}
                      className="flex items-center gap-[11px] galet-petit bg-white px-[12px] py-[9px] text-left"
                    >
                      <Avatar id={p.id} prenom={p.prenom} taille={34} prevu={p.prevu} />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-[14.5px] font-bold">{p.prenom}</span>
                        <span className={`block truncate text-[12px] ${p.complete ? "text-[#14805F]" : "text-[#9DB0C0]"}`}>
                          {p.complete ? "Fiche complétée" : p.prevu ? "Pas encore sur Palanote : le tampon l'attendra" : "Fiche pas encore complétée"}
                        </span>
                      </span>
                      <span className={`flex h-[26px] w-[26px] items-center justify-center rounded-[8px] ${coche ? "bg-[#FF8A75]" : "border-2 border-[#D5E1EC] bg-white"}`}>
                        {coche && <Check className="h-[16px] w-[16px] text-white" strokeWidth={3} />}
                      </span>
                    </button>
                  );
                })}
              </div>
              <p className="pt-[10px] text-[12.5px] leading-snug text-[#5B7189]">
                Ceux qui n'ont pas encore complété leur fiche recevront le tampon automatiquement dès qu'ils l'auront fait.
              </p>
            </>
          )}

          {/* Tamponnée */}
          {s.statut === "validee" && (
            <>
              <div className="flex flex-col items-center pt-[22px] text-center">
                <TamponNumerique
                  centre={s.centre.nom ?? "Club"}
                  ville={s.centre.ville}
                  dp={s.dp.prenom}
                  niveau={s.dp.niveau}
                  date={s.date}
                  verifie={Boolean(s.centre.verifie)}
                  taille={150}
                  anime={vientDeTamponner}
                />
                <p className="pt-[12px] text-[17px] font-bold">{vientDeTamponner ? "Tampon posé !" : "Sortie tamponnée"}</p>
                <p className="text-[13px] text-[#5B7189]">Chaque plongeur a été prévenu dans son app.</p>
              </div>
              <Titre aide={`${completes}/${participants.length} fiches`}>Plongeurs</Titre>
              <div className="flex flex-col gap-[6px]">
                {participants.map((p) => (
                  <div key={p.participant_id} className="flex items-center gap-[11px] galet-petit bg-white px-[12px] py-[9px]">
                    <Avatar id={p.id} prenom={p.prenom} taille={34} prevu={p.prevu} />
                    <span className="min-w-0 flex-1 truncate text-[14.5px] font-bold">{p.prenom}</span>
                    <span className={`text-[12px] font-semibold ${p.exclu_tampon ? "text-[#9DB0C0]" : p.complete ? "text-[#D9573F]" : "text-[#8A5A10]"}`}>
                      {p.exclu_tampon ? "Sans tampon" : p.complete ? "Tamponnée" : p.prevu ? "Pas encore sur Palanote" : "En attente de sa fiche"}
                    </span>
                  </div>
                ))}
              </div>
            </>
          )}

          {s.statut === "annulee" && <p className="pt-[22px] text-center text-[14px] text-[#5B7189]">Cette sortie est annulée. Les plongeurs ont été prévenus.</p>}

          {(s.statut === "prevue" || (s.statut === "terminee" && !s.entre_amis)) && (
            <button
              type="button"
              onClick={() => setAnnuler(true)}
              className="mx-auto mt-[26px] block text-[13px] font-semibold text-[#9DB0C0] underline underline-offset-4"
            >
              Annuler la sortie
            </button>
          )}
        </>
      )}

      {/* QR code plein écran, à montrer sur le bateau */}
      {voirQr && s?.jeton && (
        <div className="fixed inset-0 z-50 flex flex-col items-center bg-[#F1F6FC] px-[22px] pb-[max(22px,env(safe-area-inset-bottom))] pt-[clamp(16px,3svh,28px)]" role="dialog" aria-label="QR code de la sortie">
          <div className="flex w-full max-w-[430px] items-center justify-between">
            <span className="text-[17px] font-bold">Scanne pour t'inscrire</span>
            <button type="button" aria-label="Fermer" onClick={() => setVoirQr(false)} className="flex h-10 w-10 items-center justify-center goutte bg-[#E3EDF6]">
              <X className="h-[18px] w-[18px]" />
            </button>
          </div>
          <p className="pt-[clamp(12px,3svh,26px)] text-center text-[14px] text-[#5B7189]">
            {s.site} · {s.date_texte}
          </p>
          <div className="mt-[16px] flex aspect-square w-[min(78vw,300px)] items-center justify-center galet bg-white p-[20px] shadow-[0_8px_26px_rgba(15,61,112,.12)]">
            {qr && (
              <div className="relative h-full w-full">
                <div className="h-full w-full [&>svg]:h-full [&>svg]:w-full" dangerouslySetInnerHTML={{ __html: qr }} />
                <div className="absolute left-1/2 top-1/2 flex h-[46px] w-[46px] -translate-x-1/2 -translate-y-1/2 items-center justify-center goutte bg-[#0F3D70] p-[8px]">
                  <img src={logoCorail} alt="" className="h-full w-auto" />
                </div>
              </div>
            )}
          </div>
          <div className="mt-[18px] flex max-w-[360px] flex-wrap justify-center gap-[6px]" aria-live="polite">
            {participants.map((p) => (
              <span
                key={p.participant_id}
                className={`flex h-[32px] items-center gap-[6px] rounded-[16px] pl-[4px] pr-[11px] text-[13px] font-semibold ${p.prevu ? "border border-dashed border-[#BFD7E8] text-[#9DB0C0]" : "bg-white shadow-sm"}`}
              >
                <Avatar id={p.id} prenom={p.prenom} taille={24} prevu={p.prevu} />
                {p.prenom}
                {!p.prevu && p.nom_prevu && <Check className="h-[13px] w-[13px] text-[#14805F]" strokeWidth={3} aria-label="a pris sa place" />}
              </span>
            ))}
          </div>
          <p className="pt-[12px] text-[13px] font-bold text-[#14805F]">
            {inscrits} inscrit{inscrits > 1 ? "s" : ""}
            {prevus > 0 && <span className="font-semibold text-[#9DB0C0]"> · {prevus} en attente</span>}
          </p>
          <div className="flex-grow" />
          <p className="max-w-[340px] text-center text-[12px] leading-snug text-[#9DB0C0]">
            Pas encore Palanote ? Le plongeur crée son compte en scannant : son inscription l'attend.
          </p>
        </div>
      )}

      {/* 2. Après la plongée */}
      {finie && s && (
        <Feuille titre="Comment s'est passée la plongée ?" onFermer={() => setFinie(false)}>
          <p className="pb-[14px] text-[13.5px] leading-normal text-[#5B7189]">
            Ces infos arrivent dans la fiche de chaque plongeur, avec le site, la date, le bateau et sa palanquée. Chacun ajoute ensuite sa profondeur et son air.
          </p>
          <div className="flex flex-col gap-[12px]">
            <ChampTexte label="Durée (min)" inputMode="numeric" value={duree} onChange={(e) => setDuree(e.target.value.replace(/\D/g, "").slice(0, 3))} placeholder="45" autoFocus />
            <div className="grid grid-cols-2 gap-[12px]">
              <ChampTexte label="Eau au fond (°C)" inputMode="decimal" value={temp} onChange={(e) => setTemp(e.target.value.replace(/[^\d,.-]/g, "").slice(0, 4))} placeholder="17" />
              <ChampTexte label="Visibilité (m)" inputMode="numeric" value={visi} onChange={(e) => setVisi(e.target.value.replace(/\D/g, "").slice(0, 3))} placeholder="20" />
            </div>
          </div>
          <MessageErreur texte={erreur} />
          <button
            type="button"
            disabled={enCours || !Number(duree)}
            onClick={() =>
              void agir(async () => {
                const t = Number(temp.replace(",", "."));
                await terminerSortie(s.id, Number(duree), temp && Number.isFinite(t) ? t : null, visi ? Number(visi) : null);
                setFinie(false);
              }, "La sortie n'a pas pu être terminée.")
            }
            className="mt-[18px] flex h-14 w-full items-center justify-center galet-moyen bg-[#3DEFBE] text-[14px] font-bold text-[#0B3B63] disabled:opacity-50"
          >
            {enCours ? "ENVOI…" : `ENVOYER LES FICHES · ${participants.length} PLONGEUR${participants.length > 1 ? "S" : ""}`}
          </button>
        </Feuille>
      )}

      {annuler && s && (
        <Feuille titre="Annuler cette sortie ?" onFermer={() => setAnnuler(false)}>
          <p className="pb-[16px] text-[13.5px] leading-normal text-[#5B7189]">Les {participants.length} plongeurs inscrits seront prévenus dans leur app.</p>
          <button
            type="button"
            disabled={enCours}
            onClick={() =>
              void agir(async () => {
                await annulerSortie(s.id);
                setAnnuler(false);
              }, "La sortie n'a pas pu être annulée.")
            }
            className="flex h-[52px] w-full items-center justify-center galet-moyen bg-[#123A63] text-[14px] font-bold text-white"
          >
            ANNULER LA SORTIE
          </button>
          <button type="button" onClick={() => setAnnuler(false)} className="mx-auto mt-[10px] block py-2 text-[14px] font-semibold text-[#5B7189]">
            Garder la sortie
          </button>
        </Feuille>
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

function LigneParticipant({
  p,
  s,
  onAgir,
  desactive,
}: {
  p: Participant;
  s: DetailSortie;
  onAgir: (a: () => Promise<unknown>, d: string) => Promise<boolean>;
  desactive: boolean;
}) {
  return (
    <div className="flex items-center gap-[10px]">
      <Avatar id={p.id} prenom={p.prenom} taille={32} prevu={p.prevu} />
      <span className="min-w-0 flex-1">
        <span className={`block truncate text-[14px] font-bold ${p.prevu ? "text-[#7D93A8]" : ""}`}>{p.prenom}</span>
        <span className="block truncate text-[11.5px] text-[#9DB0C0]">
          {p.prevu
            ? "en attente de son scan"
            : [p.niveau, p.via === "qr" ? (p.nom_prevu ? "a pris sa place (QR)" : "QR code") : p.via === "lien" ? (p.nom_prevu ? "a pris sa place (lien)" : "par le lien") : "ajouté par toi"]
                .filter(Boolean)
                .join(" · ")}
        </span>
      </span>
      <select
        value={p.palanquee_id ?? ""}
        disabled={desactive}
        aria-label={`Palanquée de ${p.prenom}`}
        onChange={(e) => void onAgir(() => placerParticipant(p.participant_id, e.target.value || null), "Le changement n'a pas pu être enregistré.")}
        className="h-[32px] rounded-[10px] bg-[#EEF4F9] px-[6px] text-[12.5px] font-semibold text-[#123A63] outline-none"
      >
        <option value="">—</option>
        {s.palanquees.map((x) => (
          <option key={x.id} value={x.id}>
            P{x.numero}
          </option>
        ))}
      </select>
      <button
        type="button"
        aria-label={`Retirer ${p.prenom} de la sortie`}
        disabled={desactive}
        onClick={() => void onAgir(() => retirerParticipant(p.participant_id), "Ce plongeur n'a pas pu être retiré.")}
        className="flex h-[30px] w-[30px] items-center justify-center rounded-full text-[#9DB0C0]"
      >
        <X className="h-[15px] w-[15px]" />
      </button>
    </div>
  );
}
