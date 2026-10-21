import { expect, test } from "@playwright/test";
import { FauxSupabase, ouvrir, preparer, type Utilisateur } from "../support/supabase";
import { rpcCommunes } from "../support/donnees";

const PAUL: Utilisateur = { id: "a0000000-0000-0000-0000-000000000003", email: "paul@test.fr", prenom: "Paul" };
const CENTRES = [
  { id: "c-aqua", nom: "Aqua Club Hyères", ville: "Hyères", verifie: false, nb_dp: 1, membre: false },
  { id: "c-neuf", nom: "Club des Calanques", ville: "Marseille", verifie: false, nb_dp: 0, membre: false },
];

test.describe("Espace club", () => {
  test("un plongeur sans club voit la vitrine et ne peut pas rejoindre un centre déjà géré", async ({ page }) => {
    const faux = new FauxSupabase(PAUL);
    rpcCommunes(faux);
    faux.rpc["chercher_centres"] = (c) => CENTRES.filter((x) => !c["p_q"] || `${x.nom} ${x.ville}`.toLowerCase().includes(String(c["p_q"]).toLowerCase()));
    faux.rpc["sorties_dp"] = () => [];
    faux.rpc["rejoindre_centre"] = () => {
      throw new Error("centre_deja_gere");
    };
    const erreurs = await preparer(page, faux);

    await ouvrir(page, "/club");
    await expect(page.getByRole("heading", { name: /le bateau part à 9 h/i })).toBeVisible();
    await expect(page.getByRole("img", { name: /tableau de bord du directeur de plongée/i })).toBeVisible();
    await page.waitForTimeout(1200);
    await page.screenshot({ path: test.info().outputPath("1-vitrine.png") });

    await page.getByLabel("Rechercher un centre de plongée").fill("aqua");
    const aqua = page.getByRole("button", { name: /aqua club hyères/i });
    await expect(aqua).toContainText("Déjà géré");
    await aqua.click();
    await expect(page.getByText(/ce centre a déjà un directeur de plongée/i)).toBeVisible();
    expect(faux.journal).not.toContain("rpc rejoindre_centre"); // l'écran bloque avant même d'appeler le serveur
    await page.screenshot({ path: test.info().outputPath("2-deja-gere.png") });

    expect(erreurs, "erreurs JavaScript dans la page").toEqual([]);
  });

  test("un centre resté sans directeur de plongée peut être rejoint", async ({ page }) => {
    const faux = new FauxSupabase(PAUL);
    rpcCommunes(faux);
    let rejoint = false;
    faux.rpc["chercher_centres"] = (c) => CENTRES.filter((x) => `${x.nom} ${x.ville}`.toLowerCase().includes(String(c["p_q"] ?? "").toLowerCase()));
    faux.rpc["sorties_dp"] = () => [];
    faux.rpc["rejoindre_centre"] = (c) => {
      rejoint = c["p_centre"] === "c-neuf";
      return { id: "c-neuf", nom: "Club des Calanques", ville: "Marseille" };
    };
    await preparer(page, faux);
    await ouvrir(page, "/club");
    await page.getByLabel("Rechercher un centre de plongée").fill("calanques");
    await page.getByRole("button", { name: /club des calanques/i }).click();
    await expect.poll(() => rejoint).toBe(true);
  });
});
