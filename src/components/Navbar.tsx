import { useEffect, useState } from "react";
import { useLocation, useNavigate } from "@tanstack/react-router";
import { Menu, X, ArrowUpRight } from "lucide-react";
import { Logo } from "@/components/Logo";
import { Button } from "@/components/ui/button";
import { useAppStore } from "@/lib/store";
import { cn, scrollToId } from "@/lib/utils";

const LINKS = [
  { href: "accueil", label: "Accueil" },
  { href: "solutions", label: "Solutions" },
  { href: "partenaires", label: "Partenaires" },
  { href: "comment-ca-marche", label: "Comment ça marche" },
  { href: "pourquoi-allneeds", label: "Pourquoi ALLNEEDS" },
  { href: "faq", label: "FAQ" },
  { href: "contact", label: "Contact" },
];

export function Navbar() {
  const [compact, setCompact] = useState(false);
  const [active, setActive] = useState("accueil");
  const mobileNav = useAppStore((s) => s.mobileNav);
  const setMobileNav = useAppStore((s) => s.setMobileNav);
  const goToForm = useAppStore((s) => s.goToForm);
  const location = useLocation();
  const navigate = useNavigate();

  useEffect(() => {
    const onScroll = () => {
      setCompact(window.scrollY > 18);
      const marker = window.scrollY + 140;
      let current = "accueil";
      for (const link of LINKS) {
        const el = document.getElementById(link.href);
        if (el && el.offsetTop <= marker) current = link.href;
      }
      const form = document.getElementById("demande");
      if (form && form.offsetTop <= marker) current = "contact";
      setActive(current);
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    document.body.style.overflow = mobileNav ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [mobileNav]);

  const go = (id: string) => {
    setMobileNav(false);
    if (location.pathname !== "/") {
      void navigate({ to: "/", hash: id });
      return;
    }
    scrollToId(id);
  };

  return (
    <header
      className={cn(
        "sticky top-0 z-40 border-b transition-[background-color,box-shadow] duration-200",
        compact
          ? "border-line/80 bg-paper/94 shadow-[0_8px_24px_rgba(7,23,47,0.06)]"
          : "border-transparent bg-paper/88",
      )}
    >
      <a
        href="#solutions"
        className="sr-only focus:not-sr-only focus:absolute focus:top-2 focus:left-2 focus:z-50 focus:bg-paper focus:px-3 focus:py-2"
      >
        Aller au contenu
      </a>
      <div
        className={cn(
          "container-wide flex items-center justify-between gap-4",
          compact ? "h-[4.5rem]" : "h-[5.25rem]",
        )}
      >
        <a
          href="#accueil"
          className="flex shrink-0 items-center"
          onClick={(e) => {
            e.preventDefault();
            go("accueil");
          }}
        >
          <Logo compact={compact} />
        </a>

        <nav
          className="hidden items-center gap-0.5 xl:flex"
          aria-label="Navigation principale"
        >
          {LINKS.map((link) => (
            <a
              key={link.href}
              href={`#${link.href}`}
              onClick={(e) => {
                e.preventDefault();
                go(link.href);
              }}
              className={cn(
                "rounded-sm px-2.5 py-2 text-[0.92rem] font-semibold text-muted transition-colors hover:text-navy",
                active === link.href && "text-royal",
              )}
            >
              {link.label}
            </a>
          ))}
        </nav>

        <div className="flex items-center gap-2">
          <Button
            size={compact ? "sm" : "md"}
            className="hidden sm:inline-flex"
            onClick={() => {
              if (location.pathname !== "/") {
                void navigate({ to: "/", hash: "demande" });
                return;
              }
              goToForm();
            }}
          >
            Identifier mes besoins
            <ArrowUpRight className="size-4" />
          </Button>
          <button
            type="button"
            className="inline-flex size-11 items-center justify-center rounded-md text-navy xl:hidden"
            aria-label={mobileNav ? "Fermer le menu" : "Ouvrir le menu"}
            aria-expanded={mobileNav}
            onClick={() => setMobileNav(!mobileNav)}
          >
            {mobileNav ? <X className="size-6" /> : <Menu className="size-6" />}
          </button>
        </div>
      </div>

      {mobileNav ? (
        <div className="fixed inset-0 top-[5.25rem] z-40 bg-navy-deep xl:hidden">
          <nav className="flex h-full flex-col gap-1 overflow-y-auto px-5 py-6">
            {LINKS.map((link) => (
              <a
                key={link.href}
                href={`#${link.href}`}
                onClick={(e) => {
                  e.preventDefault();
                  go(link.href);
                }}
                className="border-b border-paper/10 py-4 font-display text-2xl font-semibold text-paper"
              >
                {link.label}
              </a>
            ))}
            <Button
              className="mt-6 h-14 w-full"
              onClick={() => {
                if (location.pathname !== "/") {
                  setMobileNav(false);
                  void navigate({ to: "/", hash: "demande" });
                  return;
                }
                goToForm();
              }}
            >
              Identifier mes besoins
              <ArrowUpRight className="size-4" />
            </Button>
          </nav>
        </div>
      ) : null}
    </header>
  );
}
