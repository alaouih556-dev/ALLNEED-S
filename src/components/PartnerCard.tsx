import { useEffect, useState } from "react";
import { ArrowRight } from "lucide-react";
import { CATEGORY_LABEL, type Partner } from "@/data/partners";
import { useAppStore } from "@/lib/store";
import { cn } from "@/lib/utils";

export function PartnerLogoMark({
  partner,
  large = false,
}: {
  partner: Partner;
  large?: boolean;
}) {
  const [logoReady, setLogoReady] = useState(false);

  useEffect(() => {
    if (!partner.logo) {
      setLogoReady(false);
      return;
    }

    let cancelled = false;
    const probe = new Image();
    probe.onload = () => {
      if (!cancelled) setLogoReady(true);
    };
    probe.onerror = () => {
      if (!cancelled) setLogoReady(false);
    };
    probe.src = partner.logo;

    return () => {
      cancelled = true;
    };
  }, [partner.logo]);

  if (!partner.logo || !logoReady) {
    return (
      <span
        className={cn(
          "inline-flex items-center justify-center rounded-md border border-line bg-ice px-4 font-display font-bold tracking-tight text-navy",
          large ? "h-16 min-w-32 text-xl" : "h-11 min-w-28 text-[0.95rem]",
        )}
      >
        {partner.shortName}
      </span>
    );
  }

  return (
    <img
      src={partner.logo}
      alt={`Logo ${partner.name}`}
      loading="lazy"
      decoding="async"
      onError={() => setLogoReady(false)}
      className={cn(
        "object-contain",
        partner.id === "maroc-pme" || partner.id === "rma" ? "scale-[1.3]" : "",
        large
          ? "h-auto max-h-16 max-w-48"
          : "h-11 w-full max-w-[9.5rem] max-h-11",
      )}
    />
  );
}

export function PartnerCard({ partner }: { partner: Partner }) {
  const openPartner = useAppStore((s) => s.openPartner);

  return (
    <button
      type="button"
      onClick={() => openPartner(partner.id)}
      className="group relative flex h-48 flex-col items-center overflow-hidden rounded-lg border border-line bg-paper px-4 pt-6 pb-4 text-center transition-all duration-200 hover:-translate-y-0.5 hover:border-electric hover:shadow-[0_16px_36px_rgba(18,104,232,0.14)] md:h-52"
    >
      <div className="flex h-14 w-full items-center justify-center">
        <PartnerLogoMark partner={partner} />
      </div>
      <h3 className="mt-4 line-clamp-2 px-1 font-display text-sm font-bold leading-snug text-navy md:text-[0.95rem]">
        {partner.name}
      </h3>
      <p className="mt-auto pt-2 font-display text-[0.68rem] font-bold tracking-[0.12em] text-royal uppercase">
        {CATEGORY_LABEL[partner.category]}
      </p>

      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 flex flex-col justify-end bg-linear-to-t from-navy-deep via-navy-deep/94 to-navy-deep/55 p-4 text-left opacity-0 transition-opacity duration-200 group-hover:opacity-100 group-focus-visible:opacity-100"
      >
        <p className="font-display text-[0.66rem] font-bold tracking-[0.14em] text-cyan uppercase">
          {CATEGORY_LABEL[partner.category]}
        </p>
        <p className="mt-1.5 line-clamp-3 text-xs leading-relaxed text-paper/85">
          {partner.summary}
        </p>
        <span className="mt-2 inline-flex items-center gap-1.5 font-display text-xs font-semibold text-cyan">
          Découvrir
          <ArrowRight className="size-3 transition-transform group-hover:translate-x-1" />
        </span>
      </div>
    </button>
  );
}


