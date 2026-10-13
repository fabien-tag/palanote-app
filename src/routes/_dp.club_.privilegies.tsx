import { useCallback, useEffect, useMemo, useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { AlertTriangle, CalendarPlus, Check, Copy, Mail, Plus, Send, Star, Trash2, X } from "lucide-react";
import { useConnexionRequise } from "@/components/numerisation/Ui";
import { NavigationDpMobile } from "@/components/club/NavigationDp";
import { Avatar, ChampTexte, MessageErreur, PageClub, Titre } from "@/components/club/Ui";
import { messagePlanning, useCentre } from "@/components/club/useCentre";
import { monProfil } from "@/lib/amis";
import { heureCourte, lienSortie } from "@/lib/club";
import {
  ajouterJours,
  aujourdhui,
  basculerPrivilegie,
  certificatProche,
  creerSeriePrivilegies,
  depuisIso,
  inviterPrivilegies,
  materielCentre,
  MELANGES,
  privilegierPlongeur,
  privilegiesCentre,
  type Communaute,
  type Materiel,
  type PlongeeSerie,
  type Privilegie,
  type SortieReservee,
} from "@/lib/planning";

// Membres privilégiés : la communauté des plus actifs du club.
// Une étoile, des plongées qui leur sont réservées (épaves, plongées profondes, nitrox…),
// une série programmée en une fois, et l'invitation envoyée dans l'app et par e-mail.
export const Route = createFileRoute("/_dp/club_/privilegies")({
  head: () => ({ meta: [{ title: "Palanote — Membres privilégiés" }] }),
  component: PagePrivilegies,
});

const OR = "#E9A93A";
const dateCourte = (d: string) => depuisIso(d).toLocaleDateString("fr-FR", { weekday: "short", day: "numeric", month: "short" });

function PagePrivilegies() {
  const navigate = useNavigate();
  const { pret, ecran } = useConnexionRequise();
  const { centre, erreur: erreurCentre } = useCentre(pret);
  const [c, setC] = useState<Communaute | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);
  const [serie, setSerie] = useState(false);
  const [inviter, setInviter] = useState(false);

  const charger = useCallback(async () => {
    if (!centre) return;
    try {
      setC(await privilegiesCentre(centre.id));
      setErreur(null);
    } catch (e) {
      console.error(e);
      setErreur(messagePlanning(e, "Les membres privilégiés n'ont pas pu être chargés.").replace("palanote-planning-club.sql", "palanote-privilegies.sql"));
    }
  }, [centre]);

  useEffect(() => {
    void charger();
  }, [charger]);

  if (ecran) return ecran;

  const agir = (f: () => Promise<unknown>) =>
    void f()
      .then(charger)
      .catch((e) => setErreur(messagePlanning(e, "L'action n'a pas pu être enregistrée.")));
  const inscrits = c?.sorties.reduce((t, s) => t + s.nb_inscrits, 0) ?? 0;

  return (
    <PageClub
      titre="Membres privilégiés"
      large
      navigation={<NavigationDpMobile />}
      droite={
        centre && c ? (
          <span className="flex items-center gap-[8px]">
            <button
              type="button"
              onClick={() => setSerie(true)}
              className="flex h-[42px] items-center gap-2 rounded-[10px] border border-[#D8E5EE] bg-white px-[12px] text-[13px] font-bold text-[#1176A8]"
            >
              <CalendarPlus className="h-[17px] w-[17px]" />
              <span className="hidden sm:inline">PROGRAMMER UNE SÉRIE</span>
            </button>
            <button
              type="button"
              disabled={c.membres.length === 0}
              onClick={() => setInviter(true)}
              className="flex h-[42px] items-center gap-2 rounded-[10px] bg-[#3DEFBE] px-[12px] text-[13px] font-bold text-[#0B3B63] disabled:opacity-40"
            >
              <Send className="h-[16px] w-[16px]" />
              <span className="hidden sm:inline">INVITER</span>
            </button>
          </span>
        ) : null
      }
    >
      <MessageErreur texte={erreurCentre ?? erreur} />
      {c && centre && (
        <>
          <p className="max-w-[720px] pt-[2px] text-[13.5px] leading-normal text-[#5B7189]">
            La communauté des plus actifs du club : ils ont accès aux plongées réservées (épaves, plongées profondes, nitrox) et reçoivent les invitations en
            premier.
          </p>

          <div className="grid grid-cols-2 gap-[10px] pt-[14px] lg:grid-cols-4">
            {[
              { v: c.membres.length, l: "privilégiés", d: "dans la communauté", Icone: Star },
              { v: c.membres.filter((m) => m.sur_palanote).length, l: "sur Palanote", d: "reçoivent l'invitation dans l'app" },
              { v: c.sorties.length, l: "plongées réservées", d: "à venir" },
              { v: inscrits, l: "inscriptions", d: "aux plongées réservées" },
            ].map((t) => (
              <div key={t.l} className="rounded-[10px] border border-[#E4EBF1] bg-white px-[14px] py-[12px]">
                <span className="flex items-center gap-[6px] text-[26px] font-bold leading-none">
                  {t.v}
                  {t.Icone && <t.Icone className="h-[18px] w-[18px]" fill={OR} stroke={OR} />}
                </span>
                <span className="block pt-[4px] text-[13px] font-semibold">{t.l}</span>
                <span className="block text-[11.5px] text-[#7D93A8]">{t.d}</span>
              </div>
            ))}
          </div>

          <div className="grid grid-cols-1 gap-x-[28px] lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] lg:items-start">
            <div>
              <Titre aide={c.membres.length > 0 ? `${c.membres.length}` : undefined}>La communauté</Titre>
              {c.membres.length === 0 ? (
                <p className="rounded-[10px] border border-dashed border-[#C9DCEA] bg-white/60 px-[16px] py-[14px] text-[13.5px] leading-normal text-[#5B7189]">
                  Personne n'a encore l'étoile. Choisis parmi les suggestions, ou mets l'étoile depuis Membres du club.
                </p>
              ) : (
                <div className="flex flex-col gap-[6px]">
                  {c.membres.map((m) => (
                    <LignePrivilegie key={m.id} m={m} onRetirer={() => agir(() => basculerPrivilegie(m.id, false))} />
                  ))}
                </div>
              )}

              <Titre aide="3 plongées ou plus avec le club">Les plus actifs</Titre>
              {c.suggestions.length === 0 ? (
                <p className="text-[13px] text-[#7D93A8]">
                  Pas d'autre suggestion pour l'instant.{" "}
                  <button type="button" onClick={() => navigate({ to: "/club/membres" })} className="font-bold text-[#1176A8]">
                    Voir tous les membres
                  </button>
                </p>
              ) : (
                <div className="flex flex-col gap-[6px]">
                  {c.suggestions.map((s) => (
                    <div key={s.id ?? s.user_id} className="flex items-center gap-[10px] rounded-[10px] border border-[#E4EBF1] bg-white px-[12px] py-[9px]">
                      <Avatar id={s.user_id ?? s.id} prenom={s.prenom} taille={32} />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-[14px] font-bold">
                          {s.prenom} {s.nom?.toUpperCase() ?? ""}
                        </span>
                        <span className="block text-[12px] text-[#7D93A8]">
                          {[s.niveau, `${s.activite} plongées avec le club`].filter(Boolean).join(" · ")}
                        </span>
                      </span>
                      <button
                        type="button"
                        onClick={() => agir(() => (s.id ? basculerPrivilegie(s.id, true) : privilegierPlongeur(centre.id, s.user_id!, true)))}
                        className="flex h-[34px] items-center gap-[5px] rounded-[10px] border border-[#F2D49A] bg-[#FFF8E8] px-[10px] text-[12.5px] font-bold text-[#8A5A10]"
                      >
                        <Star className="h-[14px] w-[14px]" fill={OR} stroke={OR} /> Ajouter
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div>
              <Titre aide={c.sorties.length > 0 ? `${c.sorties.length} à venir` : undefined}>Plongées réservées</Titre>
              {c.sorties.length === 0 ? (
                <div className="rounded-[10px] border border-dashed border-[#C9DCEA] bg-white/60 px-[16px] py-[14px] text-[13.5px] leading-normal text-[#5B7189]">
                  <p>Aucune plongée réservée à venir.</p>
                  <button type="button" onClick={() => setSerie(true)} className="mt-[8px] flex items-center gap-[6px] font-bold text-[#1176A8]">
                    <CalendarPlus className="h-[15px] w-[15px]" /> Programmer une série (ex. chaque dimanche)
                  </button>
                </div>
              ) : (
                <div className="flex flex-col gap-[6px]">
                  {c.sorties.map((s) => (
                    <button
                      key={s.id}
                      type="button"
                      onClick={() => navigate({ to: "/club/planning", search: { semaine: s.date, sortie: s.id } })}
                      className="flex items-center gap-[12px] rounded-[10px] border border-[#E4EBF1] bg-white px-[12px] py-[10px] text-left hover:border-[#57D4F5]"
                    >
                      <span className="w-[62px] shrink-0 text-[12px] font-bold leading-tight text-[#1176A8] first-letter:uppercase">
                        {dateCourte(s.date)}
                        <span className="block text-[#123A63]">{heureCourte(s.heure)}</span>
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-[14px] font-bold">{s.site}</span>
                        <span className="block truncate text-[12px] text-[#7D93A8]">
                          {[s.lieu, s.profondeur_prevue ? `${String(s.profondeur_prevue).replace(".0", "")} m` : null, s.bateau].filter(Boolean).join(" · ")}
                        </span>
                      </span>
                      {s.melange && <span className="shrink-0 rounded-[8px] bg-[#E3F2FB] px-[7px] py-[2px] text-[11.5px] font-bold text-[#1176A8]">{s.melange}</span>}
                      <span className="w-[54px] shrink-0 text-right text-[12px] font-semibold text-[#5B7189]">
                        {s.nb_inscrits} inscrit{s.nb_inscrits > 1 ? "s" : ""}
                      </span>
                    </button>
                  ))}
                </div>
              )}
              <p className="pt-[8px] text-[12px] leading-normal text-[#9DB0C0]">
                Sur une plongée réservée, seuls les privilégiés peuvent s'inscrire avec le QR code ou le lien. Toi, tu peux toujours ajouter qui tu veux.
              </p>
            </div>
          </div>
        </>
      )}

      {serie && centre && (
        <FeuilleSerie
          centre={centre.id}
          onFermer={(fait) => {
            setSerie(false);
            if (fait) void charger();
          }}
        />
      )}
      {inviter && centre && c && <FeuilleInvitation centre={centre.id} nomCentre={centre.nom} c={c} onFermer={() => setInviter(false)} />}
    </PageClub>
  );
}

function LignePrivilegie({ m, onRetirer }: { m: Privilegie; onRetirer: () => void }) {
  const cert = certificatProche(m.certificat_fin);
  return (
    <div className="flex items-center gap-[10px] rounded-[10px] border border-[#F2D49A] bg-white px-[12px] py-[9px]">
      <span className="relative">
        <Avatar id={m.user_id ?? m.id} prenom={m.prenom} taille={34} prevu={!m.sur_palanote} />
        <Star className="absolute -bottom-[3px] -right-[4px] h-[15px] w-[15px]" fill={OR} stroke="#fff" strokeWidth={1.5} />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[14px] font-bold">
          {m.prenom} {m.nom?.toUpperCase() ?? ""}
          {m.niveau && <span className="font-semibold text-[#5B7189]"> · {m.niveau}</span>}
        </span>
        <span className="flex flex-wrap items-center gap-x-[8px] text-[12px] text-[#7D93A8]">
          <span>{m.activite} plongée{m.activite > 1 ? "s" : ""} avec le club</span>
          {m.inscrit_reservees > 0 && <span className="font-bold text-[#14805F]">inscrit à {m.inscrit_reservees} réservée{m.inscrit_reservees > 1 ? "s" : ""}</span>}
          {!m.sur_palanote && <span>{m.email ? "pas encore sur Palanote" : "sans e-mail"}</span>}
          {cert && (
            <span className={`flex items-center gap-[3px] font-bold ${cert === "depasse" ? "text-[#D9573F]" : "text-[#8A5A10]"}`}>
              <AlertTriangle className="h-[11px] w-[11px]" /> certificat {cert === "depasse" ? "expiré" : "à renouveler"}
            </span>
          )}
        </span>
      </span>
      <button
        type="button"
        onClick={onRetirer}
        aria-label={`Retirer l'étoile de ${m.prenom}`}
        title="Retirer l'étoile"
        className="flex h-[30px] w-[30px] items-center justify-center rounded-[10px] text-[#9DB0C0] hover:bg-[#FFF1EE] hover:text-[#D9573F]"
      >
        <Trash2 className="h-[14px] w-[14px]" />
      </button>
    </div>
  );
}

// ---------- Programmer une série (ex. chaque dimanche, 1 à 3 plongées dans la journée) ----------
function prochainDimanche() {
  const d = depuisIso(aujourdhui());
  d.setDate(d.getDate() + ((7 - d.getDay()) % 7 || 7));
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

type Plongee = { heure: string; site: string; lieu: string; profondeur: string; melange: string };

function FeuilleSerie({ centre, onFermer }: { centre: string; onFermer: (fait: boolean) => void }) {
  const [debut, setDebut] = useState(prochainDimanche);
  const [semaines, setSemaines] = useState(4);
  const [plongees, setPlongees] = useState<Plongee[]>([
    { heure: "09:00", site: "", lieu: "", profondeur: "40", melange: "Nitrox 32" },
    { heure: "14:00", site: "", lieu: "", profondeur: "30", melange: "Air" },
  ]);
  const [bateaux, setBateaux] = useState<Materiel[]>([]);
  const [bateau, setBateau] = useState<string | null>(null);
  const [consignes, setConsignes] = useState("");
  const [enCours, setEnCours] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);

  useEffect(() => {
    void materielCentre(centre)
      .then((l) => setBateaux(l.filter((m) => m.type === "bateau")))
      .catch(() => undefined);
  }, [centre]);

  const dates = Array.from({ length: semaines }, (_, i) => ajouterJours(debut, 7 * i));
  const liste: PlongeeSerie[] = useMemo(
    () =>
      dates.flatMap((d) =>
        plongees
          .filter((p) => p.site.trim())
          .map((p) => ({ date: d, heure: p.heure, site: p.site.trim(), lieu: p.lieu.trim(), profondeur: p.profondeur, melange: p.melange, bateau_id: bateau, consignes })),
      ),
    [dates.join(), plongees, bateau, consignes],
  );
  const maj = (i: number, p: Partial<Plongee>) => setPlongees(plongees.map((x, j) => (j === i ? { ...x, ...p } : x)));

  const creer = async () => {
    setEnCours(true);
    setErreur(null);
    try {
      await creerSeriePrivilegies(centre, liste);
      onFermer(true);
    } catch (e) {
      setErreur(messagePlanning(e, "La série n'a pas pu être créée.").replace("palanote-planning-club.sql", "palanote-privilegies.sql"));
      setEnCours(false);
    }
  };

  return (
    <Fenetre titre="Programmer une série de plongées réservées" onFermer={() => onFermer(false)}>
      <p className="text-[13px] leading-normal text-[#5B7189]">Par exemple chaque dimanche de la saison, avec une ou plusieurs plongées dans la journée.</p>
      <div className="grid grid-cols-2 gap-[10px] pt-[12px]">
        <ChampTexte label="Premier jour" type="date" value={debut} onChange={(e) => setDebut(e.target.value)} />
        <label className="block">
          <span className="block pb-[7px] text-[13px] font-semibold text-[#5B7189]">Répéter</span>
          <select
            value={semaines}
            onChange={(e) => setSemaines(Number(e.target.value))}
            className="block h-[52px] w-full rounded-[10px] border-[1.5px] border-[#E4EBF1] bg-white px-[12px] text-[15px] outline-none focus:border-[#57D4F5]"
          >
            <option value={1}>Une seule fois</option>
            {[2, 3, 4, 5, 6, 8, 10, 12].map((n) => (
              <option key={n} value={n}>
                Chaque semaine, {n} fois
              </option>
            ))}
          </select>
        </label>
      </div>

      <p className="pb-[6px] pt-[16px] text-[12px] font-bold uppercase tracking-[.08em] text-[#5B7189]">Plongées de la journée</p>
      <div className="flex flex-col gap-[10px]">
        {plongees.map((p, i) => (
          <div key={i} className="rounded-[10px] border border-[#E4EBF1] p-[10px]">
            <div className="grid grid-cols-[88px_minmax(0,1fr)] gap-[8px] sm:grid-cols-[88px_minmax(0,1.4fr)_minmax(0,1fr)_74px]">
              <input type="time" value={p.heure} onChange={(e) => maj(i, { heure: e.target.value })} aria-label="Heure" className="h-[40px] rounded-[10px] border border-[#E4EBF1] px-[8px] text-[14px]" />
              <input value={p.site} onChange={(e) => maj(i, { site: e.target.value })} placeholder="Site (ex. Épave du Donator)" aria-label="Site" className="h-[40px] rounded-[10px] border border-[#E4EBF1] px-[10px] text-[14px]" />
              <input value={p.lieu} onChange={(e) => maj(i, { lieu: e.target.value })} placeholder="Lieu" aria-label="Lieu" className="h-[40px] rounded-[10px] border border-[#E4EBF1] px-[10px] text-[14px]" />
              <input
                value={p.profondeur}
                inputMode="decimal"
                onChange={(e) => maj(i, { profondeur: e.target.value.replace(/[^\d,.]/g, "").slice(0, 5) })}
                placeholder="m"
                aria-label="Profondeur prévue (m)"
                className="h-[40px] rounded-[10px] border border-[#E4EBF1] px-[10px] text-[14px]"
              />
            </div>
            <div className="flex flex-wrap items-center gap-[6px] pt-[8px]">
              {MELANGES.map((g) => (
                <button
                  key={g}
                  type="button"
                  onClick={() => maj(i, { melange: g })}
                  className={`h-[30px] rounded-[10px] px-[10px] text-[12px] font-bold ${p.melange === g ? "bg-[#0F3D70] text-white" : "border border-[#D8E5EE] text-[#5B7189]"}`}
                >
                  {g}
                </button>
              ))}
              {plongees.length > 1 && (
                <button type="button" onClick={() => setPlongees(plongees.filter((_, j) => j !== i))} className="ml-auto text-[12px] font-semibold text-[#9DB0C0]">
                  Retirer
                </button>
              )}
            </div>
          </div>
        ))}
        {plongees.length < 3 && (
          <button
            type="button"
            onClick={() => setPlongees([...plongees, { heure: "16:30", site: "", lieu: "", profondeur: "", melange: "Air" }])}
            className="flex items-center gap-[6px] self-start text-[13px] font-bold text-[#1176A8]"
          >
            <Plus className="h-[15px] w-[15px]" /> Une plongée de plus dans la journée
          </button>
        )}
      </div>

      {bateaux.length > 0 && (
        <div className="flex flex-wrap items-center gap-[6px] pt-[14px]">
          <span className="text-[13px] font-semibold text-[#5B7189]">Bateau :</span>
          {bateaux.map((b) => (
            <button
              key={b.id}
              type="button"
              onClick={() => setBateau(bateau === b.id ? null : b.id)}
              className={`h-[32px] rounded-[10px] px-[10px] text-[12.5px] font-bold ${bateau === b.id ? "bg-[#0F3D70] text-white" : "border border-[#D8E5EE] text-[#5B7189]"}`}
            >
              {b.libelle} · {b.places} pl.
            </button>
          ))}
        </div>
      )}
      <div className="pt-[12px]">
        <ChampTexte label="Consignes (facultatif)" value={consignes} onChange={(e) => setConsignes(e.target.value)} placeholder="Niveau 3 minimum, rendez-vous au ponton à 8h30" />
      </div>

      <p className="pt-[14px] text-[13px] font-semibold">
        {liste.length} plongée{liste.length > 1 ? "s" : ""} réservée{liste.length > 1 ? "s" : ""} :{" "}
        <span className="font-normal text-[#5B7189]">
          {dates.map((d) => dateCourte(d)).join(", ")}
        </span>
      </p>
      <MessageErreur texte={erreur} />
      <div className="flex justify-end gap-[10px] pt-[16px]">
        <button type="button" onClick={() => onFermer(false)} className="h-[44px] rounded-[10px] px-[14px] text-[13.5px] font-bold text-[#5B7189]">
          Annuler
        </button>
        <button
          type="button"
          disabled={enCours || liste.length === 0}
          onClick={() => void creer()}
          className="h-[44px] rounded-[10px] bg-[#3DEFBE] px-[18px] text-[13.5px] font-bold text-[#0B3B63] disabled:opacity-40"
        >
          {enCours ? "CRÉATION…" : `CRÉER ${liste.length} PLONGÉE${liste.length > 1 ? "S" : ""}`}
        </button>
      </div>
    </Fenetre>
  );
}

// ---------- Inviter la communauté ----------
function FeuilleInvitation({ centre, nomCentre, c, onFermer }: { centre: string; nomCentre: string; c: Communaute; onFermer: () => void }) {
  const [dest, setDest] = useState<Set<string>>(() => new Set(c.membres.map((m) => m.id)));
  const [choix, setChoix] = useState<Set<string>>(() => new Set(c.sorties.map((s) => s.id)));
  const [prenomDp, setPrenomDp] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [resultat, setResultat] = useState<string | null>(null);
  const [copie, setCopie] = useState<string | null>(null);
  const [enCours, setEnCours] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);

  useEffect(() => {
    void monProfil().then((p) => setPrenomDp(p?.prenom ?? ""));
  }, []);

  const sorties = c.sorties.filter((s) => choix.has(s.id));
  const ligne = (s: SortieReservee) =>
    `• ${dateCourte(s.date)}${s.heure ? ` à ${heureCourte(s.heure)}` : ""} : ${s.site}${s.lieu ? ` (${s.lieu})` : ""}${s.melange ? ` · ${s.melange}` : ""}${
      s.profondeur_prevue ? ` · ${String(s.profondeur_prevue).replace(".0", "")} m` : ""
    }\n  Je m'inscris : ${lienSortie(s.jeton, "lien")}`;
  const texteParDefaut = `Bonjour,\n\nCette saison, ${nomCentre} organise des plongées réservées aux membres privilégiés du club :\n\n${sorties
    .map(ligne)
    .join("\n\n")}\n\nInscris-toi en un clic avec le lien de chaque plongée (il te faut l'app Palanote, avec l'adresse e-mail que tu as donnée au club), ou réponds simplement à ce message.\n\nÀ bientôt sous l'eau,\n${prenomDp}${prenomDp ? ", " : ""}${nomCentre}`;
  const texte = message ?? texteParDefaut;
  const destinataires = c.membres.filter((m) => dest.has(m.id));
  const emails = destinataires.map((m) => m.email).filter((e): e is string => Boolean(e));
  const objet = `${nomCentre} : plongées réservées aux membres privilégiés`;
  const mailto = `mailto:?bcc=${encodeURIComponent(emails.join(","))}&subject=${encodeURIComponent(objet)}&body=${encodeURIComponent(texte)}`;

  const basculer = (set: Set<string>, id: string, maj: (s: Set<string>) => void) => {
    const n = new Set(set);
    if (n.has(id)) n.delete(id);
    else n.add(id);
    maj(n);
  };
  const copier = (quoi: string, valeur: string) =>
    void navigator.clipboard?.writeText(valeur).then(() => {
      setCopie(quoi);
      setTimeout(() => setCopie(null), 1800);
    });

  const notifier = async () => {
    setEnCours(true);
    setErreur(null);
    try {
      const r = await inviterPrivilegies(centre, [...dest], [...choix]);
      setResultat(
        `${r.avec_app} privilégié${r.avec_app > 1 ? "s" : ""} prévenu${r.avec_app > 1 ? "s" : ""} dans l'app (une notification par plongée).${
          r.sans_app ? ` ${r.sans_app} n'${r.sans_app > 1 ? "ont" : "a"} pas encore l'app : envoie-leur l'e-mail.` : ""
        }`,
      );
    } catch (e) {
      setErreur(messagePlanning(e, "L'invitation n'a pas pu partir.").replace("palanote-planning-club.sql", "palanote-privilegies.sql"));
    }
    setEnCours(false);
  };

  return (
    <Fenetre titre="Inviter les membres privilégiés" onFermer={onFermer} large>
      <div className="grid grid-cols-1 gap-[16px] lg:grid-cols-2">
        <div>
          <p className="pb-[6px] text-[12px] font-bold uppercase tracking-[.08em] text-[#5B7189]">
            Destinataires · {dest.size}/{c.membres.length}
          </p>
          <div className="max-h-[200px] overflow-y-auto rounded-[10px] border border-[#E4EBF1]">
            {c.membres.map((m, i) => (
              <label key={m.id} className={`flex cursor-pointer items-center gap-[10px] px-[12px] py-[8px] ${i > 0 ? "border-t border-[#EEF3F8]" : ""}`}>
                <input type="checkbox" checked={dest.has(m.id)} onChange={() => basculer(dest, m.id, setDest)} className="h-[16px] w-[16px] accent-[#0F3D70]" />
                <span className="min-w-0 flex-1 truncate text-[13.5px] font-semibold">
                  {m.prenom} {m.nom?.toUpperCase() ?? ""}
                </span>
                <span className="shrink-0 text-[11.5px] text-[#7D93A8]">{m.sur_palanote ? "app" : ""}{m.sur_palanote && m.email ? " + " : ""}{m.email ? "e-mail" : m.sur_palanote ? "" : "—"}</span>
              </label>
            ))}
          </div>
          <p className="pb-[6px] pt-[14px] text-[12px] font-bold uppercase tracking-[.08em] text-[#5B7189]">
            Plongées proposées · {choix.size}/{c.sorties.length}
          </p>
          {c.sorties.length === 0 ? (
            <p className="text-[13px] text-[#7D93A8]">Programme d'abord une série de plongées réservées.</p>
          ) : (
            <div className="max-h-[200px] overflow-y-auto rounded-[10px] border border-[#E4EBF1]">
              {c.sorties.map((s, i) => (
                <label key={s.id} className={`flex cursor-pointer items-center gap-[10px] px-[12px] py-[8px] ${i > 0 ? "border-t border-[#EEF3F8]" : ""}`}>
                  <input type="checkbox" checked={choix.has(s.id)} onChange={() => basculer(choix, s.id, setChoix)} className="h-[16px] w-[16px] accent-[#0F3D70]" />
                  <span className="w-[86px] shrink-0 text-[12px] font-bold text-[#1176A8] first-letter:uppercase">
                    {dateCourte(s.date)} {heureCourte(s.heure)}
                  </span>
                  <span className="min-w-0 flex-1 truncate text-[13.5px] font-semibold">{s.site}</span>
                  {s.melange && <span className="shrink-0 text-[11.5px] font-bold text-[#1176A8]">{s.melange}</span>}
                </label>
              ))}
            </div>
          )}
        </div>
        <div className="flex flex-col">
          <p className="pb-[6px] text-[12px] font-bold uppercase tracking-[.08em] text-[#5B7189]">Message</p>
          <textarea
            value={texte}
            onChange={(e) => setMessage(e.target.value)}
            rows={14}
            aria-label="Message de l'invitation"
            className="w-full flex-1 rounded-[10px] border-[1.5px] border-[#E4EBF1] bg-white px-[12px] py-[10px] text-[13px] leading-relaxed outline-none focus:border-[#57D4F5]"
          />
          {message !== null && (
            <button type="button" onClick={() => setMessage(null)} className="self-start pt-[4px] text-[12px] font-semibold text-[#1176A8]">
              Revenir au message proposé
            </button>
          )}
        </div>
      </div>

      {resultat && (
        <p className="mt-[12px] flex items-start gap-[8px] rounded-[10px] bg-[#E2F8EF] px-[12px] py-[10px] text-[13px] font-semibold text-[#14805F]">
          <Check className="mt-[2px] h-[15px] w-[15px] shrink-0" /> {resultat}
        </p>
      )}
      <MessageErreur texte={erreur} />
      <div className="flex flex-wrap items-center justify-end gap-[8px] pt-[16px]">
        <button type="button" onClick={() => copier("adresses", emails.join(", "))} disabled={emails.length === 0} className="flex h-[42px] items-center gap-[6px] rounded-[10px] px-[12px] text-[13px] font-bold text-[#5B7189] disabled:opacity-40">
          <Copy className="h-[14px] w-[14px]" /> {copie === "adresses" ? "Copié" : emails.length === 1 ? "Copier l'adresse" : `Copier les ${emails.length} adresses`}
        </button>
        <button type="button" onClick={() => copier("message", texte)} className="flex h-[42px] items-center gap-[6px] rounded-[10px] px-[12px] text-[13px] font-bold text-[#5B7189]">
          <Copy className="h-[14px] w-[14px]" /> {copie === "message" ? "Message copié" : "Copier le message"}
        </button>
        <a
          href={emails.length > 0 ? mailto : undefined}
          aria-disabled={emails.length === 0}
          className={`flex h-[42px] items-center gap-[6px] rounded-[10px] border border-[#57D4F5] bg-white px-[14px] text-[13px] font-bold text-[#1176A8] ${emails.length === 0 ? "pointer-events-none opacity-40" : ""}`}
        >
          <Mail className="h-[15px] w-[15px]" /> Préparer l'e-mail ({emails.length})
        </a>
        <button
          type="button"
          disabled={enCours || choix.size === 0 || destinataires.filter((m) => m.sur_palanote).length === 0}
          onClick={() => void notifier()}
          className="flex h-[42px] items-center gap-[6px] rounded-[10px] bg-[#3DEFBE] px-[14px] text-[13px] font-bold text-[#0B3B63] disabled:opacity-40"
        >
          <Send className="h-[15px] w-[15px]" /> {enCours ? "ENVOI…" : `PRÉVENIR DANS L'APP (${destinataires.filter((m) => m.sur_palanote).length})`}
        </button>
      </div>
      <p className="pt-[8px] text-right text-[11.5px] text-[#9DB0C0]">L'e-mail s'ouvre dans ta messagerie, adresses en copie cachée.</p>
    </Fenetre>
  );
}

function Fenetre({ titre, onFermer, children, large = false }: { titre: string; onFermer: () => void; children: React.ReactNode; large?: boolean }) {
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center lg:items-center" role="dialog" aria-modal="true" aria-label={titre}>
      <button type="button" aria-label="Fermer" onClick={onFermer} className="absolute inset-0 bg-[#06203F]/45" />
      <div className={`relative max-h-[94svh] w-full overflow-y-auto rounded-t-[10px] bg-white px-[22px] pb-[20px] pt-[18px] text-[#123A63] lg:rounded-[10px] ${large ? "max-w-[960px]" : "max-w-[640px]"}`}>
        <div className="flex items-start justify-between gap-3 pb-[8px]">
          <h2 className="flex items-center gap-[8px] text-[19px] font-bold leading-tight">
            <Star className="h-[18px] w-[18px] shrink-0" fill={OR} stroke={OR} />
            {titre}
          </h2>
          <button type="button" aria-label="Fermer" onClick={onFermer} className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[10px] bg-[#EEF3F8]">
            <X className="h-[17px] w-[17px]" />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}
