import { useEffect, useRef, useState } from "react";
import { Eraser } from "lucide-react";

// Zone de signature au doigt, au stylet ou à la souris. Renvoie une image PNG (data URL).
export function PadSignature({ onChange }: { onChange: (png: string | null) => void }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const dessin = useRef(false);
  const [vide, setVide] = useState(true);

  useEffect(() => {
    const c = ref.current!;
    const r = c.getBoundingClientRect();
    const k = 2; // assez net pour l'impression, image légère
    c.width = r.width * k;
    c.height = r.height * k;
    const ctx = c.getContext("2d")!;
    ctx.scale(k, k);
    ctx.lineWidth = 2.4;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.strokeStyle = "#0F2B4C";
  }, []);

  const point = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  };

  const effacer = () => {
    const c = ref.current!;
    c.getContext("2d")!.clearRect(0, 0, c.width, c.height);
    setVide(true);
    onChange(null);
  };

  return (
    <div>
      <div className="relative">
        <canvas
          ref={ref}
          aria-label="Zone de signature"
          className="block h-[170px] w-full touch-none rounded-[10px] border-[1.5px] border-dashed border-[#B5C9DA] bg-[#F7FBFE]"
          onPointerDown={(e) => {
            e.currentTarget.setPointerCapture(e.pointerId);
            dessin.current = true;
            const ctx = e.currentTarget.getContext("2d")!;
            const p = point(e);
            ctx.beginPath();
            ctx.moveTo(p.x, p.y);
            ctx.lineTo(p.x + 0.1, p.y + 0.1);
            ctx.stroke();
          }}
          onPointerMove={(e) => {
            if (!dessin.current) return;
            const ctx = e.currentTarget.getContext("2d")!;
            const p = point(e);
            ctx.lineTo(p.x, p.y);
            ctx.stroke();
          }}
          onPointerUp={(e) => {
            if (!dessin.current) return;
            dessin.current = false;
            setVide(false);
            onChange(e.currentTarget.toDataURL("image/png"));
          }}
        />
        {vide && (
          <span className="pointer-events-none absolute inset-0 flex items-center justify-center text-[13px] text-[#9DB0C0]">Signe ici avec le doigt ou la souris</span>
        )}
      </div>
      <button type="button" onClick={effacer} className="mt-[8px] flex items-center gap-[5px] text-[12.5px] font-semibold text-[#5B7189]">
        <Eraser className="h-[14px] w-[14px]" /> Effacer
      </button>
    </div>
  );
}
