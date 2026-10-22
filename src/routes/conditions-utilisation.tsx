import { createFileRoute, Link } from "@tanstack/react-router";
import { Bloc, Contact, PageLegale, Puces } from "@/components/legal/PageLegale";
import { EDITEUR, PAGES_OFFERTES } from "@/lib/legal";
import { OFFRES } from "@/lib/forfait";

export const Route = createFileRoute("/conditions-utilisation")({
  head: () => ({ meta: [{ title: "Palanote — Conditions d'utilisation" }] }),
  component: ConditionsUtilisation,
});

function ConditionsUtilisation() {
  return (
    <PageLegale titre="Conditions d'utilisation" intro="Les règles du jeu, en clair. En créant ton compte, tu les acceptes.">
      <Bloc titre="1. Le service">
        <p>
          Palanote est un carnet de plongée en ligne, édité par {EDITEUR.nom} ({EDITEUR.enseigne}). Il te permet de noter tes plongées,
          de numériser tes anciens carnets, de retrouver tes binômes et de garder tes photos. Le carnet est gratuit ; seule la lecture des carnets papier par l'IA a des forfaits au-delà des pages offertes (article 7).
        </p>
      </Bloc>

      <Bloc titre="2. Ton compte">
        <Puces
          items={[
            <>Un compte par personne, avec des informations exactes.</>,
            <>Tu gardes ton mot de passe pour toi. Ce qui se fait avec ton compte est sous ta responsabilité.</>,
            <>Si tu as moins de 15 ans, crée ton compte avec un parent.</>,
            <>Tu peux supprimer ton compte quand tu veux, depuis Moi › Confidentialité.</>,
          ]}
        />
      </Bloc>

      <Bloc titre="3. Palanote ne remplace pas ta formation">
        <p>
          <b>Palanote est un carnet, pas un outil de planification ni un ordinateur de plongée.</b> Les profondeurs, durées et paliers
          que tu y vois sont ceux que tu as notés, ou que l'IA a lus dans tes carnets. Ils ne doivent jamais servir à préparer ou
          conduire une plongée. Suis ta formation, ton ordinateur, tes tables et les consignes de ton directeur de plongée.
        </p>
      </Bloc>

      <Bloc titre="4. L'IA peut se tromper">
        <p>
          La lecture des carnets papier et la reconnaissance des espèces sont faites par une IA. Elle propose, tu valides : relis
          toujours ce qu'elle a lu avant de l'enregistrer. Palanote ne garantit pas l'exactitude de ses propositions.
        </p>
      </Bloc>

      <Bloc titre="5. Ce que tu publies">
        <Puces
          items={[
            <>Tes plongées, notes et photos restent à toi.</>,
            <>
              Tu nous autorises seulement à les stocker et à les montrer aux personnes que tu choisis (tes binômes, ta palanquée), le
              temps que ton compte existe.
            </>,
            <>Tu publies uniquement des photos que tu as le droit de partager, et tu respectes l'image des personnes qui y figurent.</>,
            <>Pas de contenu illégal, insultant ou trompeur, et pas d'usage pour harceler ou démarcher les autres plongeurs.</>,
          ]}
        />
        <p>En cas d'abus, on peut retirer un contenu ou suspendre un compte, après t'avoir prévenu sauf urgence.</p>
      </Bloc>

      <Bloc titre="6. Le service peut évoluer">
        <p>
          On fait de notre mieux pour que Palanote marche bien et que tes données soient en sécurité.
          Mais l'app est fournie telle quelle : elle peut connaître des interruptions ou changer. Garde un export de ton carnet (Moi ›
          Exporter mes plongées) si tu y tiens.
        </p>
        <p>
          Si les conditions changent, on te le dit dans l'app et on te demande de les accepter à nouveau. Si Palanote devait
          s'arrêter, on te préviendrait au moins 2 mois avant, pour que tu puisses récupérer ton carnet.
        </p>
      </Bloc>

      <Bloc titre="7. Version gratuite et forfaits">
        <Puces
          items={[
            <>
              <b>Gratuit pour tous</b> : le carnet sans limite de plongées, les binômes, la carte, les photos, l'identification des espèces et l'export. Plus 
              {PAGES_OFFERTES} pages de carnet papier lues par l'IA.
            </>,
            <>
              <b>Au-delà</b>, la lecture des carnets papier demande un forfait : le pack « Numériser mes carnets » ({OFFRES.pack.pages} pages de plus, sans
              abonnement, sans date limite) ou Palanote+ (pages sans limite pendant un an).
            </>,
            <>Tes plongées déjà enregistrées restent toujours à toi, accessibles et exportables, forfait ou pas.</>,
          ]}
        />
        <p>Le paiement en ligne n'est pas encore ouvert. Ses conditions (prix, paiement, rétractation) seront précisées avant son ouverture.</p>
      </Bloc>

      <Bloc titre="8. Le Récif">
        <p>
          Le Récif permet de soutenir Palanote par une contribution libre. Elle est facultative et ne donne accès à aucune fonction : elle
          ne change rien à ton forfait.
        </p>
      </Bloc>

      <Bloc titre="9. Droit applicable">
        <p>
          Ces conditions sont soumises au droit français. En cas de désaccord, écris-nous d'abord : <Contact />. On cherchera une
          solution à l'amiable avant toute autre démarche.
        </p>
      </Bloc>

      <p className="px-[4px] text-[12.5px] leading-relaxed text-[#566B82]">
        Pour savoir ce qu'on fait de tes données, lis la{" "}
        <Link to="/politique-de-confidentialite" className="font-semibold text-[#106F9F]">
          politique de confidentialité
        </Link>
        .
      </p>
    </PageLegale>
  );
}
