import { ArrowUpRight } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { PartnerLogoMark } from "@/components/PartnerCard";
import { CATEGORY_LABEL, PARTNER_BY_ID } from "@/data/partners";
import { SERVICE_BY_ID } from "@/data/services";
import { useAppStore } from "@/lib/store";

export function PartnerModal() {
  const id = useAppStore((s) => s.partnerModal);
  const openPartner = useAppStore((s) => s.openPartner);
  const goToForm = useAppStore((s) => s.goToForm);
  const partner = id ? PARTNER_BY_ID[id] : undefined;

  return (
    <Dialog open={!!id} onOpenChange={(open) => !open && openPartner(null)}>
      {partner ? (
        <DialogContent>
          <div className="overflow-y-auto px-6 py-8 md:px-10 md:py-10">
            <div className="flex flex-wrap items-start justify-between gap-4 pr-10">
              <PartnerLogoMark partner={partner} large />
              <span className="rounded-sm border border-royal/20 bg-ice px-3 py-1.5 font-display text-xs font-bold tracking-wider text-royal uppercase">
                {CATEGORY_LABEL[partner.category]}
              </span>
            </div>
            <DialogTitle className="mt-5 font-display text-3xl font-bold tracking-tight text-navy md:text-4xl">
              {partner.name}
            </DialogTitle>
            <DialogDescription className="mt-4 text-lead text-muted">
              {partner.intro}
            </DialogDescription>

            <section className="mt-8">
              <h3 className="font-display text-xl font-bold text-navy">
                Rôle & expertise
              </h3>
              <p className="mt-3 text-[1.08rem] leading-relaxed text-muted">
                {partner.role}
              </p>
            </section>

            <section className="mt-8">
              <h3 className="font-display text-xl font-bold text-navy">
                Comment ce partenaire peut accompagner les entreprises ?
              </h3>
              <ul className="mt-4 space-y-3">
                {partner.howHelps.map((item) => (
                  <li
                    key={item}
                    className="flex gap-3 border-l-2 border-electric pl-4 text-[1.05rem] text-navy"
                  >
                    {item}
                  </li>
                ))}
              </ul>
            </section>

            <section className="mt-8">
              <h3 className="font-display text-xl font-bold text-navy">
                Dans quels cas cela peut vous concerner ?
              </h3>
              <ul className="mt-4 grid gap-3 md:grid-cols-2">
                {partner.situations.map((item) => (
                  <li
                    key={item}
                    className="rounded-md border border-line bg-ice px-4 py-3 text-[1.02rem] text-navy"
                  >
                    {item}
                  </li>
                ))}
              </ul>
            </section>

            <section className="mt-8 rounded-lg bg-navy-deep p-6 text-paper">
              <h3 className="font-display text-xl font-bold text-paper">
                Comment ALLNEEDS intervient ?
              </h3>
              <p className="mt-3 text-[1.05rem] leading-relaxed text-paper/80">
                {partner.allneedsRole}
              </p>
            </section>

            {partner.relatedNeeds.length > 0 ? (
              <p className="mt-6 text-sm text-muted">
                Besoin ALLNEEDS souvent lié :{" "}
                {partner.relatedNeeds
                  .map((need) => SERVICE_BY_ID[need].formLabel)
                  .join(" · ")}
              </p>
            ) : null}

            <div className="mt-8">
              <Button
                size="lg"
                onClick={() => goToForm(partner.relatedNeeds)}
              >
                Présenter mon besoin
                <ArrowUpRight className="size-4" />
              </Button>
            </div>
          </div>
        </DialogContent>
      ) : null}
    </Dialog>
  );
}
