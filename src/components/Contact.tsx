import { Mail, MapPin, MessageCircle, Phone } from "lucide-react";
import { CONTACT } from "@/config/contact";
import { Button } from "@/components/ui/button";
import { useAppStore } from "@/lib/store";

export function Contact() {
  const goToForm = useAppStore((s) => s.goToForm);

  return (
    <section id="contact" className="bg-paper">
      <div className="container-site py-16 md:py-20">
        <div className="grid gap-8 overflow-hidden rounded-xl border border-line lg:grid-cols-[1.1fr_0.9fr]">
          <div className="p-8 md:p-12">
            <p className="eyebrow mb-4">Contact</p>
            <h2 className="text-section">Une question ? Parlons-en.</h2>
            <p className="mt-5 max-w-xl text-lead text-muted">
              Pour une demande liée à vos besoins d'entreprise, le plus simple
              reste le formulaire. Les coordonnées ci-dessous seront confirmées
              dès qu'elles seront disponibles.
            </p>
            <Button className="mt-8" size="lg" onClick={() => goToForm()}>
              Identifier mes besoins
            </Button>
          </div>
          <ul className="grid gap-px bg-line sm:grid-cols-2 lg:grid-cols-1">
            <Item icon={Phone} label="Téléphone" value={CONTACT.phoneDisplay} />
            <Item
              icon={MessageCircle}
              label="WhatsApp"
              value={CONTACT.whatsappDisplay}
            />
            <Item icon={Mail} label="Email" value={CONTACT.emailDisplay} />
            <Item icon={MapPin} label="Localisation" value={CONTACT.city} />
          </ul>
        </div>
      </div>
    </section>
  );
}

function Item({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof Phone;
  label: string;
  value: string;
}) {
  return (
    <li className="flex items-start gap-4 bg-ice px-6 py-6">
      <span className="flex size-11 items-center justify-center rounded-md bg-paper text-royal">
        <Icon className="size-5" />
      </span>
      <span>
        <span className="block font-display text-xs font-bold tracking-[0.14em] text-royal uppercase">
          {label}
        </span>
        <span className="mt-1 block font-display text-lg font-semibold text-navy">
          {value}
        </span>
      </span>
    </li>
  );
}
