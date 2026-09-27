import { SectionHeader } from "@/components/SectionHeader";
import { ServiceCard } from "@/components/ServiceCard";
import { SERVICES } from "@/data/services";

export function Services() {
  return (
    <section id="solutions" className="bg-ice">
      <div className="container-site py-16 md:py-20">
        <SectionHeader
          eyebrow="Vos besoins"
          title="Par quoi souhaitez-vous commencer ?"
          description="Un besoin ou plusieurs : sélectionnez les sujets qui concernent votre activité. L'assurance est le premier point d'entrée — les autres s'ajoutent dans la même demande."
        />
        <div className="mt-10 grid gap-5 min-[768px]:grid-cols-2 min-[1280px]:grid-cols-3 min-[1400px]:grid-cols-4">
          {SERVICES.map((service) => (
            <ServiceCard key={service.id} service={service} />
          ))}
        </div>
      </div>
    </section>
  );
}
