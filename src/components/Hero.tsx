import { ArrowRight, ArrowUpRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { NetworkDiagram } from "@/components/NetworkDiagram";
import { SERVICES } from "@/data/services";
import { useAppStore } from "@/lib/store";
import { scrollToId } from "@/lib/utils";

const REASSURANCE = [
  { k: "01", t: "Un seul contact" },
  { k: "02", t: "Plusieurs besoins" },
  { k: "03", t: "Un réseau de partenaires" },
];

export function Hero() {
  const openService = useAppStore((s) => s.openService);
  const goToForm = useAppStore((s) => s.goToForm);

  return (
    <section
      id="accueil"
      className="relative overflow-hidden network-dark text-paper"
    >
      <div className="pointer-events-none absolute inset-0 diagonal-slash opacity-40" />
      <div className="container-site relative grid items-center gap-10 py-14 lg:grid-cols-[1.12fr_0.88fr] lg:gap-12 lg:py-20">
        <div>
          <p className="mb-5 inline-flex items-center gap-2 rounded-sm border border-cyan/30 bg-paper/6 px-3 py-1.5 font-display text-[0.72rem] font-bold tracking-[0.14em] text-cyan uppercase">
            Le point de départ de vos besoins professionnels
          </p>
          <h1 className="text-display text-paper">
            Un besoin.
            <br />
            <span className="bg-linear-to-r from-electric to-cyan bg-clip-text text-transparent">
              La bonne connexion.
            </span>
          </h1>
          <p className="mt-6 max-w-xl text-lead text-paper/80">
            Que vous développiez une entreprise, prépariez sa création ou souhaitiez
            vous implanter au Maroc, ALLNEEDS vous oriente vers les solutions et
            partenaires adaptés à votre situation.
          </p>

          <ul className="mt-8 grid grid-cols-2 gap-2 sm:grid-cols-4">
            {SERVICES.map((service) => (
              <li key={service.id}>
                <button
                  type="button"
                  onClick={() => openService(service.id)}
                  className="flex h-full w-full items-center gap-2 rounded-md border border-paper/12 bg-paper/6 px-3 py-3 text-left transition-colors hover:border-cyan/50 hover:bg-paper/10"
                >
                  <span className="font-display text-xs font-bold text-cyan">
                    {service.number}
                  </span>
                  <span className="font-display text-sm font-semibold leading-tight text-paper">
                    {service.title}
                  </span>
                </button>
              </li>
            ))}
          </ul>

          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <Button size="lg" onClick={() => goToForm()}>
              Identifier mes besoins
              <ArrowUpRight className="size-4" />
            </Button>
            <Button
              size="lg"
              variant="outline"
              onClick={() => scrollToId("solutions")}
            >
              Découvrir nos solutions
              <ArrowRight className="size-4" />
            </Button>
          </div>

          <p className="mt-6 font-display text-sm tracking-wide text-paper/55 italic">
            Everything you need, right here.
          </p>

          <div className="mt-8 grid grid-cols-1 gap-px overflow-hidden rounded-md border border-paper/12 bg-paper/12 sm:grid-cols-3">
            {REASSURANCE.map((item) => (
              <div
                key={item.k}
                className="flex items-center gap-3 bg-navy-deep/70 px-4 py-4"
              >
                <span className="font-display text-xs font-bold text-cyan">
                  {item.k}
                </span>
                <span className="font-display text-sm font-semibold uppercase tracking-wide text-paper">
                  {item.t}
                </span>
              </div>
            ))}
          </div>
        </div>

        <div className="relative rounded-xl border border-paper/10 bg-navy/40 p-3 sm:p-5">
          <p className="mb-2 text-center font-display text-[0.7rem] font-bold tracking-[0.16em] text-cyan uppercase">
            Votre situation → besoins → ALLNEEDS → partenaires
          </p>
          <NetworkDiagram />
        </div>
      </div>
    </section>
  );
}
