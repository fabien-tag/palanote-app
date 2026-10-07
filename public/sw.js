// ============================================================
// Palanote — service worker
// Garde les écrans et les fichiers de l'app sur le téléphone pour l'ouvrir sans réseau.
// · Pages : réseau d'abord (toujours la dernière version), copie gardée en secours.
// · Fichiers de l'app (JS, CSS, images, polices) : copie d'abord, mise à jour en arrière-plan.
// · Données (Supabase), IA, cartes : jamais gardées ici. Les plongées saisies sans
//   réseau sont gérées par l'app elle-même (file d'attente, src/lib/hors-ligne.ts).
// Changer VERSION vide les anciennes copies.
// ============================================================
const VERSION = "palanote-v1";
const PAGES = `${VERSION}-pages`;
const FICHIERS = `${VERSION}-fichiers`;
const ESSENTIEL = ["/carnet", "/plongee-express", "/nouvelle-plongee", "/manifest.webmanifest", "/icone-192.png", "/favicon.png"];

self.addEventListener("install", (e) => {
  e.waitUntil(
    caches
      .open(PAGES)
      .then((c) => Promise.allSettled(ESSENTIEL.map((u) => c.add(new Request(u, { credentials: "same-origin" })))))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches
      .keys()
      .then((cles) => Promise.all(cles.filter((c) => !c.startsWith(VERSION)).map((c) => caches.delete(c))))
      .then(() => self.clients.claim()),
  );
});

function estPage(req, url) {
  return req.mode === "navigate" || (req.headers.get("accept") || "").includes("text/html") || ESSENTIEL.includes(url.pathname);
}

self.addEventListener("fetch", (e) => {
  const req = e.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return; // Supabase, IA, cartes : pas de copie
  if (url.pathname.startsWith("/_serverFn") || url.pathname.startsWith("/api/")) return;

  if (estPage(req, url)) {
    // Réseau d'abord ; sans réseau : la copie de cette page, sinon celle du carnet.
    e.respondWith(
      fetch(req)
        .then((rep) => {
          if (rep.ok && rep.type === "basic") {
            const copie = rep.clone();
            void caches.open(PAGES).then((c) => c.put(url.pathname, copie));
          }
          return rep;
        })
        .catch(async () => {
          const c = await caches.open(PAGES);
          return (await c.match(url.pathname)) || (await c.match("/carnet")) || Response.error();
        }),
    );
    return;
  }

  // Fichiers de l'app : copie d'abord, puis mise à jour en arrière-plan.
  e.respondWith(
    caches.open(FICHIERS).then(async (c) => {
      const garde = await c.match(req);
      const frais = fetch(req)
        .then((rep) => {
          if (rep.ok && rep.type === "basic") void c.put(req, rep.clone());
          return rep;
        })
        .catch(() => garde || Response.error());
      return garde || frais;
    }),
  );
});
