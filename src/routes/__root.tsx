import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Outlet,
  Link,
  createRootRouteWithContext,
  useRouter,
  HeadContent,
  Scripts,
  type ErrorComponentProps,
} from "@tanstack/react-router";
import { useEffect, type ReactNode } from "react";

import appCss from "../styles.css?url";
import { reportLovableError } from "../lib/lovable-error-reporting";
import { installerSuivi } from "../lib/suivi";
import { installerHorsLigne } from "../lib/hors-ligne";
import { FeuilleConditions } from "../components/legal/FeuilleConditions";

function NotFoundComponent() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-7xl font-bold text-foreground">404</h1>
        <h2 className="mt-4 text-xl font-semibold text-foreground">Page not found</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          The page you're looking for doesn't exist or has been moved.
        </p>
        <div className="mt-6">
          <Link
            to="/"
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Go home
          </Link>
        </div>
      </div>
    </div>
  );
}

function ErrorComponent({ error: rawError, reset }: ErrorComponentProps) {
  const error = rawError instanceof Error ? rawError : new Error(String(rawError));
  console.error(error);
  const router = useRouter();
  useEffect(() => {
    reportLovableError(error, { boundary: "tanstack_root_error_component" });
  }, [error]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-xl font-semibold tracking-tight text-foreground">
          This page didn't load
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Something went wrong on our end. You can try refreshing or head back home.
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          <button
            onClick={() => {
              router.invalidate();
              reset();
            }}
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Try again
          </button>
          <a
            href="/"
            className="inline-flex items-center justify-center rounded-md border border-input bg-background px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-accent"
          >
            Go home
          </a>
        </div>
      </div>
    </div>
  );
}

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: "Palanote — Ton carnet de plongée dans la poche" },
      {
        name: "description",
        content:
          "Photographie tes anciens carnets, retrouve tes binômes, organise tes sorties et équipe-toi d'occasion. Tout au même endroit.",
      },
      { property: "og:title", content: "Palanote — Ton carnet de plongée dans la poche" },
      {
        property: "og:description",
        content:
          "Photographie tes anciens carnets, retrouve tes binômes, organise tes sorties et équipe-toi d'occasion. Tout au même endroit.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      // Installable sur l'écran d'accueil, utilisable sans réseau
      { name: "theme-color", content: "#0F3D70" },
      { name: "apple-mobile-web-app-capable", content: "yes" },
      { name: "mobile-web-app-capable", content: "yes" },
      { name: "apple-mobile-web-app-title", content: "Palanote" },
      { name: "apple-mobile-web-app-status-bar-style", content: "default" },
    ],
    links: [
      { rel: "manifest", href: "/manifest.webmanifest" },
      { rel: "apple-touch-icon", href: "/apple-touch-icon.png" },
      {
        rel: "stylesheet",
        href: appCss,
      },
      { rel: "icon", href: "/favicon.png", type: "image/png" },
    ],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
  errorComponent: ErrorComponent,
});

function RootShell({ children }: { children: ReactNode }) {
  return (
    <html lang="fr">
      <head>
        <HeadContent />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}

function RootComponent() {
  const { queryClient } = Route.useRouteContext();
  // Présence et erreurs pour le tableau de bord du développeur.
  useEffect(() => installerSuivi(), []);
  // Hors ligne : envoi des plongées en attente, service worker, écrans gardés d'avance.
  const router = useRouter();
  useEffect(() => {
    installerHorsLigne();
    const prechauffer = () => {
      for (const to of ["/carnet", "/plongee-express", "/nouvelle-plongee"] as const) void router.preloadRoute({ to }).catch(() => undefined);
    };
    window.addEventListener("palanote-prechauffer", prechauffer);
    return () => window.removeEventListener("palanote-prechauffer", prechauffer);
  }, [router]);

  return (
    <QueryClientProvider client={queryClient}>
      {/* Required: nested routes render here. Removing <Outlet /> breaks all child routes. */}
      <Outlet />
      {/* Accord aux conditions d'utilisation, demandé une fois par version */}
      <FeuilleConditions />
    </QueryClientProvider>
  );
}
