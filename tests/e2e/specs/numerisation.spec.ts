import { expect, test } from "@playwright/test";
import { fileURLToPath } from "node:url";
import { FauxSupabase, LEA, ouvrir, preparer } from "../support/supabase";
import { agentDeLecture, rpcCommunes } from "../support/donnees";

const PHOTO = fileURLToPath(new URL("../support/page-carnet.jpg", import.meta.url));

test.describe("Numérisation d'un carnet par l'agent de lecture", () => {
  test("une page envoyée est lue, relue champ par champ, puis validée par le plongeur", async ({ page }) => {
    const faux = new FauxSupabase(LEA);
    rpcCommunes(faux);
    agentDeLecture(faux);
    const erreurs = await preparer(page, faux);
    const photo = async (nom: string) => {
      await page.waitForTimeout(1500); // laisse finir les fondus d'entrée
      await page.screenshot({ path: test.info().outputPath(nom) });
    };

    // 1. Choisir une photo de page
    await ouvrir(page, "/numeriser");
    const choix = page.waitForEvent("filechooser");
    await page.getByRole("button", { name: /choisir dans mes photos/i }).click();
    await (await choix).setFiles(PHOTO);
    await expect(page).toHaveURL(/\/numeriser\/choisir/);
    await photo("1-choisir.png");

    // 2. L'envoyer : l'agent la lit sur le serveur
    const envoyer = page.getByRole("button", { name: /envoyer 1 page/i });
    if (!(await envoyer.isVisible())) await page.getByRole("button", { name: /choisir cette photo/i }).first().click();
    await page.getByRole("button", { name: /envoyer 1 page/i }).click();
    await expect(page).toHaveURL(/\/numeriser\/lecture/);
    await expect(page.getByRole("button", { name: /vérifier la page/i })).toBeEnabled({ timeout: 20_000 });
    await photo("2-lecture.png");
    expect(faux.journal.filter((j) => j === "fonction lire-page")).toHaveLength(1);

    // 3. Vérifier : les champs douteux sont signalés, la photo reste sous les yeux
    await page.getByRole("button", { name: /vérifier la page/i }).click();
    await expect(page).toHaveURL(/\/numeriser\/relecture/);
    await expect(page.locator("input[value=\"Sec de la Fourmigue\"], :text(\"Sec de la Fourmigue\")").first()).toBeVisible();
    await photo("3-relecture.png");

    // 4. Rien n'entre dans le carnet avant la validation
    expect(faux.table("dives")).toHaveLength(0);
    const valider = page.getByRole("button", { name: /valider|ajouter|enregistrer/i }).last();
    await valider.click();
    await expect.poll(() => faux.table("dives").length, { timeout: 15_000 }).toBeGreaterThan(0);
    await page.waitForURL((u) => !u.pathname.includes("relecture"), { timeout: 15_000 }).catch(() => undefined);
    const plongee = faux.table("dives")[0]!;
    expect(plongee["site_name"]).toBe("Sec de la Fourmigue");
    expect(plongee["user_id"]).toBe(LEA.id);
    await photo("4-validee.png");

    expect(erreurs, "erreurs JavaScript dans la page").toEqual([]);
    console.log("non simulés :", [...faux.inconnus].join(", ") || "aucun");
  });
});
