import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import type { Page, Route } from "@playwright/test";

// ============================================================
// Un faux Supabase, en mémoire, pour tester l'app sans jamais toucher la vraie base.
// Il répond aux appels de l'app (REST, RPC, stockage, fonctions serveur, connexion)
// comme le ferait Supabase, avec les données que chaque test lui donne.
// ============================================================

export const PROJET = "imjbtxvhanvewopafmxk";
export const VERSION_CONDITIONS = /VERSION_CONDITIONS = "([^"]+)"/.exec(readFileSync(new URL("../../../src/lib/legal.ts", import.meta.url), "utf8"))![1]!;

// Une petite image (1 × 1 px) pour toutes les photos
const PNG = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==", "base64");

// Une vraie photo de page de carnet, servie pour toutes les images stockées
const PHOTO = readFileSync(new URL("./page-carnet.jpg", import.meta.url));

export type Ligne = Record<string, unknown>;
type Gestionnaire = (corps: Record<string, unknown>, faux: FauxSupabase) => unknown;
export type Utilisateur = { id: string; email: string; prenom: string };

export class FauxSupabase {
  db: Record<string, Ligne[]> = {};
  rpc: Record<string, Gestionnaire> = {};
  fonctions: Record<string, Gestionnaire> = {};
  journal: string[] = [];
  inconnus = new Set<string>();

  constructor(public moi: Utilisateur) {
    // Les conditions d'utilisation sont déjà acceptées : pas de feuille qui bloque l'écran
    this.db["consents"] = [{ id: "c1", user_id: moi.id, type: "cgu", version: VERSION_CONDITIONS, revoque_le: null }];
    this.db["profiles"] = [{ id: moi.id, prenom: moi.prenom, first_name: moi.prenom, niveau: "N2", role_plongee: "plongeur", notif_lecture: true }];
  }

  table(nom: string) {
    return (this.db[nom] ??= []);
  }

  session() {
    const u = { id: this.moi.id, aud: "authenticated", role: "authenticated", email: this.moi.email, app_metadata: {}, user_metadata: { first_name: this.moi.prenom } };
    return { access_token: "faux-jeton", token_type: "bearer", expires_in: 86400, expires_at: Math.floor(Date.now() / 1000) + 86400, refresh_token: "r", user: u };
  }

  // Ouvre une session avant le chargement de l'app (comme si l'utilisateur était déjà connecté)
  async connecter(page: Page) {
    const s = JSON.stringify(this.session());
    await page.addInitScript(
      ([cle, valeur]) => {
        localStorage.setItem(cle!, valeur!);
        localStorage.setItem("palanote-satisfaction", "plus-tard");
      },
      [`sb-${PROJET}-auth-token`, s],
    );
  }

  async installer(page: Page) {
    await page.route(/supabase\.co\/rest\/v1\/rpc\/.*/, (r) => this.surRpc(r));
    await page.route(/supabase\.co\/rest\/v1\/(?!rpc\/).*/, (r) => this.surRest(r));
    await page.route(/supabase\.co\/storage\/v1\/.*/, (r) => this.surStockage(r));
    await page.route(/supabase\.co\/functions\/v1\/.*/, (r) => this.surFonction(r));
    await page.route(/supabase\.co\/auth\/v1\/.*/, (r) => this.surAuth(r));
    await page.route(/supabase\.co\/realtime\/.*/, (r) => r.abort());
    // Services extérieurs : jamais appelés pendant les tests
    await page.route(/nominatim\.openstreetmap\.org|arcgisonline|tile\.openstreetmap/, (r) => r.fulfill({ status: 200, contentType: "application/json", body: "[]" }));
  }

  // ---------- Connexion ----------
  private async surAuth(route: Route) {
    const url = route.request().url();
    if (/\/token/.test(url) || /\/user/.test(url) && route.request().method() === "GET") {
      const s = this.session();
      return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(/\/user/.test(url) ? s.user : s) });
    }
    if (/\/logout/.test(url)) return route.fulfill({ status: 204, body: "" });
    return route.fulfill({ status: 200, contentType: "application/json", body: "{}" });
  }

  // ---------- Fonctions serveur ----------
  private async surFonction(route: Route) {
    const nom = new URL(route.request().url()).pathname.split("/functions/v1/")[1]!;
    const corps = JSON.parse(route.request().postData() ?? "{}") as Record<string, unknown>;
    this.journal.push(`fonction ${nom}`);
    const g = this.fonctions[nom];
    if (!g) {
      this.inconnus.add(`fonction ${nom}`);
      return route.fulfill({ status: 500, contentType: "application/json", body: JSON.stringify({ erreur: "non simulée" }) });
    }
    return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(g(corps, this) ?? { ok: true }) });
  }

  // ---------- RPC ----------
  private async surRpc(route: Route) {
    const nom = new URL(route.request().url()).pathname.split("/rpc/")[1]!;
    const corps = JSON.parse(route.request().postData() || "{}") as Record<string, unknown>;
    this.journal.push(`rpc ${nom}`);
    const g = this.rpc[nom];
    if (!g) {
      this.inconnus.add(`rpc ${nom}`);
      return route.fulfill({ status: 404, contentType: "application/json", body: JSON.stringify({ code: "PGRST202", message: `Could not find the function public.${nom}` }) });
    }
    try {
      return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(g(corps, this) ?? null) });
    } catch (e) {
      return route.fulfill({ status: 400, contentType: "application/json", body: JSON.stringify({ code: "P0001", message: (e as Error).message }) });
    }
  }

  // ---------- Stockage ----------
  private async surStockage(route: Route) {
    const req = route.request();
    const chemin = new URL(req.url()).pathname;
    if (chemin.includes("/object/sign/") && req.method() === "POST") {
      const corps = JSON.parse(req.postData() || "{}") as { paths?: string[] };
      if (corps.paths) return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(corps.paths.map((p) => ({ path: p, signedURL: `/object/sign/x/${p}?token=t`, error: null }))) });
      return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ signedURL: `/object/sign/${chemin.split("/object/sign/")[1]}?token=t` }) });
    }
    if (req.method() === "GET") return route.fulfill({ status: 200, contentType: "image/jpeg", headers: { "access-control-allow-origin": "*" }, body: PHOTO });
    if (req.method() === "DELETE") return route.fulfill({ status: 200, contentType: "application/json", body: "[]" });
    return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ Key: chemin.split("/object/")[1], Id: randomUUID() }) });
  }

  // ---------- Tables (REST façon PostgREST) ----------
  private filtres(params: URLSearchParams) {
    const f: [string, string, string][] = [];
    for (const [k, v] of params) {
      if (["select", "order", "limit", "offset", "on_conflict", "columns"].includes(k)) continue;
      const i = v.indexOf(".");
      f.push([k, v.slice(0, i), v.slice(i + 1)]);
    }
    return f;
  }

  private correspond(l: Ligne, f: [string, string, string][]) {
    return f.every(([k, op, val]) => {
      if (k.includes(".")) return true; // filtres sur une table jointe : ignorés
      const v = l[k];
      const texte = v === null || v === undefined ? null : String(v);
      switch (op) {
        case "eq":
          return texte === val;
        case "neq":
          return texte !== val;
        case "is":
          return val === "null" ? texte === null : String(v) === val;
        case "not":
          return val.startsWith("is.null") ? texte !== null : true;
        case "in":
          return val.replace(/^\(|\)$/g, "").split(",").map((s) => s.replace(/^"|"$/g, "")).includes(texte ?? "");
        case "gt":
          return texte !== null && texte > val;
        case "gte":
          return texte !== null && texte >= val;
        case "lt":
          return texte !== null && texte < val;
        case "lte":
          return texte !== null && texte <= val;
        case "ilike":
          return texte !== null && new RegExp(`^${val.replace(/[%*]/g, ".*")}$`, "i").test(texte);
        default:
          return true;
      }
    });
  }

  private async surRest(route: Route) {
    const req = route.request();
    const url = new URL(req.url());
    const nom = url.pathname.split("/rest/v1/")[1]!;
    const params = url.searchParams;
    const f = this.filtres(params);
    const lignes = this.table(nom);
    const prefer = req.headers()["prefer"] ?? "";
    const unique = (req.headers()["accept"] ?? "").includes("vnd.pgrst.object");
    const m = req.method();
    this.journal.push(`${m} ${nom}`);

    const repondre = (donnees: Ligne[], status = 200) => {
      if (unique) {
        if (donnees.length === 0) return route.fulfill({ status: 406, contentType: "application/json", body: JSON.stringify({ code: "PGRST116", message: "0 rows" }) });
        return route.fulfill({ status, contentType: "application/json", body: JSON.stringify(donnees[0]) });
      }
      return route.fulfill({ status, contentType: "application/json", headers: { "content-range": `0-${Math.max(0, donnees.length - 1)}/${donnees.length}` }, body: JSON.stringify(donnees) });
    };

    if (m === "HEAD") {
      const n = lignes.filter((l) => this.correspond(l, f)).length;
      return route.fulfill({ status: 200, headers: { "content-range": `*/${n}` }, body: "" });
    }
    if (m === "GET") {
      let res = lignes.filter((l) => this.correspond(l, f));
      const ordre = params.get("order");
      if (ordre) {
        const [cle, sens] = ordre.split(",")[0]!.split(".");
        res = [...res].sort((a, b) => String(a[cle!] ?? "").localeCompare(String(b[cle!] ?? "")) * (sens === "desc" ? -1 : 1));
      }
      const limite = params.get("limit");
      if (limite) res = res.slice(0, Number(limite));
      if (unique && res.length === 0 && params.get("limit") === "1") return route.fulfill({ status: 200, contentType: "application/json", body: "null" });
      return repondre(res);
    }
    if (m === "POST") {
      const corps = JSON.parse(req.postData() || "[]") as Ligne | Ligne[];
      const items = Array.isArray(corps) ? corps : [corps];
      const crees: Ligne[] = [];
      for (const it of items) {
        const existante = it["id"] ? lignes.find((l) => l["id"] === it["id"]) : undefined;
        if (existante && (params.has("on_conflict") || prefer.includes("resolution=merge"))) {
          Object.assign(existante, it);
          crees.push(existante);
          continue;
        }
        const l = { id: randomUUID(), created_at: new Date().toISOString(), deleted_at: null, ...it };
        lignes.push(l);
        crees.push(l);
      }
      return repondre(crees, 201);
    }
    if (m === "PATCH") {
      const corps = JSON.parse(req.postData() || "{}") as Ligne;
      const maj = lignes.filter((l) => this.correspond(l, f));
      for (const l of maj) Object.assign(l, corps);
      return repondre(maj);
    }
    if (m === "DELETE") {
      this.db[nom] = lignes.filter((l) => !this.correspond(l, f));
      return repondre([]);
    }
    return route.fulfill({ status: 400, body: "?" });
  }
}

// Prépare une page de test : faux Supabase installé et utilisateur connecté
export async function preparer(page: Page, faux: FauxSupabase, { connecte = true } = {}) {
  await faux.installer(page);
  if (connecte) await faux.connecter(page);
  // Les erreurs de l'app (pas celles du réseau simulé) font échouer le test
  const erreurs: string[] = [];
  page.on("pageerror", (e) => erreurs.push(e.message));
  return erreurs;
}

// Wikipédia simulé : chaque espèce a une image de référence
export async function wikipediaSimule(page: Page) {
  await page.route(/wikipedia\.org\/api\/rest_v1\/page\/summary\/.*/, (r) =>
    r.fulfill({
      status: 200,
      contentType: "application/json",
      headers: { "access-control-allow-origin": "*" },
      body: JSON.stringify({ type: "standard", title: decodeURIComponent(r.request().url().split("/summary/")[1]!), thumbnail: { source: "https://upload.wikimedia.test/ref.png" }, content_urls: { desktop: { page: "https://fr.wikipedia.org/wiki/Test" } } }),
    }),
  );
  await page.route("https://upload.wikimedia.test/ref.png", (r) => r.fulfill({ status: 200, contentType: "image/png", body: PNG }));
}

export const MARC: Utilisateur = { id: "a0000000-0000-0000-0000-000000000001", email: "marc@test.fr", prenom: "Marc" };
export const LEA: Utilisateur = { id: "a0000000-0000-0000-0000-000000000002", email: "lea@test.fr", prenom: "Léa" };

// Ouvre une page et attend que l'app soit prête (React branché sur la page)
export async function ouvrir(page: Page, chemin: string) {
  await page.goto(chemin);
  await page.waitForLoadState("networkidle");
  await page.waitForFunction(() => document.querySelector("#root, body")?.querySelector("[data-tsd-source], main, div") !== null);
  await page.waitForTimeout(600);
}
