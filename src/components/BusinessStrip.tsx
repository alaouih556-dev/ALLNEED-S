import { ArrowRight } from "lucide-react";
import { useAppStore } from "@/lib/store";
import type { NeedId } from "@/data/services";

const EXAMPLES: { label: string; need: NeedId }[] = [
  { label: "Protéger mon activité", need: "assurance" },
  { label: "Trouver un fournisseur", need: "fournisseurs" },
  { label: "Développer ma visibilité", need: "digital" },
  { label: "Former mon équipe", need: "formation" },
  { label: "Recruter", need: "recrutement" },
  { label: "Financer un projet", need: "financement" },
  { label: "Structurer ma prospection", need: "commercial" },
  { label: "Organiser ma comptabilité", need: "comptabilite" },
];

export function BusinessStrip() {
  const openService = useAppStore((s) => s.openService);

  return (
    <section className="border-b border-line bg-paper">
      <div className="container-site py-10 md:py-12">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-2xl">
            <p className="eyebrow mb-3">Le pont</p>
            <h2 className="font-display text-3xl font-bold tracking-tight text-navy md:text-4xl">
              Votre projet avance. Ses besoins évoluent.
            </h2>
          </div>
          <p className="max-w-md text-lead text-muted">
            ALLNEEDS vous permet de commencer au même endroit — quel que soit le
            sujet, ou le nombre de sujets.
          </p>
        </div>
        <div className="mt-8 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {EXAMPLES.map((item, i) => (
            <button
              key={item.need}
              type="button"
              onClick={() => openService(item.need)}
              className="group flex min-h-28 flex-col justify-between rounded-lg border border-line bg-ice p-4 text-left transition-all duration-200 hover:-translate-y-0.5 hover:border-electric hover:shadow-[0_12px_28px_rgba(18,104,232,0.12)]"
            >
              <span className="font-display text-xs font-bold text-royal">
                0{i + 1}
              </span>
              <span className="font-display text-base font-semibold leading-snug text-navy">
                {item.label}
              </span>
              <span className="inline-flex items-center gap-1 text-sm font-semibold text-royal">
                Voir
                <ArrowRight className="size-3.5 transition-transform group-hover:translate-x-1" />
              </span>
            </button>
          ))}
        </div>
      </div>
    </section>
  );
}
