import { SectionAgent } from "@/components/admin/BancAgent";
import { Fragment, useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { ArrowLeft, ArrowUpRight, ChevronDown, Mail, RefreshCw, Search, Trash2 } from "lucide-react";
import logoCorail from "@/assets/palanote-logo-cigle.png";
import { Arc, Bloc, carte, GrandNombre, nombre, Voyant, type Couleur } from "@/components/admin/Bento";
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
import { supabase } from "@/lib/supabase";
import { SectionFinances } from "@/components/admin/Finances";
import { SectionLettre } from "@/components/admin/Lettre";
import { AVANT_MISE_EN_LIGNE } from "@/lib/legal";

// Tableau de bord du développeur : clair, en blocs (bento), pensé pour l'ordinateur.
// Des voyants de couleur signalent ce qui demande de l'attention.
// Réservé aux comptes de la table app_admins.
export const Route = createFileRoute("/admin")({
  head: () => ({ meta: [{ title: "Palanote — Tableau de bord" }, { name: "robots", content: "noindex" }] }),
  component: TableauDeBord,
});

type Section = "apercu" | "agent" | "finances" | "lettre" | "retours" | "erreurs" | "utilisateurs";
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



function CarteRetour({ r, onChange, compact }: { r: Retour; onChange: (id: string, statut: Retour["statut"]) => void; compact?: boolean }) {
  return (
    <div className={`flex flex-col rounded-[16px] border bg-white p-[16px] ${r.statut === "nouveau" ? "border-[#B8E4D8]" : "border-[#E4EBF1] opacity-70"}`}>
      <div className="flex flex-wrap items-center gap-[8px]">
        {r.raison && <span className="rounded-full bg-[#0F3D70] px-[10px] py-[3px] text-[11.5px] font-semibold text-white">{r.raison}</span>}
        <span className="text-[12px] text-[#566B82]">{ilYa(r.created_at)}</span>
        {!compact && <span className="text-[12px] text-[#566B82]">· {[r.appareil, r.systeme, r.version && `v${r.version}`].filter(Boolean).join(" · ")}</span>}
      </div>
      <p className={`whitespace-pre-wrap pt-[8px] text-[14px] leading-normal ${compact ? "line-clamp-3" : ""}`}>{r.message}</p>
      {!compact && (
        <div className="mt-auto flex flex-wrap items-center justify-between gap-[10px] pt-[12px]">
          {r.email ? (
            <a href={`mailto:${r.email}?subject=${encodeURIComponent("Ton retour sur Palanote")}`} className="flex items-center gap-[6px] text-[13px] font-semibold text-[#106F9F] hover:underline">
              <Mail className="h-[15px] w-[15px]" /> {r.email}
            </a>
          ) : (
            <span className="text-[12.5px] text-[#566B82]">Pas d'adresse jointe</span>
          )}
          <button
            type="button"
            onClick={() => onChange(r.id, r.statut === "nouveau" ? "traite" : "nouveau")}
            className={`h-[34px] rounded-[10px] px-[14px] text-[12.5px] font-bold transition ${
              r.statut === "nouveau" ? "bg-[#3DEFBE] text-[#0B3B63] hover:bg-[#2BD3A5]" : "bg-[#EEF4F9] text-[#566B82] hover:bg-[#E3EDF6]"
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
            className={`h-[34px] rounded-full border px-[14px] text-[13px] font-semibold ${filtre === id ? "border-[#0F3D70] bg-[#0F3D70] text-white" : "border-[#D8E5EE] bg-white text-[#566B82]"}`}
          >
            {label}
          </button>
        ))}
      </div>
      {visibles.length === 0 ? (
        <p className={`${carte} mt-[16px] py-[40px] text-center text-[14px] text-[#566B82]`}>Aucun retour à traiter.</p>
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
  if (groupes.length === 0) return <p className={`${carte} py-[40px] text-center text-[14px] text-[#566B82]`}>Aucune erreur remontée.</p>;
  return (
    <div className={`${carte} overflow-x-auto`}>
      <table className="w-full min-w-[760px] text-left text-[13px]">
        <thead className="border-b border-[#EDF2F7] text-[11.5px] uppercase tracking-[.05em] text-[#566B82]">
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
                    <button type="button" onClick={() => setOuverte(ouvert ? null : g.message)} className="flex items-start gap-[6px] text-left font-semibold hover:text-[#106F9F]">
                      <ChevronDown className={`mt-[2px] h-[14px] w-[14px] shrink-0 transition ${ouvert ? "rotate-180" : ""}`} />
                      <span className="break-words">{g.message}</span>
                    </button>
                  </td>
                  <td className="px-[8px] py-[12px] text-[#566B82]">{g.pages.join(", ") || "—"}</td>
                  <td className="px-[8px] py-[12px] text-[#566B82]">{g.personnes}</td>
                  <td className="px-[8px] py-[12px] text-[#566B82]">{[derniere.appareil, derniere.systeme].filter(Boolean).join(" · ") || "—"}</td>
                  <td className="whitespace-nowrap px-[8px] py-[12px] text-[#566B82]">{ilYa(derniere.created_at)}</td>
                  <td className="px-[16px] py-[12px] text-right">
                    <button type="button" onClick={() => onEffacer(g.message)} className="inline-flex items-center gap-[5px] rounded-[10px] px-[10px] py-[6px] text-[12.5px] font-semibold text-[#B8432F] hover:bg-[#FFF1EE]">
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
        <Search className="h-[16px] w-[16px] text-[#566B82]" />
        <input value={recherche} onChange={(e) => setRecherche(e.target.value)} placeholder="Rechercher un prénom ou un e-mail" className="flex-1 bg-transparent text-[13.5px] outline-none" />
      </label>
      <div className={`${carte} mt-[14px] overflow-x-auto`}>
        <table className="w-full min-w-[720px] text-left text-[13px]">
          <thead className="border-b border-[#EDF2F7] text-[11.5px] uppercase tracking-[.05em] text-[#566B82]">
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
                <td className="px-[8px] py-[11px] text-[#566B82]">{u.email}</td>
                <td className="whitespace-nowrap px-[8px] py-[11px] text-[#566B82]">{dateCourte(u.inscrit_le)}</td>
                <td className="whitespace-nowrap px-[8px] py-[11px] text-[#566B82]">{ilYa(u.derniere_visite)}</td>
                <td className="px-[8px] py-[11px] text-[#566B82]">{u.appareil || "—"}</td>
                <td className="px-[16px] py-[11px] text-right font-semibold">{u.plongees}</td>
              </tr>
            ))}
            {liste.length === 0 && (
              <tr>
                <td colSpan={6} className="py-[30px] text-center text-[#566B82]">
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

function Activite({ jours }: { jours: StatsAdmin["par_jour"] }) {
  const max = Math.max(1, ...jours.map((j) => j.actifs));
  const total = jours.reduce((t, j) => t + j.inscriptions, 0);
  return (
    <>
      <div className="mt-[14px] flex items-baseline gap-[18px] text-white">
        <span>
          <span className="text-[44px] font-light leading-none tracking-[-0.02em]">{jours.at(-1)?.actifs ?? 0}</span>
          <span className="pl-[8px] text-[13px] text-white/75">actifs aujourd'hui</span>
        </span>
        <span className="text-[13px] text-white/75">
          {total} inscription{total > 1 ? "s" : ""} sur 30 jours
        </span>
      </div>
      <div className="mt-auto flex h-[150px] items-end gap-[5px] pt-[20px]">
        {jours.map((j) => (
          <div key={j.jour} className="group relative flex h-full flex-1 flex-col items-center justify-end">
            {j.inscriptions > 0 && <span className="mb-[6px] h-[5px] w-[5px] rounded-full bg-white" />}
            <div
              className="w-full rounded-full bg-white/45 transition-colors group-hover:bg-white"
              style={{ height: j.actifs ? `${Math.max(4, (j.actifs / max) * 100)}%` : 3 }}
            />
            <div className="pointer-events-none absolute bottom-full left-1/2 z-10 mb-[8px] hidden -translate-x-1/2 whitespace-nowrap rounded-[10px] bg-white px-[10px] py-[6px] text-[11.5px] text-[#123A63] shadow-[0_6px_18px_rgba(15,61,112,.18)] group-hover:block">
              <b>{new Date(j.jour).toLocaleDateString("fr-FR", { weekday: "short", day: "numeric", month: "short" })}</b> · {j.actifs} actif{j.actifs > 1 ? "s" : ""}
              {j.inscriptions ? ` · ${j.inscriptions} inscription${j.inscriptions > 1 ? "s" : ""}` : ""}
            </div>
          </div>
        ))}
      </div>
      <div className="mt-[8px] flex justify-between text-[11px] text-white/70">
        <span>il y a 30 jours</span>
        <span className="flex items-center gap-[6px]">
          <span className="h-[5px] w-[5px] rounded-full bg-white" /> jour avec inscription
        </span>
        <span>aujourd'hui</span>
      </div>
    </>
  );
}

function Apercu({ d, aller }: { d: Donnees; aller: (s: Section) => void }) {
  const s = d.stats;
  const nouveaux = d.retours.filter((r) => r.statut === "nouveau");
  const groupes = grouperErreurs(d.erreurs);
  const erreursCouleur: Couleur = s.erreurs_24h > 5 ? "rouge" : s.erreurs_24h > 0 ? "orange" : "vert";
  const derniereErreur = groupes[0];
  const dernierRetour = nouveaux[0];
  return (
    <div className="grid grid-cols-1 gap-[12px] md:grid-cols-2 xl:grid-cols-4">
      {/* Activité : grand bloc */}
      <Bloc titre="Activité, 30 derniers jours" fond="bg-[linear-gradient(150deg,#7FC7DD_0%,#4E9CC0_55%,#3B7FA8_100%)]" sombre className="md:col-span-2 xl:row-span-2">
        <Activite jours={s.par_jour} />
      </Bloc>

      <Bloc titre="Connectés" voyant={s.connectes > 0 ? "vert" : "gris"} fond="bg-[linear-gradient(160deg,#F2FBF7_0%,#D3F4E7_100%)]" onOuvrir={() => aller("utilisateurs")}>
        <GrandNombre valeur={nombre(s.connectes)} unite="en ce moment" />
        <p className="pt-[6px] text-[12.5px] text-[#566B82]">
          {s.actifs_7j} actifs sur 7 jours · {s.actifs_30j} sur 30
        </p>
      </Bloc>

      <Bloc
        titre="Retours à traiter"
        voyant={nouveaux.length ? "orange" : "vert"}
        fond="bg-[linear-gradient(160deg,#FFF6F2_0%,#FFDCCF_100%)]"
        onOuvrir={() => aller("retours")}
      >
        <GrandNombre valeur={nombre(nouveaux.length)} unite={nouveaux.length > 1 ? "messages" : "message"} />
        <p className="line-clamp-2 pt-[6px] text-[12.5px] text-[#566B82]">{dernierRetour ? `« ${dernierRetour.message} »` : "Rien en attente."}</p>
      </Bloc>

      <Bloc titre="Erreurs sur 24 h" voyant={erreursCouleur} fond="bg-[linear-gradient(160deg,#FBF9F4_0%,#F1E7D3_100%)]" onOuvrir={() => aller("erreurs")}>
        <GrandNombre valeur={nombre(s.erreurs_24h)} unite={s.erreurs_24h ? "à regarder" : "tout va bien"} />
        <p className="truncate pt-[6px] text-[12.5px] text-[#566B82]">{derniereErreur ? derniereErreur.message : "Aucune erreur remontée."}</p>
      </Bloc>

      <Bloc titre="Pages numérisées" fond="bg-[linear-gradient(160deg,#F7F5FD_0%,#E1DAF7_100%)]">
        <div className="absolute bottom-[56px] right-[18px] text-[#6E59C9]">
          <Arc part={s.pages_numerisees ? (s.pages_30j ?? 0) / s.pages_numerisees : 0} couleur="#7C67D6" />
        </div>
        <GrandNombre valeur={nombre(s.pages_numerisees)} />
        <p className="pt-[6px] text-[12.5px] text-[#566B82]">{nombre(s.pages_30j)} ce mois-ci : c'est ce qui coûte en IA</p>
      </Bloc>

      <Bloc titre="Cette semaine" fond="bg-white border border-[#E9EEF3]" className="md:col-span-2">
        <div className="mt-auto flex flex-wrap items-end gap-x-[40px] gap-y-[14px] text-[#0F2A4A]">
          {[
            { v: s.comptes_7j, l: "nouveaux comptes" },
            { v: s.plongees_7j, l: "plongées enregistrées" },
            { v: s.actifs_7j, l: "plongeurs actifs", sansPlus: true },
          ].map((k) => (
            <span key={k.l}>
              <span className="block text-[44px] font-light leading-none tracking-[-0.02em]">
                {k.v && !("sansPlus" in k) ? "+" : ""}
                {nombre(k.v)}
              </span>
              <span className="text-[12.5px] text-[#566B82]">{k.l}</span>
            </span>
          ))}
        </div>
      </Bloc>

      <Bloc titre="Binômes et photos" fond="bg-white border border-[#E9EEF3]">
        <div className="mt-auto flex items-end gap-[26px] text-[#0F2A4A]">
          <span>
            <span className="block text-[44px] font-light leading-none tracking-[-0.02em]">{nombre(s.binomes)}</span>
            <span className="text-[12.5px] text-[#566B82]">paires de binômes</span>
          </span>
          <span>
            <span className="block text-[44px] font-light leading-none tracking-[-0.02em]">{nombre(s.photos)}</span>
            <span className="text-[12.5px] text-[#566B82]">photos</span>
          </span>
        </div>
      </Bloc>

      {AVANT_MISE_EN_LIGNE.some((t) => !t.fait) && (
        <Bloc titre="Avant la mise en ligne" voyant="orange" fond="bg-[linear-gradient(160deg,#FFFBEF_0%,#FCEBC2_100%)]" className="md:col-span-2">
          <ul className="mt-[10px] flex flex-col gap-[7px] text-[13px] text-[#123A63]">
            {AVANT_MISE_EN_LIGNE.map((t) => (
              <li key={t.tache} className={`flex items-start gap-[9px] ${t.fait ? "text-[#123A63]/40 line-through" : ""}`}>
                <span className="pt-[5px]"><Voyant couleur={t.fait ? "vert" : "orange"} /></span>
                <span>{t.tache}</span>
              </li>
            ))}
          </ul>
          <p className="pt-[10px] text-[12px] text-[#566B82]">La liste complète : docs/mise-en-ligne.md</p>
        </Bloc>
      )}

      <Bloc titre="Derniers inscrits" fond="bg-white border border-[#E9EEF3]" onOuvrir={() => aller("utilisateurs")}>
        <div className="mt-[12px] flex flex-col gap-[9px]">
          {[...d.utilisateurs]
            .sort((a, b) => b.inscrit_le.localeCompare(a.inscrit_le))
            .slice(0, 3)
            .map((u) => (
              <div key={u.id} className="flex items-center gap-[10px] text-[13px]">
                <Voyant couleur={enLigne(u.derniere_visite) ? "vert" : "gris"} />
                <span className="min-w-0 flex-1 truncate">{u.prenom || u.email}</span>
                <span className="shrink-0 text-[12px] text-[#566B82]">{ilYa(u.inscrit_le)}</span>
              </div>
            ))}
          {d.utilisateurs.length === 0 && <p className="text-[12.5px] text-[#566B82]">Personne pour l'instant.</p>}
        </div>
      </Bloc>
    </div>
  );
}

// ---------- Page ----------

function TableauDeBord() {
  const navigate = useNavigate();
  const [acces, setAcces] = useState<boolean | null>(null);
  const [donnees, setDonnees] = useState<Donnees | null>(null);
  const [section, setSection] = useState<Section>("apercu");
  // Un titre de page par onglet (WCAG 2.4.2) : le lecteur d'écran et l'onglet du navigateur disent où l'on est
  useEffect(() => {
    const noms: Record<Section, string> = { apercu: "Vue d'ensemble", agent: "Agent IA", retours: "Retours", erreurs: "Erreurs", utilisateurs: "Utilisateurs", finances: "Finances", lettre: "Lettre annuelle" };
    document.title = `Palanote — Admin · ${noms[section]}`;
  }, [section]);
  const [chargement, setChargement] = useState(false);
  const [majLe, setMajLe] = useState<Date | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);
  const [prenomAdmin, setPrenomAdmin] = useState("");
  useEffect(() => {
    void supabase.auth.getSession().then(({ data }) => setPrenomAdmin(String(data.session?.user.user_metadata?.["first_name"] ?? "")));
  }, []);

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
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-[#F6F8FA] px-8 text-center text-[#123A63]">
        <h1 className="text-[22px] font-bold">Page réservée</h1>
        <p className="text-[14px] text-[#566B82]">Cette page est réservée à l'auteur de l'app.</p>
        <button type="button" onClick={() => navigate({ to: "/carnet" })} className="text-[14px] font-bold text-[#106F9F] underline">
          Revenir à mon carnet
        </button>
      </div>
    );

  const s = donnees?.stats;
  const nbRetours = donnees?.retours.filter((r) => r.statut === "nouveau").length ?? 0;
  const nbErreurs = s?.erreurs_24h ?? 0;
  const sections: { id: Section; label: string; badge?: number | undefined; couleur?: Couleur }[] = [
    { id: "apercu", label: "Vue d'ensemble" },
    { id: "agent", label: "Agent IA" },
    { id: "retours", label: "Retours", badge: nbRetours, couleur: "orange" },
    { id: "erreurs", label: "Erreurs", badge: nbErreurs, couleur: nbErreurs > 5 ? "rouge" : "orange" },
    { id: "utilisateurs", label: "Utilisateurs" },
    { id: "finances", label: "Finances" },
    { id: "lettre", label: "Lettre annuelle" },
  ];

  // Les voyants : ce qui demande de l'attention, d'un coup d'œil.
  const voyants: { couleur: Couleur; texte: string; aller?: Section }[] = s
    ? [
        { couleur: s.connectes ? "vert" : "gris", texte: `${s.connectes} connecté${s.connectes > 1 ? "s" : ""} en ce moment`, aller: "utilisateurs" },
        nbRetours ? { couleur: "orange", texte: `${nbRetours} retour${nbRetours > 1 ? "s" : ""} à lire`, aller: "retours" } : { couleur: "vert", texte: "Aucun retour en attente" },
        nbErreurs
          ? { couleur: nbErreurs > 5 ? "rouge" : "orange", texte: `${nbErreurs} erreur${nbErreurs > 1 ? "s" : ""} sur 24 h`, aller: "erreurs" }
          : { couleur: "vert", texte: "Aucune erreur sur 24 h" },
        { couleur: s.comptes_7j ? "vert" : "gris", texte: s.comptes_7j ? `${s.comptes_7j} inscription${s.comptes_7j > 1 ? "s" : ""} cette semaine` : "Pas d'inscription cette semaine", aller: "utilisateurs" },
      ]
    : [];

  return (
    <div className="min-h-screen bg-[#F6F8FA] text-[#123A63]">
      {/* Barre du haut */}
      <header className="sticky top-0 z-20 border-b border-[#EDF1F5] bg-[#F6F8FA]/90 backdrop-blur">
        <div className="mx-auto flex max-w-[1360px] items-center gap-[16px] px-[20px] py-[12px] lg:px-[40px]">
          <span className="flex items-center gap-[9px]">
            <span className="flex h-[30px] w-[30px] items-center justify-center rounded-[9px] bg-[#0F3D70] p-[5px]">
              <img src={logoCorail} alt="" className="h-full w-auto" />
            </span>
            <span className="hidden text-[15px] font-semibold sm:inline">Palanote</span>
          </span>
          <nav className="mx-auto flex gap-[2px] overflow-x-auto">
            {sections.map(({ id, label, badge, couleur }) => (
              <button
                key={id}
                type="button"
                onClick={() => setSection(id)}
                className={`flex h-[36px] shrink-0 items-center gap-[7px] rounded-full px-[15px] text-[13px] transition ${
                  section === id ? "bg-[#0F2A4A] font-semibold text-white" : "text-[#123A63]/70 hover:bg-white"
                }`}
              >
                {badge && couleur ? <Voyant couleur={couleur} /> : null}
                {label}
                {badge ? <span className={section === id ? "text-white/70" : "text-[#123A63]/45"}>{badge}</span> : null}
              </button>
            ))}
          </nav>
          <button
            type="button"
            onClick={() => void charger()}
            aria-label="Actualiser"
            className="flex h-[36px] w-[36px] items-center justify-center rounded-full text-[#123A63]/70 hover:bg-white"
          >
            <RefreshCw className={`h-[16px] w-[16px] ${chargement ? "animate-spin" : ""}`} />
          </button>
          <button
            type="button"
            onClick={() => navigate({ to: "/moi" })}
            className="hidden h-[36px] items-center gap-[7px] rounded-full px-[12px] text-[13px] text-[#123A63]/70 hover:bg-white md:flex"
          >
            <ArrowLeft className="h-[15px] w-[15px]" /> L'app
          </button>
        </div>
      </header>

      <main data-contenu tabIndex={-1} className="mx-auto max-w-[1360px] outline-none px-[20px] pb-[48px] pt-[28px] lg:px-[40px] lg:pt-[40px]">
        {/* En-tête : titre, chiffres clés et voyants */}
        <div className="grid gap-[24px] lg:grid-cols-[minmax(0,1fr)_340px]">
          <div>
            <p className="text-[12.5px] text-[#566B82]">
              {majLe ? `Mis à jour à ${majLe.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })} · actualisation chaque minute` : "Chargement…"}
            </p>
            <h1 className="pt-[6px] text-[34px] font-normal tracking-[-0.02em] lg:text-[42px]">
              {section === "apercu" ? "Palanote, aujourd'hui" : sections.find((x) => x.id === section)!.label}
            </h1>
            {s && section === "apercu" && (
              <div className="flex flex-wrap gap-x-[40px] gap-y-[16px] pt-[24px]">
                {[
                  { label: "Comptes", valeur: s.comptes, pastille: true },
                  { label: "Actifs sur 7 jours", valeur: s.actifs_7j },
                  { label: "Plongées", valeur: s.plongees },
                  { label: "Pages lues par l'IA", valeur: s.pages_numerisees },
                ].map((k) => (
                  <div key={k.label}>
                    <span className={`inline-block rounded-full px-[8px] py-[2px] text-[11px] font-medium ${k.pastille ? "bg-[#FF8A75] text-[#0B3B63]" : "text-[#566B82]"}`}>{k.label}</span>
                    <div className="pt-[4px] text-[30px] font-light leading-none tracking-[-0.02em]">{nombre(k.valeur)}</div>
                  </div>
                ))}
              </div>
            )}
          </div>
          {s && (
            <div className={`${carte} self-start p-[8px]`}>
              {voyants.map((v) => (
                <button
                  key={v.texte}
                  type="button"
                  disabled={!v.aller}
                  onClick={() => v.aller && setSection(v.aller)}
                  className="flex w-full items-center gap-[12px] rounded-[14px] px-[12px] py-[10px] text-left text-[13px] enabled:hover:bg-[#F6F8FA]"
                >
                  <Voyant couleur={v.couleur} pulse={v.couleur === "orange" || v.couleur === "rouge"} />
                  <span className="flex-1">{v.texte}</span>
                  {v.aller && <ArrowUpRight className="h-[14px] w-[14px] text-[#566B82]" />}
                </button>
              ))}
            </div>
          )}
        </div>

        {erreur && <p className="mt-[20px] rounded-[16px] bg-[#FFECE8] p-[14px] text-[13.5px] text-[#8A2A1A]">{erreur}</p>}

        {donnees && (
          <div className="mt-[28px]">
            {section === "apercu" && <Apercu d={donnees} aller={setSection} />}
            {section === "agent" && <SectionAgent />}
            {section === "retours" && <SectionRetours retours={donnees.retours} onChange={changerRetour} />}
            {section === "erreurs" && <SectionErreurs erreurs={donnees.erreurs} onEffacer={effacer} />}
            {section === "utilisateurs" && <SectionUtilisateurs utilisateurs={donnees.utilisateurs} />}
            {section === "finances" && <SectionFinances stats={donnees.stats} />}
            {section === "lettre" && <SectionLettre prenomAdmin={prenomAdmin} />}
          </div>
        )}
      </main>
    </div>
  );
}
