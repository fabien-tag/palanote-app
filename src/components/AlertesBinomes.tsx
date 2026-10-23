import { useEffect, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { Camera, Check, X } from "lucide-react";
import { BandeauProposition } from "@/components/AccueilCarnet";
import { mesBinomes, plongeesAConfirmer, type PlongeeAConfirmer, type Plongeur } from "@/lib/amis";
import type { Notification } from "@/lib/notifications";
import { supabase } from "@/lib/supabase";

// Alertes « binômes », sur tous les onglets de l'app (Carnet, Carte, Amis, Moi) :
// - une plongée remplie par un binôme : la carte flottante « X a rempli votre plongée » ;
// - un nouveau binôme (il a scanné ton QR code, ou toi le sien) : une petite notification en haut.
// L'app vérifie toutes les 10 s et au retour sur l'app, sans recharger la page.

const CLE = "palanote-binomes-connus";
const CLE_PHOTOS = "palanote-photos-annoncees";

function photosAnnoncees(): string[] {
  try {
    return JSON.parse(localStorage.getItem(CLE_PHOTOS) ?? "[]") as string[];
  } catch {
    return [];
  }
}

function lireConnus(uid: string): Set<string> | null {
  try {
    const v = JSON.parse(localStorage.getItem(CLE) ?? "null") as { uid: string; ids: string[] } | null;
    return v && v.uid === uid ? new Set(v.ids) : null;
  } catch {
    return null;
  }
}
function ecrireConnus(uid: string, ids: string[]) {
  try {
    localStorage.setItem(CLE, JSON.stringify({ uid, ids }));
  } catch {
    /* stockage indisponible */
  }
}

export function AlertesBinomes({ avecCarte }: { avecCarte: boolean }) {
  const navigate = useNavigate();
  const [propositions, setPropositions] = useState<PlongeeAConfirmer[]>([]);
  const [nouveau, setNouveau] = useState<Plongeur | null>(null);
  const [photo, setPhoto] = useState<Notification | null>(null);

  useEffect(() => {
    let actif = true;
    const verifier = async () => {
      if (document.visibilityState !== "visible") return;
      const { data } = await supabase.auth.getSession();
      const uid = data.session?.user.id;
      if (!uid || !actif) return;
      if (avecCarte)
        void plongeesAConfirmer()
          .then((p) => actif && setPropositions(p))
          .catch(() => undefined);
      // Une photo ajoutée par un binôme à une plongée commune
      void supabase
        .from("notifications")
        .select("id, type, titre, texte, lien, lue_le, created_at")
        .eq("type", "photo_partagee")
        .is("lue_le", null)
        .gt("created_at", new Date(Date.now() - 24 * 3600_000).toISOString())
        .order("created_at", { ascending: false })
        .limit(1)
        .then(({ data: n }) => {
          const derniere = (n ?? [])[0] as Notification | undefined;
          if (!actif || !derniere) return;
          const deja = photosAnnoncees();
          if (deja.includes(derniere.id)) return;
          try {
            localStorage.setItem(CLE_PHOTOS, JSON.stringify([...deja, derniere.id].slice(-30)));
          } catch {
            /* stockage indisponible */
          }
          setPhoto(derniere);
        });
      try {
        const liste = await mesBinomes();
        if (!actif) return;
        const connus = lireConnus(uid);
        // Première visite sur cet appareil : on retient la liste sans rien annoncer.
        if (connus) {
          const arrive = liste.find((b) => !connus.has(b.id));
          if (arrive) setNouveau(arrive);
        }
        ecrireConnus(uid, liste.map((b) => b.id));
      } catch {
        /* hors connexion : on réessaie au prochain tour */
      }
    };
    void verifier();
    const t = setInterval(() => void verifier(), 10_000);
    const auRetour = () => void verifier();
    document.addEventListener("visibilitychange", auRetour);
    return () => {
      actif = false;
      clearInterval(t);
      document.removeEventListener("visibilitychange", auRetour);
    };
  }, [avecCarte]);

  useEffect(() => {
    if (!photo) return;
    const t = setTimeout(() => setPhoto(null), 8000);
    return () => clearTimeout(t);
  }, [photo]);

  // La notification « nouveau binôme » se retire seule après 8 s
  useEffect(() => {
    if (!nouveau) return;
    const t = setTimeout(() => setNouveau(null), 8000);
    return () => clearTimeout(t);
  }, [nouveau]);

  return (
    <>
      {avecCarte && <BandeauProposition propositions={propositions} />}
      {photo && !nouveau && (
        <div role="status" className="fixed inset-x-0 top-[calc(12px+env(safe-area-inset-top))] z-40 mx-auto w-full max-w-[430px] px-[14px]">
          <div className="flex items-center gap-3 rounded-[20px] bg-[#0F2A4A] px-[14px] py-[12px] text-white shadow-[0_10px_28px_rgba(9,30,60,.35)]">
            <span className="flex h-[34px] w-[34px] shrink-0 items-center justify-center rounded-full bg-[#3DEFBE]">
              <Camera className="h-[17px] w-[17px] text-[#0B3B63]" strokeWidth={2.4} aria-hidden="true" />
            </span>
            <button
              type="button"
              onClick={() => {
                const lien = photo.lien;
                setPhoto(null);
                if (lien) window.location.assign(lien);
              }}
              className="min-w-0 flex-1 text-left leading-snug"
            >
              <span className="block text-[14px] font-bold">{photo.titre}</span>
              {photo.texte && <span className="block text-[12.5px] text-white/80">{photo.texte}</span>}
            </button>
            <button type="button" aria-label="Fermer" onClick={() => setPhoto(null)} className="flex h-[30px] w-[30px] shrink-0 items-center justify-center rounded-full text-white/80">
              <X className="h-[16px] w-[16px]" aria-hidden="true" />
            </button>
          </div>
        </div>
      )}
      {nouveau && (
        <div role="status" className="fixed inset-x-0 top-[calc(12px+env(safe-area-inset-top))] z-40 mx-auto w-full max-w-[430px] px-[14px]">
          <div className="flex items-center gap-3 rounded-[20px] bg-[#0F2A4A] px-[14px] py-[12px] text-white shadow-[0_10px_28px_rgba(9,30,60,.35)]">
            <span className="flex h-[34px] w-[34px] shrink-0 items-center justify-center rounded-full bg-[#3DEFBE]">
              <Check className="h-[17px] w-[17px] text-[#0B3B63]" strokeWidth={3} aria-hidden="true" />
            </span>
            <button
              type="button"
              onClick={() => {
                setNouveau(null);
                navigate({ to: "/amis" });
              }}
              className="min-w-0 flex-1 text-left text-[14px] leading-snug"
            >
              <b>{nouveau.prenom}</b> et toi êtes maintenant binômes.
            </button>
            <button type="button" aria-label="Fermer" onClick={() => setNouveau(null)} className="flex h-[30px] w-[30px] shrink-0 items-center justify-center rounded-full text-white/80">
              <X className="h-[16px] w-[16px]" aria-hidden="true" />
            </button>
          </div>
        </div>
      )}
    </>
  );
}
