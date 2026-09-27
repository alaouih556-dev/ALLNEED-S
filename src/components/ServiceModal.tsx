import { ArrowUpRight, Check } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { SERVICES, SERVICE_BY_ID } from "@/data/services";
import { PARTNERS } from "@/data/partners";
import { useAppStore } from "@/lib/store";

export function ServiceModal() {
  const id = useAppStore((s) => s.serviceModal);
  const openService = useAppStore((s) => s.openService);
  const addNeed = useAppStore((s) => s.addNeed);
  const selected = useAppStore((s) => s.selectedNeeds);
  const goToForm = useAppStore((s) => s.goToForm);
  const openPartner = useAppStore((s) => s.openPartner);
  const service = id ? SERVICE_BY_ID[id] : undefined;

  const related = service
    ? PARTNERS.filter((p) => service.relatedPartners.includes(p.id))
    : [];
  const isSelected = service ? selected.includes(service.id) : false;

  return (
    <Dialog open={!!id} onOpenChange={(open) => !open && openService(null)}>
      {service ? (
        <DialogContent>
          <div className="overflow-y-auto px-6 py-8 md:px-10 md:py-10">
            <p className="font-display text-sm font-bold tracking-[0.16em] text-royal uppercase">
              {service.number} — {service.title}
            </p>
            <DialogTitle className="mt-3 font-display text-3xl font-bold tracking-tight text-navy md:text-4xl">
              {service.headline}
            </DialogTitle>
            <DialogDescription className="mt-4 text-lead text-muted">
              {service.description}
            </DialogDescription>

            <div className="mt-8 grid gap-8 md:grid-cols-2">
              <div>
                <h3 className="font-display text-lg font-bold text-navy">
                  Exemples de situations
                </h3>
                <ul className="mt-4 space-y-3">
                  {service.situations.map((item) => (
                    <li
                      key={item}
                      className="flex gap-3 rounded-md border border-line bg-ice px-4 py-3 text-[1.05rem] text-navy"
                    >
                      <span className="mt-1.5 size-2 shrink-0 rotate-45 bg-electric" />
                      {item}
                    </li>
                  ))}
                </ul>
              </div>
              <div>
                <h3 className="font-display text-lg font-bold text-navy">
                  Ce que cela peut couvrir
                </h3>
                <ul className="mt-4 flex flex-wrap gap-2">
                  {service.tags.map((tag) => (
                    <li
                      key={tag}
                      className="rounded-sm border border-royal/20 bg-paper px-3 py-2 text-sm font-semibold text-navy"
                    >
                      {tag}
                    </li>
                  ))}
                </ul>
                {related.length > 0 ? (
                  <div className="mt-8">
                    <h3 className="font-display text-lg font-bold text-navy">
                      Partenaires souvent concernés
                    </h3>
                    <p className="mt-2 text-sm text-muted">
                      Sans exclusivité. L'orientation dépend de votre situation.
                    </p>
                    <ul className="mt-3 space-y-2">
                      {related.map((partner) => (
                        <li key={partner.id}>
                          <button
                            type="button"
                            className="w-full rounded-md border border-line px-3 py-3 text-left font-semibold text-navy hover:border-electric"
                            onClick={() => openPartner(partner.id)}
                          >
                            {partner.shortName}
                            <span className="mt-0.5 block text-sm font-normal text-muted">
                              {partner.summary}
                            </span>
                          </button>
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : null}
              </div>
            </div>

            <div className="mt-10 flex flex-col gap-3 sm:flex-row">
              <Button
                size="lg"
                onClick={() => {
                  addNeed(service.id);
                  goToForm([service.id]);
                }}
              >
                {isSelected ? (
                  <>
                    <Check className="size-4" /> Continuer vers la demande
                  </>
                ) : (
                  <>
                    {service.cta} <ArrowUpRight className="size-4" />
                  </>
                )}
              </Button>
              <Button
                size="lg"
                variant="secondary"
                onClick={() => {
                  addNeed(service.id);
                  const next = SERVICES.find(
                    (s) => !selected.includes(s.id) && s.id !== service.id,
                  );
                  openService(next ? next.id : null);
                }}
              >
                Ajouter et voir un autre besoin
              </Button>
            </div>
          </div>
        </DialogContent>
      ) : null}
    </Dialog>
  );
}
