import { PARTNER_FILTERS, type PartnerCategory } from "@/data/partners";
import { cn } from "@/lib/utils";

type Props = {
  value: "tous" | PartnerCategory;
  onChange: (value: "tous" | PartnerCategory) => void;
};

export function PartnerFilters({ value, onChange }: Props) {
  return (
    <div
      className="-mx-4 mb-8 flex gap-2 overflow-x-auto px-4 pb-2 md:mx-0 md:flex-wrap md:overflow-visible md:px-0"
      role="tablist"
      aria-label="Filtrer les partenaires"
    >
      {PARTNER_FILTERS.map((filter) => {
        const active = value === filter.id;
        return (
          <button
            key={filter.id}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onChange(filter.id)}
            className={cn(
              "shrink-0 rounded-md border px-4 py-2.5 font-display text-sm font-semibold transition-colors",
              active
                ? "border-royal bg-royal text-paper"
                : "border-line bg-paper text-navy hover:border-electric",
            )}
          >
            {filter.label}
          </button>
        );
      })}
    </div>
  );
}
