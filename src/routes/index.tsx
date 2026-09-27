import { useEffect } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { Navbar } from "@/components/Navbar";
import { Hero } from "@/components/Hero";
import { ProfileSelector } from "@/components/ProfileSelector";
import { BusinessStrip } from "@/components/BusinessStrip";
import { Services } from "@/components/Services";
import { ServiceModal } from "@/components/ServiceModal";
import { ConnectionSection } from "@/components/ConnectionSection";
import { Partners } from "@/components/Partners";
import { PartnerModal } from "@/components/PartnerModal";
import { Process } from "@/components/Process";
import { WhyAllNeeds } from "@/components/WhyAllNeeds";
import { BusinessSituations } from "@/components/BusinessSituations";
import { CreationSection } from "@/components/CreationSection";
import { InvestorSection } from "@/components/InvestorSection";
import { LeadForm } from "@/components/LeadForm";
import { FAQ } from "@/components/FAQ";
import { Contact } from "@/components/Contact";
import { Footer } from "@/components/Footer";
import { MobileCta } from "@/components/MobileCta";
import { scrollToId } from "@/lib/utils";

const DESCRIPTION =
  "ALLNEEDS centralise les besoins des entreprises, des créateurs d'entreprise et des investisseurs étrangers, et facilite leur orientation vers des solutions et partenaires adaptés : assurance, fournisseurs, communication & digital, formation, recrutement, financement & aides, accompagnement commercial, comptabilité & gestion fiscale.";

export const Route = createFileRoute("/")({
  component: Home,
  head: () => ({
    meta: [
      { title: "ALLNEEDS | Solutions pour entreprises" },
      { name: "description", content: DESCRIPTION },
    ],
  }),
});

function Home() {
  useEffect(() => {
    const hash = window.location.hash.replace("#", "");
    if (hash) {
      requestAnimationFrame(() => scrollToId(hash));
    }
  }, []);

  return (
    <>
      <Navbar />
      <main className="pb-24 md:pb-0">
        <Hero />
        <ProfileSelector />
        <BusinessStrip />
        <Services />
        <ConnectionSection />
        <Partners />
        <Process />
        <WhyAllNeeds />
        <BusinessSituations />
        <CreationSection />
        <InvestorSection />
        <LeadForm />
        <FAQ />
        <Contact />
      </main>
      <Footer />
      <MobileCta />
      <ServiceModal />
      <PartnerModal />
    </>
  );
}
