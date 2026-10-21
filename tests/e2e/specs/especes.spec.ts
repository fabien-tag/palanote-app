import { expect, test } from "@playwright/test";
import { FauxSupabase, LEA, ouvrir, preparer, wikipediaSimule } from "../support/supabase";
import { plongees, rpcCommunes } from "../support/donnees";

test.describe("Espèces : analyser les photos, comparer, valider", () => {
  test("les photos de chaque plongée sont analysées, puis validées avec une image de référence", async ({ page }) => {
    const faux = new FauxSupabase(LEA);
    rpcCommunes(faux);
    const [p1, p2] = plongees(faux, 2);
    // Une photo par plongée
    for (const [i, p] of [p1!, p2!].entries())
      faux.table("media").push({ id: `m${i}`, user_id: LEA.id, dive_id: p.id, chemin: `${LEA.id}/photo${i}.jpg`, deleted_at: null });
    faux.rpc["galerie_plongee"] = (corps) =>
      faux.table("media").filter((m) => m["dive_id"] === corps["p_dive"]).map((m) => ({ id: m["id"], chemin: m["chemin"], auteur: { id: LEA.id, prenom: "Léa" }, moi: true, partagee: false, cree_le: "2026-09-10" }));
    // Le faux identificateur d'espèces : une murène (sûre) et un sar (à confirmer)
    faux.fonctions["identifier-especes"] = (corps) => {
      const dive = faux.table("dives").find((d) => d["id"] === corps["dive_id"])!;
      dive["analyse_statut"] = "terminee";
      faux.table("dive_species").push(
        { id: `s1-${dive["id"]}`, dive_id: dive["id"], user_id: LEA.id, media_id: "m0", nom: "Murène", nom_latin: "Muraena helena", confiance: 0.93, alternative: null, source: "ia", statut: "proposee" },
        { id: `s2-${dive["id"]}`, dive_id: dive["id"], user_id: LEA.id, media_id: "m0", nom: "Sar commun", nom_latin: "Diplodus sargus", confiance: 0.6, alternative: "Sar à tête noire", source: "ia", statut: "proposee" },
      );
      return { ok: true };
    };
    const erreurs = await preparer(page, faux);
    await wikipediaSimule(page);
    const photo = async (nom: string) => {
      await page.waitForTimeout(1200);
      await page.screenshot({ path: test.info().outputPath(nom), fullPage: true });
    };

    // 1. Depuis « Qui as-tu croisé sous l'eau ? », on va vers l'écran d'analyse (pas la fiche en modification)
    await ouvrir(page, "/especes");
    await page.getByRole("button", { name: /plongées avec photos à analyser/i }).click();
    await expect(page).toHaveURL(/\/especes\/analyser/);
    await expect(page.getByRole("heading", { name: "Analyser mes photos" })).toBeVisible();
    await expect(page.getByRole("button", { name: /identifier les espèces/i })).toHaveCount(2);
    await photo("1-analyser.png");

    // 2. Tout analyser : l'accord est demandé une seule fois, puis l'analyse part
    await page.getByRole("button", { name: /tout analyser/i }).click();
    await page.getByRole("button", { name: /accepter et analyser/i }).click();
    await expect(page.getByRole("button", { name: /2 espèces détectées/i })).toHaveCount(2, { timeout: 15_000 });
    expect(faux.journal.filter((j) => j === "fonction identifier-especes")).toHaveLength(2);
    await photo("2-detectees.png");

    // 3. Valider : ta photo et l'image de référence côte à côte ; la murène sûre est déjà cochée
    await page.getByRole("button", { name: /2 espèces détectées/i }).first().click();
    await expect(page).toHaveURL(/\/plongee\/especes/);
    await expect(page.getByRole("img", { name: /image de référence : murène/i })).toBeVisible();
    await expect(page.getByRole("button", { name: "Garder Murène" })).toHaveAttribute("aria-pressed", "true");
    await expect(page.getByRole("button", { name: "Garder Sar commun" })).toHaveAttribute("aria-pressed", "false");
    await photo("3-comparer.png");

    // Rien n'est validé tant que le plongeur n'a pas confirmé
    expect(faux.table("dive_species").filter((s) => s["statut"] === "validee")).toHaveLength(0);
    await page.getByRole("button", { name: "Retirer Sar commun" }).click();
    await page.getByRole("button", { name: /valider les espèces/i }).click();

    // 4. Retour à l'écran d'analyse, avec le résultat
    await expect(page).toHaveURL(/\/especes\/analyser/);
    await expect(page.getByText("1 espèce validée")).toBeVisible();
    const statuts = faux.table("dive_species").filter((s) => s["dive_id"] === p2!.id || s["dive_id"] === p1!.id).map((s) => `${s["nom"]}:${s["statut"]}`);
    expect(statuts).toContain("Murène:validee");
    expect(statuts).toContain("Sar commun:rejetee");
    await photo("4-retour.png");

    expect(erreurs, "erreurs JavaScript dans la page").toEqual([]);
    console.log("non simulés :", [...faux.inconnus].join(", ") || "aucun");
  });
});
