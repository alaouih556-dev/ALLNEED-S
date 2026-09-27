import { ArrowRight } from "lucide-react";
import {
  Shield,
  Boxes,
  Megaphone,
  GraduationCap,
  UserPlus,
  Landmark,
  Handshake,
  Calculator,
} from "lucide-react";
import type { Service } from "@/data/services";
import { useAppStore } from "@/lib/store";
import { cn } from "@/lib/utils";

const ICONS = {
  assurance: Shield,
  fournisseurs: Boxes,
  digital: Megaphone,
  formation: GraduationCap,
  recrutement: UserPlus,
  financement: Landmark,
  commercial: Handshake,
  comptabilite: Calculator,
} as const;

export function ServiceCard({ service }: { service: Service }) {
  const openService = useAppStore((s) => s.openService);
  const selected = useAppStore((s) => s.selectedNeeds.includes(service.id));
  const Icon = ICONS[service.id];
  const priority = service.id === "assurance";

  return (
    <button
      type="button"
      onClick={() => openService(service.id)}
      className={cn(
        "group relative flex h-full flex-col overflow-hidden rounded-lg border bg-paper p-6 text-left transition-all duration-200",
        "hover:-translate-y-1 hover:border-electric hover:shadow-[0_18px_40px_rgba(18,104,232,0.14)]",
        selected ? "border-electric" : priority ? "border-royal/30" : "border-line",
        priority && !selected ? "shadow-[0_10px_28px_rgba(18,104,232,0.08)] ring-1 ring-royal/10" : "",
      )}
    >
      <span
        aria-hidden
        className="pointer-events-none absolute -right-8 -top-10 h-28 w-40 rotate-[-32deg] bg-linear-to-r from-transparent via-electric/10 to-cyan/20 opacity-0 transition-opacity duration-200 group-hover:opacity-100"
      />
      <div className="flex items-start justify-between gap-4">
        <div className="flex size-14 items-center justify-center rounded-md bg-ice text-royal transition-transform duration-200 group-hover:scale-105 group-hover:text-electric">
          <Icon className="size-7" strokeWidth={1.7} />
        </div>
        <span className="font-display text-3xl font-bold tracking-tight text-royal/25">
          {service.number}
        </span>
      </div>
      <p className="mt-5 font-display text-sm font-bold tracking-[0.14em] text-royal uppercase">
        {service.title}
      </p>
      {service.label ? (
        <p className="mt-1 text-sm font-semibold text-muted">{service.label}</p>
      ) : null}
      <h3 className="mt-3 font-display text-xl font-bold leading-snug text-navy md:text-2xl">
        {service.headline}
      </h3>
      <p className="mt-3 flex-1 text-[1.05rem] leading-relaxed text-muted">
        {service.description}
      </p>
      <ul className="mt-5 flex flex-wrap gap-2">
        {service.tags.map((tag) => (
          <li
            key={tag}
            className="rounded-sm border border-line bg-ice px-2.5 py-1 text-sm font-medium text-navy"
          >
            {tag}
          </li>
        ))}
      </ul>
      <span className="mt-6 inline-flex items-center gap-2 font-display text-base font-semibold text-royal">
        Découvrir
        <ArrowRight className="size-4 transition-transform duration-200 group-hover:translate-x-1.5" />
      </span>
    </button>
  );
}
