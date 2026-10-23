// Sur iPhone, Safari zoome sur un champ dont le texte fait moins de 16 px, et ne dézoome pas ensuite.
// Sur les écrans tactiles, on monte donc ces champs à 16 px (les plus grands gardent leur taille).
// On ne bloque pas le zoom avec le pincement : il reste possible (accessibilité, WCAG 1.4.4).

const EXCLUS = new Set(["checkbox", "radio", "file", "hidden", "range", "color", "button", "submit"]);

function ajuster(el: Element) {
  if (!(el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement || el instanceof HTMLSelectElement)) return;
  if (el instanceof HTMLInputElement && EXCLUS.has(el.type)) return;
  if (parseFloat(getComputedStyle(el).fontSize) < 16) el.style.fontSize = "16px";
}

function parcourir(racine: ParentNode) {
  racine.querySelectorAll("input, textarea, select").forEach(ajuster);
}

export function eviterZoomChamps() {
  if (typeof window === "undefined" || !window.matchMedia("(pointer: coarse)").matches) return () => undefined;
  parcourir(document);
  const obs = new MutationObserver((changes) => {
    for (const c of changes)
      c.addedNodes.forEach((n) => {
        if (n instanceof Element) {
          ajuster(n);
          parcourir(n);
        }
      });
  });
  obs.observe(document.body, { childList: true, subtree: true });
  // Filet de sécurité : juste avant le toucher qui donne le focus
  const avantFocus = (e: Event) => e.target instanceof Element && ajuster(e.target);
  document.addEventListener("touchstart", avantFocus, { capture: true, passive: true });
  return () => {
    obs.disconnect();
    document.removeEventListener("touchstart", avantFocus, { capture: true });
  };
}
