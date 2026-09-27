import { useMemo, useState } from "react";
import { SectionHeader } from "@/components/SectionHeader";
import { PartnerNetwork } from "@/components/PartnerNetwork";
import { PartnerFilters } from "@/components/PartnerFilters";
import { PartnerCard } from "@/components/PartnerCard";
import { PARTNERS, type PartnerCategory } from "@/data/partners";

export function Partners() {
  const [filter, setFilter] = useState<"tous" | PartnerCategory>("tous");
  const list = useMemo(
    () =>
      filter === "tous"
        ? PARTNERS
        : PARTNERS.filter((partner) => partner.category === filter),
    [filter],
  );

  return (
    <section id="partenaires" className="bg-paper">
      <div className="container-site py-16 md:py-20">
        <SectionHeader
          eyebrow="Nos partenaires"
          title="Un réseau de partenaires au service de votre entreprise."
          description="ALLNEEDS réunit des acteurs institutionnels, économiques, financiers, académiques et privés afin de faciliter l'orientation des entreprises selon leurs besoins et leurs projets."
        />
        <div className="mt-10">
          <PartnerNetwork />
          <PartnerFilters value={filter} onChange={setFilter} />
          <p className="mb-5 text-sm font-semibold text-muted">
            {list.length} partenaire{list.length > 1 ? "s" : ""} affiché
            {list.length > 1 ? "s" : ""}
            {filter !== "tous" ? " dans cette catégorie" : " — réseau complet"}
          </p>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:gap-4 lg:grid-cols-4 2xl:grid-cols-5">
            {list.map((partner) => (
              <PartnerCard key={partner.id} partner={partner} />
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
