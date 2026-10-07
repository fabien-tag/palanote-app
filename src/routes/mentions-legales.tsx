import { createFileRoute } from "@tanstack/react-router";
import { Bloc, Contact, PageLegale } from "@/components/legal/PageLegale";
import { EDITEUR, HEBERGEURS } from "@/lib/legal";

export const Route = createFileRoute("/mentions-legales")({
  head: () => ({ meta: [{ title: "Palanote — Mentions légales" }] }),
  component: MentionsLegales,
});

function MentionsLegales() {
  return (
    <PageLegale titre="Mentions légales">
      <Bloc titre="Éditeur">
        <p>
          Palanote est édité par <b>{EDITEUR.nom}</b> ({EDITEUR.enseigne}), {EDITEUR.statut.toLowerCase()}.
        </p>
        <p>
          SIREN : <b>{EDITEUR.siren}</b>
          <br />
          Adresse : {EDITEUR.adresse}
          <br />
          Contact : <Contact />
        </p>
        <p>Directeur de la publication : {EDITEUR.nom}.</p>
      </Bloc>

      <Bloc titre="Hébergement">
        {HEBERGEURS.map((h) => (
          <p key={h.nom}>
            <b>{h.nom}</b>, {h.role}
            <br />
            {h.lieu} · {h.site}
          </p>
        ))}
      </Bloc>

      <Bloc titre="Propriété intellectuelle">
        <p>
          Le nom Palanote, le logo, le design et le code de l'application appartiennent à {EDITEUR.nom}. Ils ne peuvent pas être
          copiés ou réutilisés sans son accord.
        </p>
        <p>Tes plongées, tes notes et tes photos restent à toi.</p>
      </Bloc>

      <Bloc titre="Crédits">
        <p>Cartes : © les contributeurs d'OpenStreetMap, © Esri, GEBCO, NOAA.</p>
      </Bloc>
    </PageLegale>
  );
}
