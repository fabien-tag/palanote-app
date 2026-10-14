import { useMemo, useState, type CSSProperties, type ReactNode } from "react";
import { Anchor, Clock, GraduationCap, LifeBuoy, Mail, MapPin, Phone, ShieldCheck, Ship, Sun, Users, Waves } from "lucide-react";
import {
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
  const autres = formations.filter((f) => f.categorie !== "niveau");
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

  const chiffres = [
    formations.length > 0 && { Icone: GraduationCap, valeur: String(formations.length), texte: formations.length > 1 ? "formations, du baptême à l'encadrement" : "formation proposée" },
    zones.length > 0 && { Icone: MapPin, valeur: String(zones.length), texte: zones.length > 1 ? "sites de plongée explorés" : "site de plongée" },
    profMax > 0 && { Icone: Waves, valeur: `${profMax} m`, texte: "de profondeur sur nos sites les plus profonds" },
    places.length > 0 && { Icone: Ship, valeur: String(Math.max(...places)), texte: "places à bord de notre bateau" },
    places.length === 0 && encadrants.length > 0 && { Icone: Users, valeur: String(encadrants.length), texte: encadrants.length > 1 ? "encadrants diplômés" : "encadrant diplômé" },
  ]
    .filter(Boolean)
    .slice(0, 4) as { Icone: typeof Waves; valeur: string; texte: string }[];

  return (
    <div id="haut" style={style} className="@container min-h-full bg-[var(--fond)] text-[var(--txt)] antialiased [&_h1,&_h2,&_h3]:font-[family-name:var(--titres)]">
      {/* ——— Héros ——— */}
      <header className="p-[10px] @3xl:p-[14px]">
        <div className="relative isolate flex min-h-[560px] flex-col overflow-hidden rounded-[26px] text-white @3xl:min-h-[700px] @3xl:rounded-[36px]">
          <FondHeros image={site.couverture_url} />
          <nav className="relative z-10 flex items-center gap-[12px] p-[14px] @3xl:p-[20px]">
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

          <div className="relative z-10 grid flex-1 grid-cols-1 gap-[28px] px-[22px] pb-[26px] pt-[30px] @3xl:px-[44px] @3xl:pb-[44px] @5xl:grid-cols-[minmax(0,1.25fr)_minmax(0,1fr)]">
            <div className="flex flex-col">
              <h1 className="max-w-[12ch] text-[clamp(40px,7.5cqw,88px)] font-medium leading-[1.02] tracking-[-0.03em]">
                {site.accroche || `Plongez avec ${centre.nom}`}
              </h1>
              <div className="mt-auto pt-[40px]">
                {site.sous_titre && <p className="max-w-[46ch] text-[16px] leading-[1.55] text-white/80 @3xl:text-[17px]">{site.sous_titre}</p>}
                <div className="flex flex-wrap gap-[10px] pt-[20px]">
                  {voir.formations && (
                    <a href="#formations" className="rounded-full bg-white px-[22px] py-[13px] text-[14px] font-semibold text-[var(--sec)]">
                      Passer un niveau
                    </a>
                  )}
                  <a href={contact.href} className="rounded-full px-[22px] py-[13px] text-[14px] font-semibold text-white ring-1 ring-white/35 backdrop-blur-md [background:rgb(255_255_255/.1)]">
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
          <section aria-label="Le club en chiffres" className="mx-auto grid max-w-[1240px] grid-cols-2 px-[22px] pt-[44px] @4xl:grid-cols-4 @4xl:px-[40px]">
            {chiffres.map((c, i) => (
              <div key={c.texte} className={`py-[14px] pr-[16px] @4xl:pl-[22px] ${i > 0 ? "@4xl:border-l @4xl:border-[var(--ligne)]" : "@4xl:pl-0"} ${i % 2 === 1 ? "border-l border-[var(--ligne)] pl-[18px]" : ""}`}>
                <c.Icone className="h-[22px] w-[22px] text-[var(--acc)]" strokeWidth={1.8} aria-hidden="true" />
                <p className="pt-[18px] text-[clamp(36px,5cqw,52px)] font-medium leading-none tracking-[-0.03em] [font-family:var(--titres)]">{c.valeur}</p>
                <p className="max-w-[24ch] pt-[10px] text-[13.5px] leading-[1.45] text-[var(--doux)]">{c.texte}</p>
              </div>
            ))}
          </section>
        )}

        {voir.tarifs && <Tarifs tarifs={tarifs} niveaux={niveauxTarifs} contact={contact} />}

        {/* ——— Le club ——— */}
        <Section id="club" libelle="Le club" titre={centre.ville ? `Plonger à ${centre.ville}` : "Plonger avec nous"} texte={site.presentation}>
          {site.atouts.length > 0 && (
            <div className="grid grid-cols-1 gap-[12px] @2xl:grid-cols-3">
              {site.atouts.map((a, i) => {
                const Icone = ICONES_ATOUTS[i % ICONES_ATOUTS.length]!;
                return (
                  <div key={i} className="rounded-[22px] bg-[var(--surface)] p-[24px] ring-1 ring-[var(--ligne)]">
                    <span className="flex h-[44px] w-[44px] items-center justify-center rounded-full bg-[var(--acc)] text-white">
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
            {niveaux.length > 0 && <Parcours niveaux={niveaux} contact={contact} />}
            {autres.length > 0 && (
              <div className={niveaux.length > 0 ? "pt-[36px]" : ""}>
                <h3 className="pb-[14px] text-[22px] font-medium tracking-[-0.02em]">{niveaux.length > 0 ? "Et aussi" : "Nos formations"}</h3>
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
          <Section id="equipe" libelle="L'équipe" titre="Ceux qui vous encadrent" texte="Directeurs de plongée, moniteurs et pilote : une équipe diplômée, présente à chaque sortie.">
            <ul className="grid grid-cols-1 gap-[12px] @xl:grid-cols-2 @4xl:grid-cols-4">
              {equipe.map((e, i) => (
                <li key={`${e.nom}-${i}`} className="flex items-center gap-[14px] rounded-[22px] bg-[var(--surface)] p-[18px] ring-1 ring-[var(--ligne)]">
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

function Section({ id, libelle, titre, texte, children }: { id: string; libelle: string; titre: string; texte?: string | null; children?: ReactNode }) {
  return (
    <section id={id} className="mx-auto max-w-[1240px] scroll-mt-[20px] px-[22px] pt-[84px] @4xl:px-[40px] @4xl:pt-[120px]">
      <div className="grid grid-cols-1 gap-[14px] pb-[34px] @4xl:grid-cols-[minmax(0,1fr)_minmax(0,2.2fr)] @4xl:pb-[44px]">
        <p className="text-[13.5px] font-medium text-[var(--acc)] @4xl:pt-[14px]">{libelle}</p>
        <div>
          <h2 className="max-w-[18ch] text-[clamp(32px,4.6cqw,54px)] font-medium leading-[1.06] tracking-[-0.03em]">{titre}</h2>
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
          <div className="w-[230px] rounded-[22px] p-[18px] ring-1 ring-white/25 backdrop-blur-xl [background:rgb(255_255_255/.14)]">
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
          <div className="flex w-[230px] items-center gap-[12px] rounded-[18px] bg-white p-[12px] text-[var(--sec)]">
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
        <div className="w-[210px] rounded-[22px] bg-white p-[20px] text-[var(--sec)] shadow-[0_24px_60px_rgb(0_0_0/.25)]">
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

// Les prix en un coup d'œil : le baptême et les niveaux d'un côté, les plongées de l'autre
function Tarifs({ tarifs, niveaux, contact }: { tarifs: Tarif[]; niveaux: FormationSite[]; contact: { href: string; texte: string } }) {
  const prix = (p: Tarif["prix"]) => {
    const n = Number(String(p ?? "").replace(",", "."));
    return p === null || p === "" || !Number.isFinite(n) ? "Sur demande" : prixEuros(n)!;
  };
  const progresser = [
    ...tarifs.filter((t) => t.groupe !== "plongee").map((t) => ({ code: null as string | null, libelle: t.libelle, detail: t.detail, prix: prix(t.prix) })),
    ...niveaux.map((n) => ({ code: n.code, libelle: n.intitule, detail: dureeTexte(n), prix: prixEuros(n.prix) ?? "Sur demande" })),
  ];
  const plonger = tarifs.filter((t) => t.groupe === "plongee");
  return (
    <Section id="tarifs" libelle="Tarifs" titre="Nos tarifs" texte="Tarifs par personne, susceptibles d'évoluer en cours de saison.">
      <div className={`grid grid-cols-1 gap-[12px] ${progresser.length > 0 && plonger.length > 0 ? "@4xl:grid-cols-2" : ""}`}>
        {progresser.length > 0 && (
          <div className="rounded-[26px] bg-[var(--sec)] p-[24px] text-white @3xl:p-[32px]">
            <h3 className="text-[22px] font-medium tracking-[-0.01em]">Découvrir et progresser</h3>
            <p className="pt-[4px] text-[13.5px] text-white/65">Du baptême au niveau 4, à votre rythme.</p>
            <ul className="mt-[18px]">
              {progresser.map((t, i) => (
                <li key={`${t.libelle}-${i}`} className="flex items-center gap-[14px] border-t border-white/12 py-[14px] first:border-t-0">
                  <span className={`flex h-[38px] min-w-[38px] items-center justify-center rounded-full px-[6px] text-[12.5px] font-semibold ${t.code ? "bg-white/12" : "bg-[var(--acc)]"}`}>
                    {t.code ?? <Waves className="h-[17px] w-[17px]" aria-hidden="true" />}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-[15.5px] font-medium">{t.libelle}</span>
                    {t.detail && <span className="block text-[12.5px] leading-snug text-white/60">{t.detail}</span>}
                  </span>
                  <span className="shrink-0 text-[22px] font-medium tracking-[-0.02em] [font-family:var(--titres)]">{t.prix}</span>
                </li>
              ))}
            </ul>
            {niveaux.length > 0 && (
              <a href="#formations" className="mt-[10px] inline-block text-[13.5px] font-semibold text-white underline underline-offset-4">
                Le programme de chaque niveau
              </a>
            )}
          </div>
        )}
        {plonger.length > 0 && (
          <div className="flex flex-col rounded-[26px] bg-[var(--surface)] p-[24px] ring-1 ring-[var(--ligne)] @3xl:p-[32px]">
            <h3 className="text-[22px] font-medium tracking-[-0.01em]">Plonger avec nous</h3>
            <p className="pt-[4px] text-[13.5px] text-[var(--doux)]">Pour les plongeurs déjà brevetés.</p>
            <ul className="mt-[18px] grid grid-cols-1 gap-[10px]">
              {plonger.map((t, i) => (
                <li key={`${t.libelle}-${i}`} className="flex items-center gap-[16px] rounded-[18px] bg-[color-mix(in_srgb,var(--acc)_8%,transparent)] p-[16px]">
                  <span className="min-w-0 flex-1">
                    <span className="block text-[16px] font-semibold">{t.libelle}</span>
                    {t.detail && <span className="block pt-[2px] text-[13px] leading-snug text-[var(--doux)]">{t.detail}</span>}
                  </span>
                  <span className="shrink-0 text-[28px] font-medium leading-none tracking-[-0.03em] text-[var(--acc)] [font-family:var(--titres)]">{prix(t.prix)}</span>
                </li>
              ))}
            </ul>
            <a href={contact.href} className="mt-auto w-fit pt-[20px]">
              <span className="inline-block rounded-full bg-[var(--sec)] px-[22px] py-[13px] text-[14px] font-semibold text-white">Réserver une plongée</span>
            </a>
          </div>
        )}
      </div>
    </Section>
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
      <article className="flex flex-col rounded-[26px] bg-[var(--surface)] p-[24px] ring-1 ring-[var(--ligne)] @3xl:p-[34px]">
        <div className="flex flex-wrap items-start justify-between gap-[16px]">
          <div>
            <p className="text-[13.5px] text-[var(--doux)]">{f.organisme}</p>
            <h3 className="pt-[4px] text-[clamp(26px,3cqw,36px)] font-medium leading-[1.1] tracking-[-0.02em]">{f.intitule}</h3>
          </div>
          <p className="text-[clamp(34px,4cqw,48px)] font-medium leading-none tracking-[-0.03em] text-[var(--acc)] [font-family:var(--titres)]">{prixEuros(f.prix) ?? "Sur demande"}</p>
        </div>
        {f.description && <p className="max-w-[58ch] pt-[16px] text-[15.5px] leading-[1.6] text-[var(--doux)]">{f.description}</p>}
        <div className="grid grid-cols-2 gap-[12px] pt-[24px]">
          <Compteur nombre={f.nb_theorie} texte={f.nb_theorie > 1 ? "cours théoriques" : "cours théorique"} />
          <Compteur nombre={f.nb_pratique} texte={f.nb_pratique > 1 ? "séances en mer ou en fosse" : "séance en mer"} />
        </div>
        {f.prerequis && (
          <p className="pt-[18px] text-[14px] leading-[1.5]">
            <span className="text-[var(--doux)]">Pour s'inscrire : </span>
            {f.prerequis}
          </p>
        )}
        <div className="mt-auto pt-[26px]">
          <a href={contact.href} className="inline-block rounded-full bg-[var(--sec)] px-[22px] py-[13px] text-[14px] font-semibold text-white">
            S'inscrire au {f.code}
          </a>
        </div>
      </article>
    </div>
  );
}

function Compteur({ nombre, texte }: { nombre: number; texte: string }) {
  return (
    <div className="rounded-[18px] bg-[color-mix(in_srgb,var(--acc)_9%,transparent)] p-[16px]">
      <p className="text-[30px] font-medium leading-none tracking-[-0.02em] [font-family:var(--titres)]">{nombre}</p>
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
          <a href={contact.href} className="mt-[28px] w-fit rounded-full bg-white px-[22px] py-[13px] text-[14px] font-semibold text-[var(--sec)]">
            {contact.texte}
          </a>
        </div>
        {blocs.length > 0 && (
          <div className="grid grid-cols-1 gap-[12px]">
            {blocs.map((b) => (
              <div key={b.titre} className="flex gap-[14px] rounded-[22px] bg-[var(--surface)] p-[20px] ring-1 ring-[var(--ligne)]">
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
