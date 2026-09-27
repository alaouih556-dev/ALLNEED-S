import { ArrowUpRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SectionHeader } from "@/components/SectionHeader";
import type { NeedId } from "@/data/services";
import type { ProfileId } from "@/data/profiles";
import { useAppStore } from "@/lib/store";

export type PathwayStep = {
  n: string;
  title: string;
  text: string;
};

export type PathwayProps = {
  id: string;
  eyebrow: string;
  headline: string;
  copy: string;
  steps: PathwayStep[];
  areas: string[];
  areasLabel: string;
  cta: string;
  profile: ProfileId;
  suggestedNeeds: NeedId[];
  className?: string;
};

export function PathwaySection({
  id,
  eyebrow,
  headline,
  copy,
  steps,
  areas,
  areasLabel,
  cta,
  profile,
  suggestedNeeds,
  className,
}: PathwayProps) {
  const goToForm = useAppStore((s) => s.goToForm);

  return (
    <section id={id} className={className}>
      <div className="container-site py-16 md:py-20">
        <SectionHeader eyebrow={eyebrow} title={headline} description={copy} />

        <ol className="mt-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {steps.map((step) => (
            <li
              key={step.n}
              className="flex h-full flex-col rounded-lg border border-line bg-paper p-6 shadow-[0_10px_28px_rgba(7,23,47,0.06)] transition-all duration-200 hover:border-electric hover:shadow-[0_14px_32px_rgba(18,104,232,0.12)]"
            >
              <span className="flex size-11 items-center justify-center rounded-md bg-navy font-display text-sm font-bold text-cyan">
                {step.n}
              </span>
              <h3 className="mt-5 font-display text-lg font-bold tracking-wide text-navy uppercase">
                {step.title}
              </h3>
              <p className="mt-3 text-[1.05rem] leading-relaxed text-muted">
                {step.text}
              </p>
            </li>
          ))}
        </ol>

        <div className="mt-12 grid gap-8 rounded-xl border border-line bg-ice p-6 md:p-8 lg:grid-cols-[1.25fr_0.75fr] lg:items-center">
          <div>
            <p className="font-display text-xs font-bold tracking-[0.16em] text-royal uppercase">
              {areasLabel}
            </p>
            <ul className="mt-4 flex flex-wrap gap-2">
              {areas.map((area) => (
                <li
                  key={area}
                  className="rounded-sm border border-line bg-paper px-3 py-1.5 text-sm font-semibold text-navy"
                >
                  {area}
                </li>
              ))}
            </ul>
          </div>
          <div className="lg:justify-self-end">
            <Button
              size="lg"
              onClick={() => goToForm(suggestedNeeds, profile)}
              className="w-full sm:w-auto"
            >
              {cta}
              <ArrowUpRight className="size-4" />
            </Button>
          </div>
        </div>
      </div>
    </section>
  );
}
