import { SectionHeader } from "@/components/SectionHeader";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { FAQ_ITEMS } from "@/data/faq";

export function FAQ() {
  return (
    <section id="faq" className="bg-ice">
      <div className="container-site py-16 md:py-20">
        <SectionHeader
          title="Questions fréquentes"
          description="Des réponses claires, sans promesse excessive. ALLNEEDS oriente : les partenaires décident selon leurs propres règles."
        />
        <div className="mt-10 rounded-xl border border-line bg-paper px-5 md:px-8">
          <Accordion type="single" collapsible defaultValue="item-0">
            {FAQ_ITEMS.map((item, i) => (
              <AccordionItem key={item.question} value={`item-${i}`}>
                <AccordionTrigger>{item.question}</AccordionTrigger>
                <AccordionContent>
                  <div className="max-w-3xl space-y-4">
                    {item.answer.map((p) => (
                      <p key={p}>{p}</p>
                    ))}
                  </div>
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </div>
      </div>
    </section>
  );
}
