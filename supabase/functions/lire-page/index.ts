// ============================================================
// Palanote — Edge Function « lire-page »
// L'agent de lecture : il lit une page de carnet photographiée et propose les plongées qu'elle contient.
// C'est un agent (boucle courte et bornée) : après une première lecture, il décide lui-même
// de vérifier ses doutes avec deux outils — zoomer sur une zone de la photo, ou comparer avec
// la page voisine du même carnet — puis il enregistre. Au plus AGENT_ETAPES_MAX appels (4 par défaut).
// Son journal (vérifications, étapes, jetons) est gardé sur la page (palanote-agent-lecture.sql).
//
// Appel : supabase.functions.invoke("lire-page", { body: { page_id } })
// Répond tout de suite (202) puis travaille en arrière-plan : l'utilisateur
// peut fermer l'app, la lecture continue sur le serveur.
//
// Secret requis (Supabase → Edge Functions → Secrets) : ANTHROPIC_API_KEY
// Optionnel : ANTHROPIC_MODEL (par défaut claude-sonnet-5-5)
// Quota : chaque page lue est prise sur le forfait du plongeur (palanote-forfaits.sql).
// Quota atteint → 402 { erreur: "quota_atteint" } et la page passe en erreur « quota_atteint ».
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
// Nombre maximal d'appels au modèle par page : la première lecture + les vérifications + l'enregistrement
const ETAPES_MAX = Math.min(6, Math.max(1, Number(Deno.env.get("AGENT_ETAPES_MAX") ?? 4)));

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

// Les deux outils de vérification de l'agent
const OUTIL_ZOOM = {
  name: "zoomer",
  description:
    "Agrandit une zone de la photo pour relire de près un chiffre ou un mot douteux. Coordonnées en pourcentage de l'image (0 = bord haut ou gauche, 100 = bord bas ou droit).",
  input_schema: {
    type: "object",
    properties: {
      x: { type: "number", description: "Bord gauche de la zone, en % de la largeur" },
      y: { type: "number", description: "Bord haut de la zone, en % de la hauteur" },
      largeur: { type: "number", description: "Largeur de la zone, en % (au moins 5)" },
      hauteur: { type: "number", description: "Hauteur de la zone, en % (au moins 5)" },
      raison: { type: "string", description: "Ce que tu veux vérifier, en quelques mots (ex. « température : 1g ou 19 ? »)" },
    },
    required: ["x", "y", "largeur", "hauteur", "raison"],
  },
};

const OUTIL_VOISINE = {
  name: "voir_page_voisine",
  description:
    "Montre ce qui a été lu sur la page précédente ou suivante du même carnet (dates, sites, lieux, profondeurs) pour vérifier la cohérence : dates qui se suivent, même site, même année.",
  input_schema: {
    type: "object",
    properties: {
      sens: { type: "string", enum: ["precedente", "suivante"] },
      raison: { type: "string", description: "Ce que tu veux vérifier (ex. « l'année de la date : 87 ou 97 ? »)" },
    },
    required: ["sens", "raison"],
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

// La méthode de l'agent : vérifier ses doutes avant d'enregistrer, sans gaspiller
const METHODE = `
Méthode (tu es un agent : tu décides toi-même des vérifications) :
1. Lis toute la page.
2. Si un champ important te fait hésiter (date, site, profondeur, durée, température, pressions), tu peux le vérifier AVANT d'enregistrer :
   - zoomer sur la zone où il est écrit, pour le relire de près ;
   - voir_page_voisine, pour vérifier la cohérence avec les autres plongées du carnet (l'année, le site, l'ordre des dates).
3. Ne vérifie que ce qui peut changer une valeur : au plus ${Math.max(0, ETAPES_MAX - 2)} vérifications, une seule à la fois.
4. Un champ ne passe de « a_verifier » à « sur » que si la vérification a vraiment levé le doute. Sinon il reste « a_verifier » : le plongeur tranchera.
5. Termine toujours en appelant enregistrer_page.`;

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

  // ——— L'agent ———
  const { resultat, journal, etapes, tokensEntree, tokensSortie } = await agentLecture(admin, page as { id: string; batch_id: string }, octets, type);

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

  // Le journal de l'agent (sans bloquer si le script palanote-agent-lecture.sql n'est pas encore lancé)
  const { error: errJournal } = await admin
    .from("ocr_pages")
    .update({ journal_agent: journal, etapes_agent: etapes, tokens_entree: tokensEntree, tokens_sortie: tokensSortie })
    .eq("id", pageId);
  if (errJournal) console.error("journal de l'agent non enregistré", errJournal.message);

  await majLot(admin, page.batch_id);
}

type Bloc = { type: string; id?: string; name?: string; input?: Record<string, unknown>; text?: string };
type Etape = { etape: number; outil: string; raison: string; zone?: { x: number; y: number; largeur: number; hauteur: number }; sens?: string; resultat: string };

async function appelerModele(messages: unknown[], outils: unknown[]) {
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
      tools: outils,
      // Les modèles récents refusent un outil imposé : on laisse le choix en « auto »,
      // la consigne demande d'appeler l'outil, et on sait aussi lire une réponse JSON.
      tool_choice: { type: "auto" },
      messages,
    }),
  });
  const corps = await reponse.json();
  if (!reponse.ok) throw new Error(`IA : ${reponse.status} ${corps?.error?.message ?? JSON.stringify(corps)}`);
  return corps as { content: Bloc[]; usage?: { input_tokens?: number; output_tokens?: number; cache_read_input_tokens?: number; cache_creation_input_tokens?: number } };
}

// Zoom : découpe la zone demandée (avec une marge) et l'agrandit.
// La bibliothèque d'images n'est chargée qu'au premier zoom : si elle manquait, seule la vérification
// serait perdue, jamais la lecture de la page.
type Img = {
  width: number;
  height: number;
  clone(): Img;
  crop(x: number, y: number, l: number, h: number): Img;
  resize(l: number, h: number): Img;
  encodeJPEG(qualite: number): Promise<Uint8Array>;
};
async function zoomer(octets: Uint8Array, cache: { image?: Img }, z: { x: number; y: number; largeur: number; hauteur: number }) {
  if (!cache.image) {
    const { Image } = await import("npm:imagescript@1.3.0");
    cache.image = (await Image.decode(octets)) as unknown as Img;
  }
  const img = cache.image;
  const borne = (v: number, min: number, max: number) => Math.min(max, Math.max(min, Number.isFinite(v) ? v : min));
  const l = borne(z.largeur, 5, 100) + 4;
  const h = borne(z.hauteur, 5, 100) + 4;
  const x = borne(z.x - 2, 0, 100 - l);
  const y = borne(z.y - 2, 0, 100 - h);
  const px = (p: number, total: number) => Math.round((p / 100) * total);
  const largeur = Math.max(16, px(l, img.width));
  const hauteur = Math.max(16, px(h, img.height));
  const decoupe = img.clone().crop(px(x, img.width), px(y, img.height), Math.min(largeur, img.width), Math.min(hauteur, img.height));
  // Assez grand pour bien relire, sans dépasser 1 400 px
  const cible = Math.min(1400, Math.max(700, decoupe.width * 2));
  if (decoupe.width < cible) decoupe.resize(cible, Math.round((decoupe.height * cible) / decoupe.width));
  return encodeBase64(await decoupe.encodeJPEG(88));
}

// Page voisine : ce qui y a été lu (ou « pas encore lue »)
async function pageVoisine(admin: SupabaseClient, page: { id: string; batch_id: string }, sens: string) {
  if (page.id === "eval") return "Pas de page voisine pour cette page de test.";
  const { data: courante } = await admin.from("ocr_pages").select("ordre").eq("id", page.id).single();
  if (!courante) return "Page introuvable.";
  const requete = admin.from("ocr_pages").select("id, ordre, statut").eq("batch_id", page.batch_id);
  const { data: voisine } = await (sens === "suivante"
    ? requete.gt("ordre", courante.ordre).order("ordre", { ascending: true })
    : requete.lt("ordre", courante.ordre).order("ordre", { ascending: false })
  )
    .limit(1)
    .maybeSingle();
  if (!voisine) return `Pas de page ${sens === "suivante" ? "suivante" : "précédente"} dans ce carnet.`;
  const { data: ext } = await admin.from("ocr_extractions").select("ordre, champs").eq("page_id", voisine.id).order("ordre");
  if (!ext || ext.length === 0) return `La page ${sens === "suivante" ? "suivante" : "précédente"} n'est pas encore lue (statut : ${voisine.statut}).`;
  const garder = ["date", "heure", "site", "lieu", "profondeur_max", "duree", "club"];
  const plongees = ext.map((e) => Object.fromEntries(garder.map((k) => [k, (e.champs as Record<string, string | null>)?.[k] ?? null])));
  return `Plongées lues sur la page ${sens === "suivante" ? "suivante" : "précédente"} : ${JSON.stringify(plongees)}`;
}

// La boucle de l'agent : lire, vérifier ses doutes, enregistrer
async function agentLecture(admin: SupabaseClient, page: { id: string; batch_id: string }, octets: Uint8Array, type: string, etapesMax = ETAPES_MAX) {
  const messages: { role: string; content: unknown }[] = [
    {
      role: "user",
      content: [
        { type: "image", source: { type: "base64", media_type: type, data: encodeBase64(octets) } },
        // La photo et la consigne sont relues à chaque étape : on les met en cache (10 % du prix)
        // En lecture directe (1 étape), pas de méthode de vérification : c'est la version « un seul appel »
        { type: "text", text: etapesMax > 1 ? CONSIGNE + "\n" + METHODE : CONSIGNE, cache_control: { type: "ephemeral" } },
      ],
    },
  ];
  const journal: Etape[] = [];
  const cache: { image?: Img } = {};
  let tokensEntree = 0;
  let tokensSortie = 0;

  for (let etape = 1; etape <= etapesMax; etape++) {
    const derniere = etape === etapesMax;
    const reponse = await appelerModele(messages, derniere ? [OUTIL] : [OUTIL_ZOOM, OUTIL_VOISINE, OUTIL]);
    tokensEntree += (reponse.usage?.input_tokens ?? 0) + (reponse.usage?.cache_read_input_tokens ?? 0) + (reponse.usage?.cache_creation_input_tokens ?? 0);
    tokensSortie += reponse.usage?.output_tokens ?? 0;
    const contenu = reponse.content ?? [];
    const appels = contenu.filter((c) => c.type === "tool_use");

    // L'agent a fini : il enregistre
    const final = appels.find((c) => c.name === "enregistrer_page");
    if (final?.input) return { resultat: final.input as unknown as ResultatPage, journal, etapes: etape, tokensEntree, tokensSortie };

    // Pas d'outil : peut-être un JSON écrit en texte, sinon on lui rappelle de conclure
    if (appels.length === 0) {
      try {
        return { resultat: extraireResultat(contenu), journal, etapes: etape, tokensEntree, tokensSortie };
      } catch {
        messages.push({ role: "assistant", content: contenu });
        messages.push({ role: "user", content: [{ type: "text", text: "Termine en appelant enregistrer_page avec ce que tu as lu." }] });
        continue;
      }
    }

    // Il veut vérifier : on exécute ses outils et on lui rend les résultats
    messages.push({ role: "assistant", content: contenu });
    const retours: unknown[] = [];
    for (const appel of appels) {
      const e = appel.input ?? {};
      const raison = String(e["raison"] ?? "");
      if (appel.name === "zoomer") {
        const zone = { x: Number(e["x"]), y: Number(e["y"]), largeur: Number(e["largeur"]), hauteur: Number(e["hauteur"]) };
        try {
          const image = await zoomer(octets, cache, zone);
          retours.push({
            type: "tool_result",
            tool_use_id: appel.id,
            content: [
              { type: "image", source: { type: "base64", media_type: "image/jpeg", data: image } },
              { type: "text", text: "Zone agrandie." },
            ],
          });
          journal.push({ etape, outil: "zoomer", raison, zone, resultat: "zone agrandie" });
        } catch (err) {
          retours.push({ type: "tool_result", tool_use_id: appel.id, content: "Zoom impossible sur cette photo : continue sans.", is_error: true });
          journal.push({ etape, outil: "zoomer", raison, zone, resultat: `zoom impossible (${String((err as Error)?.message ?? err).slice(0, 80)})` });
        }
      } else if (appel.name === "voir_page_voisine") {
        const sens = e["sens"] === "suivante" ? "suivante" : "precedente";
        const texte = await pageVoisine(admin, page, sens);
        retours.push({ type: "tool_result", tool_use_id: appel.id, content: texte });
        journal.push({ etape, outil: "voir_page_voisine", raison, sens, resultat: texte.slice(0, 300) });
      } else {
        retours.push({ type: "tool_result", tool_use_id: appel.id, content: "Outil inconnu.", is_error: true });
      }
    }
    if (etape + 1 === etapesMax) retours.push({ type: "text", text: "Dernière étape : enregistre maintenant ton résultat avec enregistrer_page." });
    messages.push({ role: "user", content: retours });
  }
  throw new Error(`IA : l'agent n'a pas conclu en ${etapesMax} étapes`);
}

// ——— Banc d'essai (eval set) : noter la sortie de l'agent face à la bonne réponse ———
const normal = (v: unknown) =>
  String(v ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9.,:\- ]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
function egaux(attendu: unknown, lu: unknown) {
  const a = normal(attendu);
  const b = normal(lu);
  if (!a || !b) return false;
  const na = Number(a.replace(",", "."));
  const nb = Number(b.replace(",", "."));
  if (Number.isFinite(na) && Number.isFinite(nb) && /^[\d.,]+$/.test(a) && /^[\d.,]+$/.test(b)) return Math.abs(na - nb) < 0.01;
  return a === b || (a.length > 3 && b.length > 3 && (a.includes(b) || b.includes(a)));
}

type Attendu = { lisible?: boolean; plongees?: Record<string, string | number | null>[] };
function noter(attendu: Attendu, sortie: ResultatPage) {
  const lues = sortie.lisible ? (sortie.plongees ?? []) : [];
  // Cas hostile : la page n'est pas lisible, aucune plongée ne doit être inventée
  if (attendu.lisible === false) {
    return { reussi: lues.length === 0, details: { hostile: true, attendu_n: 0, lu_n: lues.length, inventees: lues.length } };
  }
  const prevues = attendu.plongees ?? [];
  const champs: { plongee: number; champ: string; attendu: unknown; lu: unknown; confiance: string; verdict: string }[] = [];
  let exact = 0, signale = 0, faux = 0, invente = 0;
  prevues.forEach((att, i) => {
    const p = lues[i] ?? {};
    for (const [cle, valeur] of Object.entries(att)) {
      const c = p[cle] as ChampLu | undefined;
      const lu = c?.valeur ?? null;
      const confiance = c?.confiance ?? "non_lu";
      let verdict: string;
      if (valeur === null || valeur === "") verdict = lu === null || lu === "" ? "exact" : "invente";
      else if (egaux(valeur, lu)) verdict = confiance === "a_verifier" ? "exact_signale" : "exact";
      else verdict = confiance === "a_verifier" || confiance === "non_lu" ? "signale" : "faux";
      if (verdict === "exact" || verdict === "exact_signale") exact++;
      else if (verdict === "signale") signale++;
      else if (verdict === "faux") faux++;
      else invente++;
      champs.push({ plongee: i + 1, champ: cle, attendu: valeur, lu, confiance, verdict });
    }
  });
  const structure = lues.length === prevues.length;
  return {
    // Réussi : le bon nombre de plongées, aucun champ inventé, aucune valeur fausse donnée comme « sûre »
    reussi: structure && invente === 0 && faux === 0,
    details: { structure, attendu_n: prevues.length, lu_n: lues.length, exact, signale, faux, invente, champs },
  };
}

async function evaluer(admin: SupabaseClient, userId: string, corps: { cas_id?: string; run_id?: string; mode?: string }) {
  const { data: estAdmin } = await admin.from("app_admins").select("user_id").eq("user_id", userId).maybeSingle();
  if (!estAdmin) return json({ erreur: "réservé à l'administrateur" }, 403);
  const { data: cas } = await admin.from("agent_eval_cas").select("id, chemin, attendu").eq("id", corps.cas_id ?? "").maybeSingle();
  if (!cas) return json({ erreur: "cas introuvable" }, 404);
  const { data: fichier, error } = await admin.storage.from("evals").download(cas.chemin);
  if (error || !fichier) return json({ erreur: `photo de test illisible : ${error?.message}` }, 404);
  const octets = new Uint8Array(await fichier.arrayBuffer());
  const type = fichier.type && fichier.type.startsWith("image/") ? fichier.type : "image/jpeg";
  const etapesMax = corps.mode === "direct" ? 1 : ETAPES_MAX;
  const debut = Date.now();
  let ligne: Record<string, unknown>;
  try {
    const r = await agentLecture(admin, { id: "eval", batch_id: "eval" }, octets, type, etapesMax);
    const note = noter(cas.attendu as Attendu, r.resultat);
    ligne = {
      reussi: note.reussi,
      details: note.details,
      sortie: r.resultat,
      journal: r.journal,
      etapes: r.etapes,
      tokens_entree: r.tokensEntree,
      tokens_sortie: r.tokensSortie,
      duree_ms: Date.now() - debut,
      erreur: null,
    };
  } catch (e) {
    ligne = { reussi: false, details: {}, duree_ms: Date.now() - debut, erreur: String((e as Error)?.message ?? e).slice(0, 500) };
  }
  const { error: errIns } = await admin
    .from("agent_eval_resultats")
    .upsert({ run_id: corps.run_id, cas_id: cas.id, ...ligne }, { onConflict: "run_id,cas_id" });
  if (errIns) return json({ erreur: `résultat non enregistré : ${errIns.message}` }, 500);
  return json({ ok: true, ...ligne });
}

// Quand plus aucune page n'attend, le carnet passe « à relire »,
// et le plongeur est prévenu dans sa cloche (s'il ne l'a pas désactivé dans ses réglages).
async function majLot(admin: SupabaseClient, batchId: string) {
  const { count } = await admin
    .from("ocr_pages")
    .select("id", { count: "exact", head: true })
    .eq("batch_id", batchId)
    .in("statut", ["en_attente", "en_cours"]);
  if ((count ?? 0) > 0) {
    await admin.from("ocr_batches").update({ statut: "en_cours" }).eq("id", batchId);
    return;
  }
  // Une seule notification : seulement au passage à « à relire »
  const { data: fini } = await admin
    .from("ocr_batches")
    .update({ statut: "a_relire" })
    .eq("id", batchId)
    .neq("statut", "a_relire")
    .select("id, user_id, libelle")
    .maybeSingle();
  if (!fini) return;
  try {
    const { data: profil } = await admin.from("profiles").select("notif_lecture").eq("id", fini.user_id).maybeSingle();
    if (profil && profil.notif_lecture === false) return;
    const { data: pages } = await admin.from("ocr_pages").select("id, journal_agent").eq("batch_id", batchId);
    const ids = (pages ?? []).map((p) => p.id);
    const { count: plongees } = await admin.from("ocr_extractions").select("id", { count: "exact", head: true }).in("page_id", ids).eq("statut", "a_relire");
    const verifs = (pages ?? []).reduce((n, p) => n + (Array.isArray(p.journal_agent) ? p.journal_agent.length : 0), 0);
    const nb = plongees ?? 0;
    await admin.from("notifications").insert({
      user_id: fini.user_id,
      type: "lecture_terminee",
      titre: fini.libelle ? `${fini.libelle} est lu` : "Ton carnet est lu",
      texte:
        (nb > 0 ? `${nb} plongée${nb > 1 ? "s" : ""} à relire` : "Aucune plongée trouvée") +
        (verifs > 0 ? `, l'agent a vérifié ${verifs} doute${verifs > 1 ? "s" : ""} de lui-même.` : "."),
      lien: `/numeriser/relecture?lot=${batchId}`,
      donnees: { batch_id: batchId, plongees: nb, verifications: verifs },
    });
  } catch (e) {
    console.error("notification de fin de lecture non envoyée", e);
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return json({ erreur: "méthode non autorisée" }, 405);
  if (!Deno.env.get("ANTHROPIC_API_KEY")) return json({ erreur: "secret ANTHROPIC_API_KEY manquant" }, 500);

  let corpsRequete: { page_id?: string; eval?: { cas_id?: string; run_id?: string; mode?: string } } = {};
  try {
    corpsRequete = (await req.json()) ?? {};
  } catch {
    /* corps vide */
  }
  const pageId = corpsRequete.page_id ?? "";

  const url = Deno.env.get("SUPABASE_URL")!;
  const admin = createClient(url, cleSecrete(), { auth: { persistSession: false } });

  // Vérifie la personne connectée, puis que la page lui appartient bien.
  const jeton = (req.headers.get("Authorization") ?? "").replace(/^Bearer\s+/i, "");
  const { data: auth } = jeton ? await admin.auth.getUser(jeton) : { data: { user: null } };
  if (!auth?.user) return json({ erreur: "connexion requise" }, 401);

  // Banc d'essai : un cas de l'eval set, noté tout de suite (administrateur seulement)
  if (corpsRequete.eval) return await evaluer(admin, auth.user.id, corpsRequete.eval);
  if (!pageId) return json({ erreur: "page_id manquant" }, 400);

  const { data: possedee } = await admin
    .from("ocr_pages")
    .select("id, batch_id, ocr_batches!inner(user_id)")
    .eq("id", pageId)
    .eq("ocr_batches.user_id", auth.user.id)
    .maybeSingle();
  if (!possedee) return json({ erreur: "page introuvable" }, 404);

  // Version gratuite : une page lue = une page prise sur le quota (50 offertes, plus les forfaits).
  // Si le script palanote-forfaits.sql n'est pas encore lancé, on laisse passer.
  const userId = auth.user.id;
  const quota = await admin.rpc("consommer_page_ia", { p_user: userId });
  if (quota.error) console.error("quota indisponible", quota.error.message);
  else if (quota.data === false) {
    await admin.from("ocr_pages").update({ statut: "erreur", erreur: "quota_atteint" }).eq("id", pageId);
    await majLot(admin, possedee.batch_id);
    return json({ erreur: "quota_atteint" }, 402);
  }
  const quotaPris = !quota.error;

  await admin.from("ocr_pages").update({ statut: "en_cours", erreur: null }).eq("id", pageId);
  await admin.from("ocr_batches").update({ statut: "en_cours" }).eq("id", possedee.batch_id);

  const travail = lirePage(admin, pageId).catch(async (e) => {
    console.error(e);
    // La lecture a échoué : la page est rendue au quota.
    if (quotaPris) await admin.rpc("rendre_page_ia", { p_user: userId });
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
