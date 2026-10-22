import { useEffect, useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { Search, Star, X } from "lucide-react";
import { useConnexionRequise } from "@/components/numerisation/Ui";
import { NavigationDpMobile } from "@/components/club/NavigationDp";
import { Avatar, MessageErreur, PageClub } from "@/components/club/Ui";
import { messagePlanning, useCentre } from "@/components/club/useCentre";
import { ajouterJours, aujourdhui, depuisIso, idsPrivilegies, membresCentre, privilegierPlongeur, type MembreClub } from "@/lib/planning";
import { OngletAdherents } from "@/components/club/OngletAdherents";

// Membres du club, en deux onglets :
//   · Adhérents : la liste du club (importée d'Excel), niveaux, certificats, historique des plongées,
//     et qui est déjà sur Palanote ;
//   · Venus en sortie : les plongeurs venus avec le centre, leurs fiches, tampons, prochaine sortie.
export const Route = createFileRoute("/_dp/club_/membres")({
  // Depuis la recherche : onglet et texte préremplis
  validateSearch: (search: Record<string, unknown>): { onglet?: "adherents" | "sorties"; q?: string } => ({
    ...(search["onglet"] === "adherents" || search["onglet"] === "sorties" ? { onglet: search["onglet"] } : {}),
    ...(typeof search["q"] === "string" ? { q: search["q"] } : {}),
  }),
  head: () => ({ meta: [{ title: "Palanote — Membres du club" }] }),
  component: PageMembres,
});

type Tri = "recents" | "fideles" | "nom";

const dateCourte = (d: string | null) => (d ? depuisIso(d).toLocaleDateString("fr-FR", { day: "numeric", month: "short", year: "2-digit" }) : "—");
const sansAccents = (t: string) => t.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

function PageMembres() {
  const navigate = useNavigate();
  const { pret, ecran } = useConnexionRequise();
  const { centre, erreur: erreurCentre } = useCentre(pret);
  const [membres, setMembres] = useState<MembreClub[] | null>(null);
  const recherche = Route.useSearch();
  const [q, setQ] = useState(recherche.onglet === "sorties" ? (recherche.q ?? "") : "");
  const [tri, setTri] = useState<Tri>("recents");
  const [erreur, setErreur] = useState<string | null>(null);
  const [onglet, setOnglet] = useState<"adherents" | "sorties">(recherche.onglet ?? "adherents");
  // Nouvelle recherche alors qu'on est déjà sur la page : on suit
  useEffect(() => {
    if (!recherche.onglet) return;
    setOnglet(recherche.onglet);
    if (recherche.onglet === "sorties") setQ(recherche.q ?? "");
  }, [recherche.onglet, recherche.q]);
  const [vip, setVip] = useState<Set<string>>(new Set()); // comptes Palanote des membres privilégiés

  useEffect(() => {
    if (!centre || onglet !== "sorties") return;
    void idsPrivilegies(centre.id)
      .then((l) => setVip(new Set(l.map((x) => x.user_id).filter((x): x is string => Boolean(x)))))
      .catch(() => undefined);
  }, [centre, onglet]);

  useEffect(() => {
    if (!centre) return;
    membresCentre(centre.id)
      .then(setMembres)
      .catch((e) => {
        console.error(e);
        setMembres([]);
        setErreur(messagePlanning(e, "Les membres n'ont pas pu être chargés.").replace("palanote-planning-club.sql", "palanote-espace-club.sql"));
      });
  }, [centre]);

  if (ecran) return ecran;

  const il30 = ajouterJours(aujourdhui(), -30);
  const habitue = (m: MembreClub) => m.sorties >= 3;
  const nouveau = (m: MembreClub) => Boolean(m.premiere && m.premiere >= il30);
  const liste = (membres ?? [])
    .filter((m) => !q.trim() || sansAccents(`${m.prenom} ${m.niveau ?? ""} ${m.club ?? ""}`).includes(sansAccents(q.trim())))
    .sort((a, b) =>
      tri === "nom" ? a.prenom.localeCompare(b.prenom) : tri === "fideles" ? b.sorties - a.sorties : (b.derniere ?? "").localeCompare(a.derniere ?? ""),
    );
  const tous = membres ?? [];
  const enRetard = tous.reduce((t, m) => t + Math.max(0, m.sorties - m.fiches), 0);

  return (
    <PageClub titre="Membres du club" large navigation={<NavigationDpMobile />}>
      <MessageErreur texte={erreurCentre ?? erreur} />
      <div className="flex w-fit rounded-[12px] bg-[#E3EDF6] p-[3px]" role="tablist" aria-label="Membres">
        {(
          [
            ["adherents", "Adhérents du club"],
            ["sorties", "Venus en sortie"],
          ] as const
        ).map(([id, l]) => (
          <button
            key={id}
            type="button"
            role="tab"
            aria-selected={onglet === id}
            onClick={() => setOnglet(id)}
            className={`h-[36px] rounded-[10px] px-[14px] text-[13px] font-bold ${onglet === id ? "bg-white text-[#123A63] shadow-[0_2px_6px_#123A6314]" : "text-[#566B82]"}`}
          >
            {l}
          </button>
        ))}
      </div>
      {onglet === "adherents" && centre && <OngletAdherents key={recherche.q ?? ""} centre={centre} qInitial={recherche.onglet === "adherents" ? recherche.q : undefined} />}
      {onglet === "sorties" && membres && (
        <>
          <div className="grid grid-cols-2 gap-[10px] pt-[6px] lg:grid-cols-4">
            {[
              { v: tous.length, l: "membres", d: "venus en sortie" },
              { v: tous.filter(habitue).length, l: "habitués", d: "3 sorties ou plus" },
              { v: tous.filter(nouveau).length, l: "nouveaux", d: "30 derniers jours" },
              { v: tous.filter((m) => m.prochaine).length, l: "inscrits", d: "à une sortie à venir" },
            ].map((t) => (
              <div key={t.l} className="rounded-[10px] border border-[#E4EBF1] bg-white px-[14px] py-[12px]">
                <span className="block text-[26px] font-bold leading-none">{t.v}</span>
                <span className="block pt-[4px] text-[13px] font-semibold">{t.l}</span>
                <span className="block text-[11.5px] text-[#566B82]">{t.d}</span>
              </div>
            ))}
          </div>

          <div className="flex flex-wrap items-center gap-[10px] pt-[18px]">
            <label className="flex h-[42px] min-w-[240px] flex-1 items-center gap-[8px] rounded-[10px] border border-[#E4EBF1] bg-white px-[12px] focus-within:border-[#57D4F5] lg:max-w-[360px]">
              <Search className="h-[16px] w-[16px] text-[#566B82]" />
              <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Prénom, niveau, club…" aria-label="Chercher un membre" className="min-w-0 flex-1 bg-transparent text-[14px] outline-none" />
              {q && (
                <button type="button" aria-label="Effacer" onClick={() => setQ("")}>
                  <X className="h-[14px] w-[14px] text-[#566B82]" />
                </button>
              )}
            </label>
            <div className="flex rounded-[10px] bg-[#E3EDF6] p-[3px]">
              {(
                [
                  ["recents", "Venus récemment"],
                  ["fideles", "Les plus fidèles"],
                  ["nom", "A → Z"],
                ] as const
              ).map(([id, l]) => (
                <button
                  key={id}
                  type="button"
                  onClick={() => setTri(id)}
                  className={`h-[36px] rounded-[8px] px-[12px] text-[12.5px] font-bold ${tri === id ? "bg-white text-[#123A63] shadow-[0_2px_6px_#123A6314]" : "text-[#566B82]"}`}
                >
                  {l}
                </button>
              ))}
            </div>
            {enRetard > 0 && <span className="text-[12.5px] text-[#8A5A10]">{enRetard} fiche{enRetard > 1 ? "s" : ""} pas encore remplie{enRetard > 1 ? "s" : ""}</span>}
          </div>

          {tous.length === 0 ? (
            <p className="mt-[12px] rounded-[10px] border border-dashed border-[#D5E1EC] bg-white/60 px-[15px] py-[16px] text-[13.5px] text-[#566B82]">
              Les plongeurs apparaissent ici après leur première sortie avec le centre.
            </p>
          ) : (
            <div className="mt-[12px] overflow-x-auto rounded-[10px] border border-[#E4EBF1] bg-white">
              <table className="w-full min-w-[760px] border-collapse text-[13px]">
                <thead>
                  <tr className="text-left text-[11px] uppercase tracking-[.06em] text-[#566B82]">
                    <th className="w-[40px] pl-[10px]" aria-label="Privilégié" />
                    <th className="px-[10px] py-[10px] font-bold">Membre</th>
                    <th className="px-[8px] font-bold">Sorties</th>
                    <th className="px-[8px] font-bold">1re sortie</th>
                    <th className="px-[8px] font-bold">Dernière</th>
                    <th className="px-[8px] font-bold">Fiches</th>
                    <th className="px-[8px] font-bold">Tampons</th>
                    <th className="px-[8px] font-bold">Prochaine sortie</th>
                  </tr>
                </thead>
                <tbody>
                  {liste.map((m) => (
                    <tr key={m.id} className="border-t border-[#EEF3F8]">
                      <td className="pl-[10px]">
                        <button
                          type="button"
                          aria-pressed={vip.has(m.id)}
                          aria-label={vip.has(m.id) ? `Retirer l'étoile de ${m.prenom}` : `${m.prenom} devient membre privilégié`}
                          title={vip.has(m.id) ? "Membre privilégié" : "Mettre l'étoile"}
                          onClick={() => {
                            if (!centre) return;
                            const oui = !vip.has(m.id);
                            const n = new Set(vip);
                            if (oui) n.add(m.id);
                            else n.delete(m.id);
                            setVip(n);
                            void privilegierPlongeur(centre.id, m.id, oui).catch((e) =>
                              setErreur(messagePlanning(e, "L'étoile n'a pas pu être enregistrée.").replace("palanote-planning-club.sql", "palanote-privilegies.sql")),
                            );
                          }}
                          className="flex h-[30px] w-[30px] items-center justify-center rounded-[10px] hover:bg-[#FFF8E8]"
                        >
                          <Star className="h-[17px] w-[17px]" fill={vip.has(m.id) ? "#E9A93A" : "none"} stroke={vip.has(m.id) ? "#E9A93A" : "#C9D5E0"} />
                        </button>
                      </td>
                      <td className="px-[10px] py-[9px]">
                        <span className="flex items-center gap-[10px]">
                          <Avatar id={m.id} prenom={m.prenom} taille={32} />
                          <span className="min-w-0">
                            <span className="flex items-center gap-[6px] font-bold">
                              {m.prenom}
                              {habitue(m) && <span className="rounded-[6px] bg-[#0F3D70] px-[5px] py-[1px] text-[10px] font-bold text-white">Habitué</span>}
                              {nouveau(m) && <span className="rounded-[6px] bg-[#FFF1D6] px-[5px] py-[1px] text-[10px] font-bold text-[#8A5A10]">Nouveau</span>}
                            </span>
                            <span className="block text-[11.5px] text-[#566B82]">{[m.niveau, m.club].filter(Boolean).join(" · ") || "—"}</span>
                          </span>
                        </span>
                      </td>
                      <td className="px-[8px] font-bold">{m.sorties}</td>
                      <td className="px-[8px] text-[#566B82]">{dateCourte(m.premiere)}</td>
                      <td className="px-[8px] text-[#566B82]">{dateCourte(m.derniere)}</td>
                      <td className="px-[8px]">
                        <span className={m.fiches < m.sorties ? "font-bold text-[#8A5A10]" : "text-[#137758]"}>
                          {m.fiches}/{m.sorties}
                        </span>
                      </td>
                      <td className="px-[8px]">{m.tampons}</td>
                      <td className="px-[8px]">
                        {m.prochaine ? (
                          <span className="rounded-[6px] bg-[#E3F2FB] px-[6px] py-[2px] text-[12px] font-bold text-[#106F9F]">{dateCourte(m.prochaine)}</span>
                        ) : (
                          <span className="text-[#C9D5E0]">—</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {liste.length === 0 && <p className="px-[14px] py-[14px] text-[13px] text-[#566B82]">Aucun membre ne correspond.</p>}
            </div>
          )}
        </>
      )}
    </PageClub>
  );
}
