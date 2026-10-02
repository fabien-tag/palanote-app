import { useCallback, useEffect, useMemo, useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { ChevronDown, ChevronLeft, Mail, RefreshCw, Trash2 } from "lucide-react";
import {
  chargerTableauDeBord,
  effacerErreurs,
  estAdmin,
  marquerRetour,
  type ErreurApp,
  type Retour,
  type StatsAdmin,
  type UtilisateurAdmin,
} from "@/lib/suivi";
import { utilisateurConnecte } from "@/lib/plongees";

// Tableau de bord du développeur : réservé aux comptes de la table app_admins.
export const Route = createFileRoute("/admin")({
  head: () => ({ meta: [{ title: "Palanote — Tableau de bord" }, { name: "robots", content: "noindex" }] }),
  component: TableauDeBord,
});

type Onglet = "retours" | "erreurs" | "utilisateurs";

function ilYa(iso: string | null) {
  if (!iso) return "jamais";
  const s = Math.max(0, (Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 60) return "à l'instant";
  if (s < 3600) return `il y a ${Math.round(s / 60)} min`;
  if (s < 86400) return `il y a ${Math.round(s / 3600)} h`;
  const j = Math.round(s / 86400);
  return j < 31 ? `il y a ${j} j` : new Date(iso).toLocaleDateString("fr-FR", { day: "numeric", month: "short", year: "numeric" });
}

function Tuile({ valeur, label, detail, accent }: { valeur: number | string | undefined; label: string; detail?: string | undefined; accent?: boolean }) {
  return (
    <div className="rounded-[18px] border border-[#E4EBF1] bg-white px-[14px] py-[13px] shadow-[0_4px_14px_#123A6306]">
      <div className="flex items-center gap-[7px]">
        {accent && <span className="h-[9px] w-[9px] animate-pulse rounded-full bg-[#14B88A]" aria-hidden="true" />}
        <b className="text-[24px] leading-tight">{valeur ?? "—"}</b>
      </div>
      <div className="text-[12.5px] text-[#5B7189]">{label}</div>
      {detail && <div className="pt-[2px] text-[11.5px] font-semibold text-[#14805F]">{detail}</div>}
    </div>
  );
}

function GraphiqueActivite({ jours }: { jours: StatsAdmin["par_jour"] }) {
  const max = Math.max(1, ...jours.map((j) => j.actifs));
  const inscriptions = jours.reduce((t, j) => t + j.inscriptions, 0);
  return (
    <div className="rounded-[20px] border border-[#E4EBF1] bg-white p-[16px] shadow-[0_4px_14px_#123A6306]">
      <div className="flex items-baseline justify-between gap-2">
        <h2 className="text-[14.5px] font-bold">Utilisateurs actifs, 30 derniers jours</h2>
        <span className="text-[12px] text-[#9DB0C0]">{inscriptions} inscription{inscriptions > 1 ? "s" : ""}</span>
      </div>
      <div className="mt-[14px] flex h-[110px] items-end gap-[3px]">
        {jours.map((j) => (
          <div key={j.jour} className="group relative flex h-full flex-1 flex-col justify-end" title={`${j.jour} : ${j.actifs} actif(s), ${j.inscriptions} inscription(s)`}>
            <div className={`w-full rounded-t-[3px] ${j.actifs ? "bg-[#57D4F5]" : "bg-[#E7EFF6]"}`} style={{ height: j.actifs ? `${Math.max(6, (j.actifs / max) * 100)}%` : 3 }} />
            {j.inscriptions > 0 && <span className="absolute -top-[2px] left-1/2 h-[6px] w-[6px] -translate-x-1/2 rounded-full bg-[#FF8A75]" />}
          </div>
        ))}
      </div>
      <div className="mt-[6px] flex justify-between text-[10.5px] text-[#9DB0C0]">
        <span>{jours[0] ? new Date(jours[0].jour).toLocaleDateString("fr-FR", { day: "numeric", month: "short" }) : ""}</span>
        <span className="flex items-center gap-[5px]">
          <span className="h-[6px] w-[6px] rounded-full bg-[#FF8A75]" /> jour avec inscription
        </span>
        <span>aujourd'hui</span>
      </div>
    </div>
  );
}

function ListeRetours({ retours, onChange }: { retours: Retour[]; onChange: (id: string, statut: Retour["statut"]) => void }) {
  const [tous, setTous] = useState(false);
  const visibles = tous ? retours : retours.filter((r) => r.statut === "nouveau");
  return (
    <div className="flex flex-col gap-[10px]">
      <label className="flex items-center gap-[8px] self-end text-[12.5px] text-[#5B7189]">
        <input type="checkbox" checked={tous} onChange={(e) => setTous(e.target.checked)} /> Afficher aussi les retours traités
      </label>
      {visibles.length === 0 && <p className="py-[30px] text-center text-[13.5px] text-[#9DB0C0]">Aucun retour à traiter.</p>}
      {visibles.map((r) => (
        <div key={r.id} className={`rounded-[18px] border bg-white p-[14px] ${r.statut === "nouveau" ? "border-[#B8E4D8]" : "border-[#E4EBF1] opacity-70"}`}>
          <div className="flex flex-wrap items-center gap-[8px]">
            {r.raison && <span className="rounded-full bg-[#0F3D70] px-[10px] py-[3px] text-[11.5px] font-semibold text-white">{r.raison}</span>}
            <span className="text-[12px] text-[#9DB0C0]">{ilYa(r.created_at)}</span>
            <span className="text-[12px] text-[#9DB0C0]">· {[r.appareil, r.systeme, r.version && `v${r.version}`].filter(Boolean).join(" · ")}</span>
          </div>
          <p className="whitespace-pre-wrap pt-[8px] text-[14.5px] leading-normal">{r.message}</p>
          <div className="flex flex-wrap items-center justify-between gap-[10px] pt-[10px]">
            {r.email ? (
              <a href={`mailto:${r.email}?subject=${encodeURIComponent("Ton retour sur Palanote")}`} className="flex items-center gap-[6px] text-[13px] font-semibold text-[#1176A8]">
                <Mail className="h-[15px] w-[15px]" /> {r.email}
              </a>
            ) : (
              <span className="text-[12.5px] text-[#9DB0C0]">Pas d'adresse jointe</span>
            )}
            <button
              type="button"
              onClick={() => onChange(r.id, r.statut === "nouveau" ? "traite" : "nouveau")}
              className={`h-[36px] rounded-[12px] px-[14px] text-[12.5px] font-bold ${r.statut === "nouveau" ? "bg-[#3DEFBE] text-[#0B3B63]" : "bg-[#EEF4F9] text-[#5B7189]"}`}
            >
              {r.statut === "nouveau" ? "Marquer traité" : "Rouvrir"}
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}

function ListeErreurs({ erreurs, onEffacer }: { erreurs: ErreurApp[]; onEffacer: (message: string) => void }) {
  const [ouverte, setOuverte] = useState<string | null>(null);
  const groupes = useMemo(() => {
    const m = new Map<string, ErreurApp[]>();
    for (const e of erreurs) m.set(e.message, [...(m.get(e.message) ?? []), e]);
    return [...m.entries()].map(([message, liste]) => ({
      message,
      liste,
      personnes: new Set(liste.map((e) => e.user_id ?? "anonyme")).size,
      pages: [...new Set(liste.map((e) => e.page?.split("?")[0]).filter(Boolean))],
    }));
  }, [erreurs]);
  if (groupes.length === 0) return <p className="py-[30px] text-center text-[13.5px] text-[#9DB0C0]">Aucune erreur remontée. 🎉</p>;
  return (
    <div className="flex flex-col gap-[10px]">
      {groupes.map((g) => {
        const derniere = g.liste[0]!;
        const ouvert = ouverte === g.message;
        return (
          <div key={g.message} className="rounded-[18px] border border-[#FFD3C8] bg-white p-[14px]">
            <div className="flex items-start gap-[10px]">
              <span className="mt-[2px] flex h-[26px] min-w-[26px] items-center justify-center rounded-full bg-[#FFE4DE] px-[6px] text-[12px] font-bold text-[#B23A26]">{g.liste.length}</span>
              <div className="min-w-0 flex-1">
                <p className="break-words text-[14px] font-semibold leading-snug">{g.message}</p>
                <p className="pt-[4px] text-[12px] text-[#5B7189]">
                  {ilYa(derniere.created_at)} · {g.personnes} personne{g.personnes > 1 ? "s" : ""} · {g.pages.join(", ") || "page inconnue"}
                </p>
                <p className="text-[12px] text-[#9DB0C0]">{[derniere.appareil, derniere.systeme].filter(Boolean).join(" · ")}</p>
              </div>
            </div>
            <div className="flex items-center justify-between pt-[10px]">
              <button type="button" onClick={() => setOuverte(ouvert ? null : g.message)} className="flex items-center gap-[4px] text-[12.5px] font-semibold text-[#1176A8]">
                Détails <ChevronDown className={`h-[14px] w-[14px] transition ${ouvert ? "rotate-180" : ""}`} />
              </button>
              <button type="button" onClick={() => onEffacer(g.message)} className="flex items-center gap-[5px] text-[12.5px] font-semibold text-[#C94957]">
                <Trash2 className="h-[14px] w-[14px]" /> Effacer
              </button>
            </div>
            {ouvert && (
              <pre className="mt-[8px] max-h-[240px] overflow-auto whitespace-pre-wrap break-words rounded-[12px] bg-[#F1F6FC] p-[10px] text-[11px] leading-snug text-[#3F5B76]">
                {derniere.details || "Pas de détail technique."}
              </pre>
            )}
          </div>
        );
      })}
    </div>
  );
}

function ListeUtilisateurs({ utilisateurs }: { utilisateurs: UtilisateurAdmin[] }) {
  return (
    <div className="overflow-hidden rounded-[18px] border border-[#E4EBF1] bg-white">
      {utilisateurs.map((u) => {
        const enLigne = u.derniere_visite && Date.now() - new Date(u.derniere_visite).getTime() < 5 * 60_000;
        return (
          <div key={u.id} className="flex items-center gap-[12px] border-t border-[#EDF2F7] px-[14px] py-[11px] first:border-t-0">
            <span className={`h-[9px] w-[9px] shrink-0 rounded-full ${enLigne ? "bg-[#14B88A]" : "bg-[#D5DFE8]"}`} aria-label={enLigne ? "en ligne" : undefined} />
            <div className="min-w-0 flex-1">
              <div className="truncate text-[14px] font-bold">{u.prenom || u.email}</div>
              <div className="truncate text-[12px] text-[#5B7189]">
                {u.email} · inscrit {ilYa(u.inscrit_le)}
              </div>
            </div>
            <div className="shrink-0 text-right">
              <div className="text-[12.5px] font-semibold">{u.plongees} plongée{u.plongees > 1 ? "s" : ""}</div>
              <div className="text-[11.5px] text-[#9DB0C0]">{ilYa(u.derniere_visite)}</div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function TableauDeBord() {
  const navigate = useNavigate();
  const [acces, setAcces] = useState<boolean | null>(null);
  const [donnees, setDonnees] = useState<Awaited<ReturnType<typeof chargerTableauDeBord>> | null>(null);
  const [onglet, setOnglet] = useState<Onglet>("retours");
  const [chargement, setChargement] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);

  const charger = useCallback(async () => {
    setChargement(true);
    setErreur(null);
    try {
      setDonnees(await chargerTableauDeBord());
    } catch (e) {
      console.error("Tableau de bord non chargé", e);
      setErreur("Le tableau de bord n'a pas pu être chargé. As-tu lancé le script palanote-tableau-de-bord.sql ?");
    } finally {
      setChargement(false);
    }
  }, []);

  useEffect(() => {
    void (async () => {
      const ok = (await utilisateurConnecte()) ? await estAdmin() : false;
      setAcces(ok);
      if (ok) await charger();
    })();
  }, [charger]);

  // Mise à jour automatique toutes les minutes
  useEffect(() => {
    if (!acces) return;
    const t = setInterval(() => void charger(), 60_000);
    return () => clearInterval(t);
  }, [acces, charger]);

  if (acces === false)
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-[#F5F9FC] px-8 text-center text-[#123A63]">
        <h1 className="text-[22px] font-bold">Page réservée</h1>
        <p className="text-[14px] text-[#5B7189]">Cette page est réservée à l'auteur de l'app.</p>
        <button type="button" onClick={() => navigate({ to: "/carnet" })} className="text-[14px] font-bold text-[#1176A8] underline">
          Revenir à mon carnet
        </button>
      </div>
    );

  const s = donnees?.stats;
  const nouveaux = donnees?.retours.filter((r) => r.statut === "nouveau").length ?? 0;
  const onglets: [Onglet, string][] = [
    ["retours", `Retours${nouveaux ? ` (${nouveaux})` : ""}`],
    ["erreurs", `Erreurs${s?.erreurs_24h ? ` (${s.erreurs_24h} en 24 h)` : ""}`],
    ["utilisateurs", "Utilisateurs"],
  ];

  return (
    <div className="min-h-screen bg-[#F5F9FC] text-[#123A63]">
      <div className="mx-auto w-full max-w-[960px] px-[22px] pb-[40px] pt-[clamp(14px,2.6svh,22px)]">
        <div className="flex items-center gap-[14px]">
          <button type="button" aria-label="Retour" onClick={() => navigate({ to: "/moi" })} className="flex h-10 w-10 items-center justify-center rounded-[13px] bg-[#E3EDF6]">
            <ChevronLeft className="h-[18px] w-[18px]" strokeWidth={2.4} />
          </button>
          <h1 className="flex-1 text-[24px] font-bold">Tableau de bord</h1>
          <button
            type="button"
            aria-label="Actualiser"
            onClick={() => void charger()}
            className="flex h-10 w-10 items-center justify-center rounded-[13px] bg-[#E3EDF6]"
          >
            <RefreshCw className={`h-[17px] w-[17px] ${chargement ? "animate-spin" : ""}`} strokeWidth={2.2} />
          </button>
        </div>

        {erreur && <p className="mt-[16px] rounded-[14px] bg-[#FFE4DE] p-[12px] text-[13.5px] text-[#8A2A1A]">{erreur}</p>}

        {s && (
          <>
            <div className="mt-[20px] grid grid-cols-2 gap-[10px] md:grid-cols-4">
              <Tuile valeur={s.connectes} label="connectés en ce moment" accent />
              <Tuile valeur={s.actifs_jour} label="actifs aujourd'hui" />
              <Tuile valeur={s.actifs_7j} label="actifs sur 7 jours" />
              <Tuile valeur={s.actifs_30j} label="actifs sur 30 jours" />
              <Tuile valeur={s.comptes} label="comptes" detail={s.comptes_7j ? `+${s.comptes_7j} cette semaine` : undefined} />
              <Tuile valeur={s.plongees} label="plongées enregistrées" detail={s.plongees_7j ? `+${s.plongees_7j} cette semaine` : undefined} />
              <Tuile valeur={s.pages_numerisees} label="pages numérisées" detail={s.pages_30j ? `${s.pages_30j} sur 30 jours` : undefined} />
              <Tuile valeur={s.binomes} label="paires de binômes" detail={s.photos ? `${s.photos} photos de plongée` : undefined} />
            </div>

            <div className="mt-[12px]">
              <GraphiqueActivite jours={s.par_jour} />
            </div>

            <div role="tablist" className="mt-[22px] flex gap-[4px] overflow-x-auto rounded-[14px] bg-[#E7EFF6] p-[4px]">
              {onglets.map(([id, label]) => (
                <button
                  key={id}
                  type="button"
                  role="tab"
                  aria-selected={onglet === id}
                  onClick={() => setOnglet(id)}
                  className={`h-[38px] flex-1 whitespace-nowrap rounded-[11px] px-[12px] text-[13px] font-bold ${onglet === id ? "bg-white shadow-[0_2px_6px_rgba(15,61,112,.14)]" : "text-[#5B7189]"}`}
                >
                  {label}
                </button>
              ))}
            </div>

            <div className="mt-[14px]">
              {onglet === "retours" && donnees && (
                <ListeRetours
                  retours={donnees.retours}
                  onChange={(id, statut) => {
                    setDonnees((d) => d && { ...d, retours: d.retours.map((r) => (r.id === id ? { ...r, statut } : r)) });
                    void marquerRetour(id, statut).catch((e) => console.error("Retour non mis à jour", e));
                  }}
                />
              )}
              {onglet === "erreurs" && donnees && (
                <ListeErreurs
                  erreurs={donnees.erreurs}
                  onEffacer={(message) => {
                    setDonnees((d) => d && { ...d, erreurs: d.erreurs.filter((e) => e.message !== message) });
                    void effacerErreurs(message).catch(() => undefined);
                  }}
                />
              )}
              {onglet === "utilisateurs" && donnees && <ListeUtilisateurs utilisateurs={donnees.utilisateurs} />}
            </div>
          </>
        )}
        {!s && !erreur && acces && <p className="pt-[30px] text-center text-[13.5px] text-[#9DB0C0]">Chargement…</p>}
      </div>
    </div>
  );
}
