import { useEffect, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { Anchor } from "lucide-react";
import { SiteClub } from "@/components/site/SiteClub";
import { POLICES_SITE, sitePublic, type ContenuSite } from "@/lib/siteClub";

// Le site public d'un club : /clubs/<adresse-du-club>
// Chargé côté serveur quand c'est possible, pour que Google lise le contenu (titre, description, données structurées).
export const Route = createFileRoute("/clubs/$slug")({
  loader: async ({ params }) => {
    try {
      return { contenu: await sitePublic(params.slug) };
    } catch {
      return { contenu: null };
    }
  },
  head: ({ loaderData }) => {
    const c = loaderData?.contenu;
    const titre = c ? `${c.centre.nom}, club de plongée${c.centre.ville ? ` à ${c.centre.ville}` : ""}` : "Club de plongée";
    const description = c ? (c.site.sous_titre || c.site.presentation || `Formations, sites de plongée et sorties en mer avec ${c.centre.nom}.`).slice(0, 158) : "";
    return {
      meta: [
        { title: titre },
        { name: "description", content: description },
        { property: "og:title", content: titre },
        { property: "og:description", content: description },
        ...(c?.site.couverture_url ? [{ property: "og:image", content: c.site.couverture_url }] : []),
        { name: "theme-color", content: c?.site.couleur_secondaire ?? "#0B3B63" },
      ],
      links: [
        { rel: "preconnect", href: "https://fonts.googleapis.com" },
        { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "anonymous" },
        { rel: "stylesheet", href: POLICES_SITE },
        ...(c?.site.logo_url ? [{ rel: "icon", href: c.site.logo_url }] : []),
      ],
    };
  },
  component: PageSite,
});

function donneesStructurees(c: ContenuSite) {
  const s = c.site;
  return {
    "@context": "https://schema.org",
    "@type": "SportsActivityLocation",
    name: c.centre.nom,
    description: s.presentation ?? s.sous_titre ?? undefined,
    ...(s.telephone ? { telephone: s.telephone } : {}),
    ...(s.email ? { email: s.email } : {}),
    ...(s.logo_url ? { logo: s.logo_url } : {}),
    ...(s.couverture_url ? { image: s.couverture_url } : {}),
    address: { "@type": "PostalAddress", ...(s.adresse ? { streetAddress: s.adresse } : {}), ...(c.centre.ville ? { addressLocality: c.centre.ville } : {}), addressCountry: "FR" },
    ...(c.formations.length
      ? {
          makesOffer: c.formations.map((f) => ({
            "@type": "Offer",
            name: f.intitule,
            ...(f.prix !== null ? { price: f.prix, priceCurrency: "EUR" } : {}),
          })),
        }
      : {}),
  };
}

function PageSite() {
  const { slug } = Route.useParams();
  const { contenu: initial } = Route.useLoaderData();
  const [contenu, setContenu] = useState<ContenuSite | null | undefined>(initial ?? undefined);

  // Pas trouvé côté serveur : on retente dans le navigateur (aperçu d'un site pas encore publié, pour son DP)
  useEffect(() => {
    if (initial) return;
    let actif = true;
    void sitePublic(slug)
      .then((c) => actif && setContenu(c))
      .catch(() => actif && setContenu(null));
    return () => {
      actif = false;
    };
  }, [slug, initial]);

  // Titre de l'onglet quand le site a été chargé dans le navigateur
  useEffect(() => {
    if (contenu) document.title = `${contenu.centre.nom}, club de plongée${contenu.centre.ville ? ` à ${contenu.centre.ville}` : ""}`;
  }, [contenu]);

  if (contenu === undefined) return <div className="min-h-screen bg-[#F3F6F9]" />;
  if (!contenu)
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-[10px] bg-[#F3F6F9] px-[24px] text-center text-[#0E2238]">
        <Anchor className="h-[34px] w-[34px] text-[#14B8C4]" aria-hidden="true" />
        <h1 className="text-[24px] font-semibold">Ce site n'est pas en ligne</h1>
        <p className="max-w-[40ch] text-[15px] text-[#5B7189]">L'adresse est peut-être mal tapée, ou le club n'a pas encore publié son site.</p>
      </div>
    );

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(donneesStructurees(contenu)).replace(/</g, "\\u003c") }} />
      <SiteClub contenu={contenu} apercu />
    </>
  );
}
