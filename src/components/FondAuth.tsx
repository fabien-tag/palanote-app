import fondAsset from "@/assets/BG.png";

/**
 * Fond plein écran des écrans de connexion : photo sous-marine officielle
 * + voile sombre en haut et en bas, comme sur les maquettes.
 */
export function FondAuth() {
  return (
    <>
      <img
        src={fondAsset}
        alt=""
        className="pointer-events-none absolute inset-0 h-full w-full object-cover"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "linear-gradient(180deg, rgba(4,18,38,.52) 0%, rgba(4,18,38,.12) 22%, rgba(4,18,38,0) 36%), linear-gradient(0deg, rgba(4,16,34,.66) 0%, rgba(4,16,34,.14) 24%, rgba(4,16,34,0) 42%)",
        }}
      />
    </>
  );
}
