import { expect, test } from "@playwright/test";
import { FauxSupabase, LEA, ouvrir, preparer } from "../support/supabase";
import { plongees, rpcCommunes } from "../support/donnees";

const PROPOSITION = {
  id: "b0000000-0000-0000-0000-000000000001",
  statut: "a_confirmer",
  de: { id: "a0000000-0000-0000-0000-000000000009", prenom: "Fabien", niveau: "N2", club: null },
  cree_le: "2026-10-24T10:00:00Z",
  expire_le: "2026-11-07T10:00:00Z",
  validee_le: "2026-10-24T10:00:00Z",
  commun: { date: "2026-10-24", heure: "09:30", site: "La Gabinière", lieu: "Port-Cros, Var", duree: 48, temp_fond: 17, visibilite: 20, bateau: null, club: null, type: "Exploration" },
  palanquee: [],
  noms_libres: [],
  deja: null,
};

test.describe("Binômes", () => {
  test("une plongée proposée par un binôme se complète et se note sur un seul écran", async ({ page }) => {
    const faux = new FauxSupabase(LEA);
    rpcCommunes(faux);
    plongees(faux, 1);
    let envoye: Record<string, unknown> | null = null;
    faux.rpc["proposition_plongee"] = () => PROPOSITION;
    faux.rpc["ajouter_plongee_identifiee"] = (corps: Record<string, unknown>) => {
      envoye = corps;
      return "d0000000-0000-0000-0000-000000000001";
    };
    const erreurs = await preparer(page, faux, { connecte: true });

    await ouvrir(page, `/amis/proposition?id=${PROPOSITION.id}`);
    await expect(page.getByRole("heading", { name: /fabien a plongé avec toi/i })).toBeVisible();
    await page.getByLabel("Profondeur max").fill("31");
    await page.getByLabel("Lestage").fill("4");
    await page.getByLabel("Bloc au départ").fill("200");
    await page.getByLabel("Bloc à l'arrivée").fill("60");
    await page.getByRole("button", { name: "4 sur 5" }).click();
    await page.screenshot({ path: test.info().outputPath("proposition.png"), fullPage: true });
    await page.getByRole("button", { name: /ajouter à mon carnet/i }).click();

    // Pas de second écran : on revient directement au carnet
    await expect(page).toHaveURL(/\/carnet/);
    expect(envoye).toMatchObject({ p_id: PROPOSITION.id, p_perso: { prof_max: "31", lestage: "4", pression_debut: "200", pression_fin: "60", note: 4 } });
    expect(erreurs, "erreurs JavaScript dans la page").toEqual([]);
  });
});
