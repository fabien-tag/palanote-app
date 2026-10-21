import type { FauxSupabase } from "./supabase";

// Des plongées de démonstration pour le carnet d'un utilisateur
export function plongees(faux: FauxSupabase, n = 3) {
  const sites = [
    ["Sec de la Fourmigue", "Golfe-Juan", 32, 44],
    ["Épave du Togo", "Cavalaire", 38, 40],
    ["La Gabinière", "Port-Cros", 25, 52],
    ["Les Impériaux", "Marseille", 18, 50],
  ] as const;
  const lignes = Array.from({ length: n }, (_, i) => {
    const [site, lieu, prof, duree] = sites[i % sites.length]!;
    return {
      id: `d000000${i}-0000-0000-0000-000000000000`,
      user_id: faux.moi.id,
      dive_date: `2026-0${9 - i}-1${i}`,
      start_time: "10:00",
      site_name: site,
      site_location: lieu,
      max_depth_m: prof,
      duration_min: duree,
      temp_bottom_c: 18,
      gas_mix: "Air",
      rating: 4,
      visibility: "moi",
      analyse_statut: null,
      deleted_at: null,
      created_at: new Date().toISOString(),
    };
  });
  faux.table("dives").push(...lignes);
  return lignes;
}

// Les fonctions serveur appelées partout (à l'ouverture de l'app)
export function rpcCommunes(faux: FauxSupabase) {
  faux.rpc["signaler_presence"] = () => null;
  faux.rpc["mes_binomes"] = () => [];
  faux.rpc["mes_forfaits"] = () => ({ pages_offertes: 50, pages_utilisees: 3, pages_restantes: 47 });
  faux.rpc["mon_quota_ia"] = () => ({ pages_offertes: 50, pages_utilisees: 3, pages_restantes: 47 });
  faux.rpc["est_admin"] = () => false;
  for (const vide of ["plongees_a_confirmer", "mes_centres", "generer_rappels_plongeur", "generer_rappels_formations", "mes_sorties", "mon_historique_club"])
    faux.rpc[vide] = () => [];
  faux.rpc["consommer_page_ia"] = () => true;
}

// Le faux agent de lecture : chaque page lue donne une plongée, avec deux champs « à vérifier »
export function agentDeLecture(faux: FauxSupabase) {
  faux.fonctions["lire-page"] = (corps) => {
    const page = faux.table("ocr_pages").find((p) => p["id"] === corps["page_id"])!;
    page["statut"] = "lue";
    page["journal_agent"] = [{ etape: 1, outil: "zoomer", raison: "température : 1g ou 19 ?", resultat: "zone agrandie" }];
    page["etapes_agent"] = 2;
    faux.table("ocr_extractions").push({
      id: `e-${String(page["id"])}`,
      page_id: page["id"],
      ordre: 0,
      statut: "a_relire",
      dive_id: null,
      created_at: new Date().toISOString(),
      champs: { date: "1987-08-12", heure: "10:30", site: "Sec de la Fourmigue", lieu: "Golfe-Juan", profondeur_max: "38.5", duree: "42", temperature: "19", pression_debut: null, pression_fin: null, melange: "Air", binomes: "Paul, Léa", club: null, signee: "oui", tamponnee: "oui", commentaire: null },
      confiances: { date: "sur", heure: "sur", site: "sur", lieu: "sur", profondeur_max: "a_verifier", duree: "sur", temperature: "a_verifier", pression_debut: "non_lu", pression_fin: "non_lu", melange: "sur", binomes: "sur", club: "non_lu", signee: "sur", tamponnee: "sur", commentaire: "non_lu" },
      lectures: { profondeur_max: "38,5", temperature: "1g" },
    });
    const lot = faux.table("ocr_batches").find((b) => b["id"] === page["batch_id"]);
    if (lot && faux.table("ocr_pages").every((p) => p["batch_id"] !== lot["id"] || p["statut"] === "lue")) lot["statut"] = "a_relire";
    return { ok: true, statut: "en_cours" };
  };
}
