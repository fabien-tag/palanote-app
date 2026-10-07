import { createFileRoute, Link } from "@tanstack/react-router";
import { Bloc, Contact, PageLegale, Puces } from "@/components/legal/PageLegale";
import { EDITEUR, PRESTATAIRES } from "@/lib/legal";

export const Route = createFileRoute("/politique-de-confidentialite")({
  head: () => ({ meta: [{ title: "Palanote — Politique de confidentialité" }] }),
  component: PolitiqueConfidentialite,
});

function PolitiqueConfidentialite() {
  return (
    <PageLegale
      titre="Tes données"
      intro="Palanote garde ton carnet de plongée. Voici ce qu'on enregistre, pourquoi, qui y a accès et comment tout effacer. Pas de publicité, pas de revente de données."
    >
      <Bloc titre="Qui est responsable">
        <p>
          {EDITEUR.nom} ({EDITEUR.enseigne}), {EDITEUR.adresse}. Contact : <Contact />.
        </p>
      </Bloc>

      <Bloc titre="Ce qu'on enregistre">
        <Puces
          items={[
            <>
              <b>Ton compte</b> : prénom, adresse e-mail, mot de passe (chiffré, illisible même pour nous).
            </>,
            <>
              <b>Ton profil de plongeur</b> : niveau, club, rôle, profondeur maximale, date de ta première plongée.
            </>,
            <>
              <b>Ton carnet</b> : date, site et position, profondeur, durée, paliers, gaz, matériel, binômes, espèces vues, notes.
            </>,
            <>
              <b>Tes photos</b> : celles de tes plongées et des pages de tes carnets papier.
            </>,
            <>
              <b>Tes binômes</b> : les plongeurs que tu ajoutes et les plongées partagées.
            </>,
            <>
              <b>Des données techniques</b> : date de dernière visite, type d'appareil, erreurs de l'app. Jamais le contenu de ton
              carnet.
            </>,
          ]}
        />
      </Bloc>

      <Bloc titre="Pourquoi">
        <Puces
          items={[
            <>
              <b>Faire marcher ton carnet</b> (compte, plongées, photos, binômes) : c'est le service que tu demandes en créant ton
              compte.
            </>,
            <>
              <b>Avec ton accord seulement</b> : lire tes carnets papier et reconnaître les espèces sur tes photos avec l'IA,
              partager tes photos avec ta palanquée, recevoir la lettre annuelle. Tu peux retirer ton accord à tout moment dans{" "}
              <b>Moi › Confidentialité</b>.
            </>,
            <>
              <b>Garder l'app en bon état</b> : corriger les erreurs, comprendre ce qui est utilisé, éviter les abus.
            </>,
          ]}
        />
      </Bloc>

      <Bloc titre="Ta position est floutée">
        <p>
          La position exacte de tes plongées n'est visible que par toi. Les autres plongeurs ne voient jamais qu'une zone, décalée de
          100 à 150 mètres. Pour les espèces protégées, on ne peut jamais remonter jusqu'à tes sites.
        </p>
      </Bloc>

      <Bloc titre="Qui y a accès">
        <p>Personne d'autre que toi, sauf ce que tu choisis de partager avec tes binômes. On ne vend rien.</p>
        <p>Ces prestataires traitent des données pour faire tourner Palanote, et seulement pour ça :</p>
        <Puces
          items={PRESTATAIRES.map((p) => (
            <>
              <b>{p.nom}</b> : {p.role} ({p.lieu})
            </>
          ))}
        />
        <p>
          Pour les prestataires situés hors de l'Union européenne, le transfert est encadré par les clauses contractuelles types de la
          Commission européenne. Les photos envoyées à l'IA servent uniquement à te répondre : elles ne servent pas à entraîner ses
          modèles.
        </p>
      </Bloc>

      <Bloc titre="Combien de temps">
        <Puces
          items={[
            <>Ton compte, ton carnet et tes photos : tant que ton compte existe.</>,
            <>Si tu ne te connectes plus pendant 3 ans, on te prévient par e-mail, puis on efface ton compte.</>,
            <>Les données techniques : 12 mois au plus.</>,
            <>La preuve de ton accord aux conditions : tant que ton compte existe.</>,
          ]}
        />
        <p>Quand tu supprimes ton compte, tout est effacé : carnet, photos, binômes, accords.</p>
      </Bloc>

      <Bloc titre="Tes droits">
        <p>Tu peux à tout moment :</p>
        <Puces
          items={[
            <>voir et corriger tes données, dans l'app ;</>,
            <>
              récupérer ton carnet dans un fichier standard (UDDF), dans <b>Moi › Exporter mes plongées</b> ;
            </>,
            <>
              tout effacer, dans <b>Moi › Confidentialité › Supprimer mon compte et mes données</b> ;
            </>,
            <>retirer un accord, t'opposer à un traitement ou demander qu'on le limite.</>,
          ]}
        />
        <p>
          Pour toute demande : <Contact />. On te répond sous un mois. Si tu n'es pas satisfait, tu peux saisir la CNIL (cnil.fr).
        </p>
      </Bloc>

      <Bloc titre="Cookies">
        <p>
          Palanote n'utilise ni cookies publicitaires ni outils de mesure d'audience tiers. Ton navigateur garde seulement ce qui est
          nécessaire au fonctionnement : ta session de connexion et quelques préférences. C'est pour ça qu'on ne te demande rien à
          l'ouverture.
        </p>
      </Bloc>

      <p className="px-[4px] text-[12.5px] leading-relaxed text-[#5B7189]">
        Voir aussi les{" "}
        <Link to="/conditions-utilisation" className="font-semibold text-[#1176A8]">
          conditions d'utilisation
        </Link>
        .
      </p>
    </PageLegale>
  );
}
