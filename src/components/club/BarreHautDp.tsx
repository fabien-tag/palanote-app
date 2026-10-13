import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { Anchor } from "lucide-react";
import { ClocheDp } from "@/components/club/ClocheDp";
import { RechercheBarre } from "@/components/club/RechercheDp";
import { Avatar } from "@/components/club/Ui";
import { centreChoisi, EVENEMENT_CENTRE, mesCentres, type Centre } from "@/lib/club";
import { supabase } from "@/lib/supabase";

// Barre du haut de l'espace DP sur ordinateur : la date à gauche ; à droite
// la cloche, le club représenté et le compte connecté.
// Elle reste en place d'un écran à l'autre, comme la colonne de navigation.
type Moi = { id: string; prenom: string; nom: string | null; niveau: string | null; email: string | null };

export function BarreHautDp() {
  const [moi, setMoi] = useState<Moi | null>(null);
  const [centre, setCentre] = useState<Centre | null>(null);

  useEffect(() => {
    let actif = true;
    void (async () => {
      const { data } = await supabase.auth.getSession();
      const u = data.session?.user;
      if (!u) return;
      const { data: p } = await supabase.from("profiles").select("*").eq("id", u.id).maybeSingle();
      const r = (p ?? {}) as Record<string, unknown>;
      const meta = (u.user_metadata ?? {}) as Record<string, unknown>;
      const t = (v: unknown) => (typeof v === "string" && v.trim() ? v.trim() : null);
      if (!actif) return;
      setMoi({
        id: u.id,
        prenom: t(r["first_name"]) ?? t(r["prenom"]) ?? t(meta["first_name"]) ?? (u.email ?? "Moi").split("@")[0]!,
        nom: t(r["nom"]),
        niveau: t(r["niveau"]),
        email: u.email ?? null,
      });
    })();
    const chargerCentre = () =>
      void mesCentres()
        .then((l) => actif && setCentre(l.find((c) => c.id === centreChoisi()) ?? l[0] ?? null))
        .catch(() => undefined);
    chargerCentre();
    // Le club renommé ou changé dans Paramètres : l'étiquette suit
    window.addEventListener(EVENEMENT_CENTRE, chargerCentre);
    return () => {
      actif = false;
      window.removeEventListener(EVENEMENT_CENTRE, chargerCentre);
    };
  }, []);

  const jour = new Date().toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long" });
  const date = jour.charAt(0).toUpperCase() + jour.slice(1); // « Mardi 13 octobre »

  return (
    <header className="sticky top-0 z-30 hidden h-[72px] items-center gap-[12px] border-b border-[#DFEAF2] bg-white/95 px-[32px] backdrop-blur lg:flex">
      <div className="flex min-w-0 flex-1 items-center gap-[18px]">
        <RechercheBarre />
        <span className="hidden whitespace-nowrap text-[13px] font-semibold text-[#7D93A8] xl:inline">{date}</span>
      </div>

      <ClocheDp />

      <span className="mx-[4px] h-[28px] w-px bg-[#DFEAF2]" aria-hidden="true" />

      {centre && (
        <Link
          to="/club/parametres"
          title="Le club que tu représentes"
          className="flex h-[34px] max-w-[220px] items-center gap-[7px] rounded-[10px] bg-[#E3F2FB] px-[10px] text-[12.5px] font-bold text-[#1176A8] hover:bg-[#D5EBF8]"
        >
          <Anchor className="h-[14px] w-[14px] shrink-0" strokeWidth={2.4} aria-hidden="true" />
          <span className="truncate">{centre.nom}</span>
        </Link>
      )}

      {moi && (
        <Link to="/club/parametres" className="flex items-center gap-[10px] rounded-[10px] py-[4px] pl-[4px] pr-[8px] hover:bg-[#F1F6FC]" title="Mon compte">
          <Avatar id={moi.id} prenom={moi.prenom} taille={40} />
          <span className="min-w-0 leading-tight">
            <span className="block max-w-[180px] truncate text-[14px] font-bold text-[#123A63]">{[moi.prenom, moi.nom].filter(Boolean).join(" ")}</span>
            <span className="block max-w-[180px] truncate text-[12px] text-[#7D93A8]">
              {["Directeur de plongée", moi.niveau].filter(Boolean).join(" · ")}
            </span>
          </span>
        </Link>
      )}
    </header>
  );
}
