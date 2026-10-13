import { useCallback, useEffect, useState } from "react";
import { AlertTriangle, FileSpreadsheet, Mail, Search, Star, Trash2, UserCheck, X } from "lucide-react";
import { Avatar, MessageErreur } from "@/components/club/Ui";
import { ImportTableur } from "@/components/club/ImportTableur";
import { IMPORT_ADHERENTS, IMPORT_HISTORIQUE } from "@/components/club/importsClub";
import { messagePlanning } from "@/components/club/useCentre";
import type { Centre } from "@/lib/club";
import { adherentsCentre, basculerPrivilegie, certificatProche, depuisIso, idsPrivilegies, supprimerAdherent, type Adherent } from "@/lib/planning";

// Les adhérents du club, importés d'Excel avant même qu'ils aient l'app :
// niveaux, licences, certificats médicaux, historique des plongées avec le club,
// et qui les a déjà rejoints sur Palanote (même e-mail).

const dateCourte = (d: string | null) => (d ? depuisIso(d).toLocaleDateString("fr-FR", { day: "numeric", month: "short", year: "2-digit" }) : "—");
const sansAccents = (t: string) => t.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

export function OngletAdherents({ centre, qInitial }: { centre: Centre; qInitial?: string | undefined }) {
  const [adherents, setAdherents] = useState<Adherent[] | null>(null);
  const [q, setQ] = useState(qInitial ?? "");
  const [filtre, setFiltre] = useState<"tous" | "privilegies" | "certificat" | "pas_inscrits">("tous");
  const [importer, setImporter] = useState<null | "adherents" | "historique">(null);
  const [aSupprimer, setASupprimer] = useState<Adherent | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);
  const [vip, setVip] = useState<Set<string>>(new Set());

  const charger = useCallback(async () => {
    try {
      setAdherents(await adherentsCentre(centre.id));
      void idsPrivilegies(centre.id)
        .then((l) => setVip(new Set(l.map((x) => x.id))))
        .catch(() => undefined); // script des privilégiés pas encore lancé
      setErreur(null);
    } catch (e) {
      console.error(e);
      setAdherents([]);
      setErreur(messagePlanning(e, "Les adhérents n'ont pas pu être chargés.").replace("palanote-planning-club.sql", "palanote-import-excel.sql"));
    }
  }, [centre.id]);

  useEffect(() => {
    void charger();
  }, [charger]);

  const tous = adherents ?? [];
  const certificats = tous.filter((a) => certificatProche(a.certificat_fin));
  const liste = tous
    .filter((a) => filtre === "tous" || (filtre === "privilegies" ? vip.has(a.id) : filtre === "certificat" ? certificatProche(a.certificat_fin) : !a.sur_palanote))
    .filter((a) => !q.trim() || sansAccents(`${a.prenom} ${a.nom ?? ""} ${a.niveau ?? ""} ${a.email ?? ""} ${a.licence ?? ""}`).includes(sansAccents(q.trim())));
  const historique = tous.reduce((t, a) => t + a.plongees, 0);

  const invitation = (a: Adherent) => {
    const lien = `${window.location.origin}/creer-un-compte`;
    const corps = `Bonjour ${a.prenom},\n\n${centre.nom} passe à Palanote, le carnet de plongée numérique.${
      a.plongees > 0 ? ` Tes ${a.plongees} plongées avec le club t'y attendent.` : ""
    }\n\nCrée ton compte avec cette adresse e-mail (${a.email}) : ${lien}\n\nÀ bientôt sur le bateau !`;
    return `mailto:${a.email}?subject=${encodeURIComponent(`Ton carnet de plongée ${centre.nom} sur Palanote`)}&body=${encodeURIComponent(corps)}`;
  };

  const conf = importer === "historique" ? IMPORT_HISTORIQUE : IMPORT_ADHERENTS;

  return (
    <>
      <MessageErreur texte={erreur} />
      {adherents && (
        <>
          <div className="grid grid-cols-2 gap-[10px] pt-[14px] lg:grid-cols-4">
            {[
              { v: tous.length, l: "adhérents", d: "dans la liste du club" },
              { v: tous.filter((a) => a.sur_palanote).length, l: "sur Palanote", d: "reliés par leur e-mail" },
              { v: certificats.length, l: "certificats", d: "expirés ou à renouveler", alerte: certificats.length > 0 },
              { v: historique, l: "plongées", d: "dans l'historique importé" },
            ].map((t) => (
              <div key={t.l} className={`rounded-[10px] border bg-white px-[14px] py-[12px] ${t.alerte ? "border-[#F5B544]" : "border-[#E4EBF1]"}`}>
                <span className="block text-[26px] font-bold leading-none">{t.v}</span>
                <span className="block pt-[4px] text-[13px] font-semibold">{t.l}</span>
                <span className="block text-[11.5px] text-[#7D93A8]">{t.d}</span>
              </div>
            ))}
          </div>

          <div className="flex flex-wrap items-center gap-[10px] pt-[16px]">
            <button
              type="button"
              onClick={() => setImporter("adherents")}
              className="flex h-[42px] items-center gap-[8px] rounded-[10px] bg-[#0F3D70] px-[14px] text-[13px] font-bold text-white"
            >
              <FileSpreadsheet className="h-[16px] w-[16px]" /> Importer les adhérents
            </button>
            <button
              type="button"
              onClick={() => setImporter("historique")}
              className="flex h-[42px] items-center gap-[8px] rounded-[10px] border border-[#D8E5EE] bg-white px-[14px] text-[13px] font-bold text-[#14805F]"
            >
              <FileSpreadsheet className="h-[16px] w-[16px]" /> Importer l'historique des plongées
            </button>
          </div>

          {tous.length === 0 ? (
            <div className="mt-[14px] rounded-[10px] border border-dashed border-[#C9DCEA] bg-white/60 px-[18px] py-[18px] text-[13.5px] leading-normal text-[#5B7189]">
              <p className="font-bold text-[#123A63]">Ton club a déjà ses fichiers Excel ? Commence par là.</p>
              <p className="pt-[4px]">
                Importe la liste des adhérents (niveaux, licences, certificats médicaux), puis l'historique de leurs plongées. Quand un adhérent crée son compte
                Palanote avec la même adresse e-mail, il retrouve ses plongées du club et peut les ajouter à son carnet.
              </p>
            </div>
          ) : (
            <>
              <div className="flex flex-wrap items-center gap-[10px] pt-[14px]">
                <label className="flex h-[40px] min-w-[220px] flex-1 items-center gap-[8px] rounded-[10px] border border-[#E4EBF1] bg-white px-[12px] focus-within:border-[#57D4F5] lg:max-w-[340px]">
                  <Search className="h-[16px] w-[16px] text-[#9DB0C0]" />
                  <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Nom, niveau, licence, e-mail…" aria-label="Chercher un adhérent" className="min-w-0 flex-1 bg-transparent text-[14px] outline-none" />
                  {q && (
                    <button type="button" aria-label="Effacer" onClick={() => setQ("")}>
                      <X className="h-[14px] w-[14px] text-[#9DB0C0]" />
                    </button>
                  )}
                </label>
                <div className="flex rounded-[10px] bg-[#E3EDF6] p-[3px]">
                  {(
                    [
                      ["tous", "Tous"],
                      ["privilegies", "★ Privilégiés"],
                      ["certificat", "Certificat à renouveler"],
                      ["pas_inscrits", "Pas encore sur Palanote"],
                    ] as const
                  ).map(([id, l]) => (
                    <button
                      key={id}
                      type="button"
                      onClick={() => setFiltre(id)}
                      className={`h-[34px] rounded-[8px] px-[12px] text-[12.5px] font-bold ${filtre === id ? "bg-white text-[#123A63] shadow-[0_2px_6px_#123A6314]" : "text-[#5B7189]"}`}
                    >
                      {l}
                    </button>
                  ))}
                </div>
              </div>

              <div className="mt-[12px] overflow-x-auto rounded-[10px] border border-[#E4EBF1] bg-white">
                <table className="w-full min-w-[900px] border-collapse text-[13px]">
                  <thead>
                    <tr className="text-left text-[11px] uppercase tracking-[.06em] text-[#7D93A8]">
                      <th className="w-[40px] pl-[10px]" aria-label="Privilégié" />
                      <th className="px-[10px] py-[10px] font-bold">Adhérent</th>
                      <th className="px-[8px] font-bold">Niveau</th>
                      <th className="px-[8px] font-bold">Licence</th>
                      <th className="px-[8px] font-bold">Certificat médical</th>
                      <th className="px-[8px] font-bold">Plongées club</th>
                      <th className="px-[8px] font-bold">Prof. max</th>
                      <th className="px-[8px] font-bold">Palanote</th>
                      <th className="w-[44px]" />
                    </tr>
                  </thead>
                  <tbody>
                    {liste.map((a) => {
                      const cert = certificatProche(a.certificat_fin);
                      return (
                        <tr key={a.id} className="border-t border-[#EEF3F8]">
                          <td className="pl-[10px]">
                            <button
                              type="button"
                              aria-pressed={vip.has(a.id)}
                              aria-label={vip.has(a.id) ? `Retirer l'étoile de ${a.prenom}` : `${a.prenom} devient membre privilégié`}
                              title={vip.has(a.id) ? "Membre privilégié" : "Mettre l'étoile"}
                              onClick={() => {
                                const oui = !vip.has(a.id);
                                const n = new Set(vip);
                                if (oui) n.add(a.id);
                                else n.delete(a.id);
                                setVip(n);
                                void basculerPrivilegie(a.id, oui).catch((e) => {
                                  setErreur(messagePlanning(e, "L'étoile n'a pas pu être enregistrée.").replace("palanote-planning-club.sql", "palanote-privilegies.sql"));
                                  void charger();
                                });
                              }}
                              className="flex h-[30px] w-[30px] items-center justify-center rounded-[10px] hover:bg-[#FFF8E8]"
                            >
                              <Star className="h-[17px] w-[17px]" fill={vip.has(a.id) ? "#E9A93A" : "none"} stroke={vip.has(a.id) ? "#E9A93A" : "#C9D5E0"} />
                            </button>
                          </td>
                          <td className="px-[10px] py-[9px]">
                            <span className="flex items-center gap-[10px]">
                              <Avatar id={a.id} prenom={a.prenom} taille={32} prevu={!a.sur_palanote} />
                              <span className="min-w-0">
                                <span className="block font-bold">
                                  {a.prenom} {a.nom ? a.nom.toUpperCase() : ""}
                                </span>
                                <span className="block max-w-[220px] truncate text-[11.5px] text-[#7D93A8]">{a.email ?? a.telephone ?? "—"}</span>
                              </span>
                            </span>
                          </td>
                          <td className="px-[8px] font-semibold">{a.niveau ?? <span className="text-[#C9D5E0]">—</span>}</td>
                          <td className="px-[8px] text-[#5B7189]">{a.licence ?? <span className="text-[#C9D5E0]">—</span>}</td>
                          <td className="px-[8px]">
                            {a.certificat_fin ? (
                              <span
                                className={`inline-flex items-center gap-[4px] rounded-[6px] px-[6px] py-[2px] text-[12px] font-bold ${
                                  cert === "depasse" ? "bg-[#FFE9E2] text-[#D9573F]" : cert === "proche" ? "bg-[#FFF1D6] text-[#8A5A10]" : "text-[#5B7189]"
                                }`}
                              >
                                {cert && <AlertTriangle className="h-[12px] w-[12px]" />}
                                {cert === "depasse" ? "Expiré le " : cert === "proche" ? "Expire le " : "Jusqu'au "}
                                {dateCourte(a.certificat_fin)}
                              </span>
                            ) : (
                              <span className="text-[#C9D5E0]">—</span>
                            )}
                          </td>
                          <td className="px-[8px]">
                            {a.plongees > 0 ? (
                              <span>
                                <b>{a.plongees}</b> <span className="text-[11.5px] text-[#7D93A8]">· dernière {dateCourte(a.derniere)}</span>
                              </span>
                            ) : (
                              <span className="text-[#C9D5E0]">—</span>
                            )}
                            {a.sorties > 0 && <span className="block text-[11.5px] text-[#1176A8]">+ {a.sorties} sortie{a.sorties > 1 ? "s" : ""} Palanote</span>}
                          </td>
                          <td className="px-[8px]">{a.prof_max ? `${String(a.prof_max).replace(".0", "").replace(".", ",")} m` : <span className="text-[#C9D5E0]">—</span>}</td>
                          <td className="px-[8px]">
                            {a.sur_palanote ? (
                              <span className="flex items-center gap-[4px] text-[12px] font-bold text-[#14805F]">
                                <UserCheck className="h-[14px] w-[14px]" /> Inscrit
                                {a.recuperees > 0 && <span className="font-semibold text-[#7D93A8]">· {a.recuperees} au carnet</span>}
                              </span>
                            ) : a.email ? (
                              <a href={invitation(a)} className="inline-flex items-center gap-[4px] rounded-[8px] border border-[#57D4F5] px-[8px] py-[3px] text-[12px] font-bold text-[#1176A8]">
                                <Mail className="h-[13px] w-[13px]" /> Inviter
                              </a>
                            ) : (
                              <span className="text-[12px] text-[#9DB0C0]">Sans e-mail</span>
                            )}
                          </td>
                          <td className="pr-[10px] text-right">
                            <button
                              type="button"
                              aria-label={`Retirer ${a.prenom} de la liste`}
                              onClick={() => setASupprimer(a)}
                              className="flex h-[30px] w-[30px] items-center justify-center rounded-[10px] text-[#9DB0C0] hover:bg-[#FFF1EE] hover:text-[#D9573F]"
                            >
                              <Trash2 className="h-[14px] w-[14px]" />
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
                {liste.length === 0 && <p className="px-[14px] py-[14px] text-[13px] text-[#7D93A8]">Aucun adhérent ne correspond.</p>}
              </div>
            </>
          )}
        </>
      )}

      {aSupprimer && (
        <div className="fixed inset-0 z-50 flex items-center justify-center px-[20px]" role="dialog" aria-modal="true">
          <button type="button" aria-label="Fermer" onClick={() => setASupprimer(null)} className="absolute inset-0 bg-[#06203F]/45" />
          <div className="relative w-full max-w-[420px] rounded-[10px] bg-white p-[20px]">
            <p className="text-[16px] font-bold">
              Retirer {aSupprimer.prenom} {aSupprimer.nom ?? ""} de la liste ?
            </p>
            <p className="pt-[6px] text-[13.5px] leading-normal text-[#5B7189]">
              Son historique de plongées avec le club est effacé aussi. Les plongées déjà ajoutées à son carnet Palanote restent dans son carnet.
            </p>
            <div className="flex justify-end gap-[10px] pt-[16px]">
              <button type="button" onClick={() => setASupprimer(null)} className="h-[40px] rounded-[10px] px-[14px] text-[13px] font-bold text-[#5B7189]">
                Annuler
              </button>
              <button
                type="button"
                onClick={() => {
                  const a = aSupprimer;
                  setASupprimer(null);
                  void supprimerAdherent(a.id)
                    .then(charger)
                    .catch((e) => setErreur(messagePlanning(e, "L'adhérent n'a pas pu être retiré.")));
                }}
                className="h-[40px] rounded-[10px] bg-[#FF8A75] px-[16px] text-[13px] font-bold text-white"
              >
                RETIRER
              </button>
            </div>
          </div>
        </div>
      )}

      {importer && (
        <ImportTableur
          titre={conf.titre}
          description={conf.description}
          champs={conf.champs}
          modele={conf.modele}
          transformer={conf.transformer}
          onImporter={(lignes) => conf.importer(centre.id, lignes)}
          onFermer={(fait) => {
            setImporter(null);
            if (fait) void charger();
          }}
        />
      )}
    </>
  );
}
