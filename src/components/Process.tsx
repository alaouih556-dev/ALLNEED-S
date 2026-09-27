import { Building2, ListChecks, Send, Handshake } from "lucide-react";
import { SectionHeader } from "@/components/SectionHeader";

const STEPS = [
  {
    n: "01",
    title: "Présentez votre situation",
    text: "Entreprise existante, création d'entreprise ou implantation : nous comprenons votre point de départ.",
    icon: Building2,
  },
  {
    n: "02",
    title: "Choisissez vos besoins",
    text: "Sélectionnez un ou plusieurs besoins dans la même demande.",
    icon: ListChecks,
  },
  {
    n: "03",
    title: "Envoyez votre demande",
    text: "Votre demande est préparée et transmise via WhatsApp.",
    icon: Send,
  },
  {
    n: "04",
    title: "Avançons ensemble",
    text: "Nous poursuivons l'échange autour des solutions adaptées à votre situation.",
    icon: Handshake,
  },
];

export function Process() {
  return (
    <section id="comment-ca-marche" className="bg-ice">
      <div className="container-site py-16 md:py-20">
        <SectionHeader
          eyebrow="Comment ça marche ?"
          title="Du besoin à la solution."
          description="Une démarche continue, pas quatre cases isolées. Vous restez maître de l'envoi : le message s'ouvre dans WhatsApp pour validation."
        />
        <div className="relative mt-12">
          <div
            aria-hidden
            className="pointer-events-none absolute top-12 right-[10%] left-[10%] z-0 hidden h-0.5 bg-linear-to-r from-royal via-electric to-cyan md:block"
            style={{ transform: "skewX(-18deg)" }}
          />
          <ol className="relative z-10 grid gap-5 md:grid-cols-4">
            {STEPS.map((step, i) => {
              const Icon = step.icon;
              return (
                <li
                  key={step.n}
                  className="relative rounded-lg border border-line bg-paper p-6"
                >
                  <div className="flex items-center justify-between">
                    <span className="flex size-12 items-center justify-center rounded-md bg-navy text-cyan">
                      <Icon className="size-6" strokeWidth={1.7} />
                    </span>
                    <span className="font-display text-3xl font-bold text-royal/30">
                      {step.n}
                    </span>
                  </div>
                  <h3 className="mt-5 font-display text-xl font-bold text-navy">
                    {step.title}
                  </h3>
                  <p className="mt-3 text-[1.05rem] leading-relaxed text-muted">
                    {step.text}
                  </p>
                  {i < STEPS.length - 1 ? (
                    <span className="mt-5 inline-block font-display text-xs font-bold tracking-widest text-electric uppercase md:hidden">
                      Étape suivante →
                    </span>
                  ) : null}
                </li>
              );
            })}
          </ol>
        </div>
      </div>
    </section>
  );
}
