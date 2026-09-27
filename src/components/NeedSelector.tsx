import { Check } from "lucide-react";
import { MAX_NEEDS, SERVICES, type NeedId } from "@/data/services";
import { useAppStore } from "@/lib/store";
import { cn } from "@/lib/utils";

export function NeedSelector({ error }: { error?: string }) {
  const selected = useAppStore((s) => s.selectedNeeds);
  const toggleNeed = useAppStore((s) => s.toggleNeed);

  return (
    <fieldset data-need-selector>
      <legend className="mb-3 font-display text-[0.95rem] font-semibold text-navy">
        Vos besoins <span className="text-royal">*</span>
        <span className="ml-2 font-sans text-sm font-normal text-muted">
          Plusieurs choix possibles · {selected.length}/{MAX_NEEDS}
        </span>
      </legend>
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        {SERVICES.map((service) => {
          const on = selected.includes(service.id as NeedId);
          const full = !on && selected.length >= MAX_NEEDS;
          return (
            <button
              key={service.id}
              type="button"
              aria-pressed={on}
              onClick={() => toggleNeed(service.id)}
              className={cn(
                "flex min-h-16 items-center gap-3 rounded-md border px-4 py-3 text-left transition-all duration-150",
                on
                  ? "border-transparent text-paper cta-gradient shadow-[0_8px_20px_rgba(18,104,232,0.22)]"
                  : "border-line bg-paper text-navy hover:border-electric",
                full ? "opacity-60" : "",
              )}
            >
              <span
                className={cn(
                  "flex size-7 shrink-0 items-center justify-center rounded-sm border",
                  on
                    ? "border-paper/40 bg-paper text-royal"
                    : "border-line bg-ice",
                )}
              >
                {on ? <Check className="size-4" strokeWidth={2.4} /> : null}
              </span>
              <span>
                <span className="block font-display text-sm font-bold tracking-wide">
                  {service.number} {service.title}
                </span>
                <span
                  className={cn(
                    "block text-sm",
                    on ? "text-paper/80" : "text-muted",
                  )}
                >
                  {service.label ?? service.headline}
                </span>
              </span>
            </button>
          );
        })}
      </div>
      {error ? (
        <p className="mt-2 text-sm font-semibold text-destructive" role="alert">
          {error}
        </p>
      ) : null}
    </fieldset>
  );
}
