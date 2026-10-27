import { expect, test } from "@playwright/test";
import { FauxSupabase, LEA, ouvrir, preparer } from "../support/supabase";
import { plongees, rpcCommunes } from "../support/donnees";

test.describe("Fiche d'une plongée", () => {
  test("une plongée enregistrée s'ouvre en fiche à lire, « Modifier » ouvre le formulaire", async ({ page }) => {
    const faux = new FauxSupabase(LEA);
    rpcCommunes(faux);
    const [p] = plongees(faux, 1);
    Object.assign(p!, {
      visibility_m: 20,
      avg_depth_m: 19,
      pressure_start_bar: 200,
      pressure_end_bar: 60,
      weight_kg: 4,
      buddies: ["Sarah", "Léo"],
      club_name: "Club de plongée du Lavandou",
      boat_name: "Le Mérou",
      wildlife: ["Mérou brun", "Barracuda", "Sar commun"],
      comment: "Une dizaine de mérous autour du tombant.",
      dive_type: "Exploration",
      current_strength: "Faible",
    });
    const erreurs = await preparer(page, faux, { connecte: true });

    await ouvrir(page, `/nouvelle-plongee?id=${p!.id}`);
    await expect(page.getByRole("heading", { name: "Sec de la Fourmigue" })).toBeVisible();
    await expect(page.getByText("Profondeur max")).toBeVisible();
    await expect(page.getByText("Mérou brun")).toBeVisible();
    // Pas de champ de formulaire en lecture
    await expect(page.locator("input[type=date]")).toHaveCount(0);
    await page.screenshot({ path: test.info().outputPath("fiche.png"), fullPage: true });

    // Ajouter un membre directement depuis la fiche, sans « Modifier »
    await page.getByRole("button", { name: "Ajouter un membre" }).click();
    await page.getByLabel("Nom du membre").fill("Inès");
    await page.getByRole("button", { name: "Ajouter", exact: true }).click();
    await expect(page.getByText("Inès rejoint ta palanquée.")).toBeVisible();
    await expect(page.getByText("Inès", { exact: true })).toBeVisible();
    await expect(page.locator("input[type=date]")).toHaveCount(0);
    await page.screenshot({ path: test.info().outputPath("fiche-ajout.png"), fullPage: true });

    await page.getByRole("button", { name: "Modifier", exact: true }).click();
    await expect(page.locator("input[type=date]")).toHaveCount(1);
    await expect(page.getByRole("button", { name: "Enregistrer", exact: true })).toBeVisible();
    expect(erreurs, "erreurs JavaScript dans la page").toEqual([]);
  });
});
