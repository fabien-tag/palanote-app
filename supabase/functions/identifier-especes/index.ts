// ============================================================
// Palanote — Edge Function « identifier-especes »
// Regarde les photos d'une plongée et propose les espèces rencontrées.
// Le plongeur valide ou refuse chacune ensuite (écran « Espèces détectées ») :
// rien n'est ajouté à la plongée sans son accord.
//
// Appel : supabase.functions.invoke("identifier-especes", { body: { dive_id } })
// Répond tout de suite (202) puis travaille en arrière-plan.
//
// Secret requis (Supabase → Edge Functions → Secrets) : ANTHROPIC_API_KEY (le même que lire-page)
// Optionnel : ANTHROPIC_MODEL_ESPECES (par défaut claude-haiku-4-5-20251001, plusieurs fois moins cher :
// l'analyse des espèces est gratuite et illimitée pour tous les plongeurs)
// Ne regarde que les photos de la personne connectée, et seulement si elle a donné
// son accord (profiles.analyse_especes_le).
// ============================================================
import { createClient, type SupabaseClient } from "npm:@supabase/supabase-js@2";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const MODELE = Deno.env.get("ANTHROPIC_MODEL_ESPECES") ?? "claude-haiku-4-5-20251001";
const PHOTOS_MAX = 12;

function encodeBase64(octets: Uint8Array) {
  let binaire = "";
  for (let i = 0; i < octets.length; i += 0x8000) {
    binaire += String.fromCharCode(...octets.subarray(i, i + 0x8000));
  }
  return btoa(binaire);
}

const OUTIL = {
  name: "enregistrer_especes",
  description: "Enregistre les espèces marines reconnues sur les photos d'une plongée.",
  input_schema: {
    type: "object",
    properties: {
      especes: {
        type: "array",
        description: "Une entrée par espèce différente (pas une par photo). Vide si aucune espèce n'est reconnaissable.",
        items: {
          type: "object",
          properties: {
            nom: { type: "string", description: "Nom commun en français (ex. « Mérou brun »)" },
            nom_latin: { type: ["string", "null"], description: "Nom scientifique (ex. « Epinephelus marginatus »), ou null si inconnu" },
            confiance: { type: "number", description: "Certitude entre 0 et 1 (0,9 = très sûr, 0,6 = probable, à confirmer)" },
            photo: { type: "integer", description: "Numéro de la photo où l'espèce se voit le mieux (1 = première photo)" },
            alternative: { type: ["string", "null"], description: "Autre espèce possible si tu hésites (nom commun ou latin), sinon null" },
          },
          required: ["nom", "nom_latin", "confiance", "photo", "alternative"],
        },
      },
    },
    required: ["especes"],
  },
};

const CONSIGNE = `Tu es un naturaliste spécialiste de la faune et de la flore sous-marines (souvent la Méditerranée, parfois les tropiques).
Voici les photos d'une même plongée, numérotées dans l'ordre. Liste les espèces animales (et les grandes espèces fixées : gorgones, posidonie, corail…) que tu reconnais.

Règles :
- Une entrée par espèce, même si elle apparaît sur plusieurs photos. Indique la photo où elle se voit le mieux.
- Nom commun en français, et nom scientifique quand tu le connais.
- Ne devine jamais : si tu n'es pas sûr, baisse la confiance (moins de 0,7) et propose une alternative. Sous 0,4, ne la mets pas.
- Ignore les plongeurs, le matériel et le décor sans vie identifiable.
- Si rien n'est reconnaissable, renvoie une liste vide.
Réponds uniquement en appelant l'outil enregistrer_especes, sans autre texte.`;

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

type EspeceLue = { nom: string; nom_latin: string | null; confiance: number; photo: number; alternative: string | null };

// L'appel à l'outil, ou à défaut un objet JSON écrit dans la réponse.
function extraire(contenu: { type: string; input?: unknown; text?: string }[]): EspeceLue[] {
  const outil = contenu.find((c) => c.type === "tool_use");
  if (outil?.input) return ((outil.input as { especes?: EspeceLue[] }).especes ?? []) as EspeceLue[];
  const texte = contenu.filter((c) => c.type === "text").map((c) => c.text ?? "").join("\n");
  const debut = texte.indexOf("{");
  const fin = texte.lastIndexOf("}");
  if (debut >= 0 && fin > debut) {
    try {
      const objet = JSON.parse(texte.slice(debut, fin + 1));
      if (Array.isArray(objet?.especes)) return objet.especes as EspeceLue[];
    } catch {
      /* pas du JSON */
    }
  }
  throw new Error(`IA : réponse sans résultat structuré (${texte.slice(0, 160) || "vide"})`);
}

async function analyser(admin: SupabaseClient, diveId: string, userId: string) {
  const { data: medias, error } = await admin
    .from("media")
    .select("id, bucket, chemin")
    .eq("dive_id", diveId)
    .eq("user_id", userId)
    .is("deleted_at", null)
    .order("created_at", { ascending: true })
    .limit(PHOTOS_MAX);
  if (error) throw new Error(`photos : ${error.message}`);
  const liste = (medias ?? []) as { id: string; bucket: string; chemin: string }[];
  if (liste.length === 0) {
    await admin.from("dives").update({ analyse_statut: "aucune", analyse_le: new Date().toISOString(), analyse_erreur: null }).eq("id", diveId);
    return;
  }

  const contenu: unknown[] = [];
  for (const [i, m] of liste.entries()) {
    const { data: fichier, error: errDl } = await admin.storage.from(m.bucket).download(m.chemin);
    if (errDl || !fichier) continue;
    const type = fichier.type && fichier.type.startsWith("image/") ? fichier.type : "image/jpeg";
    contenu.push({ type: "text", text: `Photo ${i + 1}` });
    contenu.push({ type: "image", source: { type: "base64", media_type: type, data: encodeBase64(new Uint8Array(await fichier.arrayBuffer())) } });
  }
  contenu.push({ type: "text", text: CONSIGNE });

  const reponse = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "x-api-key": Deno.env.get("ANTHROPIC_API_KEY") ?? "",
      "anthropic-version": "2023-06-01",
      "content-type": "application/json",
    },
    body: JSON.stringify({
      model: MODELE,
      max_tokens: 2048,
      tools: [OUTIL],
      tool_choice: { type: "auto" }, // les modèles récents refusent un outil imposé
      messages: [{ role: "user", content: contenu }],
    }),
  });
  const corps = await reponse.json();
  if (!reponse.ok) throw new Error(`IA : ${reponse.status} ${corps?.error?.message ?? JSON.stringify(corps)}`);

  const especes = extraire(corps.content ?? []).filter((e) => e?.nom && Number(e.confiance) >= 0.4);

  // On remplace les anciennes propositions non traitées ; les espèces déjà validées restent.
  await admin.from("dive_species").delete().eq("dive_id", diveId).eq("statut", "proposee").eq("source", "ia");
  if (especes.length > 0) {
    const lignes = especes.map((e) => ({
      user_id: userId,
      dive_id: diveId,
      media_id: liste[Math.max(0, Math.min(liste.length - 1, Math.round(Number(e.photo) || 1) - 1))]?.id ?? null,
      nom: String(e.nom).trim(),
      nom_latin: e.nom_latin ? String(e.nom_latin).trim() : null,
      confiance: Math.max(0, Math.min(1, Number(e.confiance) || 0)),
      alternative: e.alternative ? String(e.alternative).trim() : null,
      source: "ia",
      statut: "proposee",
    }));
    const { error: errIns } = await admin.from("dive_species").insert(lignes);
    if (errIns) throw new Error(`enregistrement : ${errIns.message}`);
  }
  await admin
    .from("dives")
    .update({ analyse_statut: especes.length > 0 ? "terminee" : "aucune", analyse_le: new Date().toISOString(), analyse_erreur: null })
    .eq("id", diveId);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return json({ erreur: "méthode non autorisée" }, 405);
  if (!Deno.env.get("ANTHROPIC_API_KEY")) return json({ erreur: "secret ANTHROPIC_API_KEY manquant" }, 500);

  let diveId = "";
  try {
    diveId = (await req.json())?.dive_id ?? "";
  } catch {
    /* corps vide */
  }
  if (!diveId) return json({ erreur: "dive_id manquant" }, 400);

  const admin = createClient(Deno.env.get("SUPABASE_URL")!, cleSecrete(), { auth: { persistSession: false } });

  // La personne connectée, son accord, et la plongée doit être à elle.
  const jeton = (req.headers.get("Authorization") ?? "").replace(/^Bearer\s+/i, "");
  const { data: auth } = jeton ? await admin.auth.getUser(jeton) : { data: { user: null } };
  if (!auth?.user) return json({ erreur: "connexion requise" }, 401);
  const userId = auth.user.id;

  const { data: profil } = await admin.from("profiles").select("analyse_especes_le").eq("id", userId).maybeSingle();
  if (!profil?.analyse_especes_le) return json({ erreur: "accord requis" }, 403);

  const { data: plongee } = await admin.from("dives").select("id").eq("id", diveId).eq("user_id", userId).is("deleted_at", null).maybeSingle();
  if (!plongee) return json({ erreur: "plongée introuvable" }, 404);

  await admin.from("dives").update({ analyse_statut: "en_cours", analyse_erreur: null }).eq("id", diveId);

  const travail = analyser(admin, diveId, userId).catch(async (e) => {
    console.error(e);
    await admin
      .from("dives")
      .update({ analyse_statut: "erreur", analyse_erreur: String(e?.message ?? e).slice(0, 500), analyse_le: new Date().toISOString() })
      .eq("id", diveId);
  });

  // Continue après la réponse, même si l'app est fermée.
  // deno-lint-ignore no-explicit-any
  const runtime = (globalThis as any).EdgeRuntime;
  if (runtime?.waitUntil) {
    runtime.waitUntil(travail);
    return json({ ok: true, statut: "en_cours" }, 202);
  }
  await travail;
  return json({ ok: true });
});
