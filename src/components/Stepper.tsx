export function Stepper({ etape }: { etape: 1 | 2 }) {
  return (
    <div className="mt-[18px] flex gap-1.5" aria-hidden="true">
      <div
        className={`h-[5px] flex-grow rounded-[3px] ${
          etape >= 1 ? "bg-menthe" : "bg-blanc/25"
        }`}
      />
      <div
        className={`h-[5px] flex-grow rounded-[3px] ${
          etape >= 2 ? "bg-menthe" : "bg-blanc/25"
        }`}
      />
    </div>
  );
}
