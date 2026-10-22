// Lien « Aller au contenu » (WCAG 2.4.1) : invisible tant qu'on ne navigue pas au clavier,
// il apparaît au premier appui sur Tab et saute le menu pour aller au contenu de l'écran.
// Cible : la zone marquée data-contenu (espace club, admin), sinon <main>, sinon le premier titre.
export function LienEvitement() {
  const aller = (e: React.MouseEvent<HTMLAnchorElement>) => {
    e.preventDefault();
    const cible =
      document.querySelector<HTMLElement>("[data-contenu]") ??
      document.querySelector<HTMLElement>("main") ??
      document.querySelector<HTMLElement>("h1");
    if (!cible) return;
    if (!cible.hasAttribute("tabindex")) cible.setAttribute("tabindex", "-1");
    cible.focus({ preventScroll: false });
    cible.scrollIntoView({ block: "start" });
  };
  return (
    <a href="#contenu" onClick={aller} className="lien-evitement">
      Aller au contenu
    </a>
  );
}
