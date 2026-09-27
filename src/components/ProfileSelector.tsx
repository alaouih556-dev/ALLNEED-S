import { ArrowUpRight, Building2, Globe, Rocket } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SectionHeader } from "@/components/SectionHeader";
import { PROFILES, type Profile } from "@/data/profiles";
import { useAppStore } from "@/lib/store";
import { cn } from "@/lib/utils";

const ICONS = {
  building: Building2,
  rocket: Rocket,
  globe: Globe,
} as const;

export function ProfileSelector() {
  const goToForm = useAppStore((s) => s.goToForm);
  const profile = useAppStore((s) => s.profile);

  return (
    <section id="situation" className="bg-ice">
      <div className="container-site py-16 md:py-20">
        <SectionHeader
          eyebrow="Votre situation"
          title="Où en êtes-vous dans votre projet ?"
          description="ALLNEEDS adapte votre point de départ à votre situation."
        />
        <div className="mt-12 grid gap-5 lg:grid-cols-3">
          {PROFILES.map((item, index) => (
            <ProfileCard
              key={item.id}
              profile={item}
              index={index}
              active={profile === item.id}
              onSelect={() => goToForm([], item.id)}
            />
          ))}
        </div>
      </div>
    </section>
  );
}

function ProfileCard({
  profile,
  index,
  active,
  onSelect,
}: {
  profile: Profile;
  index: number;
  active: boolean;
  onSelect: () => void;
}) {
  const Icon = ICONS[profile.icon];

  return (
    <div
      className={cn(
        "group relative flex h-full flex-col overflow-hidden rounded-lg border bg-paper p-6 md:p-7 transition-all duration-200",
        "hover:-translate-y-1 hover:border-electric hover:shadow-[0_18px_40px_rgba(18,104,232,0.14)]",
        active ? "border-electric ring-1 ring-electric/25" : "border-line",
      )}
    >
      <span
        aria-hidden
        className="pointer-events-none absolute -right-10 -top-12 h-32 w-44 rotate-[-32deg] bg-linear-to-r from-transparent via-electric/10 to-cyan/20 opacity-0 transition-opacity duration-200 group-hover:opacity-100"
      />
      <div className="flex items-start justify-between gap-4">
        <span className="flex size-14 items-center justify-center rounded-md bg-ice text-royal">
          <Icon className="size-7" strokeWidth={1.7} />
        </span>
        <span className="font-display text-3xl font-bold tracking-tight text-royal/25">
          0{index + 1}
        </span>
      </div>
      <h3 className="mt-5 font-display text-xl font-bold leading-snug text-navy md:text-2xl">
        {profile.title}
      </h3>
      <p className="mt-3 flex-1 text-[1.05rem] leading-relaxed text-muted">
        {profile.description}
      </p>
      {active ? (
        <p className="mt-4 inline-flex w-fit items-center gap-2 rounded-sm border border-electric/30 bg-ice px-3 py-1.5 font-display text-xs font-bold tracking-[0.14em] text-royal uppercase">
          Situation sélectionnée
        </p>
      ) : null}
      <Button
        size="lg"
        variant={active ? "primary" : "secondary"}
        onClick={onSelect}
        className="mt-6 w-full"
      >
        {profile.cta}
        <ArrowUpRight className="size-4" />
      </Button>
    </div>
  );
}
