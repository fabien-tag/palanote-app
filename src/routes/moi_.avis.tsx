import { useEffect, useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { CheckCircle2, ChevronLeft, MessageCircle } from "lucide-react";
import { Interrupteur } from "@/components/moi/Ui";
import { decrireAppareil, envoyerRetour, RAISONS_RETOUR, VERSION_APP } from "@/lib/suivi";
import { supabase } from "@/lib/supabase";

// « Dis-moi ce qui manque » : un retour privé, envoyé directement à l'auteur (maquette 53).
export const Route = createFileRoute("/moi_/avis")({
  head: () => ({ meta: [{ title: "Palanote — Dis-moi ce qui manque" }] }),
  component: DonnerMonAvis,
});

const MAX = 500;

function DonnerMonAvis() {
  const navigate = useNavigate();
  const [raison, setRaison] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  const [joindre, setJoindre] = useState(true);
  const [connecte, setConnecte] = useState(false);
  const [appareil, setAppareil] = useState({ appareil: "", systeme: "" });
  const [enCours, setEnCours] = useState(false);
  const [envoye, setEnvoye] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);

  useEffect(() => {
    setAppareil(decrireAppareil());
    void supabase.auth.getSession().then(({ data }) => {
      setConnecte(Boolean(data.session));
      if (!data.session) setJoindre(false);
    });
  }, []);

  const envoyer = async () => {
    if (!message.trim()) return setErreur("Écris quelques mots : c'est ça qui m'aide.");
    setEnCours(true);
    setErreur(null);
    try {
      await envoyerRetour({ raison, message, joindreEmail: joindre && connecte });
      setEnvoye(true);
    } catch (e) {
      console.error("Retour non envoyé", e);
      setErreur("Le message n'est pas parti. Vérifie ta connexion et réessaie.");
    } finally {
      setEnCours(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#F1F6FC] text-[#123A63]">
      <div className="cascade mx-auto flex min-h-screen w-full max-w-[430px] flex-col px-[22px] pb-[max(22px,env(safe-area-inset-bottom))] pt-[clamp(14px,2.6svh,22px)]">
        <div className="flex items-center gap-[14px]">
          <button
            type="button"
            aria-label="Retour"
            onClick={() => navigate({ to: "/moi" })}
            className="flex h-10 w-10 items-center justify-center rounded-[13px] bg-[#E3EDF6]"
          >
            <ChevronLeft className="h-[18px] w-[18px]" strokeWidth={2.4} />
          </button>
          <h1 className="text-[18px] font-bold">Dis-moi ce qui manque</h1>
        </div>

        {envoye ? (
          <div className="flex flex-grow flex-col items-center justify-center gap-[12px] pb-[10svh] text-center">
            <CheckCircle2 className="h-[54px] w-[54px] text-[#14B88A]" strokeWidth={1.8} />
            <h2 className="text-[22px] font-bold">Merci, c'est parti.</h2>
            <p className="text-[14px] leading-normal text-[#5B7189]">
              Ton message est arrivé chez l'auteur de l'app.
              {joindre && connecte ? " Il pourra te répondre par e-mail." : ""}
            </p>
            <button
              type="button"
              onClick={() => navigate({ to: "/carnet" })}
              className="mt-[10px] flex h-[54px] w-full items-center justify-center rounded-2xl bg-[#3DEFBE] text-[14px] font-bold text-[#0B3B63]"
            >
              REVENIR À MON CARNET
            </button>
          </div>
        ) : (
          <>
            <div className="mt-[20px] flex items-start gap-[13px]">
              <span className="flex h-[48px] w-[48px] shrink-0 items-center justify-center rounded-[15px] bg-[#FFE4DE]">
                <MessageCircle className="h-[22px] w-[22px] text-[#D9573F]" strokeWidth={2} aria-hidden="true" />
              </span>
              <p className="text-[13.5px] leading-normal text-[#5B7189]">
                Ce message part directement à l'auteur de l'app. Il n'apparaît nulle part, ni sur les stores, ni sur ton profil.
              </p>
            </div>

            <h2 className="pb-[10px] pt-[20px] text-[13px] font-bold">Qu'est-ce qui te bloque ?</h2>
            <div className="flex flex-wrap gap-[8px]">
              {RAISONS_RETOUR.map((r) => {
                const actif = raison === r;
                return (
                  <button
                    key={r}
                    type="button"
                    aria-pressed={actif}
                    onClick={() => setRaison(actif ? null : r)}
                    className={`h-[38px] rounded-full border-[1.5px] px-[14px] text-[13px] font-semibold ${
                      actif ? "border-[#0F3D70] bg-[#0F3D70] text-white" : "border-[#D8E5EE] bg-white text-[#5B7189]"
                    }`}
                  >
                    {r}
                  </button>
                );
              })}
            </div>

            <h2 className="pb-[10px] pt-[20px] text-[13px] font-bold">En quelques mots</h2>
            <div className="rounded-[18px] border border-[#DCE7F0] bg-white p-[14px]">
              <textarea
                value={message}
                onChange={(e) => setMessage(e.target.value.slice(0, MAX))}
                rows={5}
                placeholder="Je voudrais pouvoir exporter mon carnet en PDF pour le faire signer par mon club."
                className="block w-full resize-none bg-transparent text-[15px] leading-normal text-[#123A63] outline-none placeholder:text-[#B5C4D1]"
              />
              <div className="pt-[4px] text-right text-[11.5px] text-[#9DB0C0]">
                {message.length} / {MAX}
              </div>
            </div>

            {connecte && (
              <div className="mt-[14px] rounded-[18px] border border-[#DCE7F0] bg-white px-[14px]">
                <Interrupteur titre="Joindre mon adresse" texte="Pour qu'il puisse te répondre. Facultatif." actif={joindre} onChange={setJoindre} />
              </div>
            )}

            <div className="mt-[14px] rounded-[18px] border border-[#DCE7F0] bg-white p-[14px]">
              <div className="text-[13px] font-bold">Ce qui part avec ton message</div>
              <div className="flex flex-wrap gap-[6px] pt-[10px]">
                {[`Version ${VERSION_APP}`, appareil.appareil, appareil.systeme].filter(Boolean).map((t) => (
                  <span key={t} className="rounded-[10px] bg-[#EEF4F9] px-[10px] py-[5px] text-[12px] text-[#5B7189]">
                    {t}
                  </span>
                ))}
              </div>
              <p className="pt-[10px] text-[12px] leading-normal text-[#9DB0C0]">Rien d'autre. Pas ton carnet, pas tes photos, pas ta position.</p>
            </div>

            <div className="min-h-[24px] flex-grow" />
            {erreur && <p className="pb-[10px] text-center text-[13px] text-[#8A2A1A]">{erreur}</p>}
            <button
              type="button"
              disabled={enCours}
              onClick={() => void envoyer()}
              className="flex h-[56px] items-center justify-center rounded-2xl bg-[#3DEFBE] text-[14px] font-bold text-[#0B3B63] shadow-[0_6px_16px_rgba(61,239,190,.32)] disabled:opacity-60"
            >
              {enCours ? "ENVOI…" : "ENVOYER À L'AUTEUR"}
            </button>
            <button
              type="button"
              onClick={() => navigate({ to: "/carnet" })}
              className="mx-auto mt-[14px] text-[13px] font-semibold text-[#5B7189] underline underline-offset-4"
            >
              Revenir à mon carnet
            </button>
          </>
        )}
      </div>
    </div>
  );
}
