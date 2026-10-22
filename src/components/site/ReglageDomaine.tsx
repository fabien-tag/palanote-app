import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { CheckCircle2, Copy, ExternalLink, Lock, RefreshCw, XCircle } from "lucide-react";
import { BOUTON_PRINCIPAL, BOUTON_SECONDAIRE, CHAMP } from "@/components/club/parametres/Commun";
import { detailErreur } from "@/components/club/Ui";
import { chargerOffre, CIBLE_DNS, definirDomaine, HEBERGEURS, retirerDomaine, verifierDomaine, type Hebergeur, type OffreClub } from "@/lib/offres";

// « Mon site internet › Nom de domaine » : le club branche son domaine (Premium et Advanced).
// Il l'achète chez son hébergeur, recopie 2 réglages DNS, et l'app vérifie qu'ils sont en place.
export function ReglageDomaine({ centre }: { centre: string }) {
  const [o, setO] = useState<OffreClub | null | undefined>(undefined);
  const [domaine, setDomaine] = useState("");
  const [hebergeur, setHebergeur] = useState<Hebergeur>("ovh");
  const [enCours, setEnCours] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);
  const [resultat, setResultat] = useState<{ txt: boolean; cname: boolean } | null>(null);
  const [copie, setCopie] = useState<string | null>(null);

  useEffect(() => {
    chargerOffre(centre)
      .then((x) => {
        setO(x);
        if (x?.domaine_hebergeur) setHebergeur(x.domaine_hebergeur);
      })
      .catch((e) => {
        setO(null);
        const m = String((e as { message?: string })?.message ?? "");
        setErreur(m.includes("offre_site_club") || (e as { code?: string })?.code === "PGRST202" ? "Lance d'abord le script « palanote-offres-domaine.sql » dans Supabase." : detailErreur(e, "Le domaine n'a pas pu être chargé."));
      });
  }, [centre]);

  if (o === undefined) return <div className="h-[120px] animate-pulse rounded-[10px] bg-[#F1F6FC]" />;
  if (!o) return <p className="text-[13px] font-semibold text-[#8A2A1A]">{erreur}</p>;

  if (o.offre === "starter")
    return (
      <div className="flex flex-col items-start gap-[10px] rounded-[10px] bg-[#F7FAFC] p-[14px]">
        <span className="flex items-center gap-[8px] text-[13.5px] font-bold">
          <Lock className="h-[16px] w-[16px] text-[#106F9F]" aria-hidden="true" /> Compris dans l'offre Premium
        </span>
        <p className="text-[12.5px] leading-normal text-[#566B82]">
          Avec le Premium, ton site s'ouvre à ton adresse, par exemple club-le-lion.fr, au lieu de palanote/clubs/{o.slug}.
        </p>
        <Link to="/club/offre" className={`${BOUTON_PRINCIPAL} h-[38px]`}>
          VOIR LES OFFRES
        </Link>
      </div>
    );

  const copier = (t: string) =>
    void navigator.clipboard?.writeText(t).then(() => {
      setCopie(t);
      setTimeout(() => setCopie(null), 1500);
    });

  const agir = async (f: () => Promise<OffreClub>) => {
    setEnCours(true);
    setErreur(null);
    try {
      setO(await f());
    } catch (e) {
      setErreur(detailErreur(e, "Le domaine n'a pas pu être enregistré."));
    } finally {
      setEnCours(false);
    }
  };

  const verifier = async () => {
    setEnCours(true);
    setErreur(null);
    try {
      const r = await verifierDomaine(centre, o);
      setResultat({ txt: r.txt, cname: r.cname });
      setO(r.offre);
    } catch (e) {
      setErreur(detailErreur(e, "La vérification n'a pas pu se faire."));
    } finally {
      setEnCours(false);
    }
  };

  const heb = HEBERGEURS.find((h) => h.cle === (o.domaine_hebergeur ?? hebergeur)) ?? HEBERGEURS[0]!;

  // Pas encore de domaine : on le saisit
  if (!o.domaine)
    return (
      <div className="flex flex-col gap-[10px]">
        <label className="block">
          <span className="block pb-[6px] text-[12.5px] font-semibold text-[#566B82]">Ton nom de domaine</span>
          <input className={CHAMP} placeholder="club-le-lion.fr" value={domaine} onChange={(e) => setDomaine(e.target.value.toLowerCase().replace(/\s/g, ""))} />
        </label>
        <span className="text-[12.5px] font-semibold text-[#566B82]">Acheté chez</span>
        <div className="flex flex-wrap gap-[6px]">
          {HEBERGEURS.map((h) => (
            <button
              key={h.cle}
              type="button"
              aria-pressed={hebergeur === h.cle}
              onClick={() => setHebergeur(h.cle)}
              className={`h-[34px] rounded-[8px] px-[12px] text-[12.5px] font-semibold ${hebergeur === h.cle ? "bg-[#0F3D70] text-white" : "border border-[#D8E5EE] text-[#566B82]"}`}
            >
              {h.nom}
            </button>
          ))}
        </div>
        {erreur && <p className="text-[12.5px] font-semibold text-[#8A2A1A]">{erreur}</p>}
        <button type="button" disabled={enCours || domaine.length < 4} onClick={() => void agir(() => definirDomaine(centre, domaine, hebergeur))} className={`${BOUTON_PRINCIPAL} w-fit`}>
          BRANCHER CE DOMAINE
        </button>
        <div className="rounded-[10px] bg-[#F7FAFC] p-[12px] text-[12.5px] leading-normal text-[#566B82]">
          <b className="text-[#123A63]">Pas encore de domaine ?</b> Achète-le au nom du club, environ 10 € par an :
          <span className="mt-[6px] flex flex-wrap gap-x-[14px] gap-y-[4px]">
            {HEBERGEURS.filter((h) => h.acheter).map((h) => (
              <a key={h.cle} href={h.acheter!} target="_blank" rel="noreferrer" className="flex items-center gap-[4px] font-bold text-[#106F9F]">
                {h.nom} <ExternalLink className="h-[12px] w-[12px]" aria-hidden="true" />
              </a>
            ))}
          </span>
        </div>
      </div>
    );

  const enregistrements = [
    { type: "TXT", nom: "_palanote", valeur: o.domaine_jeton ?? "", ok: resultat?.txt, role: "prouve que le domaine est au club" },
    { type: "CNAME", nom: "www", valeur: `${CIBLE_DNS}.`, ok: resultat?.cname, role: "envoie les visiteurs vers le site" },
  ];

  return (
    <div className="flex flex-col gap-[12px]">
      <div className="flex flex-wrap items-center gap-[8px]">
        <span className="text-[15px] font-bold">{o.domaine}</span>
        <span className={`rounded-[8px] px-[8px] py-[3px] text-[11.5px] font-bold ${o.domaine_statut === "branche" ? "bg-[#E2F8EF] text-[#137758]" : "bg-[#FFF1D6] text-[#8A5A10]"}`}>
          {o.domaine_statut === "branche" ? "Réglages DNS en place" : "En attente des réglages DNS"}
        </span>
        <span className="text-[12px] text-[#566B82]">chez {heb.nom}</span>
      </div>

      <div className="overflow-hidden rounded-[10px] border border-[#E4EBF1]">
        {enregistrements.map((r) => (
          <div key={r.type} className="flex items-center gap-[10px] border-t border-[#EDF2F7] px-[12px] py-[10px] first:border-t-0">
            <span className="w-[54px] shrink-0 rounded-[6px] bg-[#EEF4F9] py-[3px] text-center text-[11.5px] font-bold">{r.type}</span>
            <span className="min-w-0 flex-1">
              <span className="block text-[12px] text-[#566B82]">
                Nom <b className="font-mono text-[#123A63]">{r.nom}</b> · {r.role}
              </span>
              <span className="block truncate font-mono text-[12.5px] font-semibold">{r.valeur}</span>
            </span>
            {r.ok === true && <CheckCircle2 className="h-[18px] w-[18px] shrink-0 text-[#137758]" aria-label="Trouvé" />}
            {r.ok === false && <XCircle className="h-[18px] w-[18px] shrink-0 text-[#B8432F]" aria-label="Pas encore trouvé" />}
            <button type="button" title="Copier" onClick={() => copier(r.valeur)} className="shrink-0 text-[#566B82] hover:text-[#106F9F]">
              {copie === r.valeur ? <CheckCircle2 className="h-[16px] w-[16px] text-[#137758]" aria-hidden="true" /> : <Copy className="h-[16px] w-[16px]" aria-hidden="true" />}
            </button>
          </div>
        ))}
      </div>

      <ol className="flex flex-col gap-[6px] rounded-[10px] bg-[#F7FAFC] p-[12px] text-[12.5px] leading-snug text-[#3F5B76]">
        {heb.etapes.map((e, i) => (
          <li key={i} className="flex gap-[8px]">
            <span className="flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded-full bg-[#0F3D70] text-[10.5px] font-bold text-white">{i + 1}</span>
            {e}
          </li>
        ))}
        <li className="pl-[26px] text-[#566B82]">Les changements DNS mettent de quelques minutes à quelques heures à se propager.</li>
      </ol>

      {resultat && !(resultat.txt && resultat.cname) && (
        <p className="text-[12.5px] font-semibold text-[#8A5A10]">Pas encore tout à fait : les réglages marqués d'une croix ne sont pas encore visibles. Réessaie dans un moment.</p>
      )}
      {o.domaine_statut === "branche" && (
        <p className="text-[12.5px] leading-normal text-[#137758]">
          Tout est en place côté {heb.nom}. Palanote active ensuite ton domaine et son certificat HTTPS.
        </p>
      )}
      {erreur && <p className="text-[12.5px] font-semibold text-[#8A2A1A]">{erreur}</p>}
      <div className="flex flex-wrap gap-[8px]">
        <button type="button" disabled={enCours} onClick={() => void verifier()} className={`${BOUTON_PRINCIPAL} h-[38px]`}>
          <RefreshCw className={`h-[15px] w-[15px] ${enCours ? "animate-spin" : ""}`} aria-hidden="true" /> VÉRIFIER MAINTENANT
        </button>
        <button type="button" disabled={enCours} onClick={() => void agir(() => retirerDomaine(centre))} className={`${BOUTON_SECONDAIRE} h-[38px]`}>
          Retirer ce domaine
        </button>
      </div>
    </div>
  );
}
