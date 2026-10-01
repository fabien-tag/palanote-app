// ============================================================
// Palanote — Edge Function « lire-page »
// Lit une page de carnet photographiée et propose les plongées qu'elle contient.
//
// Appel : supabase.functions.invoke("lire-page", { body: { page_id } })
// Répond tout de suite (202) puis travaille en arrière-plan : l'utilisateur
// peut fermer l'app, la lecture continue sur le serveur.
//
// Secret requis (Supabase → Edge Functions → Secrets) : ANTHROPIC_API_KEY
// Optionnel : ANTHROPIC_MODEL (par défaut claude-sonnet-5-5)
// SUPABASE_URL et la clé secrète du projet sont fournis automatiquement par
// Supabase (nouvelles clés SUPABASE_SECRET_KEYS ou ancienne SUPABASE_SERVICE_ROLE_KEY).
// La personne connectée est vérifiée ici même : l'option « Verify JWT with legacy
// secret » de la fonction peut rester désactivée.
// ============================================================
import { createClient, type SupabaseClient } from "npm:@supabase/supabase-js@2";

function encodeBase64(octets: Uint8Array) {
  let binaire = "";
  for (let i = 0; i < octets.length; i += 0x8000) {
    binaire += String.fromCharCode(...octets.subarray(i, i + 0x8000));
  }
  return btoa(binaire);
}

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const MODELE = Deno.env.get("ANTHROPIC_MODEL") ?? "claude-sonnet-5-5";

// Champs lus sur une plongée. Chacun revient avec : valeur, texte lu, confiance.
const CHAMPS = {
  date: "Date de la plongée, au format AAAA-MM-JJ",
  heure: "Heure d'immersion, au format HH:MM",
  site: "Nom du site de plongée",
  lieu: "Lieu, ville ou pays",
  profondeur_max: "Profondeur maximale en mètres (nombre, point décimal)",
  duree: "Durée de la plongée en minutes (nombre entier)",
  temperature: "Température de l'eau en °C (nombre)",
  pression_debut: "Pression du bloc au départ, en bar (nombre)",
  pression_fin: "Pression du bloc en fin de plongée, en bar (nombre)",
  melange: "Gaz respiré : Air, Nitrox ou Trimix",
  binomes: "Noms des binômes ou membres de la palanquée, séparés par des virgules",
  club: "Club ou centre de plongée",
  signee: "La plongée est-elle signée par un encadrant ? « oui » ou « non »",
  tamponnee: "La plongée porte-t-elle un tampon ? « oui » ou « non »",
  commentaire: "Commentaire manuscrit, recopié tel quel",
} as const;

const champSchema = {
  type: "object",
  properties: {
    valeur: {
      type: ["string", "null"],
      description: "Valeur normalisée, ou null si le champ est absent ou illisible",
    },
    lu: {
      type: ["string", "null"],
      description: "Ce qui est réellement écrit sur la page, tel que tu le lis (ex. « 1g »)",
    },
    confiance: {
      type: "string",
      enum: ["sur", "a_verifier", "non_lu"],
      description:
        "sur : lu sans ambiguïté. a_verifier : quelque chose est écrit mais tu hésites. non_lu : absent ou illisible.",
    },
  },
  required: ["valeur", "lu", "confiance"],
};

const OUTIL = {
  name: "enregistrer_page",
  description: "Enregistre les plongées lues sur une page de carnet de plongée.",
  input_schema: {
    type: "object",
    properties: {
      lisible: {
        type: "boolean",
        description: "false si la page est trop floue, coupée ou n'est pas une page de carnet",
      },
      raison: { type: ["string", "null"], description: "Si illisible : pourquoi, en une phrase" },
      plongees: {
        type: "array",
        description: "Les plongées de la page, dans l'ordre où elles apparaissent (de haut en bas, de gauche à droite)",
        items: {
          type: "object",
          properties: Object.fromEntries(
            Object.entries(CHAMPS).map(([cle, description]) => [cle, { ...champSchema, description }]),
          ),
          required: Object.keys(CHAMPS),
        },
      },
    },
    required: ["lisible", "plongees"],
  },
};

const CONSIGNE = `Tu lis une page photographiée d'un carnet de plongée papier (souvent un carnet français type FFESSM, parfois manuscrit, parfois ancien).
Une page peut contenir une ou plusieurs plongées : renvoie-les toutes, dans l'ordre.

Règles :
- Ne devine jamais. Une donnée fausse est pire qu'une donnée absente : si un champ n'est pas écrit, valeur = null et confiance = "non_lu".
- Si l'écriture est ambiguë (ex. « 1g » qui pourrait être 19), propose la valeur la plus probable, recopie ce que tu lis dans « lu », et mets confiance = "a_verifier".
- Normalise les valeurs : date en AAAA-MM-JJ (les carnets français écrivent JJ/MM/AA ; « 87 » = 1987), heure en HH:MM, nombres avec un point décimal, sans unité.
- « lu » contient toujours le texte brut tel qu'il apparaît sur la page (ou null si rien n'est écrit).
- Si la page n'est pas lisible ou n'est pas une page de carnet, lisible = false, plongees = [] et explique en une phrase dans « raison ».
Réponds uniquement en appelant l'outil enregistrer_page avec ton résultat, sans autre texte.`;

// Clé secrète du projet, quel que soit le système de clés utilisé.
function cleSecrete(): string {
  const legacy = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (legacy) return legacy;
  try {
    const cles = JSON.parse(Deno.env.get("SUPABASE_SECRET_KEYS") ?? "{}") as Record<string, string>;
    return cles["default"] ?? Object.values(cles)[0] ?? "";
  } catch {
    return "";
  }
}

function json(corps: unknown, status = 200) {
  return new Response(JSON.stringify(corps), { status, headers: { ...CORS, "Content-Type": "application/json" } });
}

type ChampLu = { valeur: string | null; lu: string | null; confiance: "sur" | "a_verifier" | "non_lu" };
type ResultatPage = { lisible: boolean; raison?: string | null; plongees: Record<string, ChampLu>[] };

// Résultat de l'IA : l'appel à l'outil, ou à défaut un objet JSON écrit dans sa réponse.
function extraireResultat(contenu: { type: string; input?: unknown; text?: string }[]): ResultatPage {
  const outil = contenu.find((c) => c.type === "tool_use");
  if (outil?.input) return outil.input as ResultatPage;
  const texte = contenu
    .filter((c) => c.type === "text")
    .map((c) => c.text ?? "")
    .join("\n");
  const debut = texte.indexOf("{");
  const fin = texte.lastIndexOf("}");
  if (debut >= 0 && fin > debut) {
    try {
      const objet = JSON.parse(texte.slice(debut, fin + 1));
      if (objet && typeof objet === "object" && "plongees" in objet) return objet as ResultatPage;
    } catch {
      /* pas du JSON valide */
    }
  }
  throw new Error(`IA : réponse sans résultat structuré (${texte.slice(0, 160) || "vide"})`);
}

async function lirePage(admin: SupabaseClient, pageId: string) {
  // Page + photo
  const { data: page, error } = await admin
    .from("ocr_pages")
    .select("id, batch_id, media:media_id (bucket, chemin)")
    .eq("id", pageId)
    .single();
  if (error || !page) throw new Error(`page introuvable : ${error?.message ?? pageId}`);
  const media = page.media as unknown as { bucket: string; chemin: string } | null;
  if (!media) throw new Error("photo manquante pour cette page");

  const { data: fichier, error: errDl } = await admin.storage.from(media.bucket).download(media.chemin);
  if (errDl || !fichier) throw new Error(`photo illisible dans le stockage : ${errDl?.message}`);
  const octets = new Uint8Array(await fichier.arrayBuffer());
  const type = fichier.type && fichier.type.startsWith("image/") ? fichier.type : "image/jpeg";

  // Appel à l'IA de vision
  const reponse = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "x-api-key": Deno.env.get("ANTHROPIC_API_KEY") ?? "",
      "anthropic-version": "2023-06-01",
      "content-type": "application/json",
    },
    body: JSON.stringify({
      model: MODELE,
      max_tokens: 4096,
      tools: [OUTIL],
      // Les modèles récents (Sonnet / Opus 5.5) refusent un outil imposé : on laisse le choix
      // en « auto », la consigne demande d'appeler l'outil, et on sait aussi lire une réponse JSON.
      tool_choice: { type: "auto" },
      messages: [
        {
          role: "user",
          content: [
            { type: "image", source: { type: "base64", media_type: type, data: encodeBase64(octets) } },
            { type: "text", text: CONSIGNE },
          ],
        },
      ],
    }),
  });
  const corps = await reponse.json();
  if (!reponse.ok) throw new Error(`IA : ${reponse.status} ${corps?.error?.message ?? JSON.stringify(corps)}`);

  const resultat = extraireResultat(corps.content ?? []);

  // Une extraction par plongée lue
  const plongees = resultat.lisible ? resultat.plongees ?? [] : [];
  await admin.from("ocr_extractions").delete().eq("page_id", pageId).eq("statut", "a_relire");
  if (plongees.length > 0) {
    const lignes = plongees.map((p, ordre) => {
      const champs: Record<string, string | null> = {};
      const confiances: Record<string, string> = {};
      const lectures: Record<string, string | null> = {};
      for (const cle of Object.keys(CHAMPS)) {
        const c = p[cle];
        champs[cle] = c?.valeur ?? null;
        confiances[cle] = c?.confiance ?? "non_lu";
        lectures[cle] = c?.lu ?? null;
      }
      return { page_id: pageId, ordre, champs, confiances, lectures };
    });
    const { error: errIns } = await admin.from("ocr_extractions").insert(lignes);
    if (errIns) throw new Error(`enregistrement : ${errIns.message}`);
  }

  await admin
    .from("ocr_pages")
    .update({
      statut: resultat.lisible && plongees.length > 0 ? "lue" : "illisible",
      reponse_modele: resultat,
      texte_brut: resultat.raison ?? null,
      modele: MODELE,
      erreur: null,
    })
    .eq("id", pageId);

  await majLot(admin, page.batch_id);
}

// Quand plus aucune page n'attend, le carnet passe « à relire ».
async function majLot(admin: SupabaseClient, batchId: string) {
  const { count } = await admin
    .from("ocr_pages")
    .select("id", { count: "exact", head: true })
    .eq("batch_id", batchId)
    .in("statut", ["en_attente", "en_cours"]);
  await admin
    .from("ocr_batches")
    .update({ statut: (count ?? 0) === 0 ? "a_relire" : "en_cours" })
    .eq("id", batchId);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return json({ erreur: "méthode non autorisée" }, 405);
  if (!Deno.env.get("ANTHROPIC_API_KEY")) return json({ erreur: "secret ANTHROPIC_API_KEY manquant" }, 500);

  let pageId = "";
  try {
    pageId = (await req.json())?.page_id ?? "";
  } catch {
    /* corps vide */
  }
  if (!pageId) return json({ erreur: "page_id manquant" }, 400);

  const url = Deno.env.get("SUPABASE_URL")!;
  const admin = createClient(url, cleSecrete(), { auth: { persistSession: false } });

  // Vérifie la personne connectée, puis que la page lui appartient bien.
  const jeton = (req.headers.get("Authorization") ?? "").replace(/^Bearer\s+/i, "");
  const { data: auth } = jeton ? await admin.auth.getUser(jeton) : { data: { user: null } };
  if (!auth?.user) return json({ erreur: "connexion requise" }, 401);

  const { data: possedee } = await admin
    .from("ocr_pages")
    .select("id, batch_id, ocr_batches!inner(user_id)")
    .eq("id", pageId)
    .eq("ocr_batches.user_id", auth.user.id)
    .maybeSingle();
  if (!possedee) return json({ erreur: "page introuvable" }, 404);

  await admin.from("ocr_pages").update({ statut: "en_cours", erreur: null }).eq("id", pageId);
  await admin.from("ocr_batches").update({ statut: "en_cours" }).eq("id", possedee.batch_id);

  const travail = lirePage(admin, pageId).catch(async (e) => {
    console.error(e);
    await admin
      .from("ocr_pages")
      .update({ statut: "erreur", erreur: String(e?.message ?? e).slice(0, 500) })
      .eq("id", pageId);
    await majLot(admin, possedee.batch_id);
  });

  // Continue après la réponse, même si l'utilisateur ferme l'app.
  // deno-lint-ignore no-explicit-any
  const runtime = (globalThis as any).EdgeRuntime;
  if (runtime?.waitUntil) {
    runtime.waitUntil(travail);
    return json({ ok: true, statut: "en_cours" }, 202);
  }
  await travail;
  return json({ ok: true });
});
