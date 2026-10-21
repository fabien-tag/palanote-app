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
