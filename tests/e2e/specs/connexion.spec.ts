import { expect, test } from "@playwright/test";
import { FauxSupabase, LEA, ouvrir, preparer } from "../support/supabase";
import { plongees, rpcCommunes } from "../support/donnees";

test.describe("Connexion et carnet", () => {
  test("un plongeur se connecte et retrouve ses plongées", async ({ page }) => {
    const faux = new FauxSupabase(LEA);
    rpcCommunes(faux);
    plongees(faux, 3);
    const erreurs = await preparer(page, faux, { connecte: false });

    await ouvrir(page, "/connexion");
    await page.locator("#email").fill(LEA.email);
    await page.locator("#password").fill("motdepasse-test");
    await page.getByRole("button", { name: /se connecter/i }).click();

    await expect(page).toHaveURL(/\/carnet/);
    await expect(page.getByText("Sec de la Fourmigue").first()).toBeVisible();
    await expect(page.getByText("Épave du Togo").first()).toBeVisible();
    await page.screenshot({ path: test.info().outputPath("carnet.png") });
    expect(erreurs, "erreurs JavaScript dans la page").toEqual([]);
    console.log("non simulés :", [...faux.inconnus].join(", ") || "aucun");
  });

  test("sans compte, la numérisation demande de se connecter", async ({ page }) => {
    const faux = new FauxSupabase(LEA);
    await preparer(page, faux, { connecte: false });
    await ouvrir(page, "/numeriser");
    await page.getByRole("button", { name: /photographier une page/i }).click();
    await expect(page.getByText(/connecte|compte/i).first()).toBeVisible();
    await page.screenshot({ path: test.info().outputPath("connexion-requise.png") });
  });
});
