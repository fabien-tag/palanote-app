import { useCallback, useEffect, useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { Camera, Download, HelpCircle, Lock, Pencil, SlidersHorizontal, Upload } from "lucide-react";
import fondAsset from "@/assets/BG.png";
import { BarreNavigation } from "@/components/BarreNavigation";
import { BandeauConfirmation } from "@/components/BandeauConfirmation";
import { Bloc, Ligne, TitreSection } from "@/components/moi/Ui";
import { initiales, mesBinomes } from "@/lib/amis";
import { effacerMessageAccueil, lireMessageAccueil } from "@/lib/message-accueil";
import { chargerProfil, exporterUDDF, type Profil } from "@/lib/moi";
import { chargerNumeroDepart, chargerPlongees, dureeEnMinutes, utilisateurConnecte, type CartePlongee } from "@/lib/plongees";

export const Route = createFileRoute("/moi")({
  head: () => ({ meta: [{ title: "Palanote — Moi" }, { name: "description", content: "Ton profil de plongeur, tes réglages et tes données." }] }),
  component: Moi,
});

type Stats = { plongees: string; heures: string; profondeur: string; sites: string; binomes: string; depuis: string };

function calculerStats(liste: CartePlongee[], depart: number, nbBinomes: number, premiereAnnee: string): Stats {
  const profondeurs = liste.map((p) => Number(p.profMax.replace(",", "."))).filter((n) => Number.isFinite(n) && n > 0);
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
      setStats(calculerStats(liste, depart, binomes.length, p?.premiereAnnee ?? ""));
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
        {/* En-tête */}
        <div
          className="relative flex h-[clamp(200px,29svh,262px)] shrink-0 items-end overflow-hidden rounded-b-[30px] bg-[#0E3D72] bg-cover bg-center"
          style={{ backgroundImage: `url(${fondAsset})` }}
        >
          <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(14,61,114,0)_0%,rgba(14,61,114,.35)_45%,rgba(10,42,80,.92)_100%)]" />
          <div className="relative flex w-full items-center gap-[15px] px-[22px] pb-[22px]">
            <span className="flex h-[76px] w-[76px] shrink-0 items-center justify-center rounded-full bg-[#3DEFBE] text-[25px] font-bold text-[#123A63]">
              {profil ? initiales(profil.prenom || "?") : ""}
            </span>
            <div className="min-w-0 flex-1">
              <h1 className="truncate text-[28px] font-bold leading-tight text-white">{connecte === false ? "Moi" : (profil?.prenom ?? " ")}</h1>
              {profil && (profil.niveau || profil.club) && (
                <p className="truncate text-[15px] text-white/75">{[profil.niveau, profil.club].filter(Boolean).join(" · ")}</p>
              )}
              {profil && !profil.niveau && !profil.club && <p className="text-[14px] text-white/75">Ajoute ton niveau et ton club</p>}
            </div>
            {connecte && (
              <button
                type="button"
                aria-label="Modifier mon profil"
                onClick={() => navigate({ to: "/moi/profil" })}
                className="flex h-[36px] w-[36px] shrink-0 items-center justify-center self-end rounded-[11px] bg-white/20 backdrop-blur-sm"
              >
                <Pencil className="h-[16px] w-[16px] text-white" strokeWidth={2.2} />
              </button>
            )}
          </div>
        </div>

        <div className="px-[22px] pb-[24px]">
          {connecte === false && (
            <div className="flex flex-col items-center gap-4 pt-[10svh] text-center">
              <p className="text-[15px] text-[#5B7189]">Connecte-toi pour retrouver ton profil et tes réglages.</p>
              <button
                type="button"
                onClick={() => navigate({ to: "/connexion" })}
                className="flex h-[52px] w-full items-center justify-center rounded-2xl bg-[#3DEFBE] text-[14px] font-bold text-[#0B3B63]"
              >
                ME CONNECTER
              </button>
            </div>
          )}

          {connecte && (
            <>
              {/* Statistiques */}
              <div className="mt-[18px] grid grid-cols-3 gap-y-[16px] rounded-[20px] border border-[#E4EBF1] bg-white px-[8px] py-[18px] text-center shadow-[0_4px_14px_#123A6306]">
                {tuiles.map(([label, cle]) => (
                  <div key={cle}>
                    <b className="block text-[19px] leading-tight">{stats ? stats[cle] : "…"}</b>
                    <small className="text-[12px] text-[#9DB0C0]">{label}</small>
                  </div>
                ))}
              </div>

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
                <Ligne icone={HelpCircle} label="Aide et à propos" bientot />
              </Bloc>
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
