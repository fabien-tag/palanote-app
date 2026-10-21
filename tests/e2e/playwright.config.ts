import { defineConfig, devices } from "@playwright/test";

// Batterie de tests de bout en bout de Palanote.
// L'app tourne en local (serveur de développement) et parle à un faux Supabase en mémoire :
// aucune vraie donnée n'est lue ni écrite, aucun crédit IA n'est consommé.
// Lancer : npm install, npx playwright install chromium, puis npx playwright test.
const PORT = 5199;

export default defineConfig({
  testDir: "./specs",
  timeout: 60_000,
  expect: { timeout: 10_000 },
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: [["list"], ["html", { outputFolder: "rapport", open: "never" }]],
  outputDir: "resultats",
  use: {
    baseURL: `http://127.0.0.1:${PORT}`,
    screenshot: "on",
    trace: "retain-on-failure",
    locale: "fr-FR",
    timezoneId: "Europe/Paris",
  },
  projects: [
    { name: "telephone", use: { ...devices["iPhone 13"], browserName: "chromium" } },
    { name: "ordinateur", use: { viewport: { width: 1440, height: 900 } }, testMatch: /club|admin/ },
  ],
  webServer: {
    command: `npx vite dev --host 127.0.0.1 --port ${PORT} --strictPort`,
    cwd: "../..",
    url: `http://127.0.0.1:${PORT}`,
    reuseExistingServer: true,
    timeout: 120_000,
  },
});
