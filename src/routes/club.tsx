import { useEffect, useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { Anchor, ChevronRight, Plus, QrCode, Stamp, Users } from "lucide-react";
import { useConnexionRequise } from "@/components/numerisation/Ui";
import { detailErreur, LigneSortie, MessageErreur, PageClub, Titre } from "@/components/club/Ui";
import { centreChoisi, choisirCentre, mesCentres, sortiesDp, type Centre, type SortieResume } from "@/lib/club";

// Espace club du directeur de plongée (parcours 15, écran 1)
export const Route = createFileRoute("/club")({
  head: () => ({ meta: [{ title: "Palanote — Espace club" }] }),
  component: EspaceClub,
});

function EspaceClub() {
  const navigate = useNavigate();
  const { pret, ecran } = useConnexionRequise();
  const [centres, setCentres] = useState<Centre[] | null>(null);
  const [sorties, setSorties] = useState<SortieResume[]>([]);
  const [erreur, setErreur] = useState<string | null>(null);

  useEffect(() => {
    if (!pret) return;
    void (async () => {
      try {
        const [c, s] = await Promise.all([mesCentres(), sortiesDp()]);
        setCentres(c);
        setSorties(s);
      } catch (e) {
        console.error(e);
        setCentres([]);
        setErreur(detailErreur(e, "L'espace club n'a pas pu être chargé."));
      }
    })();
  }, [pret]);

  if (ecran) return ecran;

  const idCentre = centres?.find((c) => c.id === centreChoisi())?.id ?? centres?.[0]?.id;
  const centre = centres?.find((c) => c.id === idCentre) ?? null;
  const duCentre = sorties.filter((s) => !centre || s.centre_id === centre.id);
  const aTamponner = duCentre.filter((s) => s.statut === "terminee");
  const aVenir = duCentre.filter((s) => s.statut === "prevue").sort((a, b) => a.date.localeCompare(b.date));
  const passees = duCentre.filter((s) => s.statut === "validee" || s.statut === "annulee");
  const ouvrir = (s: SortieResume) => navigate({ to: "/club/sortie", search: { id: s.id } });

  return (
    <PageClub
      titre="Espace club"
      onRetour={() => navigate({ to: "/moi" })}
      bas={
        centre ? (
          <button
            type="button"
            onClick={() => navigate({ to: "/club/nouvelle-sortie", search: { centre: centre.id } })}
            className="flex h-14 w-full items-center justify-center gap-2 galet-moyen bg-[#3DEFBE] text-[14px] font-bold text-[#0B3B63] shadow-[0_4px_12px_#123A630D]"
          >
            <Plus className="h-[18px] w-[18px]" strokeWidth={2.6} aria-hidden="true" />
            NOUVELLE SORTIE
          </button>
        ) : null
      }
    >
      <MessageErreur texte={erreur} />

      {centres && centres.length === 0 && !erreur && (
        <>
          <div className="pt-[18px]">
            <h2 className="text-[24px] font-bold leading-tight">Tes sorties de club, sans papier</h2>
            <p className="pt-[8px] text-[14px] leading-normal text-[#5B7189]">
              Tu es directeur de plongée ? Prépare la sortie, ajoute tes plongeurs en un scan, et valide leurs carnets d'un geste.
            </p>
          </div>
          <div className="flex flex-col gap-[14px] pt-[22px]">
            {[
              { Icone: QrCode, t: "Ajoute les plongeurs à la volée", x: "Ils scannent le QR sur le bateau, ou tu les cherches par leur nom." },
              { Icone: Users, t: "Ils reçoivent la sortie dans l'app", x: "Date, heure, site, bateau, consignes. Et leur palanquée." },
              { Icone: Stamp, t: "Tu poses le tampon numérique", x: "Leurs fiches arrivent préremplies ; tu valides toute la sortie d'un geste." },
            ].map(({ Icone, t, x }) => (
              <div key={t} className="flex items-start gap-[13px]">
                <span className="flex h-[42px] w-[42px] shrink-0 items-center justify-center goutte bg-[#E3F2FB]">
                  <Icone className="h-[20px] w-[20px] text-[#1176A8]" strokeWidth={2.1} aria-hidden="true" />
                </span>
                <span>
                  <span className="block text-[14.5px] font-bold leading-snug">{t}</span>
                  <span className="block pt-[2px] text-[13px] leading-normal text-[#5B7189]">{x}</span>
                </span>
              </div>
            ))}
          </div>
          <div className="flex-grow" />
          <button
            type="button"
            onClick={() => navigate({ to: "/club/centre" })}
            className="mt-[28px] flex h-14 w-full items-center justify-center galet-moyen bg-[#3DEFBE] text-[14px] font-bold text-[#0B3B63]"
          >
            CHOISIR MON CENTRE
          </button>
        </>
      )}

      {centre && (
        <>
          <button
            type="button"
            onClick={() => navigate({ to: "/club/centre" })}
            className="mt-[10px] flex w-full items-center gap-[13px] galet-c border border-[#CFE6F3] bg-[#E3F2FB] px-[15px] py-[14px] text-left"
          >
            <span className="flex h-[44px] w-[44px] shrink-0 items-center justify-center goutte bg-[#0F3D70]">
              <Anchor className="h-[21px] w-[21px] text-white" strokeWidth={2.1} aria-hidden="true" />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-[16px] font-bold">{centre.nom}</span>
              <span className="block truncate text-[12.5px] text-[#3F5B76]">
                {[centre.ville, centre.verifie ? "Centre vérifié" : null, `${centre.nb_dp ?? 1} DP`].filter(Boolean).join(" · ")}
              </span>
            </span>
            <span className="shrink-0 text-[13px] font-bold text-[#1176A8]">{(centres?.length ?? 0) > 1 ? "Changer" : "Gérer"}</span>
          </button>

          {aTamponner.length > 0 && (
            <>
              <Titre aide="les fiches arrivent">À tamponner</Titre>
              <div className="flex flex-col gap-[10px]">
                {aTamponner.map((s) => (
                  <LigneSortie key={s.id} s={s} onClick={() => ouvrir(s)} />
                ))}
              </div>
            </>
          )}

          <Titre>À venir</Titre>
          {aVenir.length === 0 ? (
            <p className="galet-b border border-dashed border-[#D5E1EC] bg-white/60 px-[15px] py-[16px] text-[13.5px] leading-normal text-[#5B7189]">
              Aucune sortie prévue. Crée la prochaine : tes plongeurs la recevront dans leur app.
            </p>
          ) : (
            <div className="flex flex-col gap-[10px]">
              {aVenir.map((s) => (
                <LigneSortie key={s.id} s={s} onClick={() => ouvrir(s)} />
              ))}
            </div>
          )}

          {passees.length > 0 && (
            <>
              <Titre>Passées</Titre>
              <div className="flex flex-col gap-[10px]">
                {passees.slice(0, 12).map((s) => (
                  <LigneSortie key={s.id} s={s} onClick={() => ouvrir(s)} />
                ))}
              </div>
            </>
          )}
        </>
      )}

      {centres && centres.length > 1 && (
        <div className="flex flex-wrap gap-[8px] pt-[18px]">
          {centres.map((c) => (
            <button
              key={c.id}
              type="button"
              onClick={() => {
                choisirCentre(c.id);
                setCentres([...centres]);
              }}
              className={`flex h-[34px] items-center gap-1 rounded-[17px] px-[13px] text-[13px] font-bold ${c.id === centre?.id ? "bg-[#0F3D70] text-white" : "border border-[#D8E5EE] bg-white text-[#5B7189]"}`}
            >
              {c.nom}
              {c.id !== centre?.id && <ChevronRight className="h-[13px] w-[13px]" aria-hidden="true" />}
            </button>
          ))}
        </div>
      )}
    </PageClub>
  );
}
