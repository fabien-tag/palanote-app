import { useMemo, useState, type CSSProperties, type ReactNode } from "react";
import logoPalanote from "@/assets/palanote-logo-cigle.png";
import { Anchor, ArrowUpRight, Bell, Camera, ClipboardCheck, Clock, Smile, Stamp, Star, GraduationCap, LifeBuoy, Mail, MapPin, Phone, ShieldCheck, Ship, Sun, Users, Waves } from "lucide-react";
import {
  CHIFFRES_DEFAUT,
  nombre,
  LIBELLE_EQUIPEMENT,
  LIBELLE_ROLE,
  modeleDe,
  prixEuros,
  type BateauSite,
  type ContenuSite,
  type EquipementSite,
  type FormationSite,
  type Tarif,
  type Zone,
} from "@/lib/siteClub";

// Le site vitrine d'un club (offre Starter). Tout vient du back-office Palanote :
// les réglages de « Mon site » et les données vivantes (formations, matériel, équipe).
// Mise en page en requêtes de conteneur (@container) : le même rendu sert au site public
// et à l'aperçu du DP, quelle que soit la largeur disponible.

const ICONES_ATOUTS = [ShieldCheck, Users, LifeBuoy, Sun, Waves, Anchor];

function clair(hex: string) {
  const n = parseInt(hex.slice(1), 16);
  const [r, g, b] = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((v) => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r! + 0.7152 * g! + 0.0722 * b! > 0.35;
}

const profondeur = (z: Zone) => {
  const n = Number(String(z.profondeur ?? "").replace(",", "."));
  return Number.isFinite(n) && n > 0 ? n : null;
};

export function SiteClub({ contenu, apercu = false }: { contenu: ContenuSite; apercu?: boolean }) {
  const { site, centre, formations, bateaux, equipement, equipe } = contenu;
  const modele = modeleDe(site.modele);
  const sombre = !clair(site.couleur_fond);
  const zones = (site.zones ?? []).filter((z) => z.nom?.trim());
  const niveaux = formations.filter((f) => f.categorie === "niveau");
  const autres = formations.filter((f) => f.categorie !== "niveau" && !/^N\s?[1-4]$/i.test(f.code.trim()));
  const encadrants = equipe.filter((e) => e.role !== "pilote");
  const places = bateaux.map((b) => parseInt(b.places ?? "", 10)).filter((n) => n > 0);
  const profMax = Math.max(0, ...zones.map((z) => profondeur(z) ?? 0));
  const s = site.sections ?? { formations: true, zones: true, materiel: true, equipe: true, infos: true };

  const tarifs = (site.tarifs ?? []).filter((t) => t.libelle?.trim());
  // Les niveaux du tarif : N1 à N4, même si le N4 est rangé en « encadrement » dans le catalogue
  const niveauxTarifs = formations
    .filter((f) => f.categorie === "niveau" || /^N\s?[1-4]$/i.test(f.code.trim()))
    .sort((a, b) => (a.categorie === b.categorie ? 0 : a.categorie === "niveau" ? -1 : 1));
  const voir = {
    tarifs: s.tarifs !== false && (tarifs.length > 0 || niveauxTarifs.length > 0),
    formations: s.formations && formations.length > 0,
    zones: s.zones && zones.length > 0,
    materiel: s.materiel && (bateaux.length > 0 || equipement.length > 0),
    equipe: s.equipe && equipe.length > 0,
    infos: s.infos,
  };

  const style = {
    "--acc": site.couleur_accent,
    "--sec": site.couleur_secondaire,
    "--ter": site.couleur_tertiaire,
    "--fond": site.couleur_fond,
    "--txt": site.couleur_texte,
    "--surface": sombre ? `color-mix(in srgb, ${site.couleur_fond} 88%, white)` : "#FFFFFF",
    "--doux": `color-mix(in srgb, ${site.couleur_texte} 64%, ${site.couleur_fond})`,
    "--ligne": `color-mix(in srgb, ${site.couleur_texte} 12%, transparent)`,
    "--titres": modele.titres,
    fontFamily: modele.corps,
  } as CSSProperties;

  const contact = site.telephone
    ? { href: `tel:${site.telephone.replace(/[^\d+]/g, "")}`, texte: "Nous appeler" }
    : site.email
      ? { href: `mailto:${site.email}`, texte: "Nous écrire" }
      : { href: "#contact", texte: "Nous contacter" };

  const menu = [
    voir.tarifs && { href: "#tarifs", texte: "Tarifs" },
    voir.formations && { href: "#formations", texte: "Formations" },
    voir.zones && { href: "#sites", texte: "Sites de plongée" },
    voir.materiel && { href: "#materiel", texte: "Matériel" },
    voir.equipe && { href: "#equipe", texte: "Équipe" },
    voir.infos && { href: "#contact", texte: "Infos pratiques" },
  ].filter(Boolean) as { href: string; texte: string }[];

  const annee = nombre(site.annee_creation);
  const satisfaits = nombre(site.satisfaction);
  const note = nombre(site.note_google);
  const avis = nombre(site.nb_avis_google);
  const disponibles: Record<string, { Icone: typeof Waves; valeur: string; texte: string } | null> = {
    annees:
      annee && new Date().getFullYear() - annee > 0
        ? { Icone: Anchor, valeur: `${new Date().getFullYear() - annee} ans`, texte: `d'expérience, le club est né en ${annee}` }
        : null,
    encadrants: encadrants.length > 0 ? { Icone: Users, valeur: String(encadrants.length), texte: encadrants.length > 1 ? "encadrants diplômés à vos côtés" : "encadrant diplômé" } : null,
    satisfaction: satisfaits !== null ? { Icone: Smile, valeur: `${satisfaits} %`, texte: "de plongeurs satisfaits" } : null,
    google: note !== null ? { Icone: Star, valeur: `${note.toLocaleString("fr-FR")}/5`, texte: avis ? `note Google, sur ${avis} avis` : "note Google" } : null,
    sites: zones.length > 0 ? { Icone: MapPin, valeur: String(zones.length), texte: zones.length > 1 ? "sites de plongée explorés" : "site de plongée" } : null,
    formations: formations.length > 0 ? { Icone: GraduationCap, valeur: String(formations.length), texte: formations.length > 1 ? "formations, du baptême à l'encadrement" : "formation proposée" } : null,
    profondeur: profMax > 0 ? { Icone: Waves, valeur: `${profMax} m`, texte: "de profondeur sur nos sites les plus profonds" } : null,
    places: places.length > 0 ? { Icone: Ship, valeur: String(Math.max(...places)), texte: "places à bord de notre bateau" } : null,
  };
  const choisis = site.chiffres && site.chiffres.length > 0 ? site.chiffres : CHIFFRES_DEFAUT;
  const chiffres = choisis
    .map((c) => disponibles[c])
    .filter((c): c is { Icone: typeof Waves; valeur: string; texte: string } => Boolean(c))
    .slice(0, 4);

  return (
    <div id="haut" style={style} className="site-club @container min-h-full bg-[var(--fond)] text-[var(--txt)] antialiased [&_h1,&_h2,&_h3]:font-[family-name:var(--titres)]">
      {/* ——— Héros ——— */}
      <header className="p-[10px] @3xl:p-[14px]">
        <div className="relative isolate flex min-h-[560px] flex-col overflow-hidden rounded-[26px] text-white @3xl:min-h-[700px] @3xl:rounded-[36px]">
          <FondHeros image={site.couverture_url} />
          <Bulles />
          <nav className="relative z-10 flex items-center gap-[12px] p-[16px] @3xl:px-[32px] @3xl:pt-[28px]">
            <a href="#haut" className="flex min-w-0 items-center gap-[10px] rounded-full py-[4px] pl-[4px] pr-[14px] backdrop-blur-md [background:rgb(255_255_255/.12)]">
              {site.logo_url ? (
                <img src={site.logo_url} alt="" className="h-[38px] w-[38px] shrink-0 rounded-full bg-white object-contain p-[3px]" />
              ) : (
                <span className="flex h-[38px] w-[38px] shrink-0 items-center justify-center rounded-full bg-white text-[var(--sec)]">
                  <Anchor className="h-[18px] w-[18px]" strokeWidth={2.2} aria-hidden="true" />
                </span>
              )}
              <span className="truncate text-[15px] font-semibold">{centre.nom}</span>
            </a>
            <ul className="mx-auto hidden items-center gap-[2px] rounded-full p-[5px] text-[13.5px] backdrop-blur-md [background:rgb(255_255_255/.12)] @4xl:flex">
              {menu.map((m) => (
                <li key={m.href}>
                  <a href={m.href} className="block rounded-full px-[15px] py-[8px] text-white/85 hover:bg-white/15 hover:text-white">
                    {m.texte}
                  </a>
                </li>
              ))}
            </ul>
            <a href={contact.href} className="ml-auto shrink-0 rounded-full bg-white px-[18px] py-[11px] text-[13.5px] font-semibold text-[var(--sec)] @4xl:ml-0">
              {contact.texte}
            </a>
          </nav>

          <div className="relative z-10 grid flex-1 grid-cols-1 gap-[32px] px-[26px] pb-[34px] pt-[40px] @3xl:px-[64px] @3xl:pb-[64px] @3xl:pt-[56px] @5xl:grid-cols-[minmax(0,1.25fr)_minmax(0,1fr)]">
            <div className="flex flex-col">
              <h1 className="max-w-[12ch] text-[clamp(40px,7.5cqw,88px)] font-medium leading-[1.02] tracking-[-0.03em]">
                {site.accroche || `Plongez avec ${centre.nom}`}
              </h1>
              <div className="mt-auto pt-[40px]">
                {note !== null && <BadgeGoogle note={note} avis={avis} lien={site.lien_google ?? null} />}
                {site.sous_titre && <p className="max-w-[46ch] text-[16px] leading-[1.55] text-white/80 @3xl:text-[17px]">{site.sous_titre}</p>}
                <div className="flex flex-wrap gap-[10px] pt-[20px]">
                  {voir.formations && (
                    <a href="#formations" className="galet-moyen bg-white px-[22px] py-[13px] text-[14px] font-semibold text-[var(--sec)]">
                      Passer un niveau
                    </a>
                  )}
                  <a href={contact.href} className="galet-moyen px-[22px] py-[13px] text-[14px] font-semibold text-white ring-1 ring-white/35 backdrop-blur-md [background:rgb(255_255_255/.1)]">
                    {contact.texte}
                  </a>
                </div>
              </div>
            </div>
            <CartesHeros zones={zones} niveaux={niveaux} bateau={bateaux[0]} />
          </div>
        </div>
      </header>

      <main>
        {/* ——— Chiffres clés ——— */}
        {chiffres.length > 0 && (
          <section aria-label="Le club en chiffres" className={`mx-auto grid max-w-[1240px] grid-cols-2 px-[22px] pt-[44px] @4xl:px-[40px] ${["", "@4xl:grid-cols-1", "@4xl:grid-cols-2", "@4xl:grid-cols-3", "@4xl:grid-cols-4"][chiffres.length]}`}>
            {chiffres.map((c, i) => (
              <div key={c.texte} className={`py-[14px] pr-[16px] @4xl:pl-[22px] ${i > 0 ? "@4xl:border-l @4xl:border-[var(--ligne)]" : "@4xl:pl-0"} ${i % 2 === 1 ? "border-l border-[var(--ligne)] pl-[18px]" : ""}`}>
                <span className="goutte flex h-[46px] w-[46px] items-center justify-center bg-[color-mix(in_srgb,var(--acc)_14%,transparent)]">
                  <c.Icone className="h-[21px] w-[21px] text-[var(--acc)]" strokeWidth={1.9} aria-hidden="true" />
                </span>
                <p className="pt-[18px] text-[clamp(36px,5cqw,52px)] font-medium leading-none tracking-[-0.03em] [font-family:var(--titres)]">{c.valeur}</p>
                <p className="max-w-[24ch] pt-[10px] text-[13.5px] leading-[1.45] text-[var(--doux)]">{c.texte}</p>
              </div>
            ))}
          </section>
        )}

        {voir.tarifs && <Tarifs tarifs={tarifs} niveaux={niveauxTarifs} contact={contact} image={site.couverture_url} />}

        {/* ——— Le club ——— */}
        <Section id="club" meduse libelle="Le club" titre={centre.ville ? `Plonger à ${centre.ville}` : "Plonger avec nous"} texte={site.presentation}>
          {site.atouts.length > 0 && (
            <div className="grid grid-cols-1 gap-[12px] @2xl:grid-cols-3">
              {site.atouts.map((a, i) => {
                const Icone = ICONES_ATOUTS[i % ICONES_ATOUTS.length]!;
                return (
                  <div key={i} className={`${["galet", "galet-b", "galet-c"][i % 3]} bg-[var(--surface)] p-[26px] ring-1 ring-[var(--ligne)]`}>
                    <span className="goutte flex h-[50px] w-[50px] items-center justify-center bg-[var(--acc)] text-white">
                      <Icone className="h-[20px] w-[20px]" strokeWidth={2} aria-hidden="true" />
                    </span>
                    <h3 className="pt-[22px] text-[19px] font-semibold tracking-[-0.01em]">{a.titre}</h3>
                    <p className="pt-[6px] text-[14.5px] leading-[1.55] text-[var(--doux)]">{a.texte}</p>
                  </div>
                );
              })}
            </div>
          )}
        </Section>

        {voir.formations && (
          <Section id="formations" libelle="Formations" titre="Passer ses niveaux avec nous" texte="Des cours théoriques entre deux plongées et de la pratique en mer, encadrés par nos moniteurs.">
            {niveauxTarifs.length > 0 && <Parcours niveaux={niveauxTarifs} contact={contact} />}
            {autres.length > 0 && (
              <div className={niveauxTarifs.length > 0 ? "pt-[36px]" : ""}>
                <h3 className="pb-[14px] text-[22px] font-medium tracking-[-0.02em]">{niveauxTarifs.length > 0 ? "Et aussi" : "Nos formations"}</h3>
                <ul className="overflow-hidden rounded-[22px] bg-[var(--surface)] ring-1 ring-[var(--ligne)]">
                  {autres.map((f) => (
                    <li key={f.code} className="grid grid-cols-[1fr_auto] items-center gap-x-[16px] gap-y-[4px] border-t border-[var(--ligne)] px-[20px] py-[16px] first:border-t-0 @2xl:grid-cols-[110px_1fr_auto_auto] @2xl:px-[26px]">
                      <span className="text-[13px] font-semibold text-[var(--acc)]">{f.code}</span>
                      <span className="col-span-2 row-start-2 text-[15.5px] font-medium @2xl:col-span-1 @2xl:row-start-auto">{f.intitule}</span>
                      <span className="hidden text-[13px] text-[var(--doux)] @2xl:block">{dureeTexte(f)}</span>
                      <span className="text-right text-[17px] font-semibold [font-family:var(--titres)]">{prixEuros(f.prix) ?? "Sur demande"}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </Section>
        )}

        {voir.zones && (
          <Section id="sites" libelle="Sites de plongée" titre="Nos sites de plongée" texte="Plus la carte est sombre, plus le site est profond. Choisissez un site pour en savoir plus.">
            <Sites zones={zones} />
          </Section>
        )}

        {voir.materiel && (
          <Section id="materiel" libelle="Matériel" titre="Un équipement complet, révisé chaque saison" texte="Blocs, détendeurs, combinaisons et gilets : le matériel est prêté pendant les formations et proposé à la location.">
            <Materiel bateaux={bateaux} equipement={equipement} />
          </Section>
        )}

        {voir.equipe && (
          <Section id="equipe" meduse libelle="L'équipe" titre="Ceux qui vous encadrent" texte="Directeurs de plongée, moniteurs et pilote : une équipe diplômée, présente à chaque sortie.">
            <ul className="grid grid-cols-1 gap-[12px] @xl:grid-cols-2 @4xl:grid-cols-4">
              {equipe.map((e, i) => (
                <li key={`${e.nom}-${i}`} className={`flex items-center gap-[14px] ${["galet-b", "galet-c", "galet"][i % 3]} bg-[var(--surface)] p-[18px] ring-1 ring-[var(--ligne)]`}>
                  <span
                    className="flex h-[52px] w-[52px] shrink-0 items-center justify-center rounded-full text-[17px] font-semibold text-white"
                    style={{ background: i % 3 === 0 ? "var(--sec)" : i % 3 === 1 ? "var(--acc)" : "var(--ter)" }}
                  >
                    {initiales(e.nom)}
                  </span>
                  <span className="min-w-0">
                    <span className="block truncate text-[16px] font-semibold">{e.nom}</span>
                    <span className="block truncate text-[13px] text-[var(--doux)]">{LIBELLE_ROLE[e.role] ?? "Encadrant"}</span>
                    {e.niveau && <span className="mt-[6px] inline-block rounded-full bg-[color-mix(in_srgb,var(--acc)_14%,transparent)] px-[9px] py-[3px] text-[11.5px] font-semibold text-[var(--acc)]">{e.niveau}</span>}
                  </span>
                </li>
              ))}
            </ul>
          </Section>
        )}

        {voir.infos && <Infos contenu={contenu} contact={contact} />}
      </main>
      <div className="h-[84px] @4xl:h-[110px]" aria-hidden="true" />

      {s.palanote !== false && <PromoPalanote club={centre.nom} />}

      {/* ——— Pied de page ——— */}
      <footer className="p-[10px] @3xl:p-[14px]">
        <div className="rounded-[26px] bg-[var(--sec)] px-[24px] py-[36px] text-white @3xl:rounded-[36px] @3xl:px-[44px] @3xl:py-[48px]">
          <div className="grid grid-cols-1 gap-[30px] @3xl:grid-cols-[1.4fr_1fr_1fr]">
            <div>
              <div className="flex items-center gap-[10px]">
                {site.logo_url ? (
                  <img src={site.logo_url} alt="" className="h-[40px] w-[40px] rounded-full bg-white object-contain p-[3px]" />
                ) : (
                  <Anchor className="h-[26px] w-[26px] text-[var(--acc)]" aria-hidden="true" />
                )}
                <span className="text-[19px] font-semibold [font-family:var(--titres)]">{centre.nom}</span>
              </div>
              {site.sous_titre && <p className="max-w-[40ch] pt-[12px] text-[14px] leading-[1.55] text-white/65">{site.sous_titre}</p>}
            </div>
            <div>
              <p className="pb-[10px] text-[13px] text-white/50">Le club</p>
              <ul className="space-y-[6px] text-[14.5px]">
                {menu.map((m) => (
                  <li key={m.href}>
                    <a href={m.href} className="text-white/85 hover:text-white">
                      {m.texte}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
            <div>
              <p className="pb-[10px] text-[13px] text-white/50">Contact</p>
              <ul className="space-y-[6px] text-[14.5px] text-white/85">
                {site.telephone && <li>{site.telephone}</li>}
                {site.email && <li className="break-all">{site.email}</li>}
                {site.adresse && <li>{site.adresse}</li>}
              </ul>
            </div>
          </div>
          <p className="mt-[34px] border-t border-white/15 pt-[18px] text-[12.5px] text-white/50">
            © {new Date().getFullYear()} {centre.nom}
            {site.adresse ? `, ${site.adresse}` : centre.ville ? `, ${centre.ville}` : ""}. Tarifs indicatifs, susceptibles d'évoluer en cours de saison.
          </p>
        </div>
      </footer>
      {apercu && !site.publie && (
        <div className="pointer-events-none sticky bottom-[14px] z-20 mx-auto w-fit rounded-full bg-black/75 px-[16px] py-[8px] text-[12.5px] font-semibold text-white">
          Aperçu : le site n'est pas encore en ligne
        </div>
      )}
    </div>
  );
}

// ——— Briques ———

// Le bloc qui présente Palanote, l'app du club : aux couleurs de Palanote, avec un téléphone en maquette
const PALANOTE = { nuit: "#0A2A50", marine: "#0F3D70", menthe: "#3DEFBE", corail: "#FF8A75", ciel: "#57D4F5" };

function PromoPalanote({ club }: { club: string }) {
  const atouts = [
    { Icone: ClipboardCheck, titre: "Votre fiche arrive préremplie", texte: "Après la sortie : site, durée, palanquée. Il ne reste que votre profondeur." },
    { Icone: Stamp, titre: "Le tampon du club, en un geste", texte: "Le directeur de plongée valide toute la sortie, sur votre téléphone." },
    { Icone: Camera, titre: "Vos vieux carnets, d'une photo", texte: "L'IA lit vos pages papier, vous relisez, tout est rangé." },
    { Icone: Users, titre: "Vos binômes, des deux côtés", texte: "Une plongée notée par l'un se propose à l'autre." },
  ];
  return (
    <section aria-labelledby="titre-palanote" className="mx-auto max-w-[1240px] px-[10px] pt-[84px] @3xl:px-[14px] @4xl:pt-[110px]">
      <div className="relative isolate overflow-hidden rounded-[30px] px-[24px] pb-[0px] pt-[36px] text-white @3xl:rounded-[40px] @3xl:px-[48px] @3xl:pt-[52px]" style={{ background: `linear-gradient(150deg, ${PALANOTE.marine} 0%, ${PALANOTE.nuit} 70%)` }}>
        {/* Lumière et galets en fond */}
        <span aria-hidden="true" className="goutte absolute -right-[80px] -top-[120px] -z-10 h-[360px] w-[360px] opacity-25 blur-[60px]" style={{ background: PALANOTE.ciel }} />
        <span aria-hidden="true" className="galet absolute -bottom-[60px] left-[30%] -z-10 h-[200px] w-[280px] opacity-20 blur-[50px]" style={{ background: PALANOTE.menthe }} />
        <Meduse couleur="#6FD7BF" className="left-[46%] top-[34px] hidden h-[64px] w-[36px] @5xl:block" />

        <div className="grid grid-cols-1 items-end gap-[30px] @5xl:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)]">
          <div className="pb-[36px] @3xl:pb-[52px]">
            <p className="flex items-center gap-[10px] text-[14px] font-semibold" style={{ color: PALANOTE.menthe }}>
              <span className="goutte flex h-[34px] w-[34px] items-center justify-center bg-white/10 p-[7px]">
                <img src={logoPalanote} alt="" className="h-full w-auto" />
              </span>
              Palanote, l'app de {club}
            </p>
            <h2 id="titre-palanote" className="max-w-[16ch] pt-[18px] text-[clamp(32px,4.8cqw,56px)] font-semibold leading-[1.04] tracking-[-0.03em]">
              Ne perdez plus de temps à remplir vos carnets.
            </h2>
            <p className="max-w-[48ch] pt-[14px] text-[16px] leading-[1.6] text-white/75">
              Palanote est le carnet de plongée numérique de votre club. Gratuit et sans publicité, il se remplit presque tout seul.
            </p>
            <ul className="grid grid-cols-1 gap-[10px] pt-[26px] @xl:grid-cols-2">
              {atouts.map((a, i) => (
                <li key={a.titre} className={`${["galet-b", "galet-c", "galet", "galet-b"][i]} flex gap-[12px] bg-white/[.07] p-[16px] ring-1 ring-white/10`}>
                  <span className="goutte flex h-[40px] w-[40px] shrink-0 items-center justify-center" style={{ background: PALANOTE.menthe, color: PALANOTE.nuit }}>
                    <a.Icone className="h-[19px] w-[19px]" strokeWidth={2.2} aria-hidden="true" />
                  </span>
                  <span>
                    <span className="block text-[15px] font-semibold leading-snug">{a.titre}</span>
                    <span className="block pt-[3px] text-[13px] leading-[1.45] text-white/65">{a.texte}</span>
                  </span>
                </li>
              ))}
            </ul>
            <div className="flex flex-wrap items-center gap-[14px] pt-[28px]">
              <a href="/creer-un-compte" className="galet-moyen px-[24px] py-[15px] text-[14.5px] font-bold" style={{ background: PALANOTE.menthe, color: PALANOTE.nuit }}>
                CRÉER MON CARNET GRATUIT
              </a>
              <span className="text-[13px] text-white/60">Sur iPhone et Android, depuis le navigateur.</span>
            </div>
          </div>
          <Telephone club={club} />
        </div>
      </div>
    </section>
  );
}

// Un téléphone dessiné en CSS : l'accueil du carnet et une plongée tamponnée par le club
function Telephone({ club }: { club: string }) {
  const date = new Date();
  const jour = date.toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit", year: "numeric" });
  return (
    <div className="relative mx-auto w-[280px] self-end @5xl:mr-[20px]">
      {/* Notification qui déborde du téléphone */}
      <div className="absolute -left-[110px] -top-[34px] z-20 hidden w-[220px] items-center gap-[10px] galet-moyen bg-white/95 p-[12px] text-[#123A63] shadow-[0_18px_40px_rgb(0_0_0/.3)] @3xl:flex">
        <span className="goutte flex h-[34px] w-[34px] shrink-0 items-center justify-center" style={{ background: PALANOTE.menthe }}>
          <Stamp className="h-[16px] w-[16px]" aria-hidden="true" />
        </span>
        <span className="min-w-0 text-[12px] leading-tight">
          <b className="block text-[12.5px]">Plongée tamponnée</b>
          <span className="block truncate text-[#5B7189]">{club} a validé ta sortie</span>
        </span>
      </div>
      <div className="relative h-[540px] overflow-hidden rounded-t-[46px] border-[10px] border-b-0 border-[#0B1626] bg-[#F1F6FC] text-[#123A63] shadow-[0_-10px_60px_rgb(0_0_0/.35)]">
        <span aria-hidden="true" className="absolute left-1/2 top-[8px] z-10 h-[24px] w-[86px] -translate-x-1/2 rounded-full bg-[#0B1626]" />
        {/* En-tête du carnet */}
        <div className="rounded-b-[26px] px-[18px] pb-[16px] pt-[46px] text-white" style={{ background: `linear-gradient(180deg, ${PALANOTE.marine}, ${PALANOTE.nuit})` }}>
          <div className="flex items-center justify-between">
            <img src={logoPalanote} alt="" className="h-[22px] w-auto" />
            <Bell className="h-[17px] w-[17px]" aria-hidden="true" />
          </div>
          <p className="pt-[22px] text-[22px] font-bold leading-tight">Mes plongées</p>
          <p className="text-[11.5px] text-white/70">dernière plongée hier</p>
          <div className="mt-[12px] grid grid-cols-4 border-t border-white/15 pt-[10px] text-center">
            {[
              ["N2", "niveau"],
              ["61", "plongées"],
              ["28 m", "prof. max"],
              ["51 h", "sous l'eau"],
            ].map(([v, l]) => (
              <span key={l}>
                <b className="block text-[14px]">{v}</b>
                <span className="block text-[9.5px] text-white/60">{l}</span>
              </span>
            ))}
          </div>
        </div>
        {/* La dernière plongée, tamponnée par le club */}
        <div className="px-[12px] pt-[14px]">
          <div className="galet relative bg-white p-[14px] shadow-[0_4px_14px_rgb(18_58_99/.08)]">
            <p className="text-[10.5px] font-semibold text-[#7D93A8]">Hier, 9 h 30</p>
            <p className="pt-[2px] text-[15px] font-bold">La Gabinière</p>
            <p className="text-[11px] text-[#5B7189]">avec {club}</p>
            <div className="mt-[10px] flex gap-[6px]">
              {["32 m", "48 min", "18 °C"].map((x) => (
                <span key={x} className="galet-petit bg-[#EEF4F9] px-[8px] py-[4px] text-[11px] font-bold">
                  {x}
                </span>
              ))}
            </div>
            {/* Le tampon numérique */}
            <span
              className="absolute right-[8px] top-[8px] flex h-[70px] w-[70px] rotate-[-14deg] flex-col items-center justify-center rounded-full border-[2.5px] text-center leading-tight"
              style={{ borderColor: PALANOTE.corail, color: PALANOTE.corail }}
            >
              <span className="max-w-[54px] truncate text-[6.5px] font-bold uppercase">{club}</span>
              <span className="text-[10px] font-black">VALIDÉE</span>
              <span className="text-[7px] font-semibold">{jour}</span>
            </span>
          </div>
          <div className="galet-b mt-[10px] bg-white p-[14px] opacity-80">
            <p className="text-[10.5px] font-semibold text-[#7D93A8]">Samedi</p>
            <p className="pt-[2px] text-[14px] font-bold">Épave du Togo</p>
            <div className="mt-[8px] flex gap-[6px]">
              {["40 m", "42 min"].map((x) => (
                <span key={x} className="galet-petit bg-[#EEF4F9] px-[8px] py-[4px] text-[11px] font-bold">
                  {x}
                </span>
              ))}
            </div>
          </div>
          <div className="galet-c mt-[10px] flex items-center gap-[10px] p-[12px]" style={{ background: "#E2F8EF" }}>
            <span className="goutte flex h-[30px] w-[30px] items-center justify-center" style={{ background: PALANOTE.menthe }}>
              <ClipboardCheck className="h-[15px] w-[15px]" aria-hidden="true" />
            </span>
            <span className="text-[11.5px] font-semibold leading-tight">Ta fiche est prête : ajoute ta profondeur</span>
          </div>
        </div>
      </div>
    </div>
  );
}

// La méduse de Palanote, aux couleurs du club
function Meduse({ className = "", couleur = "color-mix(in srgb, var(--acc) 55%, white)" }: { className?: string; couleur?: string }) {
  return (
    <span aria-hidden="true" className={`pointer-events-none absolute ${className}`}>
      <svg viewBox="0 0 48 87" className="h-full w-full">
        <path d="M5 26C5 11 13 4 24 4S43 12 43 26Q39 29 35 26Q30 31 25 26Q20 30 15 26Q9 30 5 26" style={{ fill: couleur }} />
        <g fill="none" style={{ stroke: couleur }} strokeWidth={3.6} strokeLinecap="round">
          <path d="M12 27C12 44 3 44 8 59S11 69 6 79" />
          <path d="M20 28C23 45 12 48 17 64S17 76 15 84" />
          <path d="M28 28C33 44 22 47 28 62S34 72 30 80" />
          <path d="M36 28C42 38 31 47 38 55S42 65 40 69" />
        </g>
      </svg>
    </span>
  );
}

// Quelques bulles qui remontent dans le haut de page (coupées si l'on réduit les animations)
const BULLES = [
  { g: 6, t: 8, x: 8, d: 0, r: 10 },
  { g: 22, t: 11, x: 4, d: 3, r: 7 },
  { g: 38, t: 9, x: 6, d: 6, r: 12 },
  { g: 55, t: 12, x: 3, d: 1.5, r: 6 },
  { g: 71, t: 10, x: 5, d: 4.5, r: 9 },
  { g: 88, t: 13, x: 7, d: 2, r: 8 },
];
function Bulles() {
  return (
    <div aria-hidden="true" className="pointer-events-none absolute inset-x-0 bottom-0 -z-0 h-full overflow-hidden">
      {BULLES.map((b, i) => (
        <span
          key={i}
          className="bulle absolute bottom-[-20px] rounded-full ring-1 ring-white/50 [background:radial-gradient(circle_at_30%_30%,rgb(255_255_255/.55),rgb(255_255_255/.08))]"
          style={{ left: `${b.g}%`, width: b.r, height: b.r, ["--duree" as string]: `${b.t}s`, ["--delai" as string]: `${b.d}s` }}
        />
      ))}
    </div>
  );
}

// La note Google du club, en verre dépoli dans le haut de page ; le lien mène à sa fiche Google
function BadgeGoogle({ note, avis, lien }: { note: number; avis: number | null; lien: string | null }) {
  const contenu = (
    <>
      <span className="flex gap-[2px]" aria-hidden="true">
        {[1, 2, 3, 4, 5].map((i) => (
          <Star key={i} className="h-[15px] w-[15px]" strokeWidth={0} fill={i <= Math.round(note) ? "#FFC65C" : "rgb(255 255 255 / .35)"} />
        ))}
      </span>
      <span className="text-[14px] font-semibold">{note.toLocaleString("fr-FR")}</span>
      <span className="text-[13px] text-white/75">sur Google{avis ? `, ${avis} avis` : ""}</span>
    </>
  );
  const classe = "mb-[18px] inline-flex items-center gap-[8px] rounded-full px-[14px] py-[8px] ring-1 ring-white/25 backdrop-blur-md [background:rgb(255_255_255/.12)]";
  return lien ? (
    <a href={lien} target="_blank" rel="noreferrer" className={`${classe} hover:[background:rgb(255_255_255/.2)]`} aria-label={`Note Google : ${note} sur 5${avis ? `, ${avis} avis` : ""}`}>
      {contenu}
    </a>
  ) : (
    <span className={classe} aria-label={`Note Google : ${note} sur 5`}>
      {contenu}
    </span>
  );
}

function Section({
  id,
  libelle,
  titre,
  texte,
  meduse = false,
  children,
}: {
  id: string;
  libelle: string;
  titre: string;
  texte?: string | null;
  meduse?: boolean;
  children?: ReactNode;
}) {
  return (
    <section id={id} className="relative mx-auto max-w-[1240px] scroll-mt-[20px] px-[22px] pt-[84px] @4xl:px-[40px] @4xl:pt-[120px]">
      {meduse && <Meduse className="right-[28px] top-[70px] h-[70px] w-[38px] @4xl:right-[60px] @4xl:top-[110px] @4xl:h-[96px] @4xl:w-[52px]" />}
      <div className="flex flex-col gap-[12px] pb-[34px] @4xl:pb-[44px]">
        <p className="flex items-center gap-[8px] text-[13.5px] font-medium text-[var(--acc)]">
          <span className="goutte inline-block h-[10px] w-[10px] bg-[var(--acc)]" aria-hidden="true" />
          {libelle}
        </p>
        <div>
          <h2 className="max-w-[22ch] text-[clamp(32px,4.6cqw,54px)] font-medium leading-[1.06] tracking-[-0.03em]">{titre}</h2>
          {texte && <p className="max-w-[62ch] pt-[16px] text-[16px] leading-[1.6] text-[var(--doux)]">{texte}</p>}
        </div>
      </div>
      {children}
    </section>
  );
}

function FondHeros({ image }: { image: string | null }) {
  return (
    <div className="absolute inset-0 -z-10" aria-hidden="true">
      {image ? (
        <>
          <img src={image} alt="" className="h-full w-full object-cover" />
          <div className="absolute inset-0 bg-[linear-gradient(100deg,color-mix(in_srgb,var(--sec)_88%,transparent)_0%,color-mix(in_srgb,var(--sec)_45%,transparent)_55%,transparent_100%)]" />
          <div className="absolute inset-x-0 bottom-0 h-1/2 bg-[linear-gradient(0deg,color-mix(in_srgb,var(--sec)_70%,transparent),transparent)]" />
        </>
      ) : (
        // Sans photo : la lumière qui traverse l'eau, dans les couleurs du club
        <div className="absolute inset-0 bg-[linear-gradient(160deg,var(--sec)_0%,color-mix(in_srgb,var(--sec)_55%,var(--acc))_55%,var(--acc)_130%)]">
          <div className="absolute -right-[10%] -top-[30%] h-[140%] w-[34%] rotate-[24deg] bg-[linear-gradient(90deg,transparent,rgb(255_255_255/.22),transparent)] blur-[28px]" />
          <div className="absolute right-[18%] -top-[30%] h-[140%] w-[10%] rotate-[24deg] bg-[linear-gradient(90deg,transparent,rgb(255_255_255/.14),transparent)] blur-[18px]" />
          <div className="absolute inset-x-0 bottom-0 h-[45%] bg-[linear-gradient(0deg,color-mix(in_srgb,var(--sec)_85%,black),transparent)]" />
        </div>
      )}
    </div>
  );
}

function CartesHeros({ zones, niveaux, bateau }: { zones: Zone[]; niveaux: FormationSite[]; bateau: BateauSite | undefined }) {
  const avecProf = zones.map((z) => ({ nom: z.nom, p: profondeur(z) })).filter((z): z is { nom: string; p: number } => z.p !== null).slice(0, 7);
  const max = Math.max(1, ...avecProf.map((z) => z.p));
  const premier = niveaux.find((n) => n.prix !== null) ?? niveaux[0];
  if (avecProf.length === 0 && !premier && !bateau) return null;
  return (
    <div className="hidden items-end justify-end gap-[14px] @5xl:flex">
      <div className="flex flex-col gap-[14px]">
        {avecProf.length > 0 && (
          <div className="galet w-[230px] p-[18px] ring-1 ring-white/25 backdrop-blur-xl [background:rgb(255_255_255/.14)]">
            <p className="text-[34px] font-medium leading-none tracking-[-0.03em] [font-family:var(--titres)]">{max} m</p>
            <p className="pt-[6px] text-[12.5px] leading-snug text-white/75">profondeur max sur {avecProf.length > 1 ? `nos ${zones.length} sites` : "notre site"}</p>
            {/* Une barre par site, qui descend selon sa profondeur */}
            <div className="mt-[14px] flex h-[64px] items-start justify-between border-t border-white/40 px-[2px] pt-[6px]">
              {avecProf.map((z) => (
                <span key={z.nom} title={`${z.nom} : ${z.p} m`} className="w-[10px] rounded-full bg-white/85" style={{ height: `${Math.max(14, (z.p / max) * 100)}%` }} />
              ))}
            </div>
          </div>
        )}
        {bateau && (
          <div className="galet-moyen flex w-[230px] items-center gap-[12px] bg-white p-[12px] text-[var(--sec)]">
            <span className="flex h-[40px] w-[40px] shrink-0 items-center justify-center rounded-full bg-[var(--acc)] text-white">
              <Ship className="h-[19px] w-[19px]" aria-hidden="true" />
            </span>
            <span className="min-w-0 text-[13px] leading-tight">
              <b className="block truncate text-[14px]">{bateau.nom}</b>
              {[bateau.type, bateau.places].filter(Boolean).join(", ")}
            </span>
          </div>
        )}
      </div>
      {premier && (
        <div className="galet-b w-[210px] bg-white p-[20px] text-[var(--sec)] shadow-[0_24px_60px_rgb(0_0_0/.25)]">
          <span className="flex h-[40px] w-[40px] items-center justify-center rounded-full bg-[var(--acc)] text-white">
            <GraduationCap className="h-[19px] w-[19px]" aria-hidden="true" />
          </span>
          <p className="pt-[26px] text-[13px] text-[color-mix(in_srgb,var(--sec)_65%,white)]">{premier.intitule}</p>
          <p className="pt-[4px] text-[30px] font-medium leading-none tracking-[-0.02em] [font-family:var(--titres)]">{prixEuros(premier.prix) ?? premier.code}</p>
          <p className="pt-[8px] text-[12.5px] text-[color-mix(in_srgb,var(--sec)_65%,white)]">{dureeTexte(premier)}</p>
        </div>
      )}
    </div>
  );
}

// Les tarifs en cartes côte à côte : au survol (ou au toucher), la carte s'ouvre
// et montre le détail, les autres se resserrent. Une transition CSS sur la largeur,
// pas de bibliothèque : le plus léger possible.
type CarteTarif = { cle: string; code: string | null; titre: string; detail: string | null; prix: string; infos: string[] };

function Tarifs({ tarifs, niveaux, contact, image }: { tarifs: Tarif[]; niveaux: FormationSite[]; contact: { href: string; texte: string }; image: string | null }) {
  const prix = (p: Tarif["prix"]) => {
    const n = Number(String(p ?? "").replace(",", "."));
    return p === null || p === "" || !Number.isFinite(n) ? "Sur demande" : prixEuros(n)!;
  };
  const progresser: CarteTarif[] = [
    ...tarifs
      .filter((t) => t.groupe !== "plongee")
      .map((t, i) => ({ cle: `t${i}`, code: null, titre: t.libelle, detail: t.detail || null, prix: prix(t.prix), infos: [] })),
    ...niveaux.map((n) => ({
      cle: n.code,
      code: n.code,
      titre: n.intitule,
      detail: n.objectifs || n.description,
      prix: prixEuros(n.prix) ?? "Sur demande",
      infos: [
        n.age_min ? `Dès ${n.age_min} ans` : "",
        n.profondeur_max ? `Jusqu'à ${n.profondeur_max} m` : "",
        n.nb_pratique > 0 ? `${n.nb_pratique} plongées` : "",
        n.nb_theorie > 0 ? `${n.nb_theorie} cours théoriques` : "",
        n.prerequis ? `Pour s'inscrire : ${n.prerequis}` : "",
      ].filter(Boolean),
    })),
  ];
  const plonger: CarteTarif[] = tarifs
    .filter((t) => t.groupe === "plongee")
    .map((t, i) => ({ cle: `p${i}`, code: null, titre: t.libelle, detail: t.detail || null, prix: prix(t.prix), infos: [] }));

  return (
    <Section id="tarifs" libelle="Tarifs" titre="Nos tarifs" texte="Tarifs par personne, susceptibles d'évoluer en cours de saison. Ouvrez une carte pour en savoir plus.">
      <div className="flex flex-col gap-[34px]">
        {progresser.length > 0 && <RangeeCartes titre="Découvrir et progresser" cartes={progresser} contact={contact} image={image} profondeurDepart={0} action="S'inscrire" />}
        {plonger.length > 0 && <RangeeCartes titre="Plonger avec nous" cartes={plonger} contact={contact} image={image} profondeurDepart={0.55} action="Réserver" />}
      </div>
    </Section>
  );
}

function RangeeCartes({
  titre,
  cartes,
  contact,
  image,
  profondeurDepart,
  action,
}: {
  titre: string;
  cartes: CarteTarif[];
  contact: { href: string; texte: string };
  image: string | null;
  profondeurDepart: number;
  action: string;
}) {
  const [actif, setActif] = useState(0);
  // Chaque carte descend un peu plus profond : du bleu clair du baptême au bleu nuit
  const fond = (i: number) => {
    const t = Math.min(1, profondeurDepart + (i / Math.max(1, cartes.length - 1)) * (1 - profondeurDepart) * 0.9);
    if (!image)
      return {
        backgroundImage: `linear-gradient(180deg, color-mix(in srgb, var(--acc) ${Math.round(70 - t * 55)}%, var(--sec)) 0%, color-mix(in srgb, var(--sec) ${Math.round(60 + t * 40)}%, black) 100%)`,
      };
    // Avec la photo du club : un voile de plus en plus sombre, et un cadrage différent par carte
    return {
      backgroundImage: `linear-gradient(180deg, color-mix(in srgb, var(--sec) ${Math.round(15 + t * 45)}%, transparent) 0%, color-mix(in srgb, var(--sec) ${Math.round(75 + t * 20)}%, black) 100%), url("${image}")`,
      backgroundSize: "cover",
      backgroundPosition: `${(15 + i * 14) % 100}% center`,
    };
  };
  return (
    <div>
      <h3 className="pb-[14px] text-[22px] font-medium tracking-[-0.01em]">{titre}</h3>
      <ul className="flex flex-col gap-[10px] @3xl:h-[420px] @3xl:flex-row">
        {cartes.map((c, i) => {
          const ouvert = i === actif;
          return (
            <li
              key={c.cle}
              onMouseEnter={() => setActif(i)}
              className={`relative min-w-0 overflow-hidden rounded-[28px] text-white transition-[flex-grow,min-height] duration-500 ease-[cubic-bezier(.2,.8,.2,1)] motion-reduce:transition-none @3xl:min-h-0 @3xl:basis-0 ${
                ouvert ? "min-h-[320px] @3xl:grow-[4]" : "min-h-[76px] @3xl:grow"
              }`}
              style={fond(i)}
            >
              <button
                type="button"
                aria-expanded={ouvert}
                onClick={() => setActif(i)}
                onFocus={() => setActif(i)}
                className="absolute inset-0 z-10 rounded-[28px] focus-visible:outline focus-visible:outline-2 focus-visible:-outline-offset-4 focus-visible:outline-white"
              >
                <span className="sr-only">
                  {c.titre}, {c.prix}
                </span>
              </button>
              {/* Pastille flèche, comme une invitation à ouvrir */}
              <span
                aria-hidden="true"
                className={`absolute right-[16px] top-[16px] h-[44px] w-[44px] items-center justify-center rounded-full ring-1 ${ouvert ? "flex" : "hidden @3xl:flex"} ring-white/40 backdrop-blur-md transition-transform duration-500 [background:rgb(255_255_255/.12)] ${ouvert ? "rotate-45" : ""}`}
              >
                <ArrowUpRight className="h-[18px] w-[18px]" />
              </span>
              {c.code && (
                <span className={`absolute left-[18px] top-[18px] rounded-full px-[12px] py-[6px] text-[13px] font-semibold backdrop-blur-md [background:rgb(255_255_255/.14)] transition-opacity duration-300 ${ouvert ? "opacity-100" : "opacity-0"}`}>
                  {c.code}
                </span>
              )}

              {/* Fermée (ordinateur) : le titre à la verticale */}
              <span
                aria-hidden="true"
                className={`pointer-events-none absolute inset-x-0 bottom-[22px] hidden flex-col items-center gap-[12px] transition-opacity duration-300 @3xl:flex ${ouvert ? "opacity-0" : "opacity-100 delay-150"}`}
              >
                <span className="max-h-[250px] truncate text-[16px] font-medium [font-family:var(--titres)] [transform:rotate(180deg)] [writing-mode:vertical-rl]">{c.titre}</span>
                <span className="text-[13px] font-semibold text-white/85">{c.prix}</span>
              </span>

              {/* Fermée (téléphone) : titre et prix sur une ligne */}
              <span aria-hidden="true" className={`pointer-events-none absolute inset-x-[20px] bottom-[20px] flex items-end justify-between gap-[12px] @3xl:hidden ${ouvert ? "hidden" : ""}`}>
                <span className="text-[16.5px] font-medium leading-tight [font-family:var(--titres)]">
                  {c.code && <span className="pr-[8px] text-[13px] font-semibold text-white/70">{c.code}</span>}
                  {c.titre}
                </span>
                <span className="shrink-0 text-[17px] font-semibold">{c.prix}</span>
              </span>

              {/* Ouverte : tout le détail */}
              <div
                className={`pointer-events-none absolute inset-x-0 bottom-0 p-[22px] transition-[opacity,transform] duration-500 @3xl:p-[28px] ${
                  ouvert ? "translate-y-0 opacity-100 delay-150" : "translate-y-[12px] opacity-0"
                }`}
              >
                <p className="text-[clamp(26px,3cqw,38px)] font-medium leading-[1.05] tracking-[-0.02em] [color:color-mix(in_srgb,var(--ter)_45%,white)] [font-family:var(--titres)]">{c.titre}</p>
                {c.detail && <p className="max-w-[44ch] pt-[8px] text-[14.5px] leading-[1.5] text-white/85">{c.detail}</p>}
                {c.infos.length > 0 && (
                  <ul className="flex flex-wrap gap-[6px] pt-[12px]">
                    {c.infos.map((x) => (
                      <li key={x} className="rounded-full px-[10px] py-[5px] text-[12px] font-medium backdrop-blur-md [background:rgb(255_255_255/.14)]">
                        {x}
                      </li>
                    ))}
                  </ul>
                )}
                <div className="flex flex-wrap items-end justify-between gap-[12px] pt-[16px]">
                  <p className="text-[clamp(34px,4cqw,48px)] font-medium leading-none tracking-[-0.03em] [font-family:var(--titres)]">{c.prix}</p>
                  <a href={contact.href} className="pointer-events-auto relative z-20 rounded-full bg-white px-[18px] py-[11px] text-[13.5px] font-semibold text-[var(--sec)]">
                    {action}
                  </a>
                </div>
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function Parcours({ niveaux, contact }: { niveaux: FormationSite[]; contact: { href: string; texte: string } }) {
  const [choisi, setChoisi] = useState(0);
  const f = niveaux[Math.min(choisi, niveaux.length - 1)]!;
  return (
    <div className="grid grid-cols-1 gap-[12px] @4xl:grid-cols-[minmax(0,1fr)_minmax(0,1.5fr)]">
      {/* Les niveaux se suivent : c'est un vrai parcours */}
      <div className="rounded-[26px] bg-[var(--acc)] p-[24px] text-white @3xl:p-[32px]">
        <p className="text-[21px] font-medium tracking-[-0.01em] [font-family:var(--titres)]">Votre parcours</p>
        <p className="pt-[4px] text-[13.5px] text-white/75">Du premier niveau à l'autonomie, un niveau après l'autre.</p>
        <ol className="relative mt-[24px] space-y-[8px] before:absolute before:bottom-[22px] before:left-[21px] before:top-[22px] before:w-px before:bg-white/35">
          {niveaux.map((n, i) => {
            const actif = i === choisi;
            return (
              <li key={n.code} className="relative">
                <button
                  type="button"
                  onClick={() => setChoisi(i)}
                  aria-pressed={actif}
                  className={`flex w-full items-center gap-[14px] rounded-full py-[5px] pl-[5px] pr-[18px] text-left transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-white ${actif ? "bg-white text-[var(--sec)]" : "text-white hover:bg-white/12"}`}
                >
                  <span className={`flex h-[34px] min-w-[34px] items-center justify-center rounded-full px-[6px] text-[12.5px] font-semibold ${actif ? "bg-[var(--acc)] text-white" : "bg-white/20"}`}>{n.code}</span>
                  <span className="min-w-0 flex-1 truncate text-[14.5px] font-medium">{n.intitule}</span>
                  <span className={`text-[13.5px] font-semibold ${actif ? "" : "text-white/80"}`}>{prixEuros(n.prix)}</span>
                </button>
              </li>
            );
          })}
        </ol>
        <p className="pt-[20px] text-[12.5px] text-white/70">Choisissez un niveau pour voir son programme et son tarif.</p>
      </div>
      <article className="galet flex flex-col bg-[var(--surface)] p-[24px] ring-1 ring-[var(--ligne)] @3xl:p-[34px]">
        <div className="flex flex-wrap items-start justify-between gap-[16px]">
          <div>
            <p className="text-[13.5px] text-[var(--acc)]">{[f.accroche, f.organisme].filter(Boolean).join(", ")}</p>
            <h3 className="pt-[4px] text-[clamp(26px,3cqw,36px)] font-medium leading-[1.1] tracking-[-0.02em]">{f.intitule}</h3>
          </div>
          <p className="text-[clamp(34px,4cqw,48px)] font-medium leading-none tracking-[-0.03em] text-[var(--acc)] [font-family:var(--titres)]">{prixEuros(f.prix) ?? "Sur demande"}</p>
        </div>
        {(f.objectifs || f.description) && <p className="max-w-[62ch] pt-[14px] text-[15.5px] leading-[1.6] text-[var(--doux)]">{f.objectifs || f.description}</p>}

        {/* L'essentiel en chiffres */}
        <div className="grid grid-cols-2 gap-[10px] pt-[20px] @2xl:grid-cols-4">
          {f.age_min ? <Compteur nombre={`${f.age_min} ans`} texte="âge minimum" /> : null}
          {f.profondeur_max ? <Compteur nombre={`${f.profondeur_max} m`} texte="profondeur maximale" /> : null}
          {f.nb_pratique > 0 && <Compteur nombre={String(f.nb_pratique)} texte={f.nb_pratique > 1 ? "plongées en mer" : "plongée en mer"} />}
          {f.nb_theorie > 0 && <Compteur nombre={String(f.nb_theorie)} texte={f.nb_theorie > 1 ? "cours théoriques" : "cours théorique"} />}
        </div>

        {/* Ce qu'on fait, ce qui est compris */}
        {((f.contenu?.length ?? 0) > 0 || (f.inclus?.length ?? 0) > 0) && (
          <div className="grid grid-cols-1 gap-[18px] pt-[22px] @2xl:grid-cols-2">
            {(f.contenu?.length ?? 0) > 0 && <ListeFiche titre="Au programme" items={f.contenu!} />}
            {(f.inclus?.length ?? 0) > 0 && <ListeFiche titre="Compris dans le prix" items={f.inclus!} />}
          </div>
        )}

        {f.prerogatives && (
          <p className="galet-moyen mt-[20px] bg-[color-mix(in_srgb,var(--acc)_12%,transparent)] px-[16px] py-[12px] text-[14.5px] leading-snug">
            <span className="font-semibold text-[var(--acc)]">Après la formation : </span>
            {f.prerogatives}
          </p>
        )}

        {/* Les conditions */}
        <dl className="grid grid-cols-1 gap-x-[20px] gap-y-[12px] pt-[18px] text-[13.5px] leading-[1.5] @2xl:grid-cols-2">
          {f.prerequis && <InfoFiche titre="Pour s'inscrire">{f.prerequis}</InfoFiche>}
          {(f.documents?.length ?? 0) > 0 && <InfoFiche titre="Documents à fournir">{f.documents!.join(", ")}</InfoFiche>}
          {f.periode && <InfoFiche titre="Quand">{f.periode}</InfoFiche>}
          {f.cursus && <InfoFiche titre="Cursus">{f.cursus}</InfoFiche>}
        </dl>

        <div className="mt-auto pt-[24px]">
          <a href={contact.href} className="inline-block galet-moyen bg-[var(--sec)] px-[22px] py-[13px] text-[14px] font-semibold text-white">
            S'inscrire au {f.code}
          </a>
        </div>
      </article>
    </div>
  );
}

function ListeFiche({ titre, items }: { titre: string; items: string[] }) {
  return (
    <div>
      <p className="pb-[8px] text-[14px] font-semibold">{titre}</p>
      <ul className="flex flex-col gap-[7px]">
        {items.map((x) => (
          <li key={x} className="flex gap-[9px] text-[14px] leading-snug text-[var(--doux)]">
            <span className="goutte mt-[5px] h-[8px] w-[8px] shrink-0 bg-[var(--acc)]" aria-hidden="true" />
            {x}
          </li>
        ))}
      </ul>
    </div>
  );
}

function InfoFiche({ titre, children }: { titre: string; children: ReactNode }) {
  return (
    <div>
      <dt className="text-[12.5px] font-semibold text-[var(--doux)]">{titre}</dt>
      <dd className="pt-[2px]">{children}</dd>
    </div>
  );
}

function Compteur({ nombre, texte }: { nombre: number | string; texte: string }) {
  return (
    <div className="galet-moyen bg-[color-mix(in_srgb,var(--acc)_9%,transparent)] p-[14px]">
      <p className="text-[26px] font-medium leading-none tracking-[-0.02em] [font-family:var(--titres)]">{nombre}</p>
      <p className="pt-[6px] text-[13px] leading-snug text-[var(--doux)]">{texte}</p>
    </div>
  );
}

function Sites({ zones }: { zones: Zone[] }) {
  const [choisi, setChoisi] = useState(0);
  const max = Math.max(40, ...zones.map((z) => profondeur(z) ?? 0));
  const teinte = (z: Zone) => {
    const p = profondeur(z);
    const t = p === null ? 0.45 : Math.min(1, p / max);
    return `linear-gradient(180deg, color-mix(in srgb, var(--acc) ${Math.round(95 - t * 80)}%, var(--sec)) 0%, color-mix(in srgb, var(--sec) ${Math.round(55 + t * 45)}%, black) 100%)`;
  };
  return (
    <>
      {/* Ordinateur : cartes verticales qui s'ouvrent */}
      <div className="hidden h-[460px] gap-[10px] @3xl:flex">
        {zones.slice(0, 8).map((z, i) => {
          const actif = i === choisi;
          const p = profondeur(z);
          return (
            <button
              key={`${z.nom}-${i}`}
              type="button"
              onClick={() => setChoisi(i)}
              aria-expanded={actif}
              className={`relative overflow-hidden rounded-[26px] text-left text-white transition-[flex-grow] duration-500 ease-out focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--acc)] motion-reduce:transition-none ${actif ? "grow-[5]" : "grow"} basis-0`}
              style={{ background: teinte(z) }}
            >
              {/* Graduation de profondeur, sur le bord */}
              <span aria-hidden="true" className="absolute inset-y-[22px] right-[14px] w-[10px] bg-[repeating-linear-gradient(180deg,rgb(255_255_255/.35)_0_1px,transparent_1px_18px)]" />
              {actif ? (
                <span className="absolute inset-0 flex flex-col p-[28px]">
                  <span className="text-[13.5px] text-white/70">{z.niveau ? `Accessible dès le ${z.niveau}` : "Site de plongée"}</span>
                  <span className="mt-auto block max-w-[16ch] text-[clamp(28px,3.4cqw,42px)] font-medium leading-[1.05] tracking-[-0.02em] [font-family:var(--titres)]">{z.nom}</span>
                  {z.description && <span className="block max-w-[44ch] pt-[12px] text-[14.5px] leading-[1.55] text-white/80">{z.description}</span>}
                  {p !== null && <span className="pt-[20px] text-[56px] font-medium leading-none tracking-[-0.04em] [font-family:var(--titres)]">{p} m</span>}
                </span>
              ) : (
                <span className="absolute inset-0 flex flex-col items-center justify-end gap-[14px] py-[24px]">
                  <span className="max-h-[300px] truncate text-[16px] font-medium [font-family:var(--titres)] [transform:rotate(180deg)] [writing-mode:vertical-rl]">{z.nom}</span>
                  {p !== null && <span className="text-[13px] font-semibold text-white/80">{p} m</span>}
                </span>
              )}
            </button>
          );
        })}
      </div>
      {/* Téléphone : une liste */}
      <ul className="grid grid-cols-1 gap-[10px] @3xl:hidden">
        {zones.map((z, i) => {
          const p = profondeur(z);
          return (
            <li key={`${z.nom}-${i}`} className="flex items-end gap-[14px] rounded-[22px] p-[20px] text-white" style={{ background: teinte(z) }}>
              <span className="min-w-0 flex-1">
                <span className="block text-[19px] font-medium leading-tight [font-family:var(--titres)]">{z.nom}</span>
                {(z.niveau || z.description) && <span className="block pt-[6px] text-[13.5px] leading-snug text-white/75">{[z.niveau && `Dès le ${z.niveau}`, z.description].filter(Boolean).join(". ")}</span>}
              </span>
              {p !== null && <span className="text-[30px] font-medium leading-none tracking-[-0.03em] [font-family:var(--titres)]">{p} m</span>}
            </li>
          );
        })}
      </ul>
    </>
  );
}

function Materiel({ bateaux, equipement }: { bateaux: BateauSite[]; equipement: EquipementSite[] }) {
  const familles = useMemo(() => {
    const m = new Map<string, { total: number; variantes: string[] }>();
    for (const e of equipement) {
      const f = m.get(e.categorie) ?? { total: 0, variantes: [] };
      f.total += e.nb;
      if (e.variante) f.variantes.push(`${e.nb} × ${e.variante}`);
      m.set(e.categorie, f);
    }
    return [...m.entries()];
  }, [equipement]);
  const b = bateaux[0];
  return (
    <div className="grid grid-cols-1 gap-[12px] @4xl:grid-cols-[minmax(0,1fr)_minmax(0,1.35fr)]">
      {b && (
        <div className="relative overflow-hidden rounded-[26px] bg-[var(--sec)] p-[26px] text-white @3xl:p-[34px]">
          <span aria-hidden="true" className="absolute -bottom-[60px] -right-[40px] h-[220px] w-[220px] rounded-full border-[28px] border-white/5" />
          <span className="flex h-[48px] w-[48px] items-center justify-center rounded-full bg-[var(--acc)]">
            <Ship className="h-[22px] w-[22px]" aria-hidden="true" />
          </span>
          <h3 className="pt-[22px] text-[30px] font-medium leading-tight tracking-[-0.02em]">{b.nom}</h3>
          {b.modele && <p className="pt-[4px] text-[14px] text-white/65">{b.modele}</p>}
          <dl className="mt-[22px] grid grid-cols-2 gap-x-[16px] gap-y-[14px] border-t border-white/15 pt-[20px] text-[14px]">
            {[
              ["Type", b.type],
              ["Capacité", b.places],
              ["Longueur", b.longueur],
              ["Moteur", b.moteur],
              ["Port d'attache", b.port],
              ["Oxygène à bord", b.oxygene],
            ]
              .filter(([, v]) => v)
              .map(([k, v]) => (
                <div key={k}>
                  <dt className="text-[12.5px] text-white/55">{k}</dt>
                  <dd className="pt-[2px] font-medium">{v}</dd>
                </div>
              ))}
          </dl>
          {bateaux.length > 1 && <p className="pt-[18px] text-[13px] text-white/60">Et {bateaux.length - 1} autre{bateaux.length > 2 ? "s" : ""} bateau{bateaux.length > 2 ? "x" : ""} : {bateaux.slice(1).map((x) => x.nom).join(", ")}.</p>}
        </div>
      )}
      {familles.length > 0 && (
        <div className={`grid grid-cols-1 gap-[12px] @xl:grid-cols-2 ${b ? "" : "@4xl:col-span-2 @4xl:grid-cols-3"}`}>
          {familles.map(([cat, f]) => (
            <div key={cat} className="rounded-[22px] bg-[var(--surface)] p-[20px] ring-1 ring-[var(--ligne)]">
              <p className="text-[34px] font-medium leading-none tracking-[-0.03em] [font-family:var(--titres)]">{f.total}</p>
              <p className="pt-[8px] text-[15px] font-semibold">{LIBELLE_EQUIPEMENT[cat] ?? cat}</p>
              {f.variantes.length > 0 && <p className="pt-[4px] text-[13px] leading-[1.45] text-[var(--doux)]">{f.variantes.join(", ")}</p>}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function Infos({ contenu, contact }: { contenu: ContenuSite; contact: { href: string; texte: string } }) {
  const { site, centre } = contenu;
  const carte = site.adresse ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${site.adresse} ${centre.ville ?? ""}`)}` : null;
  const blocs = [
    site.horaires && { Icone: Clock, titre: "Horaires", texte: site.horaires },
    site.saison && { Icone: Sun, titre: "Saison", texte: site.saison },
    site.infos && { Icone: LifeBuoy, titre: "À prévoir", texte: site.infos },
  ].filter(Boolean) as { Icone: typeof Clock; titre: string; texte: string }[];
  return (
    <Section id="contact" libelle="Infos pratiques" titre="Venir plonger avec nous">
      <div className="grid grid-cols-1 gap-[12px] @4xl:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)]">
        <div className="flex flex-col rounded-[26px] bg-[var(--acc)] p-[26px] text-white @3xl:p-[34px]">
          <p className="text-[21px] font-medium [font-family:var(--titres)]">Une question, une réservation ?</p>
          <p className="pt-[4px] text-[14px] text-white/80">Appelez-nous ou écrivez-nous, on vous répond vite.</p>
          <div className="mt-[26px] space-y-[12px]">
            {site.telephone && (
              <a href={`tel:${site.telephone.replace(/[^\d+]/g, "")}`} className="flex items-center gap-[12px] text-[clamp(24px,3cqw,34px)] font-medium tracking-[-0.02em] [font-family:var(--titres)]">
                <Phone className="h-[22px] w-[22px] shrink-0" aria-hidden="true" /> {site.telephone}
              </a>
            )}
            {site.email && (
              <a href={`mailto:${site.email}`} className="flex items-center gap-[12px] break-all text-[16px] font-medium">
                <Mail className="h-[19px] w-[19px] shrink-0" aria-hidden="true" /> {site.email}
              </a>
            )}
            {site.adresse && (
              <p className="flex items-start gap-[12px] text-[15px]">
                <MapPin className="mt-[2px] h-[19px] w-[19px] shrink-0" aria-hidden="true" />
                <span>
                  {site.adresse}
                  {carte && (
                    <a href={carte} target="_blank" rel="noreferrer" className="block pt-[4px] text-[13.5px] font-semibold underline underline-offset-4">
                      Voir l'itinéraire
                    </a>
                  )}
                </span>
              </p>
            )}
            {!site.telephone && !site.email && !site.adresse && <p className="text-[14px] text-white/80">Les coordonnées du club arrivent bientôt.</p>}
          </div>
          <a href={contact.href} className="mt-[28px] w-fit galet-moyen bg-white px-[22px] py-[13px] text-[14px] font-semibold text-[var(--sec)]">
            {contact.texte}
          </a>
        </div>
        {blocs.length > 0 && (
          <div className="grid grid-cols-1 gap-[12px]">
            {blocs.map((b) => (
              <div key={b.titre} className="galet-c flex gap-[14px] bg-[var(--surface)] p-[20px] ring-1 ring-[var(--ligne)]">
                <b.Icone className="mt-[2px] h-[20px] w-[20px] shrink-0 text-[var(--acc)]" aria-hidden="true" />
                <div>
                  <p className="text-[15.5px] font-semibold">{b.titre}</p>
                  <p className="whitespace-pre-line pt-[4px] text-[14px] leading-[1.55] text-[var(--doux)]">{b.texte}</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </Section>
  );
}

function dureeTexte(f: FormationSite) {
  const t = [f.nb_theorie > 0 && `${f.nb_theorie} cours`, f.nb_pratique > 0 && `${f.nb_pratique} plongée${f.nb_pratique > 1 ? "s" : ""}`].filter(Boolean);
  return t.join(" et ");
}

function initiales(nom: string) {
  return nom
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((m) => m[0]!.toUpperCase())
    .join("");
}
