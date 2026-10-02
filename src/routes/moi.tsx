import { useCallback, useEffect, useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { BarChart3, Camera, ChevronRight, Download, HelpCircle, Lock, MessageCircle, Pencil, SlidersHorizontal, Upload } from "lucide-react";
import logoCorail from "@/assets/palanote-logo-cigle.png";
import { BarreNavigation } from "@/components/BarreNavigation";
import { BandeauConfirmation } from "@/components/BandeauConfirmation";
import { Bloc, Ligne, TitreSection } from "@/components/moi/Ui";
import { libelleRole } from "@/lib/profil-plongeur";
import { initiales, mesBinomes } from "@/lib/amis";
import { estAdmin } from "@/lib/suivi";
import { effacerMessageAccueil, lireMessageAccueil } from "@/lib/message-accueil";
import { chargerProfil, exporterUDDF, type Profil } from "@/lib/moi";
import { chargerNumeroDepart, chargerPlongees, dureeEnMinutes, utilisateurConnecte, type CartePlongee } from "@/lib/plongees";

export const Route = createFileRoute("/moi")({
  head: () => ({ meta: [{ title: "Palanote — Moi" }, { name: "description", content: "Ton profil de plongeur, tes réglages et tes données." }] }),
  component: Moi,
});

type Stats = { plongees: string; heures: string; profondeur: string; sites: string; binomes: string; depuis: string };

function calculerStats(liste: CartePlongee[], depart: number, nbBinomes: number, premiereAnnee: string, profMaxAvant: string): Stats {
  const profondeurs = [...liste.map((p) => Number(p.profMax.replace(",", "."))), Number(profMaxAvant.replace(",", "."))].filter((n) => Number.isFinite(n) && n > 0);
  const minutes = liste.reduce((t, p) => t + (dureeEnMinutes(p.duree) ?? 0), 0);
  const sites = new Set(liste.map((p) => p.siteNom.trim().toLowerCase()).filter(Boolean));
  const annees = liste.map((p) => Number(p.date.slice(0, 4))).filter((a) => a > 1900);
  const depuis = premiereAnnee || (annees.length ? String(Math.min(...annees)) : "");
  return {
    plongees: String(depart + liste.length),
    heures: minutes === 0 ? "0 h" : minutes < 60 ? `${minutes} min` : `${Math.round(minutes / 60)} h`,
    profondeur: profondeurs.length ? `${String(Math.max(...profondeurs)).replace(".", ",")} m` : "—",
    sites: String(sites.size),
    binomes: String(nbBinomes),
    depuis: depuis || "—",
  };
}

function Moi() {
  const navigate = useNavigate();
  const [connecte, setConnecte] = useState<boolean | null>(null);
  const [profil, setProfil] = useState<Profil | null>(null);
  const [stats, setStats] = useState<Stats | null>(null);
  const [mesPlongees, setMesPlongees] = useState<CartePlongee[]>([]);
  const [admin, setAdmin] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);
  const [exportEnCours, setExportEnCours] = useState(false);
  const finMessage = useCallback(() => {
    effacerMessageAccueil();
    setMessage(null);
  }, []);

  useEffect(() => {
    setMessage(lireMessageAccueil());
    let actif = true;
    (async () => {
      const u = await utilisateurConnecte();
      if (!actif) return;
      setConnecte(Boolean(u));
      if (!u) return;
      const [p, liste, depart, binomes] = await Promise.all([
        chargerProfil(),
        chargerPlongees().catch(() => [] as CartePlongee[]),
        chargerNumeroDepart(u.id).catch(() => 0),
        mesBinomes().catch(() => []),
      ]);
      if (!actif) return;
      setProfil(p);
      setStats(calculerStats(liste, depart, binomes.length, p?.premiereAnnee ?? "", p?.profMaxAvant ?? ""));
      setMesPlongees(liste);
      void estAdmin().then((a) => actif && setAdmin(a));
    })();
    return () => {
      actif = false;
    };
  }, []);

  const exporter = async () => {
    setExportEnCours(true);
    setErreur(null);
    try {
      const n = await exporterUDDF(profil?.prenom ?? "");
      setMessage(n === 0 ? "Ton carnet est vide : le fichier ne contient aucune plongée" : `${n} plongée${n > 1 ? "s" : ""} exportée${n > 1 ? "s" : ""} au format UDDF`);
    } catch (e) {
      console.error(e);
      setErreur("L'export n'a pas abouti. Vérifie ta connexion et réessaie.");
    } finally {
      setExportEnCours(false);
    }
  };

  const tuiles: [string, keyof Stats][] = [
    ["plongées", "plongees"],
    ["sous l'eau", "heures"],
    ["profondeur", "profondeur"],
    ["sites", "sites"],
    ["binômes", "binomes"],
    ["depuis", "depuis"],
  ];

  return (
    <div className="flex h-screen flex-col overflow-hidden bg-[#F5F9FC] text-[#123A63] supports-[height:100dvh]:h-[100dvh]">
      {message && <BandeauConfirmation texte={message} onFin={finMessage} />}
      <div className="mx-auto flex min-h-0 w-full max-w-[430px] flex-1 flex-col overflow-y-auto">
        {/* Titre, comme sur les autres onglets */}
        <div className="flex shrink-0 items-center justify-between px-[22px] pt-[clamp(14px,2.6svh,22px)]">
          <h1 className="text-[clamp(24px,3.6svh,28px)] font-bold">Moi</h1>
          {connecte && (
            <button
              type="button"
              aria-label="Modifier mon profil"
              onClick={() => navigate({ to: "/moi/profil" })}
              className="flex h-[42px] w-[42px] items-center justify-center rounded-full bg-[#E3EDF6]"
            >
              <Pencil className="h-[17px] w-[17px] text-[#123A63]" strokeWidth={2.2} />
            </button>
          )}
        </div>

        <div className="px-[22px] pb-[24px]">
          {connecte === false && (
            <div className="flex flex-col items-center gap-4 pt-[10svh] text-center">
              <p className="text-[15px] text-[#5B7189]">Connecte-toi pour retrouver ton profil et tes réglages.</p>
              <button
                type="button"
                onClick={() => navigate({ to: "/connexion" })}
                className="flex h-[52px] w-full items-center justify-center galet-moyen bg-[#3DEFBE] text-[14px] font-bold text-[#0B3B63]"
              >
                ME CONNECTER
              </button>
            </div>
          )}

          {connecte && (
            <>
              {/* Mon profil */}
              <button
                type="button"
                onClick={() => navigate({ to: "/moi/profil" })}
                className="mt-[18px] flex w-full items-center gap-[14px] text-left"
              >
                <span className="flex h-[60px] w-[60px] shrink-0 items-center justify-center rounded-full bg-[#3DEFBE] text-[20px] font-bold text-[#123A63]">
                  {profil ? initiales(profil.prenom || "?") : ""}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[20px] font-bold leading-tight">{profil?.prenom ?? " "}</span>
                  <span className="block truncate text-[13.5px] text-[#5B7189]">
                    {profil && (profil.niveau || profil.club || profil.role) ? [profil.niveau, libelleRole(profil.role), profil.club].filter(Boolean).join(" · ") : "Ajoute ton niveau et ton club"}
                  </span>
                </span>
              </button>

              {/* Statistiques */}
              <div className="mt-[16px] grid grid-cols-3 gap-y-[16px] galet-b border border-[#E4EBF1] bg-white px-[8px] py-[18px] text-center shadow-[0_4px_14px_#123A6306]">
                {tuiles.map(([label, cle]) => (
                  <div key={cle}>
                    <b className="block text-[19px] leading-tight">{stats ? stats[cle] : "…"}</b>
                    <small className="text-[12px] text-[#9DB0C0]">{label}</small>
                  </div>
                ))}
              </div>

              {/* Graphique : plongées mois par mois */}
              {mesPlongees.length > 0 && <GraphiqueMois plongees={mesPlongees} />}

              {/* Appel au Récif */}
              <button
                type="button"
                onClick={() => navigate({ to: "/recif" })}
                className="mt-[12px] flex w-full items-center gap-[13px] galet-c border border-[#B8E4D8] bg-[#E2F8EF] px-[15px] py-[14px] text-left shadow-[0_4px_14px_#123A6309]"
              >
                <span className="flex h-[42px] w-[42px] shrink-0 items-center justify-center goutte bg-[#0F3D70] p-[8px]">
                  <img src={logoCorail} alt="" className="h-full w-auto" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-[14.5px] font-bold">Rejoins le Récif</span>
                  <span className="block pt-[1px] text-[12.5px] leading-snug text-[#3F5B76]">L'app reste gratuite. Le Récif, c'est ceux qui la font tenir.</span>
                </span>
                <ChevronRight className="h-[17px] w-[17px] shrink-0 text-[#3F5B76]" aria-hidden="true" />
              </button>

              <TitreSection>Mon carnet</TitreSection>
              <Bloc>
                <Ligne
                  icone={Download}
                  label={exportEnCours ? "Export en cours…" : "Exporter mes plongées"}
                  valeur="UDDF"
                  onClick={exportEnCours ? undefined : () => void exporter()}
                />
                <Ligne icone={Upload} label="Importer un fichier" bientot />
                <Ligne icone={Camera} label="Numériser un carnet papier" onClick={() => navigate({ to: "/numeriser" })} />
              </Bloc>
              {erreur && <p className="pt-[10px] text-[13px] text-[#8A2A1A]">{erreur}</p>}

              <TitreSection>L'application</TitreSection>
              <Bloc>
                <Ligne icone={SlidersHorizontal} label="Réglages" onClick={() => navigate({ to: "/moi/reglages" })} />
                <Ligne icone={Lock} label="Confidentialité" onClick={() => navigate({ to: "/moi/confidentialite" })} />
                <Ligne icone={MessageCircle} label="Dis-moi ce qui manque" onClick={() => navigate({ to: "/moi/avis" })} />
                <Ligne icone={HelpCircle} label="Aide et à propos" bientot />
              </Bloc>
              {admin && (
                <>
                  <TitreSection>Développeur</TitreSection>
                  <Bloc>
                    <Ligne icone={BarChart3} label="Tableau de bord" onClick={() => navigate({ to: "/admin" })} />
                  </Bloc>
                </>
              )}
            </>
          )}
        </div>
      </div>
      <div className="mx-auto w-full max-w-[430px] shrink-0">
        <BarreNavigation actif="moi" />
      </div>
    </div>
  );
}

// ---------- « Tes plongées, mois par mois » (maquette du bilan annuel) ----------

const INITIALES_MOIS = ["J", "F", "M", "A", "M", "J", "J", "A", "S", "O", "N", "D"];
const NOMS_MOIS = ["Janvier", "Février", "Mars", "Avril", "Mai", "Juin", "Juillet", "Août", "Septembre", "Octobre", "Novembre", "Décembre"];

function GraphiqueMois({ plongees }: { plongees: CartePlongee[] }) {
  const annees = [...new Set(plongees.map((p) => p.date.slice(0, 4)).filter((a) => /^\d{4}$/.test(a)))].sort().reverse();
  const [annee, setAnnee] = useState(annees[0] ?? "");
  if (annees.length === 0) return null;
  const parMois = Array.from({ length: 12 }, () => 0);
  for (const p of plongees) if (p.date.startsWith(annee)) parMois[Number(p.date.slice(5, 7)) - 1]! += 1;
  const max = Math.max(...parMois);
  const total = parMois.reduce((a, b) => a + b, 0);
  const meilleur = parMois.indexOf(max);
  const vides = parMois.filter((n) => n === 0).length;
  const seulMeilleur = max > 1 && parMois.filter((n) => n === max).length === 1;
  return (
    <div className="mt-[12px] galet border border-[#E4EBF1] bg-white px-[16px] pb-[14px] pt-[15px] shadow-[0_4px_14px_#123A6306]">
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-[14.5px] font-bold">Tes plongées, mois par mois</h2>
        {annees.length > 1 ? (
          <select
            value={annee}
            onChange={(e) => setAnnee(e.target.value)}
            aria-label="Année"
            className="rounded-[10px] bg-[#EEF4F9] px-[8px] py-[4px] text-[12.5px] font-semibold text-[#123A63] outline-none"
          >
            {annees.map((a) => (
              <option key={a} value={a}>
                {a}
              </option>
            ))}
          </select>
        ) : (
          <span className="text-[12.5px] font-semibold text-[#9DB0C0]">{annee}</span>
        )}
      </div>
      <div className="mt-[14px] flex h-[96px] items-end gap-[5px]" role="img" aria-label={`Plongées par mois en ${annee}`}>
        {parMois.map((n, i) => (
          <div key={i} className="flex h-full flex-1 flex-col items-center justify-end gap-[3px]">
            {n > 0 && <span className={`text-[11px] font-bold ${seulMeilleur && i === meilleur ? "text-[#123A63]" : "text-[#7D93A8]"}`}>{n}</span>}
            <div
              className={`w-full rounded-t-[5px] ${n === 0 ? "bg-[#E7EFF6]" : seulMeilleur && i === meilleur ? "bg-[#0F3D70]" : "bg-[#9ACDEB]"}`}
              style={{ height: n === 0 ? 3 : `${Math.max(10, (n / max) * 70)}px` }}
            />
          </div>
        ))}
      </div>
      <div className="mt-[6px] flex gap-[5px]">
        {INITIALES_MOIS.map((m, i) => (
          <span key={i} className="flex-1 text-center text-[10.5px] text-[#9DB0C0]">
            {m}
          </span>
        ))}
      </div>
      <p className="pt-[10px] text-[12.5px] leading-normal text-[#5B7189]">
        {total} plongée{total > 1 ? "s" : ""} en {annee}.
        {seulMeilleur ? ` ${NOMS_MOIS[meilleur]} t'en a pris ${max}.` : ""}
        {vides > 0 ? ` ${vides} mois sans plongée.` : ""}
      </p>
    </div>
  );
}
