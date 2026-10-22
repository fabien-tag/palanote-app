import { AlertTriangle, GraduationCap, Hourglass, UserMinus, BadgeCheck, Bell, CalendarCheck, CalendarClock, CalendarX, ClipboardCheck, HeartHandshake, LifeBuoy, PenLine, ShieldAlert, Stamp, Star, UserPlus, Users, ScanSearch } from "lucide-react";
import { ilYA, type Notification } from "@/lib/notifications";

// Une notification de la cloche (plongeur et directeur de plongée)
export const ICONES_NOTIFICATION: Record<string, { Icone: typeof Bell; fond: string; couleur: string }> = {
  lecture_terminee: { Icone: ScanSearch, fond: "bg-[#E2F8EF]", couleur: "text-[#137758]" },
  sortie_inscription: { Icone: CalendarCheck, fond: "bg-[#E3F2FB]", couleur: "text-[#106F9F]" },
  sortie_rejointe: { Icone: UserPlus, fond: "bg-[#E3F2FB]", couleur: "text-[#106F9F]" },
  sortie_a_completer: { Icone: PenLine, fond: "bg-[#E2F8EF]", couleur: "text-[#137758]" },
  sortie_relance: { Icone: PenLine, fond: "bg-[#E2F8EF]", couleur: "text-[#137758]" },
  tampon: { Icone: Stamp, fond: "bg-[#FFE9E2]", couleur: "text-[#B8432F]" },
  passeport_verifie: { Icone: BadgeCheck, fond: "bg-[#E2F8EF]", couleur: "text-[#137758]" },
  privilegies_invitation: { Icone: Star, fond: "bg-[#FFF3D9]", couleur: "text-[#B07A12]" },
  sortie_modifiee: { Icone: CalendarCheck, fond: "bg-[#FFF1D6]", couleur: "text-[#8A5A10]" },
  sortie_annulee: { Icone: CalendarX, fond: "bg-[#EEF2F6]", couleur: "text-[#566B82]" },
  binome_demande: { Icone: Users, fond: "bg-[#E3F2FB]", couleur: "text-[#106F9F]" },
  binome_accepte: { Icone: HeartHandshake, fond: "bg-[#E2F8EF]", couleur: "text-[#137758]" },
  formation_programmee: { Icone: GraduationCap, fond: "bg-[#E3F2FB]", couleur: "text-[#106F9F]" },
  formation_moniteur: { Icone: GraduationCap, fond: "bg-[#E3F2FB]", couleur: "text-[#106F9F]" },
  formation_rappel: { Icone: GraduationCap, fond: "bg-[#E2F8EF]", couleur: "text-[#137758]" },
  formation_validee: { Icone: GraduationCap, fond: "bg-[#E2F8EF]", couleur: "text-[#137758]" },
  formation_annulee: { Icone: GraduationCap, fond: "bg-[#EEF2F6]", couleur: "text-[#566B82]" },
  club_adhesion: { Icone: UserPlus, fond: "bg-[#E2F8EF]", couleur: "text-[#137758]" },
  membre_rejoint: { Icone: UserPlus, fond: "bg-[#E2F8EF]", couleur: "text-[#137758]" },
  sortie_desistement: { Icone: UserMinus, fond: "bg-[#FFE9E2]", couleur: "text-[#B8432F]" },
  desistement_valide: { Icone: UserMinus, fond: "bg-[#EEF2F6]", couleur: "text-[#566B82]" },
  sortie_attente: { Icone: Hourglass, fond: "bg-[#FFF3D9]", couleur: "text-[#B07A12]" },
  sortie_place_liberee: { Icone: CalendarCheck, fond: "bg-[#E2F8EF]", couleur: "text-[#137758]" },
  rappel_veille: { Icone: CalendarClock, fond: "bg-[#E2F8EF]", couleur: "text-[#137758]" },
  // Rappels du DP
  rappel_materiel: { Icone: LifeBuoy, fond: "bg-[#FFF1D6]", couleur: "text-[#8A5A10]" },
  rappel_certificat: { Icone: ShieldAlert, fond: "bg-[#FFF1D6]", couleur: "text-[#8A5A10]" },
  rappel_sortie: { Icone: AlertTriangle, fond: "bg-[#FFE9E2]", couleur: "text-[#B8432F]" },
  rappel_cloture: { Icone: ClipboardCheck, fond: "bg-[#E3F2FB]", couleur: "text-[#106F9F]" },
  rappel_tampon: { Icone: Stamp, fond: "bg-[#FFE9E2]", couleur: "text-[#B8432F]" },
};

export function LigneNotification({ n, onOuvrir }: { n: Notification; onOuvrir: (n: Notification) => void }) {
  const i = ICONES_NOTIFICATION[n.type] ?? { Icone: Bell, fond: "bg-[#EEF4F9]", couleur: "text-[#566B82]" };
  return (
    <button
      type="button"
      onClick={() => onOuvrir(n)}
      className={`flex w-full items-start gap-[12px] galet-b border px-[14px] py-[12px] text-left ${n.lue_le ? "border-[#E4EBF1] bg-white" : "border-[#BFE6F5] bg-[#F3FAFE]"}`}
    >
      <span className={`flex h-[40px] w-[40px] shrink-0 items-center justify-center goutte ${i.fond}`}>
        <i.Icone className={`h-[19px] w-[19px] ${i.couleur}`} strokeWidth={2.2} aria-hidden="true" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="flex items-baseline justify-between gap-2">
          <span className="text-[14.5px] font-bold leading-snug">{n.titre}</span>
          <span className="shrink-0 text-[11.5px] text-[#566B82]">{ilYA(n.created_at)}</span>
        </span>
        {n.texte && <span className="block pt-[2px] text-[13px] leading-snug text-[#566B82]">{n.texte}</span>}
      </span>
      {!n.lue_le && <span className="mt-[6px] h-[9px] w-[9px] shrink-0 rounded-full bg-[#FF8A75]" aria-label="Nouvelle" />}
    </button>
  );
}
