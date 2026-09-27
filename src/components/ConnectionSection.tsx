import { ArrowDown, ArrowUpRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { MAX_NEEDS, SERVICES } from "@/data/services";
import { useAppStore } from "@/lib/store";

const OUTCOMES = ["Solutions", "Partenaires", "Accompagnement"];

export function ConnectionSection() {
  const goToForm = useAppStore((s) => s.goToForm);
  const setNeeds = useAppStore((s) => s.setNeeds);

  return (
    <section className="network-dark relative overflow-hidden text-paper">
      <div className="pointer-events-none absolute inset-0 diagonal-slash opacity-30" />
      <div className="container-site relative py-16 md:py-20">
        <div className="grid gap-10 lg:grid-cols-[1fr_1.15fr] lg:items-center">
          <div>
            <p className="eyebrow mb-4 text-cyan">Le cœur ALLNEEDS</p>
            <h2 className="text-section text-paper">
              Plusieurs besoins.
              <br />
              Un seul point de connexion.
            </h2>
            <p className="mt-5 text-lead text-paper/78">
              Votre entreprise peut avoir plusieurs priorités en même temps.
              ALLNEEDS centralise votre demande pour simplifier votre prochaine
              étape.
            </p>
            <p className="mt-6 inline-flex rounded-sm border border-cyan/30 bg-paper/8 px-4 py-2 font-display text-sm font-bold tracking-wide text-cyan uppercase">
              Jusqu'à {MAX_NEEDS} besoins dans une seule demande
            </p>
            <div className="mt-8">
              <Button
                size="lg"
                onClick={() => {
                  setNeeds(SERVICES.map((s) => s.id));
                  goToForm();
                }}
              >
                Centraliser mes besoins
                <ArrowUpRight className="size-4" />
              </Button>
            </div>
          </div>

          <div className="rounded-xl border border-paper/12 bg-navy/50 p-5 md:p-8">
            <div className="flex flex-col items-center gap-3 text-center">
              <div className="rounded-md border border-paper/15 bg-paper px-6 py-3 font-display text-lg font-bold text-navy">
                Votre situation
              </div>
              <ArrowDown className="size-5 text-cyan" />
              <div className="grid w-full grid-cols-2 gap-2 lg:grid-cols-4">
                {SERVICES.map((service) => (
                  <div
                    key={service.id}
                    className="rounded-md border border-electric/30 bg-navy-mid px-3 py-3 font-display text-sm font-semibold text-paper"
                  >
                    {service.shortTitle}
                  </div>
                ))}
              </div>
              <ArrowDown className="size-5 text-cyan" />
              <div className="relative w-full overflow-hidden rounded-lg border border-cyan/40 cta-gradient px-6 py-5 text-center">
                <p className="font-display text-xs font-bold tracking-[0.2em] text-paper/80">
                  POINT DE CONNEXION
                </p>
                <p className="mt-1 font-display text-3xl font-bold text-paper">
                  ALLNEEDS
                </p>
              </div>
              <ArrowDown className="size-5 text-cyan" />
              <div className="grid w-full grid-cols-3 gap-2">
                {OUTCOMES.map((item) => (
                  <div
                    key={item}
                    className="rounded-md border border-paper/15 bg-navy-deep px-2 py-4 font-display text-sm font-semibold text-cyan sm:text-base"
                  >
                    {item}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
