import { Link, useLocation, useNavigate } from "@tanstack/react-router";
import { Logo } from "@/components/Logo";
import { CONTACT } from "@/config/contact";
import { scrollToId } from "@/lib/utils";

const NAV = [
  { id: "solutions", label: "Solutions" },
  { id: "partenaires", label: "Partenaires" },
  { id: "comment-ca-marche", label: "Comment ça marche" },
  { id: "faq", label: "FAQ" },
  { id: "contact", label: "Contact" },
  { id: "demande", label: "Identifier mes besoins" },
];

export function Footer() {
  const location = useLocation();
  const navigate = useNavigate();

  return (
    <footer className="network-dark relative overflow-hidden text-paper">
      <div className="pointer-events-none absolute inset-0 diagonal-slash opacity-25" />
      <div className="container-site relative grid gap-12 py-16 md:grid-cols-3 md:py-20">
        <div>
          <div className="inline-flex rounded-md bg-paper p-2">
            <Logo compact />
          </div>
          <p className="mt-5 font-display text-sm tracking-wide text-paper/60 italic">
            Everything you need, right here.
          </p>
          <p className="mt-4 max-w-sm text-[1.05rem] leading-relaxed text-paper/75">
            Un point d'entrée pour les besoins de votre entreprise.
          </p>
        </div>
        <div>
          <p className="font-display text-xs font-bold tracking-[0.16em] text-cyan uppercase">
            Navigation
          </p>
          <ul className="mt-4 space-y-2">
            {NAV.map((item) => (
              <li key={item.id}>
                <a
                  href={`/#${item.id}`}
                  className="text-[1.05rem] text-paper/80 hover:text-cyan"
                  onClick={(e) => {
                    e.preventDefault();
                    if (location.pathname !== "/") {
                      void navigate({ to: "/", hash: item.id });
                      return;
                    }
                    scrollToId(item.id);
                  }}
                >
                  {item.label}
                </a>
              </li>
            ))}
          </ul>
        </div>
        <div>
          <p className="font-display text-xs font-bold tracking-[0.16em] text-cyan uppercase">
            Contact
          </p>
          <ul className="mt-4 space-y-2 text-[1.05rem] text-paper/80">
            <li>{CONTACT.phoneDisplay}</li>
            <li>{CONTACT.emailDisplay}</li>
            <li>{CONTACT.city}</li>
            <li>{CONTACT.whatsappDisplay}</li>
          </ul>
        </div>
      </div>
      <div className="relative border-t border-paper/10">
        <div className="container-site flex flex-col gap-3 py-5 text-sm text-paper/55 md:flex-row md:items-center md:justify-between">
          <p>© 2026 ALLNEEDS. Tous droits réservés.</p>
          <div className="flex gap-5">
            <Link to="/mentions-legales" className="hover:text-cyan">
              Mentions légales
            </Link>
            <Link
              to="/politique-de-confidentialite"
              className="hover:text-cyan"
            >
              Politique de confidentialité
            </Link>
          </div>
        </div>
      </div>
    </footer>
  );
}
