import { expect, test } from "@playwright/test";
import { FauxSupabase, LEA, ouvrir, preparer } from "../support/supabase";
import { plongees, rpcCommunes } from "../support/donnees";

test.describe("Mes sites de plongée", () => {
  test("une nouvelle plongée propose les sites déjà plongés, un toucher remplit le site et le lieu", async ({ page }) => {
    const faux = new FauxSupabase(LEA);
    rpcCommunes(faux);
    plongees(faux, 3);
    faux.table("sites_plongee").push({ id: "s1", user_id: LEA.id, nom: "Les Trois Arches", lieu: "Le Lavandou, France", coords: "43.1311, 6.3700", derniere_plongee: "2026-10-01" });
    const erreurs = await preparer(page, faux, { connecte: true });

    await ouvrir(page, "/nouvelle-plongee");
    await expect(page.getByText("Tes sites de plongée")).toBeVisible();
    await expect(page.getByRole("button", { name: /Épave du Togo/ })).toBeVisible();
    await page.getByText("Tes sites de plongée").scrollIntoViewIfNeeded();
    await page.screenshot({ path: test.info().outputPath("sites-liste.png") });

    // Taper le début d'un nom filtre la liste
    await page.getByPlaceholder("Nom du site").fill("trois");
    await expect(page.getByRole("button", { name: /Épave du Togo/ })).toHaveCount(0);
    await page.getByRole("button", { name: /Les Trois Arches/ }).click();
    await expect(page.getByPlaceholder("Nom du site")).toHaveValue("Les Trois Arches");
    await expect(page.getByPlaceholder("Ville, pays")).toHaveValue("Le Lavandou, France");
    await expect(page.getByText("Un de tes sites ?")).toHaveCount(0);
    await page.screenshot({ path: test.info().outputPath("sites.png") });
    expect(erreurs, "erreurs JavaScript dans la page").toEqual([]);
  });
});
