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
          description="Sélectionnez les sujets qui concernent votre activité, puis cochez vos demandes courantes. Vous pouvez préciser un besoin particulier. Pour la création d'entreprise et les questions juridiques, nous vous orientons vers des spécialistes."
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
