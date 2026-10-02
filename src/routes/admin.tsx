import { Fragment, useCallback, useEffect, useMemo, useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { AlertTriangle, ArrowLeft, ChevronDown, LayoutDashboard, Mail, MessageCircle, RefreshCw, Search, Trash2, Users } from "lucide-react";
import logoCorail from "@/assets/palanote-logo-cigle.png";
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

// Tableau de bord du développeur, pensé pour l'ordinateur (s'adapte au téléphone).
// Réservé aux comptes de la table app_admins.
export const Route = createFileRoute("/admin")({
  head: () => ({ meta: [{ title: "Palanote — Tableau de bord" }, { name: "robots", content: "noindex" }] }),
  component: TableauDeBord,
});

type Section = "apercu" | "retours" | "erreurs" | "utilisateurs";
type Donnees = Awaited<ReturnType<typeof chargerTableauDeBord>>;

// ---------- Outils ----------

function ilYa(iso: string | null) {
  if (!iso) return "jamais";
  const s = Math.max(0, (Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 60) return "à l'instant";
  if (s < 3600) return `il y a ${Math.round(s / 60)} min`;
  if (s < 86400) return `il y a ${Math.round(s / 3600)} h`;
  const j = Math.round(s / 86400);
  return j < 31 ? `il y a ${j} j` : dateCourte(iso);
}
const dateCourte = (iso: string) => new Date(iso).toLocaleDateString("fr-FR", { day: "numeric", month: "short", year: "numeric" });
const enLigne = (iso: string | null) => Boolean(iso && Date.now() - new Date(iso).getTime() < 5 * 60_000);

type GroupeErreurs = { message: string; liste: ErreurApp[]; personnes: number; pages: string[] };
function grouperErreurs(erreurs: ErreurApp[]): GroupeErreurs[] {
  const m = new Map<string, ErreurApp[]>();
  for (const e of erreurs) m.set(e.message, [...(m.get(e.message) ?? []), e]);
  return [...m.entries()].map(([message, liste]) => ({
    message,
    liste,
    personnes: new Set(liste.map((e) => e.user_id ?? "anonyme")).size,
    pages: [...new Set(liste.map((e) => e.page?.split("?")[0]).filter((p): p is string => Boolean(p)))],
  }));
}

const carte = "rounded-[18px] border border-[#E4EBF1] bg-white shadow-[0_4px_14px_#123A6306]";

// ---------- Blocs ----------

function Tuile({ valeur, label, detail, accent }: { valeur: number | string | undefined; label: string; detail?: string | undefined; accent?: boolean }) {
  return (
    <div className={`${carte} px-[18px] py-[16px]`}>
      <div className="text-[12.5px] font-semibold uppercase tracking-[.05em] text-[#7D93A8]">{label}</div>
      <div className="flex items-center gap-[8px] pt-[6px]">
        {accent && <span className="h-[10px] w-[10px] animate-pulse rounded-full bg-[#14B88A]" aria-hidden="true" />}
        <b className="text-[30px] leading-none">{valeur ?? "—"}</b>
      </div>
      <div className="h-[18px] pt-[6px] text-[12.5px] font-semibold text-[#14805F]">{detail ?? ""}</div>
    </div>
  );
}

function GraphiqueActivite({ jours }: { jours: StatsAdmin["par_jour"] }) {
  const max = Math.max(1, ...jours.map((j) => j.actifs));
  const inscriptions = jours.reduce((t, j) => t + j.inscriptions, 0);
  const graduations = [max, Math.round(max / 2), 0];
  return (
    <div className={`${carte} p-[20px]`}>
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-[15px] font-bold">Utilisateurs actifs, 30 derniers jours</h2>
        <span className="flex items-center gap-[14px] text-[12.5px] text-[#7D93A8]">
          <span className="flex items-center gap-[6px]">
            <span className="h-[10px] w-[10px] rounded-[3px] bg-[#57D4F5]" /> actifs
          </span>
          <span className="flex items-center gap-[6px]">
            <span className="h-[7px] w-[7px] rounded-full bg-[#FF8A75]" /> {inscriptions} inscription{inscriptions > 1 ? "s" : ""}
          </span>
        </span>
      </div>
      <div className="mt-[18px] flex gap-[10px]">
        <div className="flex h-[190px] flex-col justify-between pb-[1px] text-right text-[11px] text-[#9DB0C0]">
          {graduations.map((g, i) => (
            <span key={i}>{g}</span>
          ))}
        </div>
        <div className="relative flex h-[190px] flex-1 items-end gap-[4px] border-b border-[#E4EBF1]">
          <div className="pointer-events-none absolute inset-x-0 top-0 border-t border-dashed border-[#EDF2F7]" />
          <div className="pointer-events-none absolute inset-x-0 top-1/2 border-t border-dashed border-[#EDF2F7]" />
          {jours.map((j) => (
            <div key={j.jour} className="group relative flex h-full flex-1 flex-col justify-end">
              <div
                className={`w-full rounded-t-[4px] transition-colors ${j.actifs ? "bg-[#57D4F5] group-hover:bg-[#1176A8]" : "bg-[#EEF4F9]"}`}
                style={{ height: j.actifs ? `${Math.max(3, (j.actifs / max) * 100)}%` : 3 }}
              />
              {j.inscriptions > 0 && <span className="absolute -top-[10px] left-1/2 h-[7px] w-[7px] -translate-x-1/2 rounded-full bg-[#FF8A75]" />}
              <div className="pointer-events-none absolute bottom-full left-1/2 z-10 mb-[14px] hidden -translate-x-1/2 whitespace-nowrap rounded-[10px] bg-[#0F3D70] px-[10px] py-[6px] text-[11.5px] text-white shadow-lg group-hover:block">
                <b>{new Date(j.jour).toLocaleDateString("fr-FR", { weekday: "short", day: "numeric", month: "short" })}</b>
                <br />
                {j.actifs} actif{j.actifs > 1 ? "s" : ""} · {j.inscriptions} inscription{j.inscriptions > 1 ? "s" : ""}
              </div>
            </div>
          ))}
        </div>
      </div>
      <div className="ml-[30px] mt-[8px] flex justify-between text-[11px] text-[#9DB0C0]">
        {jours
          .filter((_, i) => i % 7 === 0 || i === jours.length - 1)
          .map((j, i, t) => (
            <span key={j.jour}>{i === t.length - 1 ? "aujourd'hui" : new Date(j.jour).toLocaleDateString("fr-FR", { day: "numeric", month: "short" })}</span>
          ))}
      </div>
    </div>
  );
}

function CarteRetour({ r, onChange, compact }: { r: Retour; onChange: (id: string, statut: Retour["statut"]) => void; compact?: boolean }) {
  return (
    <div className={`flex flex-col rounded-[16px] border bg-white p-[16px] ${r.statut === "nouveau" ? "border-[#B8E4D8]" : "border-[#E4EBF1] opacity-70"}`}>
      <div className="flex flex-wrap items-center gap-[8px]">
        {r.raison && <span className="rounded-full bg-[#0F3D70] px-[10px] py-[3px] text-[11.5px] font-semibold text-white">{r.raison}</span>}
        <span className="text-[12px] text-[#9DB0C0]">{ilYa(r.created_at)}</span>
        {!compact && <span className="text-[12px] text-[#9DB0C0]">· {[r.appareil, r.systeme, r.version && `v${r.version}`].filter(Boolean).join(" · ")}</span>}
      </div>
      <p className={`whitespace-pre-wrap pt-[8px] text-[14px] leading-normal ${compact ? "line-clamp-3" : ""}`}>{r.message}</p>
      {!compact && (
        <div className="mt-auto flex flex-wrap items-center justify-between gap-[10px] pt-[12px]">
          {r.email ? (
            <a href={`mailto:${r.email}?subject=${encodeURIComponent("Ton retour sur Palanote")}`} className="flex items-center gap-[6px] text-[13px] font-semibold text-[#1176A8] hover:underline">
              <Mail className="h-[15px] w-[15px]" /> {r.email}
            </a>
          ) : (
            <span className="text-[12.5px] text-[#9DB0C0]">Pas d'adresse jointe</span>
          )}
          <button
            type="button"
            onClick={() => onChange(r.id, r.statut === "nouveau" ? "traite" : "nouveau")}
            className={`h-[34px] rounded-[10px] px-[14px] text-[12.5px] font-bold transition ${
              r.statut === "nouveau" ? "bg-[#3DEFBE] text-[#0B3B63] hover:bg-[#2BD3A5]" : "bg-[#EEF4F9] text-[#5B7189] hover:bg-[#E3EDF6]"
            }`}
          >
            {r.statut === "nouveau" ? "Marquer traité" : "Rouvrir"}
          </button>
        </div>
      )}
    </div>
  );
}

function SectionRetours({ retours, onChange }: { retours: Retour[]; onChange: (id: string, statut: Retour["statut"]) => void }) {
  const [filtre, setFiltre] = useState<"nouveau" | "tous">("nouveau");
  const visibles = filtre === "tous" ? retours : retours.filter((r) => r.statut === "nouveau");
  return (
    <>
      <div className="flex gap-[6px]">
        {(
          [
            ["nouveau", `À traiter (${retours.filter((r) => r.statut === "nouveau").length})`],
            ["tous", `Tous (${retours.length})`],
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            type="button"
            onClick={() => setFiltre(id)}
            className={`h-[34px] rounded-full border px-[14px] text-[13px] font-semibold ${filtre === id ? "border-[#0F3D70] bg-[#0F3D70] text-white" : "border-[#D8E5EE] bg-white text-[#5B7189]"}`}
          >
            {label}
          </button>
        ))}
      </div>
      {visibles.length === 0 ? (
        <p className={`${carte} mt-[16px] py-[40px] text-center text-[14px] text-[#9DB0C0]`}>Aucun retour à traiter.</p>
      ) : (
        <div className="mt-[16px] grid gap-[14px] md:grid-cols-2 2xl:grid-cols-3">
          {visibles.map((r) => (
            <CarteRetour key={r.id} r={r} onChange={onChange} />
          ))}
        </div>
      )}
    </>
  );
}

function SectionErreurs({ erreurs, onEffacer }: { erreurs: ErreurApp[]; onEffacer: (message: string) => void }) {
  const [ouverte, setOuverte] = useState<string | null>(null);
  const groupes = useMemo(() => grouperErreurs(erreurs), [erreurs]);
  if (groupes.length === 0) return <p className={`${carte} py-[40px] text-center text-[14px] text-[#9DB0C0]`}>Aucune erreur remontée.</p>;
  return (
    <div className={`${carte} overflow-x-auto`}>
      <table className="w-full min-w-[760px] text-left text-[13px]">
        <thead className="border-b border-[#EDF2F7] text-[11.5px] uppercase tracking-[.05em] text-[#7D93A8]">
          <tr>
            <th className="w-[64px] px-[16px] py-[12px] font-semibold">Nb</th>
            <th className="px-[8px] py-[12px] font-semibold">Erreur</th>
            <th className="px-[8px] py-[12px] font-semibold">Pages</th>
            <th className="px-[8px] py-[12px] font-semibold">Personnes</th>
            <th className="px-[8px] py-[12px] font-semibold">Appareil</th>
            <th className="px-[8px] py-[12px] font-semibold">Dernière fois</th>
            <th className="w-[120px] px-[16px] py-[12px]" />
          </tr>
        </thead>
        <tbody>
          {groupes.map((g) => {
            const derniere = g.liste[0]!;
            const ouvert = ouverte === g.message;
            return (
              <Fragment key={g.message}>
                <tr className="border-t border-[#EDF2F7] align-top hover:bg-[#F8FBFD]">
                  <td className="px-[16px] py-[12px]">
                    <span className="inline-flex h-[26px] min-w-[26px] items-center justify-center rounded-full bg-[#FFE4DE] px-[7px] text-[12px] font-bold text-[#B23A26]">{g.liste.length}</span>
                  </td>
                  <td className="max-w-[420px] px-[8px] py-[12px]">
                    <button type="button" onClick={() => setOuverte(ouvert ? null : g.message)} className="flex items-start gap-[6px] text-left font-semibold hover:text-[#1176A8]">
                      <ChevronDown className={`mt-[2px] h-[14px] w-[14px] shrink-0 transition ${ouvert ? "rotate-180" : ""}`} />
                      <span className="break-words">{g.message}</span>
                    </button>
                  </td>
                  <td className="px-[8px] py-[12px] text-[#5B7189]">{g.pages.join(", ") || "—"}</td>
                  <td className="px-[8px] py-[12px] text-[#5B7189]">{g.personnes}</td>
                  <td className="px-[8px] py-[12px] text-[#5B7189]">{[derniere.appareil, derniere.systeme].filter(Boolean).join(" · ") || "—"}</td>
                  <td className="whitespace-nowrap px-[8px] py-[12px] text-[#5B7189]">{ilYa(derniere.created_at)}</td>
                  <td className="px-[16px] py-[12px] text-right">
                    <button type="button" onClick={() => onEffacer(g.message)} className="inline-flex items-center gap-[5px] rounded-[10px] px-[10px] py-[6px] text-[12.5px] font-semibold text-[#C94957] hover:bg-[#FFF1EE]">
                      <Trash2 className="h-[14px] w-[14px]" /> Effacer
                    </button>
                  </td>
                </tr>
                {ouvert && (
                  <tr>
                    <td />
                    <td colSpan={6} className="px-[8px] pb-[14px] pr-[16px]">
                      <pre className="max-h-[300px] overflow-auto whitespace-pre-wrap break-words rounded-[12px] bg-[#F1F6FC] p-[12px] text-[11.5px] leading-snug text-[#3F5B76]">
                        {derniere.details || "Pas de détail technique."}
                      </pre>
                    </td>
                  </tr>
                )}
              </Fragment>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function SectionUtilisateurs({ utilisateurs }: { utilisateurs: UtilisateurAdmin[] }) {
  const [recherche, setRecherche] = useState("");
  const q = recherche.trim().toLowerCase();
  const liste = q ? utilisateurs.filter((u) => `${u.prenom} ${u.email}`.toLowerCase().includes(q)) : utilisateurs;
  return (
    <>
      <label className="flex h-[42px] max-w-[360px] items-center gap-[8px] rounded-[12px] border border-[#DCE7F0] bg-white px-[12px]">
        <Search className="h-[16px] w-[16px] text-[#9DB0C0]" />
        <input value={recherche} onChange={(e) => setRecherche(e.target.value)} placeholder="Rechercher un prénom ou un e-mail" className="flex-1 bg-transparent text-[13.5px] outline-none" />
      </label>
      <div className={`${carte} mt-[14px] overflow-x-auto`}>
        <table className="w-full min-w-[720px] text-left text-[13px]">
          <thead className="border-b border-[#EDF2F7] text-[11.5px] uppercase tracking-[.05em] text-[#7D93A8]">
            <tr>
              <th className="px-[16px] py-[12px] font-semibold">Plongeur</th>
              <th className="px-[8px] py-[12px] font-semibold">E-mail</th>
              <th className="px-[8px] py-[12px] font-semibold">Inscrit</th>
              <th className="px-[8px] py-[12px] font-semibold">Dernière visite</th>
              <th className="px-[8px] py-[12px] font-semibold">Appareil</th>
              <th className="px-[16px] py-[12px] text-right font-semibold">Plongées</th>
            </tr>
          </thead>
          <tbody>
            {liste.map((u) => (
              <tr key={u.id} className="border-t border-[#EDF2F7] hover:bg-[#F8FBFD]">
                <td className="px-[16px] py-[11px]">
                  <span className="flex items-center gap-[9px] font-bold">
                    <span className={`h-[9px] w-[9px] shrink-0 rounded-full ${enLigne(u.derniere_visite) ? "bg-[#14B88A]" : "bg-[#D5DFE8]"}`} title={enLigne(u.derniere_visite) ? "en ligne" : undefined} />
                    {u.prenom || "—"}
                  </span>
                </td>
                <td className="px-[8px] py-[11px] text-[#5B7189]">{u.email}</td>
                <td className="whitespace-nowrap px-[8px] py-[11px] text-[#5B7189]">{dateCourte(u.inscrit_le)}</td>
                <td className="whitespace-nowrap px-[8px] py-[11px] text-[#5B7189]">{ilYa(u.derniere_visite)}</td>
                <td className="px-[8px] py-[11px] text-[#5B7189]">{u.appareil || "—"}</td>
                <td className="px-[16px] py-[11px] text-right font-semibold">{u.plongees}</td>
              </tr>
            ))}
            {liste.length === 0 && (
              <tr>
                <td colSpan={6} className="py-[30px] text-center text-[#9DB0C0]">
                  Personne ne correspond.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </>
  );
}

function Apercu({ d, aller, onRetour }: { d: Donnees; aller: (s: Section) => void; onRetour: (id: string, statut: Retour["statut"]) => void }) {
  const s = d.stats;
  const nouveaux = d.retours.filter((r) => r.statut === "nouveau");
  const groupes = grouperErreurs(d.erreurs).slice(0, 4);
  return (
    <>
      <div className="grid grid-cols-2 gap-[14px] xl:grid-cols-4">
        <Tuile valeur={s.connectes} label="Connectés" detail="en ce moment" accent />
        <Tuile valeur={s.actifs_jour} label="Actifs aujourd'hui" detail={`${s.actifs_7j} sur 7 j · ${s.actifs_30j} sur 30 j`} />
        <Tuile valeur={s.comptes} label="Comptes" detail={s.comptes_7j ? `+${s.comptes_7j} cette semaine` : undefined} />
        <Tuile valeur={s.plongees} label="Plongées" detail={s.plongees_7j ? `+${s.plongees_7j} cette semaine` : undefined} />
        <Tuile valeur={s.pages_numerisees} label="Pages numérisées" detail={s.pages_30j ? `${s.pages_30j} sur 30 jours` : undefined} />
        <Tuile valeur={s.photos} label="Photos de plongée" />
        <Tuile valeur={s.binomes} label="Paires de binômes" />
        <Tuile valeur={s.erreurs_24h} label="Erreurs sur 24 h" />
      </div>

      <div className="mt-[14px] grid grid-cols-1 items-start gap-[14px] xl:grid-cols-[minmax(0,1fr)_380px]">
        <GraphiqueActivite jours={s.par_jour} />
        <div className="flex flex-col gap-[14px]">
          <div className={`${carte} p-[16px]`}>
            <div className="flex items-center justify-between">
              <h2 className="text-[14.5px] font-bold">Retours à traiter</h2>
              <button type="button" onClick={() => aller("retours")} className="text-[12.5px] font-semibold text-[#1176A8] hover:underline">
                Tout voir
              </button>
            </div>
            <div className="mt-[10px] flex flex-col gap-[8px]">
              {nouveaux.length === 0 && <p className="py-[10px] text-[13px] text-[#9DB0C0]">Rien à traiter.</p>}
              {nouveaux.slice(0, 2).map((r) => (
                <CarteRetour key={r.id} r={r} onChange={onRetour} compact />
              ))}
            </div>
          </div>
          <div className={`${carte} p-[16px]`}>
            <div className="flex items-center justify-between">
              <h2 className="text-[14.5px] font-bold">Erreurs récentes</h2>
              <button type="button" onClick={() => aller("erreurs")} className="text-[12.5px] font-semibold text-[#1176A8] hover:underline">
                Tout voir
              </button>
            </div>
            <div className="mt-[8px] flex flex-col">
              {groupes.length === 0 && <p className="py-[10px] text-[13px] text-[#9DB0C0]">Aucune erreur.</p>}
              {groupes.map((g) => (
                <div key={g.message} className="flex items-start gap-[10px] border-t border-[#EDF2F7] py-[9px] first:border-t-0">
                  <span className="mt-[1px] inline-flex h-[22px] min-w-[22px] items-center justify-center rounded-full bg-[#FFE4DE] px-[6px] text-[11px] font-bold text-[#B23A26]">{g.liste.length}</span>
                  <div className="min-w-0">
                    <p className="truncate text-[13px] font-semibold">{g.message}</p>
                    <p className="text-[11.5px] text-[#9DB0C0]">{ilYa(g.liste[0]!.created_at)} · {g.pages[0] ?? "—"}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

// ---------- Page ----------

function TableauDeBord() {
  const navigate = useNavigate();
  const [acces, setAcces] = useState<boolean | null>(null);
  const [donnees, setDonnees] = useState<Donnees | null>(null);
  const [section, setSection] = useState<Section>("apercu");
  const [chargement, setChargement] = useState(false);
  const [majLe, setMajLe] = useState<Date | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);

  const charger = useCallback(async () => {
    setChargement(true);
    setErreur(null);
    try {
      setDonnees(await chargerTableauDeBord());
      setMajLe(new Date());
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

  useEffect(() => {
    if (!acces) return;
    const t = setInterval(() => void charger(), 60_000);
    return () => clearInterval(t);
  }, [acces, charger]);

  const changerRetour = (id: string, statut: Retour["statut"]) => {
    setDonnees((d) => d && { ...d, retours: d.retours.map((r) => (r.id === id ? { ...r, statut } : r)) });
    void marquerRetour(id, statut).catch((e) => console.error("Retour non mis à jour", e));
  };
  const effacer = (message: string) => {
    setDonnees((d) => d && { ...d, erreurs: d.erreurs.filter((e) => e.message !== message) });
    void effacerErreurs(message).catch(() => undefined);
  };

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

  const nbRetours = donnees?.retours.filter((r) => r.statut === "nouveau").length ?? 0;
  const nbErreurs = donnees ? grouperErreurs(donnees.erreurs).length : 0;
  const sections: { id: Section; label: string; icone: typeof Users; badge?: number | undefined }[] = [
    { id: "apercu", label: "Vue d'ensemble", icone: LayoutDashboard },
    { id: "retours", label: "Retours", icone: MessageCircle, badge: nbRetours },
    { id: "erreurs", label: "Erreurs", icone: AlertTriangle, badge: nbErreurs },
    { id: "utilisateurs", label: "Utilisateurs", icone: Users, badge: donnees?.utilisateurs.length },
  ];
  const titre = sections.find((s) => s.id === section)!.label;

  return (
    <div className="min-h-screen bg-[#F1F6FC] text-[#123A63] lg:flex">
      {/* Barre latérale (ordinateur) / bandeau (téléphone) */}
      <aside className="bg-[#0F3D70] text-white lg:sticky lg:top-0 lg:flex lg:h-screen lg:w-[248px] lg:shrink-0 lg:flex-col">
        <div className="flex items-center gap-[10px] px-[20px] py-[16px] lg:py-[24px]">
          <img src={logoCorail} alt="" className="h-[30px] w-auto" />
          <div>
            <div className="text-[16px] font-bold leading-tight">Palanote</div>
            <div className="text-[11.5px] text-white/60">Tableau de bord</div>
          </div>
        </div>
        <nav className="flex gap-[4px] overflow-x-auto px-[12px] pb-[12px] lg:flex-col lg:pb-0">
          {sections.map(({ id, label, icone: Icone, badge }) => (
            <button
              key={id}
              type="button"
              onClick={() => setSection(id)}
              className={`flex h-[42px] shrink-0 items-center gap-[10px] rounded-[12px] px-[12px] text-[13.5px] font-semibold transition ${
                section === id ? "bg-white/15 text-white" : "text-white/70 hover:bg-white/10 hover:text-white"
              }`}
            >
              <Icone className="h-[17px] w-[17px]" strokeWidth={2} />
              <span className="whitespace-nowrap lg:flex-1 lg:text-left">{label}</span>
              {badge ? (
                <span className={`rounded-full px-[7px] py-[1px] text-[11px] font-bold ${id === "retours" ? "bg-[#3DEFBE] text-[#0B3B63]" : id === "erreurs" ? "bg-[#FF8A75] text-white" : "bg-white/15"}`}>
                  {badge}
                </span>
              ) : null}
            </button>
          ))}
        </nav>
        <div className="hidden flex-1 lg:block" />
        <button
          type="button"
          onClick={() => navigate({ to: "/moi" })}
          className="m-[12px] hidden h-[42px] items-center gap-[10px] rounded-[12px] px-[12px] text-[13px] font-semibold text-white/70 hover:bg-white/10 hover:text-white lg:flex"
        >
          <ArrowLeft className="h-[16px] w-[16px]" /> Retour à l'app
        </button>
      </aside>

      <main className="min-w-0 flex-1 px-[20px] pb-[40px] pt-[22px] lg:px-[36px] lg:pt-[30px]">
        <div className="mx-auto max-w-[1320px]">
          <div className="flex flex-wrap items-center gap-[12px]">
            <h1 className="flex-1 text-[26px] font-bold">{titre}</h1>
            {majLe && <span className="text-[12.5px] text-[#9DB0C0]">Mis à jour à {majLe.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}</span>}
            <button
              type="button"
              onClick={() => void charger()}
              className="flex h-[38px] items-center gap-[8px] rounded-[12px] border border-[#DCE7F0] bg-white px-[14px] text-[13px] font-semibold hover:bg-[#F8FBFD]"
            >
              <RefreshCw className={`h-[15px] w-[15px] ${chargement ? "animate-spin" : ""}`} strokeWidth={2.2} /> Actualiser
            </button>
          </div>

          {erreur && <p className="mt-[16px] rounded-[14px] bg-[#FFE4DE] p-[12px] text-[13.5px] text-[#8A2A1A]">{erreur}</p>}
          {!donnees && !erreur && <p className="pt-[40px] text-center text-[14px] text-[#9DB0C0]">Chargement…</p>}

          {donnees && (
            <div className="mt-[22px]">
              {section === "apercu" && <Apercu d={donnees} aller={setSection} onRetour={changerRetour} />}
              {section === "retours" && <SectionRetours retours={donnees.retours} onChange={changerRetour} />}
              {section === "erreurs" && <SectionErreurs erreurs={donnees.erreurs} onEffacer={effacer} />}
              {section === "utilisateurs" && <SectionUtilisateurs utilisateurs={donnees.utilisateurs} />}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
