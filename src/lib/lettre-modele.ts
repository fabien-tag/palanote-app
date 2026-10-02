// MODELE-DEBUT — ce bloc est recopié tel quel dans supabase/functions/envoyer-lettre/index.ts
// Lettre annuelle : bilan de l'année + appel au Récif (maquette 56).

export type DestinataireLettre = {
  email: string;
  prenom: string | null;
  jeton: string;
  plongees: number;
  minutes: number;
  sites: number;
  profondeur: number | null;
};

const echapper = (t: string) => t.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

export function personnaliser(texte: string, d: Pick<DestinataireLettre, "prenom">) {
  return texte.replace(/\{prenom\}/gi, d.prenom || "plongeur");
}

export function lettreHtml(o: { sujet: string; contenu: string; annee: number; appUrl: string; d: DestinataireLettre }) {
  const { d, annee, appUrl } = o;
  const heures = Math.round((d.minutes || 0) / 60);
  const paragraphes = personnaliser(o.contenu, d)
    .split(/\n{2,}/)
    .map((p) => `<p style="margin:0 0 14px 0">${echapper(p.trim()).replace(/\n/g, "<br>")}</p>`)
    .join("");
  const tuile = (valeur: string, label: string, fond: string) =>
    `<td width="33%" style="padding:4px"><div style="background:${fond};border-radius:14px;padding:14px 6px;text-align:center"><div style="font-size:24px;font-weight:700;color:#123A63">${valeur}</div><div style="font-size:12px;color:#5B7189">${label}</div></div></td>`;
  const bilan =
    d.plongees > 0
      ? `<p style="margin:0 0 4px 0;font-size:12px;letter-spacing:.08em;color:#7D93A8;font-weight:700">SALUT ${echapper((d.prenom || "").toUpperCase())}</p>
         <p style="margin:0 0 16px 0;font-size:20px;font-weight:700;color:#123A63">Tu as passé ${heures} heure${heures > 1 ? "s" : ""} sous l'eau en ${annee}.</p>
         <table width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 18px 0"><tr>
           ${tuile(String(d.plongees), d.plongees > 1 ? "plongées" : "plongée", "#E2F8EF")}
           ${tuile(String(d.sites), d.sites > 1 ? "sites" : "site", "#E3F2FB")}
           ${tuile(d.profondeur ? `${String(Number(d.profondeur)).replace(".", ",")} m` : "—", "ta plus profonde", "#FFE9E2")}
         </tr></table>`
      : `<p style="margin:0 0 16px 0;font-size:20px;font-weight:700;color:#123A63">Salut ${echapper(d.prenom || "")} !</p>`;
  const desabo = `${appUrl}/desabonnement?jeton=${encodeURIComponent(d.jeton)}`;
  return `<!doctype html><html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>${echapper(o.sujet)}</title></head>
<body style="margin:0;background:#EEF3F8;font-family:-apple-system,Segoe UI,Helvetica,Arial,sans-serif;color:#123A63">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#EEF3F8;padding:24px 12px"><tr><td align="center">
<table width="100%" cellpadding="0" cellspacing="0" style="max-width:520px">
<tr><td style="background:#0F3D70;border-radius:22px 22px 0 0;padding:26px 24px 22px 24px;color:#ffffff">
  <div style="font-size:13px;opacity:.75">Palanote</div>
  <div style="font-size:24px;font-weight:700;padding-top:6px">Ton année de plongée ${annee}</div>
</td></tr>
<tr><td style="background:#ffffff;border-radius:0 0 22px 22px;padding:24px;font-size:15px;line-height:1.55;color:#3F5B76">
  ${bilan}
  ${paragraphes}
  <table width="100%" cellpadding="0" cellspacing="0" style="margin:8px 0 6px 0"><tr><td align="center" style="background:#3DEFBE;border-radius:14px">
    <a href="${appUrl}/recif" style="display:block;padding:15px 10px;font-size:14px;font-weight:700;color:#0B3B63;text-decoration:none;letter-spacing:.04em">REJOINDRE LE RÉCIF</a>
  </td></tr></table>
  <p style="margin:6px 0 0 0;font-size:12.5px;color:#9DB0C0;text-align:center">Et si tu préfères ne rien faire, l'app ne changera pas d'un pixel.</p>
</td></tr>
<tr><td style="padding:18px 10px;font-size:11.5px;line-height:1.5;color:#9DB0C0;text-align:center">
  Tu reçois ce message parce que tu as accepté de recevoir le bilan de ton année. C'est le seul de l'année.<br>
  <a href="${desabo}" style="color:#7D93A8">Ne plus recevoir ce bilan</a><br>Palanote · Fabien Tagliareni · France
</td></tr>
</table></td></tr></table></body></html>`;
}

export function lettreTexte(o: { contenu: string; annee: number; appUrl: string; d: DestinataireLettre }) {
  const { d } = o;
  const heures = Math.round((d.minutes || 0) / 60);
  const bilan = d.plongees > 0 ? `En ${o.annee} : ${d.plongees} plongée(s), ${d.sites} site(s), ${heures} h sous l'eau.\n\n` : "";
  return `Salut ${d.prenom || ""},\n\n${bilan}${personnaliser(o.contenu, d)}\n\nRejoindre le Récif : ${o.appUrl}/recif\n\nNe plus recevoir ce bilan : ${o.appUrl}/desabonnement?jeton=${d.jeton}`;
}
// MODELE-FIN
