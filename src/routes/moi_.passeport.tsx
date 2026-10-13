import { useCallback, useEffect, useRef, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { BadgeCheck, Camera, CreditCard, Maximize2, Plus, ShieldCheck, Trash2 } from "lucide-react";
import { useConnexionRequise } from "@/components/numerisation/Ui";
import { Bloc, Note, PageMoi, TitreSection } from "@/components/moi/Ui";
import { Feuille, MessageErreur } from "@/components/club/Ui";
import {
  chargerPasseport,
  enregistrerBrevet,
  enregistrerCertificat,
  etatCertificat,
  ORGANISMES,
  supprimerBrevet,
  TYPES_BREVET,
  urlsPhotos,
  type Brevet,
  type BrouillonBrevet,
  type Passeport,
} from "@/lib/passeport";
import { PasseportPleinEcran } from "@/components/PasseportPleinEcran";

// Mon passeport de plongeur : mes brevets avec la photo de mes cartes, et la fin de mon
// certificat médical. Je le montre au directeur de plongée sur le bateau, et les DP qui
// m'encadrent le voient depuis leur sortie (ils peuvent marquer une carte « vérifiée »).
export const Route = createFileRoute("/moi_/passeport")({
  head: () => ({ meta: [{ title: "Palanote — Mon passeport" }] }),
  component: PageMonPasseport,
});

const dateLongue = (d: string) => new Date(`${d}T12:00:00`).toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" });
const libelleType = (t: string) => TYPES_BREVET.find((x) => x.id === t)?.libelle ?? t;

function PageMonPasseport() {
  const { pret, ecran } = useConnexionRequise();
  const [p, setP] = useState<Passeport | null>(null);
  const [photos, setPhotos] = useState<Record<string, string>>({});
  const [edition, setEdition] = useState<{ brouillon: BrouillonBrevet; avant?: Brevet } | null>(null);
  const [montrer, setMontrer] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);
  const [certificat, setCertificat] = useState("");

  const charger = useCallback(async () => {
    try {
      const r = await chargerPasseport();
      setP(r);
      setCertificat(r.certificat_fin ?? "");
      setPhotos(await urlsPhotos(r.brevets.flatMap((b) => [b.photo_recto, b.photo_verso])));
    } catch (e) {
      console.error(e);
      const m = String((e as { message?: string })?.message ?? "");
      setErreur(/Could not find the function|does not exist/i.test(m) ? "Le passeport n'est pas encore activé : lance le script « palanote-passeport.sql » dans Supabase." : "Ton passeport n'a pas pu être chargé.");
    }
  }, []);

  useEffect(() => {
    if (pret) void charger();
  }, [pret, charger]);

  if (ecran) return ecran;

  const etat = etatCertificat(p?.certificat_fin ?? null);
  const gaz = (p?.brevets ?? []).filter((b) => b.type === "nitrox" || b.type === "trimix");

  return (
    <PageMoi titre="Mon passeport">
      <MessageErreur texte={erreur} />
      {p && (
        <>
          {/* La carte du passeport */}
          <div className="relative mt-[18px] overflow-hidden galet bg-[linear-gradient(140deg,#0F3D70_0%,#1176A8_100%)] px-[20px] pb-[18px] pt-[16px] text-white shadow-[0_10px_26px_#0F3D7033]">
            <p className="text-[11px] font-bold uppercase tracking-[.14em] text-white/70">Passeport de plongée</p>
            <p className="pt-[10px] text-[26px] font-bold leading-tight">{p.prenom}</p>
            <p className="text-[15px] font-semibold text-white/85">{[p.niveau, p.club].filter(Boolean).join(" · ") || "Ajoute ton niveau dans ton profil"}</p>
            <div className="flex flex-wrap gap-[6px] pt-[12px]">
              {gaz.map((b) => (
                <span key={b.id} className="flex items-center gap-[4px] rounded-[10px] bg-white/18 px-[8px] py-[3px] text-[12px] font-bold">
                  {b.verifie_le && <BadgeCheck className="h-[13px] w-[13px] text-[#3DEFBE]" />}
                  {b.intitule}
                </span>
              ))}
              <span
                className={`rounded-[10px] px-[8px] py-[3px] text-[12px] font-bold ${
                  etat === "expire" || etat === "absent" ? "bg-[#FF8A75] text-white" : etat === "bientot" ? "bg-[#F5B544] text-[#4A3000]" : "bg-[#3DEFBE] text-[#0B3B63]"
                }`}
              >
                {etat === "absent" ? "Certificat médical ?" : etat === "expire" ? "Certificat expiré" : `Certificat jusqu'au ${dateLongue(p.certificat_fin!)}`}
              </span>
            </div>
            <button
              type="button"
              onClick={() => setMontrer(true)}
              className="mt-[16px] flex h-[46px] w-full items-center justify-center gap-[8px] galet-moyen bg-white text-[13.5px] font-bold text-[#0F3D70]"
            >
              <Maximize2 className="h-[16px] w-[16px]" /> MONTRER AU DIRECTEUR DE PLONGÉE
            </button>
          </div>

          <TitreSection>Certificat médical</TitreSection>
          <Bloc className="py-[14px]">
            <label className="flex items-center gap-[12px]">
              <ShieldCheck className="h-[20px] w-[20px] shrink-0 text-[#1176A8]" />
              <span className="min-w-0 flex-1 text-[14.5px] font-bold">Valable jusqu'au</span>
              <input
                type="date"
                value={certificat}
                onChange={(e) => setCertificat(e.target.value)}
                onBlur={() =>
                  certificat !== (p.certificat_fin ?? "") &&
                  void enregistrerCertificat(certificat || null)
                    .then(charger)
                    .catch(() => setErreur("La date n'a pas pu être enregistrée."))
                }
                className="h-[40px] galet-petit border border-[#E4EBF1] px-[8px] text-[14px]"
              />
            </label>
          </Bloc>
          <Note>Palanote garde seulement la date de fin, jamais le certificat lui-même. Un rappel arrive un mois avant.</Note>

          <TitreSection>Mes brevets</TitreSection>
          <div className="flex flex-col gap-[10px]">
            {p.brevets.map((b) => (
              <button
                key={b.id}
                type="button"
                onClick={() =>
                  setEdition({
                    avant: b,
                    brouillon: { id: b.id, type: b.type, intitule: b.intitule, organisme: b.organisme ?? "", numero: b.numero ?? "", obtenu_le: b.obtenu_le ?? "" },
                  })
                }
                className="flex items-center gap-[12px] galet-b border border-[#E4EBF1] bg-white p-[10px] text-left shadow-[0_4px_14px_#123A6306]"
              >
                <span className="flex h-[58px] w-[88px] shrink-0 items-center justify-center overflow-hidden galet-petit bg-[#EEF4F9]">
                  {b.photo_recto && photos[b.photo_recto] ? (
                    <img src={photos[b.photo_recto]} alt={`Carte ${b.intitule}`} className="h-full w-full object-cover" />
                  ) : (
                    <CreditCard className="h-[22px] w-[22px] text-[#9DB0C0]" />
                  )}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="flex items-center gap-[6px]">
                    <span className="truncate text-[15px] font-bold">{b.intitule}</span>
                    <span className="shrink-0 rounded-[8px] bg-[#E3F2FB] px-[6px] py-[1px] text-[10.5px] font-bold text-[#1176A8]">{libelleType(b.type)}</span>
                  </span>
                  <span className="block truncate text-[12.5px] text-[#5B7189]">
                    {[b.organisme, b.numero ? `n° ${b.numero}` : null, b.obtenu_le ? new Date(`${b.obtenu_le}T12:00:00`).getFullYear() : null].filter(Boolean).join(" · ") || "Ajoute les détails"}
                  </span>
                  <span className={`flex items-center gap-[4px] text-[12px] font-semibold ${b.verifie_le ? "text-[#14805F]" : "text-[#9DB0C0]"}`}>
                    {b.verifie_le ? (
                      <>
                        <BadgeCheck className="h-[13px] w-[13px]" /> Vérifiée par {b.verifie_par}
                        {b.verifie_centre ? ` · ${b.verifie_centre}` : ""}
                      </>
                    ) : b.photo_recto ? (
                      "Carte en photo, pas encore vérifiée"
                    ) : (
                      "Sans photo de la carte"
                    )}
                  </span>
                </span>
              </button>
            ))}
            {p.brevets.length === 0 && (
              <p className="galet-b border border-dashed border-[#D5E1EC] bg-white/60 px-[15px] py-[14px] text-[13.5px] leading-normal text-[#5B7189]">
                Ajoute ton niveau, et tes qualifications Nitrox ou Trimix avec la photo de tes cartes : le DP les verra sans que tu sortes ton portefeuille.
              </p>
            )}
            <button
              type="button"
              onClick={() => setEdition({ brouillon: { type: p.brevets.length === 0 ? "niveau" : "nitrox", intitule: "", organisme: "FFESSM", numero: "", obtenu_le: "" } })}
              className="flex h-[52px] items-center justify-center gap-[8px] galet-moyen border-[1.5px] border-dashed border-[#9DCBE6] text-[14px] font-bold text-[#1176A8]"
            >
              <Plus className="h-[18px] w-[18px]" /> Ajouter un brevet
            </button>
          </div>
          <Note>Seuls toi et les directeurs de plongée qui t'encadrent voient ton passeport. Si tu modifies une carte vérifiée, elle devra être vérifiée à nouveau.</Note>
        </>
      )}

      {edition && (
        <EditionBrevet
          brouillon={edition.brouillon}
          avant={edition.avant}
          photos={photos}
          onFermer={(fait) => {
            setEdition(null);
            if (fait) void charger();
          }}
        />
      )}
      {montrer && p && <PasseportPleinEcran p={p} photos={photos} onFermer={() => setMontrer(false)} />}
    </PageMoi>
  );
}

function ChoixPhoto({ titre, actuelle, nouvelle, onChoisir, onRetirer }: { titre: string; actuelle: string | null; nouvelle: File | null; onChoisir: (f: File) => void; onRetirer: () => void }) {
  const entree = useRef<HTMLInputElement>(null);
  const [apercu, setApercu] = useState<string | null>(null);
  useEffect(() => {
    if (!nouvelle) return setApercu(null);
    const u = URL.createObjectURL(nouvelle);
    setApercu(u);
    return () => URL.revokeObjectURL(u);
  }, [nouvelle]);
  const image = apercu ?? actuelle;
  return (
    <div>
      <span className="block pb-[6px] text-[13px] font-semibold text-[#5B7189]">{titre}</span>
      <button
        type="button"
        onClick={() => entree.current?.click()}
        className="relative flex aspect-[1.586] w-full items-center justify-center overflow-hidden galet-petit border-[1.5px] border-dashed border-[#C9DCEA] bg-[#F5F9FC]"
      >
        {image ? (
          <img src={image} alt={titre} className="h-full w-full object-cover" />
        ) : (
          <span className="flex flex-col items-center gap-[4px] text-[12.5px] font-bold text-[#1176A8]">
            <Camera className="h-[22px] w-[22px]" /> Prendre en photo
          </span>
        )}
      </button>
      {image && (
        <button type="button" onClick={onRetirer} className="pt-[4px] text-[12px] font-semibold text-[#9DB0C0]">
          Retirer la photo
        </button>
      )}
      <input
        ref={entree}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) onChoisir(f);
          e.target.value = "";
        }}
      />
    </div>
  );
}

function EditionBrevet({ brouillon, avant, photos, onFermer }: { brouillon: BrouillonBrevet; avant?: Brevet | undefined; photos: Record<string, string>; onFermer: (fait: boolean) => void }) {
  const [b, setB] = useState<BrouillonBrevet>(brouillon);
  const [enCours, setEnCours] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);
  const suggestions = TYPES_BREVET.find((t) => t.id === b.type)?.suggestions ?? [];
  const recto = b.retirerRecto ? null : avant?.photo_recto ? (photos[avant.photo_recto] ?? null) : null;
  const verso = b.retirerVerso ? null : avant?.photo_verso ? (photos[avant.photo_verso] ?? null) : null;

  const enregistrer = async () => {
    setEnCours(true);
    setErreur(null);
    try {
      await enregistrerBrevet(b, avant);
      onFermer(true);
    } catch (e) {
      console.error(e);
      setErreur("Le brevet n'a pas pu être enregistré. Vérifie ta connexion et réessaie.");
      setEnCours(false);
    }
  };

  return (
    <Feuille titre={avant ? avant.intitule : "Ajouter un brevet"} onFermer={() => onFermer(false)}>
      <div className="flex flex-col gap-[14px]">
        <div className="flex flex-wrap gap-[6px]">
          {TYPES_BREVET.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setB({ ...b, type: t.id })}
              className={`h-[34px] rounded-[17px] px-[13px] text-[13px] font-bold ${b.type === t.id ? "bg-[#0F3D70] text-white" : "border border-[#D8E5EE] text-[#5B7189]"}`}
            >
              {t.libelle}
            </button>
          ))}
        </div>
        <label className="block">
          <span className="block pb-[7px] text-[13px] font-semibold text-[#5B7189]">Intitulé</span>
          <input
            value={b.intitule}
            onChange={(e) => setB({ ...b, intitule: e.target.value })}
            placeholder={suggestions[0]}
            className="block h-[50px] w-full galet-moyen border-[1.5px] border-[#E4EBF1] bg-white px-[16px] text-[15px] outline-none focus:border-[#57D4F5]"
          />
          <span className="flex flex-wrap gap-[5px] pt-[7px]">
            {suggestions.slice(0, 6).map((s) => (
              <button key={s} type="button" onClick={() => setB({ ...b, intitule: s })} className="rounded-[12px] bg-[#EEF4F9] px-[9px] py-[3px] text-[12px] font-semibold text-[#3F5B76]">
                {s}
              </button>
            ))}
          </span>
        </label>
        <div>
          <span className="block pb-[7px] text-[13px] font-semibold text-[#5B7189]">Organisme</span>
          <div className="flex flex-wrap gap-[5px]">
            {ORGANISMES.map((o) => (
              <button
                key={o}
                type="button"
                onClick={() => setB({ ...b, organisme: o })}
                className={`h-[30px] rounded-[15px] px-[11px] text-[12.5px] font-bold ${b.organisme === o ? "bg-[#0F3D70] text-white" : "border border-[#D8E5EE] text-[#5B7189]"}`}
              >
                {o}
              </button>
            ))}
          </div>
        </div>
        <div className="grid grid-cols-2 gap-[10px]">
          <label className="block">
            <span className="block pb-[7px] text-[13px] font-semibold text-[#5B7189]">N° de carte</span>
            <input value={b.numero} onChange={(e) => setB({ ...b, numero: e.target.value })} className="block h-[46px] w-full galet-moyen border-[1.5px] border-[#E4EBF1] px-[12px] text-[15px] outline-none focus:border-[#57D4F5]" />
          </label>
          <label className="block">
            <span className="block pb-[7px] text-[13px] font-semibold text-[#5B7189]">Obtenu le</span>
            <input type="date" value={b.obtenu_le} onChange={(e) => setB({ ...b, obtenu_le: e.target.value })} className="block h-[46px] w-full galet-moyen border-[1.5px] border-[#E4EBF1] px-[10px] text-[14px] outline-none focus:border-[#57D4F5]" />
          </label>
        </div>
        <div className="grid grid-cols-2 gap-[10px]">
          <ChoixPhoto titre="Recto de la carte" actuelle={recto} nouvelle={b.recto ?? null} onChoisir={(f) => setB({ ...b, recto: f, retirerRecto: false })} onRetirer={() => setB({ ...b, recto: null, retirerRecto: true })} />
          <ChoixPhoto titre="Verso" actuelle={verso} nouvelle={b.verso ?? null} onChoisir={(f) => setB({ ...b, verso: f, retirerVerso: false })} onRetirer={() => setB({ ...b, verso: null, retirerVerso: true })} />
        </div>
        {avant?.verifie_le && <p className="text-[12px] text-[#8A5A10]">Cette carte est vérifiée : si tu la modifies, elle devra être vérifiée à nouveau.</p>}
      </div>
      <MessageErreur texte={erreur} />
      <button
        type="button"
        disabled={enCours || !b.intitule.trim()}
        onClick={() => void enregistrer()}
        className="mt-[18px] flex h-14 w-full items-center justify-center galet-moyen bg-[#3DEFBE] text-[14px] font-bold text-[#0B3B63] disabled:opacity-50"
      >
        {enCours ? "ENREGISTREMENT…" : "ENREGISTRER"}
      </button>
      {avant && (
        <button
          type="button"
          onClick={() =>
            void supprimerBrevet(avant)
              .then(() => onFermer(true))
              .catch(() => setErreur("Le brevet n'a pas pu être retiré."))
          }
          className="mx-auto mt-[12px] flex items-center gap-[5px] text-[13px] font-semibold text-[#9DB0C0] underline underline-offset-4"
        >
          <Trash2 className="h-[13px] w-[13px]" /> Retirer ce brevet
        </button>
      )}
    </Feuille>
  );
}
