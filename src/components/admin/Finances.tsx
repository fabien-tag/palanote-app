import { useCallback, useEffect, useState } from "react";
import { Pencil, Plus, Trash2, X } from "lucide-react";
import { Arc, Bloc, carte, Voyant } from "@/components/admin/Bento";
import {
  ajouterDon,
  bilanParMois,
  chargePourMois,
  chargerFinances,
  changerCoutPageIa,
  enregistrerCharge,
  euros,
  membresRecif,
  moisCle,
  supprimerCharge,
  supprimerDon,
  type Charge,
  type DonneesFinances,
} from "@/lib/finances";
import type { StatsAdmin } from "@/lib/suivi";
import { SectionForfaits } from "@/components/admin/Forfaits";

// Section « Finances » du tableau de bord : ce que coûte l'app, ce que rapporte le Récif.

const NOMS_MOIS = ["janv.", "févr.", "mars", "avr.", "mai", "juin", "juil.", "août", "sept.", "oct.", "nov.", "déc."];
const libelleMois = (m: string) => NOMS_MOIS[Number(m.slice(5, 7)) - 1] ?? m;
const champ = "h-[38px] rounded-[10px] border border-[#DCE7F0] bg-white px-[10px] text-[13.5px] outline-none focus:border-[#57D4F5]";

function GraphiqueMois({ bilans }: { bilans: ReturnType<typeof bilanParMois> }) {
  const max = Math.max(1, ...bilans.flatMap((b) => [b.depenses, b.recettes]));
  return (
    <>
      <div className="mt-auto flex h-[170px] items-end gap-[10px] pt-[18px]">
        {bilans.map((b) => (
          <div key={b.mois} className="group relative flex h-full flex-1 items-end justify-center gap-[3px]">
            <div className="w-[42%] max-w-[16px] rounded-full bg-[#F2A48F]" style={{ height: b.depenses ? `${Math.max(3, (b.depenses / max) * 100)}%` : 3 }} />
            <div className="w-[42%] max-w-[16px] rounded-full bg-[#3DCFA3]" style={{ height: b.recettes ? `${Math.max(3, (b.recettes / max) * 100)}%` : 3 }} />
            <div className="pointer-events-none absolute bottom-full left-1/2 z-10 mb-[8px] hidden -translate-x-1/2 whitespace-nowrap rounded-[10px] bg-[#0F2A4A] px-[10px] py-[7px] text-[11.5px] leading-snug text-white shadow-lg group-hover:block">
              <b>{libelleMois(b.mois)} {b.mois.slice(0, 4)}</b>
              <br />
              Dépenses {euros(b.depenses, 2)} (dont IA {euros(b.ia, 2)})
              <br />
              Dons {euros(b.dons, 2)} · forfaits {euros(b.forfaits, 2)}
              <br />
              Solde {euros(b.solde, 2)}
            </div>
          </div>
        ))}
      </div>
      <div className="mt-[8px] flex gap-[10px] text-[11px] text-[#9DB0C0]">
        {bilans.map((b) => (
          <span key={b.mois} className="flex-1 text-center">
            {libelleMois(b.mois)}
          </span>
        ))}
      </div>
    </>
  );
}

function FormCharge({ initiale, onFini }: { initiale?: Charge; onFini: () => void }) {
  const [libelle, setLibelle] = useState(initiale?.libelle ?? "");
  const [categorie, setCategorie] = useState(initiale?.categorie ?? "");
  const [montant, setMontant] = useState(initiale ? String(initiale.montant) : "");
  const [periodicite, setPeriodicite] = useState<Charge["periodicite"]>(initiale?.periodicite ?? "mois");
  const [depuis, setDepuis] = useState(initiale?.depuis ?? `${moisCle(new Date())}-01`);
  const [jusqua, setJusqua] = useState(initiale?.jusqu_a ?? "");
  const [erreur, setErreur] = useState<string | null>(null);
  const valider = async () => {
    const m = Number(montant.replace(",", "."));
    if (!libelle.trim() || !Number.isFinite(m) || m < 0) return setErreur("Un nom et un montant sont nécessaires.");
    try {
      await enregistrerCharge({
        ...(initiale ? { id: initiale.id } : {}),
        libelle: libelle.trim(),
        categorie: categorie.trim() || null,
        montant: m,
        periodicite,
        depuis,
        jusqu_a: jusqua || null,
      });
      onFini();
    } catch (e) {
      console.error("Charge non enregistrée", e);
      setErreur("La charge n'a pas pu être enregistrée.");
    }
  };
  return (
    <div className="flex flex-wrap items-end gap-[8px] rounded-[14px] bg-[#F6F8FA] p-[12px]">
      <input className={`${champ} min-w-[180px] flex-1`} placeholder="Nom (ex. Resend)" value={libelle} onChange={(e) => setLibelle(e.target.value)} />
      <input className={`${champ} w-[130px]`} placeholder="Catégorie" value={categorie} onChange={(e) => setCategorie(e.target.value)} />
      <input className={`${champ} w-[90px]`} placeholder="Montant €" inputMode="decimal" value={montant} onChange={(e) => setMontant(e.target.value)} />
      <select className={champ} value={periodicite} onChange={(e) => setPeriodicite(e.target.value as Charge["periodicite"])}>
        <option value="mois">par mois</option>
        <option value="an">par an</option>
        <option value="unique">une fois</option>
      </select>
      <label className="text-[11.5px] text-[#7D93A8]">
        depuis
        <input type="date" className={`${champ} block`} value={depuis} onChange={(e) => setDepuis(e.target.value)} />
      </label>
      <label className="text-[11.5px] text-[#7D93A8]">
        jusqu'au (arrêt)
        <input type="date" className={`${champ} block`} value={jusqua} onChange={(e) => setJusqua(e.target.value)} />
      </label>
      <button type="button" onClick={() => void valider()} className="h-[38px] rounded-[10px] bg-[#0F2A4A] px-[14px] text-[13px] font-semibold text-white">
        {initiale ? "Enregistrer" : "Ajouter"}
      </button>
      <button type="button" onClick={onFini} aria-label="Annuler" className="flex h-[38px] w-[38px] items-center justify-center rounded-[10px] text-[#7D93A8] hover:bg-white">
        <X className="h-[16px] w-[16px]" />
      </button>
      {erreur && <p className="w-full text-[12.5px] text-[#8A2A1A]">{erreur}</p>}
    </div>
  );
}

function FormDon({ onFini }: { onFini: () => void }) {
  const [prenom, setPrenom] = useState("");
  const [email, setEmail] = useState("");
  const [montant, setMontant] = useState("15");
  const [formule, setFormule] = useState("coup-de-main");
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [note, setNote] = useState("");
  const [erreur, setErreur] = useState<string | null>(null);
  const valider = async () => {
    const m = Number(montant.replace(",", "."));
    if (!Number.isFinite(m) || m <= 0) return setErreur("Le montant doit être positif.");
    try {
      await ajouterDon({ prenom, email, montant: m, formule, recu_le: date, note });
      onFini();
    } catch (e) {
      console.error("Don non enregistré", e);
      setErreur("Le don n'a pas pu être enregistré.");
    }
  };
  return (
    <div className="flex flex-wrap items-end gap-[8px] rounded-[14px] bg-[#F6F8FA] p-[12px]">
      <input className={`${champ} w-[130px]`} placeholder="Prénom" value={prenom} onChange={(e) => setPrenom(e.target.value)} />
      <input className={`${champ} min-w-[180px] flex-1`} placeholder="E-mail (facultatif)" value={email} onChange={(e) => setEmail(e.target.value)} />
      <input className={`${champ} w-[80px]`} inputMode="decimal" value={montant} onChange={(e) => setMontant(e.target.value)} aria-label="Montant en euros" />
      <select
        className={champ}
        value={formule}
        onChange={(e) => {
          setFormule(e.target.value);
          setMontant({ cafe: "5", "coup-de-main": "15", "a-vie": "49" }[e.target.value] ?? montant);
        }}
      >
        <option value="cafe">Un café</option>
        <option value="coup-de-main">Un coup de main</option>
        <option value="a-vie">À vie</option>
        <option value="autre">Autre</option>
      </select>
      <input type="date" className={champ} value={date} onChange={(e) => setDate(e.target.value)} aria-label="Date du don" />
      <input className={`${champ} w-[160px]`} placeholder="Note" value={note} onChange={(e) => setNote(e.target.value)} />
      <button type="button" onClick={() => void valider()} className="h-[38px] rounded-[10px] bg-[#0F2A4A] px-[14px] text-[13px] font-semibold text-white">
        Ajouter
      </button>
      <button type="button" onClick={onFini} aria-label="Annuler" className="flex h-[38px] w-[38px] items-center justify-center rounded-[10px] text-[#7D93A8] hover:bg-white">
        <X className="h-[16px] w-[16px]" />
      </button>
      {erreur && <p className="w-full text-[12.5px] text-[#8A2A1A]">{erreur}</p>}
    </div>
  );
}

export function SectionFinances({ stats }: { stats: StatsAdmin }) {
  const [f, setF] = useState<DonneesFinances | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);
  const [edition, setEdition] = useState<string | "nouvelle" | null>(null);
  const [ajoutDon, setAjoutDon] = useState(false);
  const [coutIa, setCoutIa] = useState("");

  const charger = useCallback(async () => {
    try {
      const d = await chargerFinances();
      setF(d);
      setCoutIa(String(d.coutPageIa).replace(".", ","));
      setErreur(null);
    } catch (e) {
      console.error("Finances non chargées", e);
      setErreur("Les finances n'ont pas pu être chargées. As-tu lancé le script palanote-finances-lettre.sql ?");
    }
  }, []);
  useEffect(() => void charger(), [charger]);

  if (erreur) return <p className="rounded-[16px] bg-[#FFECE8] p-[14px] text-[13.5px] text-[#8A2A1A]">{erreur}</p>;
  if (!f) return <p className="py-[30px] text-center text-[14px] text-[#9DB0C0]">Chargement…</p>;

  const bilans = bilanParMois(f);
  const ceMois = bilans.at(-1)!;
  const total = bilans.reduce(
    (t, b) => ({ depenses: t.depenses + b.depenses, dons: t.dons + b.dons, forfaits: t.forfaits + b.forfaits, recettes: t.recettes + b.recettes }),
    { depenses: 0, dons: 0, forfaits: 0, recettes: 0 },
  );
  const couverture = total.depenses ? total.recettes / total.depenses : 0;
  const membres = membresRecif(f.dons);
  const nouveauxMembres = membresRecif(f.dons.filter((d) => d.recu_le.slice(0, 7) === ceMois.mois));
  const donMoyen = f.dons.length ? f.dons.reduce((t, d) => t + d.montant, 0) / f.dons.length : 15;
  // Ce que coûtera l'année qui vient, au rythme actuel (charges en cours + IA moyenne des 3 derniers mois)
  const chargesMensuelles = f.charges.reduce((t, c) => t + (c.periodicite === "unique" ? 0 : chargePourMois(c, ceMois.mois)), 0);
  const iaMoyenne = bilans.slice(-3).reduce((t, b) => t + b.ia, 0) / 3;
  const coutAnnuel = (chargesMensuelles + iaMoyenne) * 12;
  const membresNecessaires = Math.ceil(coutAnnuel / donMoyen);
  // Le même objectif, en abonnés Palanote+ (19 € par an)
  const abonnesNecessaires = Math.ceil(coutAnnuel / 19);
  const equilibre = total.recettes >= coutAnnuel && coutAnnuel > 0;
  const soldeCouleur = ceMois.solde >= 0 ? "vert" : "rouge";

  return (
    <div className="flex flex-col gap-[12px]">
      <div className="grid grid-cols-1 gap-[12px] md:grid-cols-2 xl:grid-cols-4">
        <Bloc titre="Dépenses ce mois-ci" fond="bg-[linear-gradient(160deg,#FFF7F3_0%,#FBDCCF_100%)]">
          <div className="mt-auto text-[44px] font-light leading-none tracking-[-0.02em] text-[#0F2A4A]">{euros(ceMois.depenses)}</div>
          <p className="pt-[6px] text-[12.5px] text-[#123A63]/65">
            {euros(ceMois.charges)} d'abonnements · {euros(ceMois.ia, 2)} d'IA ({ceMois.pages} pages)
          </p>
        </Bloc>
        <Bloc titre="Recettes ce mois-ci" fond="bg-[linear-gradient(160deg,#F2FBF7_0%,#D3F4E7_100%)]">
          <div className="mt-auto text-[44px] font-light leading-none tracking-[-0.02em] text-[#0F2A4A]">{euros(ceMois.recettes)}</div>
          <p className="pt-[6px] text-[12.5px] text-[#123A63]/65">
            {euros(ceMois.forfaits)} de forfaits · {euros(ceMois.dons)} de dons ({nouveauxMembres} nouveau{nouveauxMembres > 1 ? "x" : ""} membre
            {nouveauxMembres > 1 ? "s" : ""} du Récif)
          </p>
        </Bloc>
        <Bloc titre={ceMois.solde >= 0 ? "Gain du mois" : "Perte du mois"} voyant={soldeCouleur} fond="bg-white border border-[#E9EEF3]">
          <div className={`mt-auto text-[44px] font-light leading-none tracking-[-0.02em] ${ceMois.solde >= 0 ? "text-[#14805F]" : "text-[#C2383D]"}`}>
            {ceMois.solde > 0 ? "+" : ""}
            {euros(ceMois.solde)}
          </div>
          <p className="pt-[6px] text-[12.5px] text-[#123A63]/65">
            Sur 12 mois : {total.recettes - total.depenses >= 0 ? "+" : ""}
            {euros(total.recettes - total.depenses)}
          </p>
        </Bloc>
        <Bloc titre="Couverture sur 12 mois" fond="bg-[linear-gradient(160deg,#F7F5FD_0%,#E1DAF7_100%)]">
          <div className="absolute bottom-[56px] right-[18px] text-[#6E59C9]">
            <Arc part={couverture} couleur="#7C67D6" />
          </div>
          <div className="mt-auto text-[44px] font-light leading-none tracking-[-0.02em] text-[#0F2A4A]">{Math.round(couverture * 100)} %</div>
          <p className="pt-[6px] text-[12.5px] text-[#123A63]/65">
            des dépenses payées par les forfaits et les dons ({euros(total.recettes)} / {euros(total.depenses)})
          </p>
        </Bloc>
      </div>

      <div className="grid grid-cols-1 items-start gap-[12px] xl:grid-cols-[minmax(0,1fr)_360px]">
        <Bloc titre="Dépenses et recettes, 12 derniers mois" fond="bg-white border border-[#E9EEF3]">
          <div className="mt-[6px] flex gap-[16px] text-[12px] text-[#7D93A8]">
            <span className="flex items-center gap-[6px]">
              <span className="h-[9px] w-[9px] rounded-full bg-[#F2A48F]" /> dépenses (abonnements + IA)
            </span>
            <span className="flex items-center gap-[6px]">
              <span className="h-[9px] w-[9px] rounded-full bg-[#3DCFA3]" /> recettes (forfaits + dons du Récif)
            </span>
          </div>
          <GraphiqueMois bilans={bilans} />
        </Bloc>
        <div className="flex flex-col gap-[12px]">
          <Bloc titre="Coût de revient" fond="bg-[linear-gradient(160deg,#F4F9FD_0%,#D9ECF8_100%)]">
            <div className="mt-[14px] flex flex-col gap-[10px] text-[13.5px]">
              {[
                ["Par plongeur actif (30 j)", stats.actifs_30j ? euros(ceMois.depenses / stats.actifs_30j, 2) : "—"],
                ["Par compte", stats.comptes ? euros(ceMois.depenses / stats.comptes, 2) : "—"],
                ["Par page lue par l'IA", euros(f.coutPageIa, 3)],
              ].map(([l, v]) => (
                <div key={l} className="flex items-baseline justify-between gap-2">
                  <span className="text-[#123A63]/70">{l}</span>
                  <b className="text-[16px] font-semibold">{v}</b>
                </div>
              ))}
            </div>
          </Bloc>
          <Bloc titre="L'équilibre" voyant={equilibre ? "vert" : "orange"} fond="bg-white border border-[#E9EEF3]">
            <div className="mt-auto flex items-baseline gap-[8px] text-[#0F2A4A]">
              <span className="text-[44px] font-light leading-none tracking-[-0.02em]">{euros(total.recettes)}</span>
              <span className="text-[13px] text-[#123A63]/60">sur {euros(coutAnnuel)} par an</span>
            </div>
            <p className="pt-[6px] text-[12.5px] leading-snug text-[#123A63]/65">
              Pour couvrir {euros(coutAnnuel)} de dépenses par an, il faudrait environ <b className="text-[#0F2A4A]">{abonnesNecessaires} abonnés Palanote+</b> à 19 €,
              ou <b className="text-[#0F2A4A]">{membresNecessaires} membres du Récif</b> à {euros(donMoyen)}. Aujourd'hui : {membres} membre{membres > 1 ? "s" : ""} du Récif.
            </p>
          </Bloc>
        </div>
      </div>

      {/* Charges */}
      <div className={`${carte} p-[20px]`}>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-[15px] font-semibold">Abonnements et frais</h2>
          <div className="flex items-center gap-[12px]">
            <label className="flex items-center gap-[8px] text-[12.5px] text-[#7D93A8]">
              Coût d'une page lue par l'IA
              <input
                className={`${champ} w-[80px]`}
                inputMode="decimal"
                value={coutIa}
                onChange={(e) => setCoutIa(e.target.value)}
                onBlur={() => {
                  const v = Number(coutIa.replace(",", "."));
                  if (Number.isFinite(v) && v >= 0 && v !== f.coutPageIa) void changerCoutPageIa(v).then(charger).catch((e) => console.error("Coût IA non enregistré", e));
                }}
              />
              €
            </label>
            <button type="button" onClick={() => setEdition("nouvelle")} className="flex h-[34px] items-center gap-[6px] rounded-full bg-[#0F2A4A] px-[14px] text-[12.5px] font-semibold text-white">
              <Plus className="h-[14px] w-[14px]" /> Ajouter
            </button>
          </div>
        </div>
        {edition === "nouvelle" && (
          <div className="mt-[12px]">
            <FormCharge
              onFini={() => {
                setEdition(null);
                void charger();
              }}
            />
          </div>
        )}
        <table className="mt-[10px] w-full text-left text-[13.5px]">
          <tbody>
            {f.charges.map((c) =>
              edition === c.id ? (
                <tr key={c.id}>
                  <td colSpan={5} className="py-[8px]">
                    <FormCharge
                      initiale={c}
                      onFini={() => {
                        setEdition(null);
                        void charger();
                      }}
                    />
                  </td>
                </tr>
              ) : (
                <tr key={c.id} className="border-t border-[#EDF2F7] first:border-t-0">
                  <td className="py-[10px]">
                    <span className="flex items-center gap-[8px]">
                      <Voyant couleur={chargePourMois(c, ceMois.mois) > 0 || (c.periodicite === "unique" && c.depuis.slice(0, 7) >= ceMois.mois) ? "vert" : "gris"} />
                      {c.libelle}
                    </span>
                  </td>
                  <td className="py-[10px] text-[#7D93A8]">{c.categorie ?? ""}</td>
                  <td className="py-[10px] text-right font-semibold">
                    {euros(c.montant, 2)} <span className="font-normal text-[#7D93A8]">{c.periodicite === "mois" ? "/ mois" : c.periodicite === "an" ? "/ an" : "une fois"}</span>
                  </td>
                  <td className="py-[10px] pl-[14px] text-[12px] text-[#9DB0C0]">{c.jusqu_a ? `arrêtée le ${new Date(c.jusqu_a).toLocaleDateString("fr-FR")}` : ""}</td>
                  <td className="w-[80px] py-[10px] text-right">
                    <button type="button" aria-label={`Modifier ${c.libelle}`} onClick={() => setEdition(c.id)} className="rounded-[8px] p-[6px] text-[#7D93A8] hover:bg-[#F6F8FA]">
                      <Pencil className="h-[14px] w-[14px]" />
                    </button>
                    <button
                      type="button"
                      aria-label={`Supprimer ${c.libelle}`}
                      onClick={() => {
                        if (window.confirm(`Supprimer « ${c.libelle} » ? Pour un abonnement arrêté, mets plutôt une date de fin.`))
                          void supprimerCharge(c.id).then(charger).catch((e) => console.error("Charge non supprimée", e));
                      }}
                      className="rounded-[8px] p-[6px] text-[#C94957] hover:bg-[#FFF1EE]"
                    >
                      <Trash2 className="h-[14px] w-[14px]" />
                    </button>
                  </td>
                </tr>
              ),
            )}
          </tbody>
        </table>
        <p className="pt-[8px] text-[12px] text-[#9DB0C0]">
          Le coût de l'IA est estimé : nombre de pages lues × coût d'une page. Ta facture Anthropic exacte est sur console.anthropic.com.
        </p>
      </div>

      {/* Dons */}
      <div className={`${carte} p-[20px]`}>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-[15px] font-semibold">Dons du Récif</h2>
          <button type="button" onClick={() => setAjoutDon(true)} className="flex h-[34px] items-center gap-[6px] rounded-full bg-[#0F2A4A] px-[14px] text-[12.5px] font-semibold text-white">
            <Plus className="h-[14px] w-[14px]" /> Ajouter un don
          </button>
        </div>
        {ajoutDon && (
          <div className="mt-[12px]">
            <FormDon
              onFini={() => {
                setAjoutDon(false);
                void charger();
              }}
            />
          </div>
        )}
        {f.dons.length === 0 ? (
          <p className="py-[20px] text-[13.5px] text-[#9DB0C0]">Aucun don pour l'instant. Tant que le paiement en ligne n'est pas branché, ajoute ici ceux que tu reçois.</p>
        ) : (
          <table className="mt-[10px] w-full text-left text-[13.5px]">
            <tbody>
              {f.dons.map((d) => (
                <tr key={d.id} className="border-t border-[#EDF2F7] first:border-t-0">
                  <td className="py-[10px] font-semibold">{d.prenom || d.email || "Anonyme"}</td>
                  <td className="py-[10px] text-[#7D93A8]">{{ cafe: "Un café", "coup-de-main": "Un coup de main", "a-vie": "À vie" }[d.formule ?? ""] ?? d.formule ?? ""}</td>
                  <td className="py-[10px] text-[#7D93A8]">{new Date(d.recu_le).toLocaleDateString("fr-FR")}</td>
                  <td className="py-[10px] text-[12px] text-[#9DB0C0]">{d.source === "stripe" ? "Stripe" : "saisi à la main"}</td>
                  <td className="py-[10px] text-right font-semibold text-[#14805F]">+{euros(d.montant, 2)}</td>
                  <td className="w-[44px] py-[10px] text-right">
                    <button
                      type="button"
                      aria-label="Supprimer ce don"
                      onClick={() => {
                        if (window.confirm("Supprimer ce don ?")) void supprimerDon(d.id).then(charger).catch((e) => console.error("Don non supprimé", e));
                      }}
                      className="rounded-[8px] p-[6px] text-[#C94957] hover:bg-[#FFF1EE]"
                    >
                      <Trash2 className="h-[14px] w-[14px]" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <SectionForfaits />
    </div>
  );
}
