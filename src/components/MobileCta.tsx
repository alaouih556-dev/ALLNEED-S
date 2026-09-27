import { ArrowUpRight } from "lucide-react";
import { useAppStore } from "@/lib/store";

export function MobileCta() {
  const goToForm = useAppStore((s) => s.goToForm);
  const count = useAppStore((s) => s.selectedNeeds.length);

  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-0 z-30 p-3 pr-20 md:hidden">
      <button
        type="button"
        onClick={() => goToForm()}
        className="pointer-events-auto flex h-14 w-full items-center justify-center gap-2 rounded-lg font-display text-base font-semibold text-paper shadow-[0_12px_32px_rgba(7,23,47,0.28)] cta-gradient"
      >
        {count > 0
          ? `Continuer · ${count} besoin${count > 1 ? "s" : ""}`
          : "Identifier mes besoins"}
        <ArrowUpRight className="size-4" />
      </button>
    </div>
  );
}
