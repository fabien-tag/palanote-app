import { useEffect, useRef, useState, type ReactNode } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { ChevronDown, Copy, ExternalLink, ImagePlus, Monitor, Plus, Smartphone, Trash2, Upload } from "lucide-react";
import { useConnexionRequise } from "@/components/numerisation/Ui";
import { NavigationDpMobile } from "@/components/club/NavigationDp";
import { detailErreur, MessageErreur, PageClub } from "@/components/club/Ui";
import { useCentre } from "@/components/club/useCentre";
import { BOUTON_PRINCIPAL, BOUTON_SECONDAIRE, Bascule, CHAMP, Libelle } from "@/components/club/parametres/Commun";
import { SiteClub } from "@/components/site/SiteClub";
import { ReglageDomaine } from "@/components/site/ReglageDomaine";
import {
  CHIFFRES_DEFAUT,
  CHIFFRES_SITE,
  chargerMonSite,
  enregistrerSite,
  envoyerImageSite,
  lienSite,
  MODELES,
  nombre,
  PALETTES,
  POLICES_SITE,
  type ContenuSite,
  type ReglagesSite,
  type Sections,
  type Tarif,
  type Zone,
} from "@/lib/siteClub";

// « Mon site internet » : le DP règle le site vitrine du club (offre Starter),
// avec l'aperçu en direct à droite. Le contenu vivant (formations, matériel, équipe)
// vient du back-office : rien à ressaisir.
export const Route = createFileRoute("/_dp/club_/site")({
  head: () => ({
    meta: [{ title: "Palanote — Mon site internet" }],
    links: [{ rel: "stylesheet", href: POLICES_SITE }],
  }),
  component: PageMonSite,
});

type Rubrique = "apparence" | "tarifs" | "chiffres" | "domaine" | "textes" | "sites" | "contact" | "rubriques";

const ZONE_VIDE: Zone = { nom: "", profondeur: "", niveau: "", description: "" };
const NIVEAUX_ZONE = ["", "baptême", "N1", "N2", "N3"];

function PageMonSite() {
  const { pret, ecran } = useConnexionRequise();
  const { centre, erreur: erreurCentre } = useCentre(pret);
  const [contenu, setContenu] = useState<ContenuSite | null>(null);
  const [brouillon, setBrouillon] = useState<ReglagesSite | null>(null);
  const [ouverte, setOuverte] = useState<Rubrique>("apparence");
  const [vue, setVue] = useState<"ordinateur" | "telephone">("ordinateur");
  const [enCours, setEnCours] = useState(false);
  const [envoi, setEnvoi] = useState<null | "logo" | "couverture">(null);
  const [erreur, setErreur] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!centre) return;
    chargerMonSite(centre.id)
      .then((c) => {
        setContenu(c);
        setBrouillon(c.site);
      })
      .catch((e) => setErreur(scriptManquant(e) ? "Lance d'abord le script « palanote-site-club.sql » dans Supabase." : detailErreur(e, "Le site n'a pas pu être chargé.")));
  }, [centre]);

  useEffect(() => {
    if (!message) return;
    const t = setTimeout(() => setMessage(null), 3000);
    return () => clearTimeout(t);
  }, [message]);

  if (ecran) return ecran;

  const modifie = Boolean(brouillon && contenu && JSON.stringify(brouillon) !== JSON.stringify(contenu.site));
  const maj = <K extends keyof ReglagesSite>(k: K, v: ReglagesSite[K]) => {
    setMessage(null);
    setBrouillon((b) => (b ? { ...b, [k]: v } : b));
  };

  const enregistrer = async (publier?: boolean) => {
    if (!centre || !brouillon) return;
    setEnCours(true);
    setErreur(null);
    try {
      const { centre_id: _c, updated_at: _u, offre: _o, ...reglages } = brouillon;
      const c = await enregistrerSite(centre.id, {
        ...reglages,
        zones: reglages.zones.filter((z) => z.nom.trim()),
        tarifs: (reglages.tarifs ?? [])
          .filter((t) => t.libelle.trim())
          .map((t) => ({ ...t, prix: t.prix === "" || t.prix === null ? null : Number(String(t.prix).replace(",", ".")) })),
        ...(publier === undefined ? {} : { publie: publier }) });
      // Base pas à jour : les chiffres clés et la note Google ne sont pas enregistrés (on garde la saisie)
      const manque = !("chiffres" in c.site);
      setContenu(c);
      setBrouillon(
        manque
          ? {
              ...c.site,
              annee_creation: brouillon.annee_creation ?? null,
              satisfaction: brouillon.satisfaction ?? null,
              note_google: brouillon.note_google ?? null,
              nb_avis_google: brouillon.nb_avis_google ?? null,
              lien_google: brouillon.lien_google ?? null,
              chiffres: brouillon.chiffres ?? [],
            }
          : c.site,
      );
      if (manque) {
        setErreur("Les chiffres clés et la note Google n'ont pas été enregistrés : relance le script « palanote-site-club.sql » dans Supabase.");
        return;
      }
      setMessage(publier === true ? "Site publié." : publier === false ? "Site retiré d'internet." : "Modifications enregistrées.");
    } catch (e) {
      setErreur(detailErreur(e, "Le site n'a pas pu être enregistré."));
    } finally {
      setEnCours(false);
    }
  };

  const envoyer = async (quoi: "logo" | "couverture", f: File | undefined) => {
    if (!f || !centre) return;
    if (!["image/png", "image/jpeg", "image/webp"].includes(f.type)) return setErreur("Choisis une image PNG ou JPEG.");
    if (f.size > 5 * 1024 * 1024) return setErreur("L'image dépasse 5 Mo : réduis-la avant de l'envoyer.");
    setEnvoi(quoi);
    setErreur(null);
    try {
      const url = await envoyerImageSite(centre.id, quoi, f);
      maj(quoi === "logo" ? "logo_url" : "couverture_url", url);
    } catch (e) {
      setErreur(detailErreur(e, "L'image n'a pas pu être envoyée."));
    } finally {
      setEnvoi(null);
    }
  };

  const b = brouillon;

  return (
    <PageClub titre="Mon site internet" large="plein" navigation={<NavigationDpMobile />}>
      <MessageErreur texte={erreurCentre ?? erreur} />
      {!b || !contenu ? (
        !erreur && <div className="h-[420px] animate-pulse rounded-[14px] bg-white/60" />
      ) : (
        <>
          {/* Barre d'état : adresse, offre, publication */}
          <div className="flex flex-wrap items-center gap-[12px] rounded-[14px] border border-[#E4EBF1] bg-white px-[16px] py-[12px]">
            <span className={`rounded-[8px] px-[10px] py-[5px] text-[12px] font-bold ${b.publie ? "bg-[#E2F8EF] text-[#14805F]" : "bg-[#FFF1D6] text-[#8A5A10]"}`}>
              {b.publie ? "En ligne" : "Brouillon"}
            </span>
            <Link to="/club/offre" title="Voir les offres" className="rounded-[8px] bg-[#E3F2FB] px-[10px] py-[5px] text-[12px] font-bold text-[#1176A8] hover:bg-[#D5EBF8]">
              Offre {contenu.site.offre === "advanced" ? "Advanced" : contenu.site.offre === "premium" ? "Premium" : "Starter"}
            </Link>
            <span className="min-w-0 truncate text-[13px] text-[#5B7189]">
              {lienSite(contenu.site.slug)}
            </span>
            <button type="button" title="Copier l'adresse" onClick={() => void navigator.clipboard?.writeText(lienSite(contenu.site.slug)).then(() => setMessage("Adresse copiée."))} className="text-[#7D93A8] hover:text-[#1176A8]">
              <Copy className="h-[16px] w-[16px]" aria-hidden="true" />
            </button>
            <a href={`/clubs/${contenu.site.slug}`} target="_blank" rel="noreferrer" className="flex items-center gap-[5px] text-[13px] font-bold text-[#1176A8]">
              Ouvrir <ExternalLink className="h-[14px] w-[14px]" aria-hidden="true" />
            </a>
            <span className="ml-auto flex flex-wrap items-center gap-[10px]">
              {message && <span className="text-[13px] font-semibold text-[#14805F]">{message}</span>}
              {modifie && (
                <button type="button" disabled={enCours} onClick={() => setBrouillon(contenu.site)} className={BOUTON_SECONDAIRE}>
                  Annuler
                </button>
              )}
              <button type="button" disabled={!modifie || enCours} onClick={() => void enregistrer()} className={BOUTON_SECONDAIRE}>
                Enregistrer
              </button>
              <button type="button" disabled={enCours} onClick={() => void enregistrer(contenu.site.publie ? modifie : true)} className={BOUTON_PRINCIPAL}>
                {contenu.site.publie ? (modifie ? "ENREGISTRER ET GARDER EN LIGNE" : "RETIRER D'INTERNET") : "PUBLIER LE SITE"}
              </button>
            </span>
          </div>

          <div className="grid grid-cols-1 gap-[20px] pt-[16px] xl:grid-cols-[400px_minmax(0,1fr)]">
            {/* ——— Réglages ——— */}
            <div className="flex flex-col gap-[10px]">
              <Volet titre="Apparence" texte="Modèle, couleurs, logo, photo" ouvert={ouverte === "apparence"} onClick={() => setOuverte("apparence")}>
                <p className="pb-[8px] text-[12.5px] font-semibold text-[#5B7189]">Modèle de page</p>
                <div className="grid grid-cols-2 gap-[8px]">
                  {MODELES.map((m) => (
                    <button
                      key={m.id}
                      type="button"
                      aria-pressed={b.modele === m.id}
                      onClick={() => setBrouillon({ ...b, modele: m.id, couleur_fond: m.fond, couleur_texte: m.texteCouleur })}
                      className={`overflow-hidden rounded-[12px] border-[1.5px] text-left ${b.modele === m.id ? "border-[#3DEFBE]" : "border-[#E4EBF1] hover:border-[#B8D9EA]"}`}
                    >
                      <span className="block h-[54px]" style={{ background: `linear-gradient(160deg, ${b.couleur_secondaire}, ${b.couleur_accent})` }}>
                        <span className="block h-full w-full" style={{ background: `linear-gradient(0deg, ${m.fond} 30%, transparent 30%)` }} />
                      </span>
                      <span className="block px-[10px] py-[8px]">
                        <span className="block text-[13px] font-bold" style={{ fontFamily: m.titres }}>
                          {m.nom}
                        </span>
                        <span className="block text-[11.5px] text-[#7D93A8]">{m.texte}</span>
                      </span>
                    </button>
                  ))}
                </div>

                <p className="pb-[8px] pt-[16px] text-[12.5px] font-semibold text-[#5B7189]">Palettes</p>
                <div className="flex flex-wrap gap-[8px]">
                  {PALETTES.map((p) => {
                    const actif = b.couleur_accent === p.accent && b.couleur_secondaire === p.secondaire && b.couleur_tertiaire === p.tertiaire;
                    return (
                      <button
                        key={p.nom}
                        type="button"
                        title={p.nom}
                        aria-pressed={actif}
                        onClick={() => setBrouillon({ ...b, couleur_accent: p.accent, couleur_secondaire: p.secondaire, couleur_tertiaire: p.tertiaire })}
                        className={`flex items-center gap-[6px] rounded-[10px] border-[1.5px] py-[5px] pl-[6px] pr-[10px] text-[12px] font-semibold ${actif ? "border-[#3DEFBE] bg-[#E2F8EF]" : "border-[#E4EBF1] bg-white"}`}
                      >
                        <span className="flex">
                          {[p.accent, p.secondaire, p.tertiaire].map((c) => (
                            <span key={c} className="-mr-[4px] h-[16px] w-[16px] rounded-full ring-2 ring-white" style={{ background: c }} />
                          ))}
                        </span>
                        <span className="pl-[4px]">{p.nom}</span>
                      </button>
                    );
                  })}
                </div>

                <div className="grid grid-cols-1 gap-[2px] pt-[14px]">
                  <Couleur label="Couleur d'accent" aide="boutons, liens, chiffres" valeur={b.couleur_accent} onChange={(v) => maj("couleur_accent", v)} />
                  <Couleur label="Couleur secondaire" aide="haut de page, pied de page" valeur={b.couleur_secondaire} onChange={(v) => maj("couleur_secondaire", v)} />
                  <Couleur label="Troisième couleur" aide="touches de couleur" valeur={b.couleur_tertiaire} onChange={(v) => maj("couleur_tertiaire", v)} />
                  <Couleur label="Fond de page" valeur={b.couleur_fond} onChange={(v) => maj("couleur_fond", v)} />
                  <Couleur label="Texte" valeur={b.couleur_texte} onChange={(v) => maj("couleur_texte", v)} />
                </div>

                <div className="grid grid-cols-2 gap-[10px] pt-[14px]">
                  <Image
                    label="Logo"
                    aide="PNG ou JPEG, carré de préférence"
                    url={b.logo_url}
                    enCours={envoi === "logo"}
                    rond
                    onFichier={(f) => void envoyer("logo", f)}
                    onRetirer={() => maj("logo_url", null)}
                  />
                  <Image
                    label="Photo de couverture"
                    aide="Large, au moins 1600 px"
                    url={b.couverture_url}
                    enCours={envoi === "couverture"}
                    onFichier={(f) => void envoyer("couverture", f)}
                    onRetirer={() => maj("couverture_url", null)}
                  />
                </div>
              </Volet>

              <Volet titre="Tarifs" texte="Baptême et plongées ; les niveaux viennent de Formations" ouvert={ouverte === "tarifs"} onClick={() => setOuverte("tarifs")}>
                <div className="flex flex-col gap-[10px]">
                  {b.tarifs.map((t, i) => {
                    const majTarif = (champ: Partial<Tarif>) => maj("tarifs", b.tarifs.map((x, j) => (j === i ? { ...x, ...champ } : x)));
                    return (
                      <div key={i} className="rounded-[10px] border border-[#EDF2F7] p-[10px]">
                        <div className="flex gap-[8px]">
                          <input className={CHAMP} value={t.libelle} placeholder="Plongée épave" onChange={(e) => majTarif({ libelle: e.target.value })} />
                          <div className="relative w-[96px] shrink-0">
                            <input
                              className={`${CHAMP} pr-[24px] text-right`}
                              inputMode="decimal"
                              value={t.prix ?? ""}
                              placeholder="Prix"
                              aria-label="Prix en euros"
                              onChange={(e) => majTarif({ prix: e.target.value.replace(/[^\d,.]/g, "").slice(0, 7) })}
                            />
                            <span className="pointer-events-none absolute right-[10px] top-[12px] text-[13px] text-[#9DB0C0]">€</span>
                          </div>
                          <button type="button" aria-label="Retirer ce tarif" onClick={() => maj("tarifs", b.tarifs.filter((_, j) => j !== i))} className="shrink-0 px-[4px] text-[#9DB0C0] hover:text-[#C94957]">
                            <Trash2 className="h-[16px] w-[16px]" aria-hidden="true" />
                          </button>
                        </div>
                        <input className={`${CHAMP} mt-[8px]`} value={t.detail} placeholder="Une phrase : pour qui, ce qui est compris" onChange={(e) => majTarif({ detail: e.target.value })} />
                        <div className="flex gap-[6px] pt-[8px]">
                          {(
                            [
                              ["formation", "Avec le baptême et les niveaux"],
                              ["plongee", "Avec les plongées"],
                            ] as const
                          ).map(([g, label]) => (
                            <button
                              key={g}
                              type="button"
                              aria-pressed={t.groupe === g}
                              onClick={() => majTarif({ groupe: g })}
                              className={`h-[30px] rounded-[8px] px-[10px] text-[12px] font-semibold ${t.groupe === g ? "bg-[#0F3D70] text-white" : "border border-[#D8E5EE] text-[#5B7189]"}`}
                            >
                              {label}
                            </button>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                  <button type="button" onClick={() => maj("tarifs", [...b.tarifs, { libelle: "", detail: "", prix: "", groupe: "plongee" }])} className={`${BOUTON_SECONDAIRE} h-[36px] w-fit`}>
                    <Plus className="h-[15px] w-[15px]" aria-hidden="true" /> Ajouter un tarif
                  </button>
                  <p className="text-[12px] leading-normal text-[#7D93A8]">
                    Les prix des niveaux ({contenu.formations.filter((f) => f.categorie === "niveau").map((f) => f.code).join(", ") || "aucun pour l'instant"}) viennent du catalogue Formations : modifie-les là-bas.
                  </p>
                </div>
              </Volet>

              <Volet titre="Chiffres clés et avis Google" texte="4 chiffres sous le haut de page, la note Google" ouvert={ouverte === "chiffres"} onClick={() => setOuverte("chiffres")}>
                <div className="grid grid-cols-2 gap-[10px]">
                  <Libelle texte="Année de création du club">
                    <input className={CHAMP} inputMode="numeric" placeholder="1984" value={b.annee_creation ?? ""} onChange={(e) => maj("annee_creation", e.target.value.replace(/\D/g, "").slice(0, 4))} />
                  </Libelle>
                  <Libelle texte="Plongeurs satisfaits (%)">
                    <input className={CHAMP} inputMode="numeric" placeholder="98" value={b.satisfaction ?? ""} onChange={(e) => maj("satisfaction", e.target.value.replace(/\D/g, "").slice(0, 3))} />
                  </Libelle>
                  <Libelle texte="Note Google (sur 5)">
                    <input className={CHAMP} inputMode="decimal" placeholder="4,8" value={b.note_google ?? ""} onChange={(e) => maj("note_google", e.target.value.replace(/[^\d,.]/g, "").slice(0, 3))} />
                  </Libelle>
                  <Libelle texte="Nombre d'avis Google">
                    <input className={CHAMP} inputMode="numeric" placeholder="126" value={b.nb_avis_google ?? ""} onChange={(e) => maj("nb_avis_google", e.target.value.replace(/\D/g, "").slice(0, 6))} />
                  </Libelle>
                  <div className="col-span-2">
                    <Libelle texte="Lien vers la fiche Google du club">
                      <input className={CHAMP} type="url" placeholder="https://g.page/…" value={b.lien_google ?? ""} onChange={(e) => maj("lien_google", e.target.value)} />
                    </Libelle>
                  </div>
                </div>
                <p className="pt-[8px] text-[12px] leading-normal text-[#7D93A8]">
                  La note s'affiche en haut du site et mène à ta fiche Google : recopie-la de temps en temps. Le pourcentage de satisfaits est déclaré par le club.
                </p>
                <p className="pt-[16px] text-[12.5px] font-semibold text-[#5B7189]">Les chiffres affichés (4 au plus, dans l'ordre choisi)</p>
                <p className="pb-[6px] text-[11.5px] text-[#9DB0C0]">Touche un chiffre pour l'ajouter ou le retirer ; quand il y en a déjà 4, il remplace le dernier.</p>
                {(() => {
                  const choisis = b.chiffres && b.chiffres.length > 0 ? b.chiffres : CHIFFRES_DEFAUT;
                  const profondeurs = b.zones.map((z) => nombre(z.profondeur) ?? 0);
                  const valeur: Record<string, string | null> = {
                    annees: nombre(b.annee_creation) ? `${new Date().getFullYear() - nombre(b.annee_creation)!} ans` : null,
                    encadrants: contenu.equipe.filter((e) => e.role !== "pilote").length > 0 ? String(contenu.equipe.filter((e) => e.role !== "pilote").length) : null,
                    satisfaction: nombre(b.satisfaction) !== null ? `${nombre(b.satisfaction)} %` : null,
                    google: nombre(b.note_google) !== null ? `${nombre(b.note_google)!.toLocaleString("fr-FR")}/5` : null,
                    sites: b.zones.length > 0 ? String(b.zones.length) : null,
                    formations: contenu.formations.length > 0 ? String(contenu.formations.length) : null,
                    profondeur: Math.max(0, ...profondeurs) > 0 ? `${Math.max(0, ...profondeurs)} m` : null,
                    places: contenu.bateaux.some((x) => parseInt(x.places ?? "", 10) > 0) ? String(Math.max(...contenu.bateaux.map((x) => parseInt(x.places ?? "", 10) || 0))) : null,
                  };
                  return CHIFFRES_SITE.map((c) => {
                    const rang = choisis.indexOf(c.cle);
                    const coche = rang >= 0;
                    return (
                      <button
                        key={c.cle}
                        type="button"
                        aria-pressed={coche}
                        onClick={() =>
                          // 4 au plus : un 5e chiffre prend la place du dernier choisi
                          maj("chiffres", coche ? choisis.filter((x) => x !== c.cle) : [...choisis.slice(0, 3), c.cle])
                        }
                        className="flex w-full items-center gap-[10px] border-t border-[#EDF2F7] py-[9px] text-left first-of-type:border-t-0 disabled:opacity-40"
                      >
                        <span className={`flex h-[22px] w-[22px] shrink-0 items-center justify-center rounded-[6px] text-[11.5px] font-bold ${coche ? "bg-[#0F3D70] text-white" : "border border-[#C9D9E5]"}`}>{coche ? rang + 1 : ""}</span>
                        <span className="min-w-0 flex-1 text-[13.5px] font-bold">{c.nom}</span>
                        <span className={`text-[12.5px] ${valeur[c.cle] ? "font-semibold text-[#1176A8]" : "text-[#C9A15A]"}`}>{valeur[c.cle] ?? "à renseigner"}</span>
                      </button>
                    );
                  });
                })()}
              </Volet>

              <Volet titre="Textes" texte="Accroche, présentation, points forts" ouvert={ouverte === "textes"} onClick={() => setOuverte("textes")}>
                <div className="flex flex-col gap-[12px]">
                  <Libelle texte="Grand titre">
                    <input className={CHAMP} value={b.accroche ?? ""} maxLength={70} onChange={(e) => maj("accroche", e.target.value)} />
                  </Libelle>
                  <Libelle texte="Sous le titre">
                    <textarea className={`${CHAMP} h-[70px] resize-none py-[10px]`} value={b.sous_titre ?? ""} maxLength={160} onChange={(e) => maj("sous_titre", e.target.value)} />
                  </Libelle>
                  <Libelle texte="Présentation du club">
                    <textarea className={`${CHAMP} h-[110px] resize-y py-[10px]`} value={b.presentation ?? ""} maxLength={900} onChange={(e) => maj("presentation", e.target.value)} />
                  </Libelle>
                  <p className="pt-[4px] text-[12.5px] font-semibold text-[#5B7189]">Points forts du club</p>
                  {b.atouts.map((a, i) => (
                    <div key={i} className="rounded-[10px] border border-[#EDF2F7] p-[10px]">
                      <div className="flex gap-[8px]">
                        <input className={CHAMP} value={a.titre} placeholder="Titre" onChange={(e) => maj("atouts", b.atouts.map((x, j) => (j === i ? { ...x, titre: e.target.value } : x)))} />
                        <button type="button" aria-label="Retirer" onClick={() => maj("atouts", b.atouts.filter((_, j) => j !== i))} className="shrink-0 px-[6px] text-[#9DB0C0] hover:text-[#C94957]">
                          <Trash2 className="h-[16px] w-[16px]" aria-hidden="true" />
                        </button>
                      </div>
                      <textarea className={`${CHAMP} mt-[8px] h-[60px] resize-none py-[8px]`} value={a.texte} placeholder="Une phrase" onChange={(e) => maj("atouts", b.atouts.map((x, j) => (j === i ? { ...x, texte: e.target.value } : x)))} />
                    </div>
                  ))}
                  {b.atouts.length < 6 && (
                    <button type="button" onClick={() => maj("atouts", [...b.atouts, { titre: "", texte: "" }])} className={`${BOUTON_SECONDAIRE} h-[36px] w-fit`}>
                      <Plus className="h-[15px] w-[15px]" aria-hidden="true" /> Ajouter un point fort
                    </button>
                  )}
                </div>
              </Volet>

              <Volet titre="Sites de plongée" texte={`${b.zones.length} site${b.zones.length > 1 ? "s" : ""}, avec profondeur et niveau`} ouvert={ouverte === "sites"} onClick={() => setOuverte("sites")}>
                <div className="flex flex-col gap-[10px]">
                  {b.zones.map((z, i) => {
                    const majZone = (champ: Partial<Zone>) => maj("zones", b.zones.map((x, j) => (j === i ? { ...x, ...champ } : x)));
                    return (
                      <div key={i} className="rounded-[10px] border border-[#EDF2F7] p-[10px]">
                        <div className="flex gap-[8px]">
                          <input className={CHAMP} value={z.nom} placeholder="Nom du site" onChange={(e) => majZone({ nom: e.target.value })} />
                          <button type="button" aria-label="Retirer le site" onClick={() => maj("zones", b.zones.filter((_, j) => j !== i))} className="shrink-0 px-[6px] text-[#9DB0C0] hover:text-[#C94957]">
                            <Trash2 className="h-[16px] w-[16px]" aria-hidden="true" />
                          </button>
                        </div>
                        <div className="grid grid-cols-2 gap-[8px] pt-[8px]">
                          <input
                            className={CHAMP}
                            inputMode="numeric"
                            value={z.profondeur ?? ""}
                            placeholder="Profondeur (m)"
                            onChange={(e) => majZone({ profondeur: e.target.value.replace(/[^\d]/g, "").slice(0, 3) })}
                          />
                          <select className={CHAMP} value={z.niveau} onChange={(e) => majZone({ niveau: e.target.value })}>
                            {NIVEAUX_ZONE.map((n) => (
                              <option key={n} value={n}>
                                {n ? `Dès le ${n}` : "Niveau requis"}
                              </option>
                            ))}
                          </select>
                        </div>
                        <textarea className={`${CHAMP} mt-[8px] h-[56px] resize-none py-[8px]`} value={z.description} placeholder="Ce qu'on y voit : tombant, épave, mérous…" onChange={(e) => majZone({ description: e.target.value })} />
                      </div>
                    );
                  })}
                  <div className="flex flex-wrap gap-[8px]">
                    <button type="button" onClick={() => maj("zones", [...b.zones, { ...ZONE_VIDE }])} className={`${BOUTON_SECONDAIRE} h-[36px]`}>
                      <Plus className="h-[15px] w-[15px]" aria-hidden="true" /> Ajouter un site
                    </button>
                    {(contenu.zones_sorties ?? []).some((z) => !b.zones.some((x) => x.nom.trim().toLowerCase() === z.nom.trim().toLowerCase())) && (
                      <button
                        type="button"
                        onClick={() =>
                          maj("zones", [
                            ...b.zones,
                            ...(contenu.zones_sorties ?? []).filter((z) => !b.zones.some((x) => x.nom.trim().toLowerCase() === z.nom.trim().toLowerCase())),
                          ])
                        }
                        className={`${BOUTON_SECONDAIRE} h-[36px]`}
                      >
                        Reprendre les sites de mes sorties
                      </button>
                    )}
                  </div>
                </div>
              </Volet>

              <Volet titre="Coordonnées et infos pratiques" texte="Téléphone, e-mail, adresse, horaires" ouvert={ouverte === "contact"} onClick={() => setOuverte("contact")}>
                <div className="grid grid-cols-2 gap-[10px]">
                  <Libelle texte="Téléphone">
                    <input className={CHAMP} type="tel" value={b.telephone ?? ""} placeholder="04 67 00 00 00" onChange={(e) => maj("telephone", e.target.value)} />
                  </Libelle>
                  <Libelle texte="E-mail">
                    <input className={CHAMP} type="email" value={b.email ?? ""} placeholder="contact@club.fr" onChange={(e) => maj("email", e.target.value)} />
                  </Libelle>
                  <div className="col-span-2">
                    <Libelle texte="Adresse">
                      <input className={CHAMP} value={b.adresse ?? ""} placeholder="Quai du port, 34250 Palavas-les-Flots" onChange={(e) => maj("adresse", e.target.value)} />
                    </Libelle>
                  </div>
                  <div className="col-span-2">
                    <Libelle texte="Horaires">
                      <textarea className={`${CHAMP} h-[60px] resize-none py-[8px]`} value={b.horaires ?? ""} placeholder="Tous les jours de 8 h à 18 h en saison" onChange={(e) => maj("horaires", e.target.value)} />
                    </Libelle>
                  </div>
                  <div className="col-span-2">
                    <Libelle texte="Saison">
                      <input className={CHAMP} value={b.saison ?? ""} onChange={(e) => maj("saison", e.target.value)} />
                    </Libelle>
                  </div>
                  <div className="col-span-2">
                    <Libelle texte="À prévoir">
                      <textarea className={`${CHAMP} h-[80px] resize-none py-[8px]`} value={b.infos ?? ""} onChange={(e) => maj("infos", e.target.value)} />
                    </Libelle>
                  </div>
                </div>
              </Volet>

              <Volet titre="Nom de domaine" texte="Ton site à ton adresse (Premium)" ouvert={ouverte === "domaine"} onClick={() => setOuverte("domaine")}>
                {centre && <ReglageDomaine centre={centre.id} />}
              </Volet>

              <Volet titre="Rubriques et adresse" texte="Ce qui s'affiche, l'adresse du site" ouvert={ouverte === "rubriques"} onClick={() => setOuverte("rubriques")}>
                {(
                  [
                    ["tarifs", "Tarifs", `${b.tarifs.length} tarif${b.tarifs.length > 1 ? "s" : ""} et les niveaux`],
                    ["formations", "Formations", `${contenu.formations.length} dans le catalogue`],
                    ["zones", "Sites de plongée", `${b.zones.length} site${b.zones.length > 1 ? "s" : ""}`],
                    ["materiel", "Bateau et matériel", `${contenu.bateaux.length} bateau${contenu.bateaux.length > 1 ? "x" : ""}, ${contenu.equipement.reduce((n, e) => n + e.nb, 0)} pièces`],
                    ["equipe", "L'équipe", `${contenu.equipe.length} personne${contenu.equipe.length > 1 ? "s" : ""}`],
                    ["infos", "Infos pratiques et contact", ""],
                    ["palanote", "Bloc Palanote", "L'app du club, en bas de page"],
                  ] as [keyof Sections, string, string][]
                ).map(([cle, titre, texte]) => (
                  <div key={cle} className="flex items-center gap-[12px] border-t border-[#EDF2F7] py-[11px] first:border-t-0">
                    <span className="min-w-0 flex-1">
                      <span className="block text-[13.5px] font-bold">{titre}</span>
                      {texte && <span className="block text-[12px] text-[#7D93A8]">{texte}</span>}
                    </span>
                    <Bascule actif={b.sections[cle] !== false} label={titre} onChange={(v) => maj("sections", { ...b.sections, [cle]: v })} />
                  </div>
                ))}
                <p className="pt-[6px] text-[12px] leading-normal text-[#7D93A8]">
                  Les formations, le bateau, le matériel et l'équipe viennent directement de Formations, Matériel et Équipe : une mise à jour là-bas change le site.
                </p>
                <div className="pt-[14px]">
                  <Libelle texte="Adresse du site">
                    <div className="flex items-center overflow-hidden rounded-[10px] border-[1.5px] border-[#E4EBF1] bg-white focus-within:border-[#57D4F5]">
                      <span className="pl-[12px] text-[13px] text-[#9DB0C0]">/clubs/</span>
                      <input
                        className="h-[42px] min-w-0 flex-1 bg-transparent pr-[12px] text-[14px] outline-none"
                        value={b.slug}
                        onChange={(e) => maj("slug", e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, "-").replace(/-+/g, "-").slice(0, 60))}
                      />
                    </div>
                  </Libelle>
                </div>
              </Volet>
            </div>

            {/* ——— Aperçu en direct ——— */}
            <div className="min-w-0 xl:sticky xl:top-[92px] xl:self-start">
              <div className="flex items-center gap-[10px] pb-[10px]">
                <span className="text-[13px] font-bold text-[#5B7189]">Aperçu en direct</span>
                <span className="ml-auto flex rounded-[10px] border border-[#D8E5EE] bg-white p-[3px]">
                  {(
                    [
                      ["ordinateur", Monitor, "Ordinateur"],
                      ["telephone", Smartphone, "Téléphone"],
                    ] as const
                  ).map(([v, Icone, label]) => (
                    <button
                      key={v}
                      type="button"
                      aria-pressed={vue === v}
                      onClick={() => setVue(v)}
                      className={`flex h-[30px] items-center gap-[6px] rounded-[8px] px-[10px] text-[12.5px] font-bold ${vue === v ? "bg-[#0F3D70] text-white" : "text-[#5B7189]"}`}
                    >
                      <Icone className="h-[14px] w-[14px]" aria-hidden="true" /> {label}
                    </button>
                  ))}
                </span>
              </div>
              <Apercu largeur={vue === "ordinateur" ? 1280 : 390}>
                <SiteClub contenu={{ ...contenu, site: { ...b, zones: b.zones.filter((z) => z.nom.trim()) } }} apercu />
              </Apercu>
            </div>
          </div>
        </>
      )}
    </PageClub>
  );
}

// Le site rendu à sa vraie largeur (1280 px ou 390 px), réduit pour tenir dans la colonne
function Apercu({ largeur, children }: { largeur: number; children: ReactNode }) {
  const cadre = useRef<HTMLDivElement>(null);
  const [zoom, setZoom] = useState(0.5);
  useEffect(() => {
    const el = cadre.current;
    if (!el) return;
    const calculer = () => setZoom(Math.min(1, (el.clientWidth - 2) / largeur));
    calculer();
    const ro = new ResizeObserver(calculer);
    ro.observe(el);
    return () => ro.disconnect();
  }, [largeur]);
  return (
    <div ref={cadre} className="overflow-hidden rounded-[14px] border border-[#D8E5EE] bg-white">
      <div className="h-[calc(100svh-190px)] min-h-[520px] overflow-y-auto overflow-x-hidden">
        <div style={{ width: largeur, zoom, margin: largeur < 600 ? "0 auto" : undefined }}>{children}</div>
      </div>
    </div>
  );
}

function Volet({ titre, texte, ouvert, onClick, children }: { titre: string; texte: string; ouvert: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <section className="overflow-hidden rounded-[14px] border border-[#E4EBF1] bg-white">
      <button type="button" aria-expanded={ouvert} onClick={onClick} className="flex w-full items-center gap-[10px] px-[16px] py-[14px] text-left">
        <span className="min-w-0 flex-1">
          <span className="block text-[15px] font-bold">{titre}</span>
          <span className="block truncate text-[12.5px] text-[#7D93A8]">{texte}</span>
        </span>
        <ChevronDown className={`h-[18px] w-[18px] shrink-0 text-[#9DB0C0] transition-transform ${ouvert ? "rotate-180" : ""}`} aria-hidden="true" />
      </button>
      {ouvert && <div className="border-t border-[#EDF2F7] px-[16px] pb-[16px] pt-[14px]">{children}</div>}
    </section>
  );
}

function Couleur({ label, aide, valeur, onChange }: { label: string; aide?: string; valeur: string; onChange: (v: string) => void }) {
  const [saisie, setSaisie] = useState(valeur);
  useEffect(() => setSaisie(valeur), [valeur]);
  return (
    <div className="flex items-center gap-[10px] py-[5px]">
      <label className="relative h-[34px] w-[34px] shrink-0 cursor-pointer overflow-hidden rounded-[9px] ring-1 ring-[#D8E5EE]" style={{ background: valeur }}>
        <input type="color" value={valeur} onChange={(e) => onChange(e.target.value.toUpperCase())} className="absolute inset-0 cursor-pointer opacity-0" aria-label={label} />
      </label>
      <span className="min-w-0 flex-1">
        <span className="block text-[13px] font-bold">{label}</span>
        {aide && <span className="block text-[11.5px] text-[#9DB0C0]">{aide}</span>}
      </span>
      <input
        value={saisie}
        onChange={(e) => {
          const v = e.target.value.trim();
          setSaisie(v);
          if (/^#[0-9A-Fa-f]{6}$/.test(v)) onChange(v.toUpperCase());
        }}
        className="h-[34px] w-[90px] rounded-[8px] border border-[#E4EBF1] px-[8px] font-mono text-[12.5px] uppercase outline-none focus:border-[#57D4F5]"
        aria-label={`${label} (code hexadécimal)`}
      />
    </div>
  );
}

function Image({
  label,
  aide,
  url,
  enCours,
  rond = false,
  onFichier,
  onRetirer,
}: {
  label: string;
  aide: string;
  url: string | null;
  enCours: boolean;
  rond?: boolean;
  onFichier: (f: File | undefined) => void;
  onRetirer: () => void;
}) {
  return (
    <div>
      <p className="pb-[6px] text-[12.5px] font-semibold text-[#5B7189]">{label}</p>
      <label className="relative flex h-[96px] cursor-pointer items-center justify-center overflow-hidden rounded-[12px] border-[1.5px] border-dashed border-[#C9D9E5] bg-[#F7FAFC] hover:border-[#57D4F5]">
        {url ? (
          <img src={url} alt="" className={rond ? "h-[70px] w-[70px] rounded-full bg-white object-contain p-[4px]" : "h-full w-full object-cover"} />
        ) : (
          <span className="flex flex-col items-center gap-[4px] text-[12px] font-semibold text-[#7D93A8]">
            {enCours ? <Upload className="h-[20px] w-[20px] animate-pulse" aria-hidden="true" /> : <ImagePlus className="h-[20px] w-[20px]" aria-hidden="true" />}
            {enCours ? "Envoi…" : "Choisir une image"}
          </span>
        )}
        <input type="file" accept="image/png,image/jpeg,image/webp" className="sr-only" onChange={(e) => onFichier(e.target.files?.[0])} />
      </label>
      <p className="flex items-center gap-[6px] pt-[5px] text-[11.5px] text-[#9DB0C0]">
        <span className="min-w-0 flex-1 truncate">{aide}</span>
        {url && (
          <button type="button" onClick={onRetirer} className="font-semibold text-[#C94957]">
            Retirer
          </button>
        )}
      </p>
    </div>
  );
}

function scriptManquant(e: unknown) {
  const m = String((e as { message?: string })?.message ?? "");
  return m.includes("mon_site_club") || m.includes("Could not find the function") || (e as { code?: string })?.code === "PGRST202";
}
