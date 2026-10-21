import { expect, test } from "@playwright/test";
import { fileURLToPath } from "node:url";
import { FauxSupabase, LEA, MARC, ouvrir, preparer } from "../support/supabase";
import { rpcCommunes } from "../support/donnees";

const PHOTO = fileURLToPath(new URL("../support/page-carnet.jpg", import.meta.url));
const STATS = {
  comptes: 42, comptes_7j: 5, connectes: 3, actifs_jour: 9, actifs_7j: 21, actifs_30j: 34, plongees: 512, plongees_7j: 38,
  retours_nouveaux: 0, erreurs_24h: 0, pages_numerisees: 187, pages_30j: 64, binomes: 17, photos: 96,
  par_jour: Array.from({ length: 30 }, (_, i) => ({ jour: new Date(Date.now() - (29 - i) * 864e5).toISOString().slice(0, 10), actifs: 5 + (i % 7), inscriptions: i % 6 === 0 ? 1 : 0 })),
};

test.describe("Tableau de bord admin", () => {
  test("un compte qui n'est pas admin ne voit pas le tableau de bord", async ({ page }) => {
    const faux = new FauxSupabase(LEA);
    rpcCommunes(faux); // est_admin → faux
    faux.rpc["admin_stats"] = () => STATS;
    await preparer(page, faux);
    await ouvrir(page, "/admin");
    await expect(page.getByRole("heading", { name: "Page réservée" })).toBeVisible();
    expect(faux.journal).not.toContain("rpc admin_stats");
  });

  test("le banc d'essai de l'agent : ajouter un cas, lancer l'évaluation, lire le score", async ({ page }) => {
    const faux = new FauxSupabase(MARC);
    rpcCommunes(faux);
    faux.rpc["est_admin"] = () => true;
    faux.rpc["admin_stats"] = () => STATS;
    faux.rpc["admin_utilisateurs"] = () => [];
    const mode = (o: Record<string, number | null>) => ({ pages: 0, lues: 0, illisibles: 0, erreurs: 0, en_cours: 0, avec_verification: 0, verifications: 0, zooms: 0, pages_voisines: 0, etapes_moyennes: null, tokens_entree: 0, tokens_sortie: 0, pages_avec_tokens: 0, champs_proposes: 0, champs_corriges: 0, faux_surs: 0, champs_surs: 0, champs_completes: 0, ...o });
    faux.rpc["admin_suivi_agent"] = (c) => ({
      jours: c["p_jours"],
      modes: {
        agent: mode({ pages: 8, lues: 7, illisibles: 1, avec_verification: 5, verifications: 7, zooms: 5, pages_voisines: 2, etapes_moyennes: 2.4, tokens_entree: 41000, tokens_sortie: 6100, pages_avec_tokens: 8, champs_proposes: 40, champs_corriges: 4, champs_surs: 26 }),
        direct: mode({ pages: 12, lues: 10, illisibles: 2, champs_proposes: 55, champs_corriges: 13, champs_surs: 27 }),
      },
      plongees_validees: 18,
      plongees_rejetees: 1,
      par_jour: Array.from({ length: 14 }, (_, i) => ({ jour: new Date(Date.now() - (13 - i) * 864e5).toISOString().slice(0, 10), agent: i > 9 ? 2 : 0, direct: i < 4 ? 3 : 0 })),
      dernieres: [{ le: new Date().toISOString(), mode: "agent", statut: "lue", etapes: 3, verifications: ["date : 87 ou 97 ?", "température : 1g ou 19 ?"], tokens: 6200, erreur: null }],
    });
    // Le faux agent en mode évaluation : il lit juste la date et la profondeur, avec un zoom
    faux.fonctions["lire-page"] = (corps) => {
      const ev = corps["eval"] as { run_id: string; cas_id: string; mode: string };
      const ligne = {
        run_id: ev.run_id,
        cas_id: ev.cas_id,
        reussi: true,
        details: { structure: true, attendu_n: 1, lu_n: 1, exact: 2, signale: 0, faux: 0, invente: 0, champs: [
          { plongee: 1, champ: "date", attendu: "1987-08-12", lu: "1987-08-12", confiance: "sur", verdict: "exact" },
          { plongee: 1, champ: "profondeur_max", attendu: "38.5", lu: "38.5", confiance: "sur", verdict: "exact" },
        ] },
        journal: ev.mode === "agent" ? [{ outil: "zoomer", raison: "profondeur : 38,5 ou 36,5 ?" }] : [],
        etapes: ev.mode === "agent" ? 2 : 1,
        tokens_entree: 4000,
        tokens_sortie: 600,
        duree_ms: 6400,
        erreur: null,
      };
      faux.table("agent_eval_resultats").push({ id: `r-${ev.run_id}`, ...ligne });
      return { ok: true, ...ligne };
    };
    const erreurs = await preparer(page, faux);

    await ouvrir(page, "/admin");
    await page.getByRole("button", { name: "Agent IA" }).click();
    await expect(page.getByRole("heading", { name: /banc d'essai de l'agent/i })).toBeVisible();

    // Le suivi en production : taux de correction humaine et faux « sûrs », pour chaque mode
    await expect(page.getByRole("heading", { name: "L'agent en production" })).toBeVisible();
    await expect(page.getByText("10 %")).toBeVisible(); // 4 champs corrigés sur 40 avec l'agent
    await expect(page.getByText("24 %")).toBeVisible(); // 13 sur 55 en lecture directe
    await page.getByRole("button", { name: "7 jours" }).click();
    await expect.poll(() => faux.journal.filter((j) => j === "rpc admin_suivi_agent").length).toBeGreaterThan(1);

    // Ajouter un cas : la photo et ce qui est vraiment écrit
    await page.getByRole("button", { name: /ajouter un cas/i }).click();
    await page.locator('input[type="file"]').setInputFiles(PHOTO);
    await page.getByPlaceholder(/titre/i).fill("Carnet 1987, page 12");
    await page.getByPlaceholder("AAAA-MM-JJ").fill("1987-08-12");
    await page.getByPlaceholder("32").fill("38.5");
    await page.getByRole("button", { name: /ajouter ce cas/i }).click();
    await expect(page.getByText("Carnet 1987, page 12")).toBeVisible();
    const cas = faux.table("agent_eval_cas")[0]!;
    expect(cas["type"]).toBe("nominal");
    expect(cas["attendu"]).toEqual({ lisible: true, plongees: [{ date: "1987-08-12", profondeur_max: "38.5" }] });

    // Lancer l'évaluation avec l'agent, puis lire le score
    await page.getByRole("button", { name: /avec l'agent/i }).click();
    await expect(page.getByText(/1\/1/).first()).toBeVisible({ timeout: 15_000 });
    expect(faux.table("agent_eval_runs")).toHaveLength(1);
    await page.waitForTimeout(800);
    await page.screenshot({ path: test.info().outputPath("banc-agent.png"), fullPage: true });

    expect(erreurs, "erreurs JavaScript dans la page").toEqual([]);
    console.log("non simulés :", [...faux.inconnus].join(", ") || "aucun");
  });
});
